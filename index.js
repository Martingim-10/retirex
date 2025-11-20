import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

function obtenerRendimientoPrevencion(edadActual, edadRetiro) {
  const horizonte = edadRetiro - edadActual;
  const r_base = 0.029;
  const ajuste_longevidad = (70 - edadRetiro) * 0.00015;
  const ajuste_horizonte = horizonte * 0.0002;
  return r_base + ajuste_longevidad + ajuste_horizonte;
}

function calcularCapital(aporte, meses, tasa) {
  let total = 0;
  for (let i = 1; i <= meses; i++) {
    const exponent = meses - i;
    total += aporte * Math.pow(1 + tasa, exponent);
  }
  return total;
}

app.post("/cotizar", (req, res) => {
  const { edad_actual, edad_retiro, aporte_mensual, moneda } = req.body;

  if (!edad_actual || !edad_retiro || !aporte_mensual) {
    return res.status(400).json({ error: "Faltan parámetros." });
  }

  let aporte = aporte_mensual;
  if (moneda === "pesos" && aporte < 30000) aporte = 30000;

  const meses = (edad_retiro - edad_actual) * 12;

  const r_oficial = obtenerRendimientoPrevencion(edad_actual, edad_retiro);
  const capital_oficial = calcularCapital(aporte, meses, r_oficial);

  const r_real_pesos = Math.pow(1 + 0.35, 1 / 12) - 1;
  const capital_real_pesos = calcularCapital(aporte, meses, r_real_pesos);

  let capital_real_usd = null;
  let r_real_usd = null;

  if (moneda === "usd") {
    r_real_usd = Math.pow(1 + 0.02, 1 / 12) - 1;
    capital_real_usd = calcularCapital(aporte, meses, r_real_usd);
  }

  return res.json({
    entrada: { edad_actual, edad_retiro, aporte_mensual: aporte, moneda },
    oficial: {
      tasa_mensual: r_oficial,
      capital: Math.round(capital_oficial),
    },
    real_pesos: {
      tasa_mensual: r_real_pesos,
      capital: Math.round(capital_real_pesos),
    },
    real_usd: capital_real_usd
      ? {
          tasa_mensual: r_real_usd,
          capital: Math.round(capital_real_usd),
        }
      : null,
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Retirex API lista en puerto", PORT));
