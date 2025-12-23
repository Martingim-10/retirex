const OpenAI = require("openai");
const cors = require('cors')({origin: true});
const express = require('express');
const app = express();

app.use(express.json());
app.use(cors); // Aplicar cors como middleware global

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Sos "Retirex IA", asesor de seguros de retiro. Garantía: 4% anual. Escenarios: 18% y 30%. Se breve y profesional.`;

// Ruta de prueba para Google (Health Check)
app.get('/', (req, res) => {
  res.status(200).send("Retirex Engine Ready ✅");
});

// Ruta de Cotización
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
    
    res.json({ 
      oficial: { capital: calcular(0.18) }, 
      realista: { capital: calcular(0.30) } 
    });
  } catch (e) {
    res.status(500).json({ error: "Error en cálculo" });
  }
});

// Ruta de IA
app.post('/ia', async (req, res) => {
  try {
    const { messages } = req.body;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (e) {
    res.status(500).json({ error: "Error IA" });
  }
});

// ESCUCHAR EL PUERTO (Vital para Cloud Run)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
