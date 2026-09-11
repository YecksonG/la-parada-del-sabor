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

export interface AbonoCreditoItem {
  raw_tag: string;
  monto_usd: number;
  metodo_abono: string;
  es_pago_total: boolean;
  desglose_mixto?: PagoFraccionItem[];
  fecha_hora?: string;
  referencia_notas?: string;
}

/**
 * Parsea los abonos de crédito registrados en notas_comanda
 * Formato del tag: [ABONO CRÉDITO: $X.XX USD vía METODO ... (EfUSD: $A, PMBs: Bs.B, ...) ...]
 */
export function parsearAbonosCreditoDeNotas(
  notas: string | null | undefined,
  tasaBcv: number
): AbonoCreditoItem[] {
  if (!notas) return [];
  const regex = /\[ABONO CRÉDITO:\s*\$([0-9.]+)\s+USD\s+vía\s+([A-Z_]+)([^\]]*)\]/gi;
  const abonos: AbonoCreditoItem[] = [];

  let match;
  while ((match = regex.exec(notas)) !== null) {
    const rawTag = match[0];
    const montoUsd = parseFloat(match[1]) || 0;
    const metodoAbono = match[2].toLowerCase().trim();
    const resto = match[3] || "";
    const esPagoTotal = resto.includes("SALDADA TOTALMENTE");

    // Extraer fecha/hora si existe al final del tag (- DD/MM/YYYY ...)
    const fechaMatch = resto.match(/-\s*([0-9/]+\s+[0-9:apm.\s]+)$/i);
    const fechaHora = fechaMatch ? fechaMatch[1].trim() : undefined;

    // Extraer referencia o notas (| Ref/Notas: ...)
    const refMatch = resto.match(/\|\s*Ref\/Notas:\s*([^-]+)/i);
    const referenciaNotas = refMatch ? refMatch[1].trim() : undefined;

    let desglose_mixto: PagoFraccionItem[] | undefined;
    if (metodoAbono === "pago_mixto") {
      // Extraer los sub-montos de los paréntesis si existen: (EfUSD: $2.00, PMBs: Bs.100.00, ...)
      const subMatch = resto.match(/\(([^)]+)\)/);
      if (subMatch) {
        const parts = subMatch[1].split(",");
        desglose_mixto = [];
        for (const p of parts) {
          const itemTrim = p.trim();
          if (itemTrim.startsWith("EfUSD:")) {
            const val = parseFloat(itemTrim.replace(/[^0-9.]/g, "")) || 0;
            if (val > 0) desglose_mixto.push({ metodo: "efectivo_usd", monto_usd: val, monto_bs: 0 });
          } else if (itemTrim.startsWith("PMBs:")) {
            const valBs = parseFloat(itemTrim.replace(/[^0-9.]/g, "")) || 0;
            const valUsd = tasaBcv > 0 ? Number((valBs / tasaBcv).toFixed(2)) : 0;
            if (valBs > 0) desglose_mixto.push({ metodo: "pago_movil", monto_usd: valUsd, monto_bs: valBs });
          } else if (itemTrim.startsWith("EfBs:")) {
            const valBs = parseFloat(itemTrim.replace(/[^0-9.]/g, "")) || 0;
            const valUsd = tasaBcv > 0 ? Number((valBs / tasaBcv).toFixed(2)) : 0;
            if (valBs > 0) desglose_mixto.push({ metodo: "efectivo_bs", monto_usd: valUsd, monto_bs: valBs });
          } else if (itemTrim.startsWith("TransfBs:")) {
            const valBs = parseFloat(itemTrim.replace(/[^0-9.]/g, "")) || 0;
            const valUsd = tasaBcv > 0 ? Number((valBs / tasaBcv).toFixed(2)) : 0;
            if (valBs > 0) desglose_mixto.push({ metodo: "transferencia", monto_usd: valUsd, monto_bs: valBs });
          } else if (itemTrim.startsWith("Binance:")) {
            const val = parseFloat(itemTrim.replace(/[^0-9.]/g, "")) || 0;
            if (val > 0) desglose_mixto.push({ metodo: "binance", monto_usd: val, monto_bs: 0 });
          } else if (itemTrim.startsWith("Zelle:")) {
            const val = parseFloat(itemTrim.replace(/[^0-9.]/g, "")) || 0;
            if (val > 0) desglose_mixto.push({ metodo: "zelle", monto_usd: val, monto_bs: 0 });
          }
        }
      }
    }

    abonos.push({
      raw_tag: rawTag,
      monto_usd: montoUsd,
      metodo_abono: metodoAbono,
      es_pago_total: esPagoTotal,
      desglose_mixto,
      fecha_hora: fechaHora,
      referencia_notas: referenciaNotas,
    });
  }

  return abonos;
}

/**
 * Elimina un tag específico de abono de notas_comanda limpiando separadores '•'
 */
export function eliminarTagAbonoDeNotas(notas: string | null | undefined, rawTag: string): string | null {
  if (!notas) return null;
  // Reemplazar la ocurrencia exacta de rawTag y limpiar viñetas
  let limpias = notas.replace(rawTag, "").trim();
  // Limpiar viñetas dobles o al inicio/final
  limpias = limpias
    .replace(/•\s*•+/g, "•")
    .replace(/^\s*•\s*/, "")
    .replace(/\s*•\s*$/, "")
    .trim();
  return limpias.length > 0 ? limpias : null;
}

/**
 * Limpia TODOS los tags de abono de notas_comanda
 */
export function limpiarTodosLosAbonosDeNotas(notas: string | null | undefined): string | null {
  if (!notas) return null;
  let limpias = notas.replace(/•?\s*\[ABONO CRÉDITO:[^\]]+\]/gi, "").trim();
  limpias = limpias
    .replace(/•\s*•+/g, "•")
    .replace(/^\s*•\s*/, "")
    .replace(/\s*•\s*$/, "")
    .trim();
  return limpias.length > 0 ? limpias : null;
}

/**
 * Calcula el saldo adeudado pendiente de una comanda a crédito,
 * restando de su total_usd todos los abonos previos registrados en notas_comanda.
 */
export function calcularSaldoPendienteComanda(
  venta: { total_usd?: number | string | null; notas_comanda?: string | null; tasa_bcv?: number | string | null },
  tasaBcv: number = 832
): { totalOriginalUsd: number; totalAbonadoUsd: number; saldoPendienteUsd: number } {
  const totalOriginalUsd = Number(venta.total_usd) || 0;
  const tasa = Number(venta.tasa_bcv) || tasaBcv || 1;
  const abonos = parsearAbonosCreditoDeNotas(venta.notas_comanda, tasa);
  const totalAbonadoUsd = abonos.reduce((acc, a) => acc + (Number(a.monto_usd) || 0), 0);
  const saldoPendienteUsd = Math.max(0, Number((totalOriginalUsd - totalAbonadoUsd).toFixed(2)));

  return {
    totalOriginalUsd,
    totalAbonadoUsd,
    saldoPendienteUsd,
  };
}

