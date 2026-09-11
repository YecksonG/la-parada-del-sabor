/**
 * Utilidades para Pago Mixto / Fraccionado en La Parada del Sabor
 * Permite desglosar y conciliar cobros multimoneda (USD y Bs)
 * garantizando compatibilidad 100% con BD existente y SQLite/Supabase.
 */

export type MetodoPagoFraccion =
  | "efectivo_usd"
  | "pago_movil"
  | "efectivo_bs"
  | "punto"
  | "transferencia"
  | "zelle"
  | "binance";

export interface PagoFraccionItem {
  metodo: MetodoPagoFraccion;
  monto_usd: number;
  monto_bs: number;
}

export const METODOS_FRACCION_INFO: Record<
  MetodoPagoFraccion,
  { label: string; icon: string; moneda: "USD" | "Bs"; esDigital?: boolean }
> = {
  efectivo_usd: { label: "Efectivo USD", icon: "💵", moneda: "USD" },
  pago_movil: { label: "Pago Móvil Bs", icon: "📱", moneda: "Bs", esDigital: true },
  efectivo_bs: { label: "Efectivo Bs", icon: "🇻🇪", moneda: "Bs" },
  punto: { label: "Punto de Venta Bs", icon: "💳", moneda: "Bs", esDigital: true },
  transferencia: { label: "Transferencia Bs", icon: "🏦", moneda: "Bs", esDigital: true },
  zelle: { label: "Zelle USD", icon: "🟣", moneda: "USD", esDigital: true },
  binance: { label: "Binance USDT", icon: "🟡", moneda: "USD", esDigital: true },
};

/**
 * Genera el tag legible para notas_comanda
 * Ej: [Pago Mixto: $2.00 Efectivo USD + $2.00 Pago Móvil (~Bs. 1.640,20)]
 */
export function generarTagPagoMixto(
  desglose: PagoFraccionItem[],
  tasaBcv: number
): string {
  const partes: string[] = [];

  for (const item of desglose) {
    if (item.monto_usd <= 0) continue;
    const info = METODOS_FRACCION_INFO[item.metodo] || {
      label: item.metodo,
      icon: "💳",
      moneda: "USD",
    };

    if (info.moneda === "Bs") {
      const bsVal =
        item.monto_bs > 0 ? item.monto_bs : Number((item.monto_usd * tasaBcv).toFixed(2));
      partes.push(
        `$${item.monto_usd.toFixed(2)} ${info.label} (~Bs. ${bsVal.toLocaleString("es-VE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })})`
      );
    } else {
      partes.push(`$${item.monto_usd.toFixed(2)} ${info.label}`);
    }
  }

  return `[Pago Mixto: ${partes.join(" + ")}]`;
}

/**
 * Parsea un tag de pago mixto de notas_comanda si existe
 */
export function parsearPagoMixtoDeNotas(
  notas: string | null | undefined,
  tasaBcv: number
): PagoFraccionItem[] | null {
  if (!notas) return null;
  const match = notas.match(/\[Pago Mixto:\s*([^\]]+)\]/i);
  if (!match) return null;

  const contenido = match[1];
  const segmentos = contenido.split(" + ");
  const resultado: PagoFraccionItem[] = [];

  for (const seg of segmentos) {
    const s = seg.trim();
    // Regex para capturar: $Monto Nombre (~Bs. MontoBs)
    const m = s.match(/^\$([0-9.]+)\s+([^(~]+)(?:\(~Bs\.\s*([0-9.,]+)\))?/i);
    if (!m) continue;

    const montoUsd = parseFloat(m[1]) || 0;
    const nombreMetodo = m[2].trim().toLowerCase();
    const rawBs = m[3] ? parseFloat(m[3].replace(/\./g, "").replace(",", ".")) : 0;

    let metodo: MetodoPagoFraccion = "efectivo_usd";
    if (nombreMetodo.includes("pago móvil") || nombreMetodo.includes("pago movil")) {
      metodo = "pago_movil";
    } else if (nombreMetodo.includes("efectivo bs")) {
      metodo = "efectivo_bs";
    } else if (nombreMetodo.includes("efectivo usd") || nombreMetodo.includes("efectivo")) {
      metodo = "efectivo_usd";
    } else if (nombreMetodo.includes("punto") || nombreMetodo.includes("tarjeta")) {
      metodo = "punto";
    } else if (nombreMetodo.includes("transferencia")) {
      metodo = "transferencia";
    } else if (nombreMetodo.includes("zelle")) {
      metodo = "zelle";
    } else if (nombreMetodo.includes("binance")) {
      metodo = "binance";
    }

    const montoBs =
      rawBs > 0
        ? rawBs
        : METODOS_FRACCION_INFO[metodo]?.moneda === "Bs"
        ? Number((montoUsd * tasaBcv).toFixed(2))
        : 0;

    resultado.push({
      metodo,
      monto_usd: montoUsd,
      monto_bs: montoBs,
    });
  }

  return resultado.length > 0 ? resultado : null;
}
