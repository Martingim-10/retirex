const OpenAI = require("openai");
const cors = require('cors')({origin: true});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Sos "Retirex IA", asesor de seguros de retiro. Garantía: 4% anual. Escenarios: 18% y 30%. Se breve y profesional.`;

exports.retirexapi = (req, res) => {
  return cors(req, res, async () => {
    if (req.method === 'GET') return res.send("Retirex Engine Ready ✅");

    const path = req.path;

    if (path === '/cotizar') {
      try {
        const { edad_actual, edad_retiro, aporte_mensual } = req.body;
        const n = (Number(edad_retiro) - Number(edad_actual)) * 12;
        const primaPura = (Number(aporte_mensual) / 1.006) * 0.90;
        const calcular = (t) => {
          const i = Math.pow(1 + t, 1/12) - 1;
          const rfu = (Math.pow(1 + i, n) * (1 - Math.pow(1 + i, -n))) / (1 - Math.pow(1 + i, -1));
          return Math.round(primaPura * rfu);
        };
        return res.json({ oficial: { capital: calcular(0.18) }, realista: { capital: calcular(0.30) } });
      } catch (e) { return res.status(500).send("Error"); }
    }

    if (path === '/ia') {
      try {
        const { messages } = req.body;
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        });
        return res.json({ reply: completion.choices[0].message.content });
      } catch (e) { return res.status(500).send("Error IA"); }
    }
  });
};
