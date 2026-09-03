"use client";

/**
 * Utilidades de fecha centradas en el huso horario de Venezuela (UTC-4).
 * Todos los filtros de "hoy" del sistema usan America/Caracas para que
 * "hoy" signifique el día en Venezuela, independientemente del timezone
 * del navegador del usuario (importante para pedidos web/dashboard).
 */

interface FechaCaracas {
  anio: string;
  mes: string;
  dia: string;
}

/** Fecha sentinela que nunca coincide con "hoy" (evita RangeError en Invalid Date). */
const FECHA_INVALIDA: FechaCaracas = { anio: "1970", mes: "01", dia: "01" };

function toFechaCaracas(fecha: string | Date): FechaCaracas {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  // Hardening defensivo: una fecha inválida lanzaría RangeError en Intl.format.
  if (isNaN(d.getTime())) return FECHA_INVALIDA;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .split("-");

  return { anio: partes[0], mes: partes[1], dia: partes[2] };
}

/** Devuelve la fecha de HOY en Caracas como { anio, mes, dia }. */
export function fechaHoyEnCaracas(): FechaCaracas {
  return toFechaCaracas(new Date());
}

/**
 * Compara si una venta/fecha coincide con la fecha de hoy en Caracas.
 * @param fechaISO Fecha (ISO string o Date) de la venta a evaluar.
 * @param ref Fecha de referencia opcional (por defecto, hoy en Caracas).
 */
export function esMismaFechaEnCaracas(
  fechaISO: string | Date,
  ref?: { anio: string; mes: string; dia: string }
): boolean {
  const fechaVenta = toFechaCaracas(fechaISO);
  const referencia = ref ?? fechaHoyEnCaracas();
  return (
    fechaVenta.anio === referencia.anio &&
    fechaVenta.mes === referencia.mes &&
    fechaVenta.dia === referencia.dia
  );
}

/** Devuelve la fecha en formato YYYY-MM-DD en hora de Caracas. */
export function toFechaCaracasString(fecha: string | Date): string {
  const f = toFechaCaracas(fecha);
  return `${f.anio}-${f.mes}-${f.dia}`;
}