const OpenAI = require("openai");
const cors = require('cors')({origin: true});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Sos "Retirex IA", asesor de seguros de retiro. Garantía: 4% anual. Escenarios: 18% y 30%. El aporte mínimo obligatorio es $40.000. Sé breve.`;

exports.retirexapi = (req, res) => {
  return cors(req, res, async () => {
    
    if (req.method === 'GET') return res.status(200).send("Retirex Engine Ready ✅");

    const path = req.path;

    if (path === '/cotizar') {
      try {
        const { edad_actual, edad_retiro, aporte_mensual } = req.body;
        const monto = Number(aporte_mensual);

        // BLOQUEO ESTRICTO: Si es menor a 40.000, no calcula nada.
        if (monto < 40000) {
          return res.status(400).json({ 
            status: "error", 
            message: "La compañía ha actualizado el aporte mínimo a $40.000. Por favor, ingresa un monto igual o superior." 
          });
        }

        const n = (Number(edad_retiro) - Number(edad_actual)) * 12;
        const primaPura = (monto / 1.006) * 0.90;
        
        const calcular = (t) => {
          const i = Math.pow(1 + t, 1/12) - 1;
          const rfu = (Math.pow(1 + i, n) * (1 - Math.pow(1 + i, -n))) / (1 - Math.pow(1 + i, -1));
          return Math.round(primaPura * rfu);
        };

        return res.json({ 
          status: "success",
          oficial: { capital: calcular(0.18) }, 
          realista: { capital: calcular(0.30) } 
        });

      } catch (e) {
        return res.status(500).json({ status: "error", message: "Error en el cálculo" });
      }
    }

    if (path === '/ia') {
      try {
        const { messages } = req.body;
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          max_tokens: 150
        });
        return res.json({ status: "success", reply: completion.choices[0].message.content });
      } catch (e) {
        return res.status(500).json({ status: "error" });
      }
    }
  });
};
