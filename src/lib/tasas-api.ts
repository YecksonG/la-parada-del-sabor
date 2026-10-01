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

import type { TasaCambio } from "@/types/database";

/**
 * Busca en una lista de tasas_cambio la tasa correspondiente a una fecha (YYYY-MM-DD).
 * Si no existe tasa exacta para ese día (ej. fin de semana o feriado), toma la tasa más reciente anterior o igual a esa fecha.
 */
export function buscarTasaPorFecha(fecha: string, listaTasas: TasaCambio[]): TasaCambio | null {
  if (!fecha || !listaTasas || listaTasas.length === 0) return null;
  const fechaLimpia = fecha.split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaLimpia)) return null;


  // 1. Coincidencia exacta
  const exacta = listaTasas.find((t) => t.fecha === fechaLimpia);
  if (exacta) return exacta;

  // 2. Tasa más reciente anterior o igual a la fecha solicitada
  const anteriores = listaTasas
    .filter((t) => t.fecha <= fechaLimpia)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (anteriores.length > 0) return anteriores[0];

  // 3. Si la fecha es anterior a todo nuestro registro, devolver la más antigua disponible
  const masAntigua = [...listaTasas].sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  return masAntigua || null;
}

