import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { google } from "googleapis";

const app = express();
app.use(cors());
app.use(express.json());

// =======================
//  CONFIGURACIÓN OPENAI
// =======================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // setear en Render
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

Contexto:
- La compañía con la que trabajás es Prevención Retiro, del Grupo Sancor Seguros, en Argentina.
- El productor es un productor matriculado y autorizado para operar estos planes.

Sobre simulación:
- El cálculo numérico lo hace la API de Retirex.
- Vos no inventás números; comentás los resultados.

Sobre rescates y cambios:
- Se puede rescatar, pero con ajustes.
- Se pueden cambiar aportes.
- No inventes porcentajes ni plazos exactos.

Tono:
- Cercano, didáctico, simple.
- Ayudar > vender.
`;

// =======================
//  LÓGICA FINANCIERA
// =======================
function capitalizacionMensual(aporte, meses, tasaMensual) {
  return aporte * ((Math.pow(1 + tasaMensual, meses) - 1) / tasaMensual);
}

// =======================
//  ENDPOINT COTIZADOR
// =======================
app.post("/cotizar", (req, res) => {
  try {
    const { edad_actual, edad_retiro, aporte_mensual, moneda } = req.body;

    const meses = (edad_retiro - edad_actual) * 12;

    if (!edad_actual || !edad_retiro || !aporte_mensual || meses <= 0 || aporte_mensual <= 0) {
      return res.status(400).json({ error: "Datos inválidos para la simulación" });
    }

    // Tasas internas
    const tasa_oficial = 0.013;
    const tasa_real_pesos = Math.pow(1 + 0.35, 1 / 12) - 1;
    const tasa_real_usd = Math.pow(1 + 0.02, 1 / 12) - 1;

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
//  ENDPOINT IA
// =======================
app.post("/ia", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Faltan mensajes para el chat" });
    }

    const completion = await openai.responses.create({
      model: "gpt-4o",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
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

// =======================
//  RESPUESTAS DESDE GOOGLE SHEETS
// =======================

// Cargar credenciales de variable de entorno
const sheetsCredentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);

const auth = new google.auth.GoogleAuth({
  credentials: sheetsCredentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
});

const sheets = google.sheets({ version: "v4", auth });

// ID del Sheet de Respuestas Retirex
const SPREADSHEET_ID = "1xie-u86pV1cP4l0WqW1H7AZ-yc98lTFOq3-4ZoCI1Vc";

app.get("/respuestas", async (req, res) => {
  try {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Retiros!A:C" // keyword | respuesta | tag
    });

    const rows = resp.data.values;

    if (!rows || rows.length < 2) {
      return res.status(500).json({ error: "Hoja vacía o sin datos" });
    }

    const respuestas = {};

    for (let i = 1; i < rows.length; i++) {
      const [keyword, respuesta, tag] = rows[i];
      if (!keyword || !respuesta) continue;

      respuestas[keyword.trim().toLowerCase()] = {
        respuesta,
        tag: tag || null
      };
    }

    return res.json(respuestas);

  } catch (error) {
    console.error("Error leyendo Google Sheets:", error);
    return res.status(500).json({ error: "No se pudo leer el Sheet" });
  }
});

// =======================
//  ENDPOINT TEST
// =======================
app.get("/", (req, res) => {
  res.send("Retirex API + IA funcionando ✅");
});

// =======================
//  SERVIDOR
// =======================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Retirex API escuchando en puerto ${PORT}`);
});
