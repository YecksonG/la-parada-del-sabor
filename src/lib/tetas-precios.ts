/**
 * Regla de Precios Oficial "Tetas Cream":
 * - 1 unidad individual = $0.80 USD
 * - Pack Promo 2 unidades = $1.50 USD
 * - Pares subsiguientes gozan del descuento de la promo (ej. 3 = $2.30, 4 = $3.00).
 */
export function calcularTotalTetasUsd(cantidad: number, precioUnitarioBase: number = 0.80): number {
  if (cantidad <= 0) return 0;
  if (Math.abs(precioUnitarioBase - 0.80) > 0.01) {
    return Number((cantidad * precioUnitarioBase).toFixed(2));
  }
  const pares = Math.floor(cantidad / 2);
  const sueltas = cantidad % 2;
  const total = (pares * 1.50) + (sueltas * 0.80);
  return Number(total.toFixed(2));
}

export { CATEGORIAS_TETAS } from "@/types/database";
