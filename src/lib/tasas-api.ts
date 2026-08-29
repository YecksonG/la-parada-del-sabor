export type TasasDelDia = {
  bcv: number;
  usdt: number;
  eur: number;
  promedio: number;
  fecha: string;
};

function validarNumero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function obtenerJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function obtenerTasasDelDia(): Promise<TasasDelDia | null> {
  const [bcvToday, dolarFlow] = await Promise.all([
    obtenerJson("https://bcv.today/api/v1/rate.json"),
    obtenerJson("https://dolarflow.com/api/paralelo/"),
  ]);

  const bcv = validarNumero(bcvToday?.USD);
  const eur = validarNumero(bcvToday?.EUR);
  const usdt = validarNumero(dolarFlow?.precio);

  if (bcv === 0 && usdt === 0) return null;

  const promedio = bcv > 0 && usdt > 0 ? Number(((bcv + usdt) / 2).toFixed(2)) : (usdt || bcv);

  const fechaStr =
    typeof bcvToday?.date === "string"
      ? bcvToday.date
      : new Date().toLocaleDateString("en-CA");

  return { bcv, usdt, eur, promedio, fecha: fechaStr };
}
