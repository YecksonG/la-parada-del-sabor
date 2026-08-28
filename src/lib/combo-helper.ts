import { Producto } from "@/types/database";

export interface SaborArepa {
  id: string;
  nombre: string;
  desc: string;
  icono: string;
}

export const SABORES_AREPAS_COMBO: SaborArepa[] = [
  { id: "reina_pepiada", nombre: "Reina Pepiada", desc: "Pollo con aguacate y mayonesa", icono: "🥑" },
  { id: "pelua", nombre: "Pelúa", desc: "Carne mechada + Queso amarillo", icono: "🧀" },
  { id: "catira", nombre: "Catira", desc: "Pollo mechado + Queso amarillo", icono: "🍗" },
  { id: "sifrina", nombre: "Sifrina", desc: "Reina pepiada + Queso amarillo", icono: "👑" },
  { id: "queso_amarillo", nombre: "Queso Amarillo", desc: "Queso amarillo rallado", icono: "🧀" },
  { id: "queso_blanco", nombre: "Queso Blanco", desc: "Queso blanco de res", icono: "🫓" },
  { id: "carne_mechada", nombre: "Carne Mechada", desc: "Guiso criollo de carne mechada", icono: "🥩" },
  { id: "pollo_mechado", nombre: "Pollo Mechado", desc: "Guiso criollo de pechuga", icono: "🍲" },
];

/**
 * Determina cuántas arepas contiene un combo dado su nombre o descripción.
 * Retorna null si no es un combo de arepas.
 */
export function getComboArepasCount(prod: Producto): number | null {
  const nombre = prod.nombre.toLowerCase();
  if (nombre.includes("10 arep") || nombre.includes("combo 10") || nombre.includes("familiar 10")) return 10;
  if (nombre.includes("6 arep") || nombre.includes("combo 6")) return 6;
  if (nombre.includes("2 arep") || nombre.includes("combo 2")) return 2;
  return null;
}

/**
 * Serializa la selección de sabores en un formato legible para tickets y cocina.
 * Ej: "Sabores: 3x Pelúa, 3x Catira" o "Sabores: 2x Reina Pepiada (Nota: Sin mayonesa)"
 */
export function serializarSaboresCombo(
  saboresSeleccionados: Record<string, number>,
  notaAdicional?: string
): string {
  const lineas: string[] = [];
  
  for (const sabor of SABORES_AREPAS_COMBO) {
    const cant = saboresSeleccionados[sabor.id] || 0;
    if (cant > 0) {
      lineas.push(`${cant}x ${sabor.nombre}`);
    }
  }

  let res = `Sabores: ${lineas.join(", ")}`;
  if (notaAdicional?.trim()) {
    res += ` — Obs: ${notaAdicional.trim()}`;
  }
  return res;
}
