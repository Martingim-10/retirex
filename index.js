const express = require('express');
const cors = require('cors');
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Sos "Retirex IA", asesor de seguros de retiro. Garantía: 4% anual. Escenarios: 18% y 30%. Se breve y profesional.`;

// 1. Ruta de salud (Vital para que Google vea que el puerto responde)
app.get('/', (req, res) => {
  res.status(200).send("Retirex Engine Ready ✅");
});

// 2. Ruta de Cotización
app.post('/cotizar', async (req, res) => {
  try {
    const { edad_actual, edad_retiro, aporte_mensual } = req.body;
    const n = (Number(edad_retiro) - Number(edad_actual)) * 12;
    const primaPura = (Number(aporte_mensual) / 1.006) * 0.90;
    const calcular = (t) => {
      const i = Math.pow(1 + t, 1/12) - 1;
      const rfu = (Math.pow(1 + i, n) * (1 - Math.pow(1 + i, -n))) / (1 - Math.pow(1 + i, -1));
      return Math.round(primaPura * rfu);
    };
    res.json({ oficial: { capital: calcular(0.18) }, realista: { capital: calcular(0.30) } });
  } catch (e) { res.status(500).send("Error"); }
});

// 3. Ruta de IA
app.post('/ia', async (req, res) => {
  try {
    const { messages } = req.body;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (e) { res.status(500).send("Error IA"); }
});

// 4. EL ARRANQUE DEL PUERTO (Esto quita el error de Google)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
