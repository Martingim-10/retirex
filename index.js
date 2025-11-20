import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

// =======================
//  CONFIGURACIÓN OPENAI
// =======================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // la vas a setear en Render
});

// Prompt maestro del agente Retirex IA
const SYSTEM_PROMPT = `
Sos "Retirex IA", un asesor inteligente especializado en seguros de retiro en Argentina.
Tu tarea es:
- Explicar con lenguaje claro y humano cómo funciona un seguro de retiro, en especial los planes de Prevención Retiro.
- Ayudar a las personas a entender cuánto pueden acumular aportando mes a mes.
- Comparar SIEMPRE:
  * Escenario oficial Prevención (más conservador).
  * Escenario realista en pesos (35% anual estimado).
  * Escenario en dólares (2% anual estimado), cuando sea relevante.
- Nunca muestres tasas, fórmulas, ni porcentajes técnicos al usuario. Solo hablá de montos, plazos y conceptos.
- No des datos específicos de reglamentos internos de la compañía que no conozcas con certeza. Usá frases del tipo:
  "En general...", "La compañía establece condiciones específicas en el contrato..." y sugerí siempre revisar con el productor.

Contexto:
- La compañía con la que trabajás es Prevención Retiro, del Grupo Sancor Seguros, en Argentina.
- El productor que te "maneja" es un productor de seguros matriculado y autorizado para operar estos planes.
- No hagas alarde, pero cuando tenga sentido podés decir:
  "Trabajo junto a un productor de seguros autorizado para operar Prevención Retiro en Argentina".

Sobre la simulación:
- El cálculo numérico LO HACE un servicio aparte (la API de Retirex).
- Vos no inventás números desde tu cabeza: si el usuario ya hizo la simulación, comentás y explicás los resultados.
- Si el usuario aún no simuló, pedile:
  * Edad actual.
  * Edad a la que le gustaría retirarse.
  * Aporte mensual aproximado.
- Podés decirle algo como:
  "Con esos datos puedo preparar una simulación estimada para que veas la diferencia entre el escenario oficial y uno más realista".

Sobre rescates y cambios:
- Explicá que normalmente:
  * Puede existir rescate anticipado, pero con penalidades/descuentos.
  * Se pueden hacer cambios de aporte con el tiempo (subir o bajar).
- NO inventes porcentajes de penalidad ni plazos exactos.
- Siempre sugerí:
  "Los detalles precisos figuran en el reglamento y en la póliza, y se revisan caso por caso".

Tono:
- Cercano, sin ser invasivo.
- Didáctico, simple, concreto.
- Sin lenguaje "vendedor agresivo".
- Pensá en ayudar, no en cerrar una venta inmediata.

Contacto:
- Antes de pedir datos al usuario, ofrecé siempre los datos del productor:
  "Si querés hablar con alguien real para ver tu caso puntual, te dejo mis datos y después, si querés, me compartís los tuyos."
- No inventes teléfonos ni mails; el frontend se encargará de mostrarlos.

Si el usuario hace preguntas generales (qué es, cómo funciona, ventajas, riesgos, inflación, jubilación estatal vs privada, etc.), respondé con claridad.
Si el usuario pide una simulación concreta, pedile los datos necesarios de forma amigable.
`;

// =======================
//  LÓGICA FINANCIERA
// =======================

function capitalizacionMensual(aporte, meses, tasaMensual) {
  // FV = aporte * [ ((1+t)^n - 1) / t ]
  return aporte * ((Math.pow(1 + tasaMensual, meses) - 1) / tasaMensual);
}

// Endpoint de simulación de retiro
app.post("/cotizar", (req, res) => {
  try {
    const { edad_actual, edad_retiro, aporte_mensual, moneda } = req.body;

    const meses = (edad_retiro - edad_actual) * 12;

    if (!edad_actual || !edad_retiro || !aporte_mensual || meses <= 0 || aporte_mensual <= 0) {
      return res.status(400).json({ error: "Datos inválidos para la simulación" });
    }

    // Tasas (no se muestran al usuario, son internas)
    const tasa_oficial = 0.013; // ~1,3% mensual, más conservador
    const tasa_real_pesos = Math.pow(1 + 0.35, 1 / 12) - 1; // ~35% anual en pesos
    const tasa_real_usd = Math.pow(1 + 0.02, 1 / 12) - 1;   // ~2% anual en USD

    const capital_oficial = capitalizacionMensual(aporte_mensual, meses, tasa_oficial);
    const capital_real_pesos = capitalizacionMensual(aporte_mensual, meses, tasa_real_pesos);
    const capital_real_usd =
      moneda === "usd" ? capitalizacionMensual(aporte_mensual, meses, tasa_real_usd) : null;

    return res.json({
      entrada: {
        edad_actual,
        edad_retiro,
        aporte_mensual,
        moneda,
      },
      oficial: {
        capital: Math.round(capital_oficial),
      },
      real_pesos: {
        capital: Math.round(capital_real_pesos),
      },
      real_usd: capital_real_usd ? Math.round(capital_real_usd) : null,
    });
  } catch (e) {
    console.error("Error en /cotizar:", e);
    return res.status(500).json({ error: "Error interno en la simulación" });
  }
});

// =======================
//  ENDPOINT DEL AGENTE IA
// =======================
//
// Espera un body { messages: [ { role: "user"|"assistant", content: "..." }, ... ] }
// El frontend se encarga de ir mandando el historial de chat.
// Devuelve { reply: "texto del asistente" }

app.post("/ia", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Faltan mensajes para el chat" });
    }

  const completion = await openai.responses.create({
  model: "gpt-4o",
  input: [
    {
      role: "system",
      content: SYSTEM_PROMPT
    },
    ...messages
  ]
});

const reply = completion.output_text;

return res.json({ reply });

  } catch (e) {
    console.error("Error en /ia:", e);
    return res.status(500).json({ error: "Error interno en el agente IA" });
  }
});

// Endpoint simple para verificar que la API vive
app.get("/", (req, res) => {
  res.send("Retirex API + IA funcionando ✅");
});

// Levantar servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Retirex API escuchando en puerto ${PORT}`);
});
