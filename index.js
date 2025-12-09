import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

/* ======================================================
   CONFIGURACIÓN OPENAI
====================================================== */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
Sos "Retirex IA", un asesor inteligente especializado en seguros de retiro en Argentina.
Tu tarea es:
- Explicar con lenguaje claro cómo funciona un seguro de retiro.
- Ayudar a entender cuánto puede acumular una persona según su simulación.
- Comparar SIEMPRE escenarios:
  * Oficial Prevención (conservador).
  * Realista pesos (30% anual estimado).
- No mostrar tasas, solo montos y diferencias.
- No inventar datos regulatorios específicos.
- Tono amable, didáctico, profesional.
- Remitir al productor cuando se necesite revisión humana.
`;

/* ======================================================
   LÓGICA FINANCIERA
====================================================== */
function capitalizacionMensual(aporte, meses, tasaMensual) {
  // FV = aporte * [ ((1+t)^n - 1) / t ]
  return aporte * ((Math.pow(1 + tasaMensual, meses) - 1) / tasaMensual);
}

/* ======================================================
 /* ======================================================
   ENDPOINT SIMULACIÓN /cotizar (NUEVO – LÓGICA REAL)
====================================================== */
app.post("/cotizar", (req, res) => {
  try {
    const { edad_actual, edad_retiro, aporte_mensual, sexo } = req.body;

    const aporte = Number(aporte_mensual);
    const meses = (edad_retiro - edad_actual) * 12;

    if (meses <= 0 || aporte <= 0) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    /* ===============================================
       CÁLCULOS ACTUARIALES (exactos al Excel oficial)
    =============================================== */

    // Prima de tarifa y prima pura normal (ARS)
    const primaTarifa = aporte / 1.006;
    const primaPura = primaTarifa * 0.90; // -10% gastos

    // Tasas anuales
    const tasaRealistaAnual = 0.30; // 30%
    const tasaOficialAnual  = 0.18; // 18%

    // Tasas mensuales equivalentes
    const tasaRealistaMensual = Math.pow(1 + tasaRealistaAnual, 1/12) - 1;
    const tasaOficialMensual  = Math.pow(1 + tasaOficialAnual, 1/12) - 1;

    // RFU
    function rfu(tasa, n) {
      return (
        (Math.pow(1 + tasa, n) * (1 - Math.pow(1 + tasa, -n))) /
        (1 - Math.pow(1 + tasa, -1))
      );
    }

    const RFU_realista = rfu(tasaRealistaMensual, meses);
    const RFU_oficial  = rfu(tasaOficialMensual, meses);

    const capital_realista = primaPura * RFU_realista;
    const capital_oficial  = primaPura * RFU_oficial;

    /* ===============================================
       RESPUESTA
    =============================================== */
    res.json({
      entrada: { edad_actual, edad_retiro, aporte_mensual, sexo },
      oficial: {
        capital: Math.round(capital_oficial)
      },
      realista: {
        capital: Math.round(capital_realista)
      }
    });

  } catch (e) {
    console.error("Error en /cotizar:", e);
    return res.status(500).json({ error: "Error interno" });
  }
});

/* ======================================================
   ENDPOINT IA /ia
====================================================== */
/* ======================================================
   ENDPOINT IA /ia
====================================================== */
import axios from "axios";

app.post("/ia", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Faltan mensajes" });
    }

    // Último mensaje del usuario
    const ultimaEntrada = messages[messages.length - 1].content;

    // 1. Consultar respuestas fijas en la hoja (endpoint /respuestas)
    try {
      const respuestaLocal = await axios.post("http://localhost:10000/respuestas", {
        mensaje: ultimaEntrada,
      });

      if (respuestaLocal.data && respuestaLocal.data.respuesta) {
        // Si hay respuesta fija → devolverla directamente
        return res.json({ reply: respuestaLocal.data.respuesta });
      }
    } catch (err) {
      console.error("Error consultando respuestas fijas:", err);
      // Si falla la consulta, seguimos con OpenAI como fallback
    }

    // 2. Fallback a OpenAI si no hay respuesta fija
    const completion = await openai.responses.create({
      model: "gpt-4o",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
    });

    const reply = completion.output_text;
    return res.json({ reply });

  } catch (e) {
    console.error("Error en /ia:", e);
    return res.status(500).json({ error: "Error interno" });
  }
});


 /* ======================================================
   ENDPOINT RESPUESTAS – vía Apps Script
====================================================== */

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwKf_4QUYUa5bvToa4xJsx1r6VzOD5ngbp1zgLlw_uOaaw6CWGO12yJU7agSVSlBhng/exec";

app.post("/respuestas", async (req, res) => {
  try {
    const respuesta = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await respuesta.json();
    return res.json(data);

  } catch (e) {
    console.error("Error consultando respuestas:", e);
    return res
      .status(500)
      .json({ ok: false, error: "No se pudo consultar las respuestas" });
  }
});

/* ======================================================
   ENDPOINT TEST /
====================================================== */
app.get("/", (req, res) => {
  res.send("Retirex API + IA funcionando ✅");
});

/* ======================================================
   LEVANTAR SERVIDOR
====================================================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Retirex API escuchando en puerto ${PORT}`);
});
