import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { google } from "googleapis";

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
  * Realista pesos (35% anual estimado).
- No mostrar tasas, solo montos y diferencias.
- No inventar datos regulatorios específicos.
- Tono amable, didáctico, profesional.
- Remitir al productor cuando se necesite revisión humana.
`;

/* ======================================================
   GOOGLE SHEETS – CONFIG
====================================================== */
const sheetsClient = new google.auth.JWT({
  email: process.env.GS_CLIENT_EMAIL,
  key: process.env.GS_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SHEET_ID = "1xie-u86pV1cP4l0WqW1H7AZ-yc98lTFOq3-4ZoCI1Vc";  
const TAB_NAME = "Leads Retiro";

/* ======================================================
   FUNCIÓN PARA GUARDAR EN SHEETS
====================================================== */
async function guardarEnSheet(data) {
  try {
    const sheets = google.sheets({ version: "v4", auth: sheetsClient });

    const fila = [
      new Date().toLocaleString("es-AR"),
      data.edad_actual,
      data.edad_retiro,
      data.aporte_mensual,
      data.capital_oficial,
      data.capital_realista,
      "Chat Retirex Web"
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TAB_NAME}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [fila] },
    });

    console.log("Lead guardado en Sheets");
    return true;
  } catch (err) {
    console.error("Error guardando lead:", err);
    return false;
  }
}

/* ======================================================
   FUNCIÓN FINANCIERA
====================================================== */
function capitalizacionMensual(aporte, meses, tasaMensual) {
  return aporte * ((Math.pow(1 + tasaMensual, meses) - 1) / tasaMensual);
}

/* ======================================================
   ENDPOINT SIMULACIÓN
====================================================== */
app.post("/cotizar", (req, res) => {
  try {
    const { edad_actual, edad_retiro, aporte_mensual, moneda } = req.body;

    const meses = (edad_retiro - edad_actual) * 12;

    if (!edad_actual || !edad_retiro || !aporte_mensual || meses <= 0 || aporte_mensual <= 0) {
      return res.status(400).json({ error: "Datos inválidos para la simulación" });
    }

    const tasa_oficial = 0.013;
    const tasa_real_pesos = Math.pow(1 + 0.35, 1 / 12) - 1;
    const tasa_real_usd = Math.pow(1 + 0.02, 1 / 12) - 1;

    const capital_oficial = capitalizacionMensual(aporte_mensual, meses, tasa_oficial);
    const capital_real_pesos = capitalizacionMensual(aporte_mensual, meses, tasa_real_pesos);
    const capital_real_usd =
      moneda === "usd" ? capitalizacionMensual(aporte_mensual, meses, tasa_real_usd) : null;

    return res.json({
      entrada: { edad_actual, edad_retiro, aporte_mensual, moneda },
      oficial: { capital: Math.round(capital_oficial) },
      real_pesos: { capital: Math.round(capital_real_pesos) },
      real_usd: capital_real_usd ? Math.round(capital_real_usd) : null,
    });
  } catch (e) {
    console.error("Error en /cotizar:", e);
    return res.status(500).json({ error: "Error interno" });
  }
});

/* ======================================================
   ENDPOINT GUARDAR LEAD
====================================================== */
app.post("/guardar-lead", async (req, res) => {
  try {
    const ok = await guardarEnSheet(req.body);
    if (ok) return res.json({ status: "ok" });
    return res.status(500).json({ error: "No se pudo guardar el lead" });
  } catch (e) {
    console.error("Error /guardar-lead:", e);
    return res.status(500).json({ error: "Error interno" });
  }
});

/* ======================================================
   ENDPOINT IA
====================================================== */
app.post("/ia", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Faltan mensajes" });
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
    return res.status(500).json({ error: "Error interno" });
  }
});

/* ======================================================
   ENDPOINT TEST
====================================================== */
app.get("/", (req, res) => {
  res.send("Retirex API + IA funcionando ✅");
});
// =======================
// GUARDAR LEAD EN SHEETS
// =======================

app.post("/guardar-lead", async (req, res) => {
  try {
    const url = https://script.google.com/macros/s/AKfycbwKf_4QUYUa5bvToa4xJsx1r6VzOD5ngbp1zgLlw_uOaaw6CWGO12yJU7agSVSlBhng/exec; // <-- reemplazar acá

    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await respuesta.json();

    return res.json(data);

  } catch (e) {
    console.error("Error guardando lead:", e);
    return res.status(500).json({ ok: false, error: "No se pudo guardar" });
  }
});

/* ======================================================
   LEVANTAR SERVIDOR
====================================================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Retirex API escuchando en puerto ${PORT}`);
});
