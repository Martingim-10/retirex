import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Fórmula de interés compuesto mensual
function capitalizacionMensual(aporte, meses, tasaMensual) {
  // fórmula: FV = aporte * [ ((1+t)^n - 1) / t ]
  return aporte * ((Math.pow(1 + tasaMensual, meses) - 1) / tasaMensual);
}

app.post("/cotizar", (req, res) => {
  try {
    const { edad_actual, edad_retiro, aporte_mensual, moneda } = req.body;

    const meses = (edad_retiro - edad_actual) * 12;

    if (meses <= 0 || aporte_mensual <= 0) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    // === TASAS CORRECTAS ===
    const tasa_oficial = 0.013; // 1.3% mensual
    const tasa_real_pesos = Math.pow(1 + 0.35, 1 / 12) - 1; // conv 35% anual → ~2.53% mensual
    const tasa_real_usd = Math.pow(1 + 0.02, 1 / 12) - 1; // conv 2% anual → ~0.165% mensual

    // === CÁLCULOS ===
    const capital_oficial = capitalizacionMensual(aporte_mensual, meses, tasa_oficial);
    const capital_real_pesos = capitalizacionMensual(aporte_mensual, meses, tasa_real_pesos);
    const capital_real_usd = moneda === "usd"
      ? capitalizacionMensual(aporte_mensual, meses, tasa_real_usd)
      : null;

    // === RESPUESTA SIN TASAS ===
    return res.json({
      entrada: {
        edad_actual,
        edad_retiro,
        aporte_mensual,
        moneda
      },
      oficial: {
        capital: Math.round(capital_oficial)
      },
      real_pesos: {
        capital: Math.round(capital_real_pesos)
      },
      real_usd: capital_real_usd ? Math.round(capital_real_usd) : null
    });

  } catch (e) {
    return res.status(500).json({ error: "Error interno", detalle: e.message });
  }
});

app.listen(10000, () => {
  console.log("Retirex API lista en puerto 10000");
});
