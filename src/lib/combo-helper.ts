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
  { id: "jamon_queso", nombre: "Jamón y Queso", desc: "Jamón de pavo + Queso amarillo", icono: "🥓" },
  { id: "sifrina", nombre: "Sifrina", desc: "Reina pepiada + Queso amarillo", icono: "👑" },
  { id: "queso_amarillo", nombre: "Queso Amarillo", desc: "Queso amarillo rallado", icono: "🧀" },
  { id: "queso_blanco", nombre: "Queso Blanco", desc: "Queso blanco de res", icono: "🫓" },
  { id: "carne_mechada", nombre: "Carne Mechada", desc: "Guiso criollo de carne mechada", icono: "🥩" },
  { id: "pollo_mechado", nombre: "Pollo Mechado", desc: "Guiso criollo de pechuga", icono: "🍲" },
];

/**
 * Determina cuántas arepas contiene un combo dado su nombre o descripción usando límites de palabra precisos.
 * Retorna null si no es un combo de arepas.
 */
export function getComboArepasCount(prod: Producto): number | null {
  const nombre = prod.nombre.toLowerCase();
  if (/\b10\s*arep/i.test(nombre) || /\bcombo\s*10\b/i.test(nombre) || /\bfamiliar\s*10\b/i.test(nombre)) return 10;
  if (/\b6\s*arep/i.test(nombre) || /\bcombo\s*6\b/i.test(nombre)) return 6;
  if (/\b4\s*arep/i.test(nombre) || /\bcombo\s*4\b/i.test(nombre) || /\bcompartir\b/i.test(nombre)) return 4;
  if (/\b2\s*arep/i.test(nombre) || /\bcombo\s*2\b/i.test(nombre) || /\bpersonal\b/i.test(nombre)) return 2;
  return null;
}

/**
 * Resuelve la imagen autoritativa para un producto o combo.
 */
export function getProductImage(prod: { nombre: string; imagen_url?: string | null }): string | null {
  if (
    prod.imagen_url &&
    prod.imagen_url.trim() &&
    !prod.imagen_url.includes("menu-arepas.png") &&
    !prod.imagen_url.includes("combo-arepas.png")
  ) {
    return prod.imagen_url;
  }
  const norm = prod.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Arepas individuales
  if (norm.includes("catira")) return "/images/arepas/arepa-catira.jpg";
  if (norm.includes("especial") && norm.includes("pollo")) return "/images/arepas/arepa-especial-pollo.jpg";
  if (norm.includes("reina") || norm.includes("pepiada")) return "/images/arepas/arepa-reina-pepiada.jpg";
  if (norm.includes("jamon") && norm.includes("queso")) return "/images/arepas/arepa-jamon-queso.jpg";
  if (norm.includes("especial") && (norm.includes("carne") || norm.includes("esmechada"))) return "/images/arepas/arepa-especial-carne.jpg";
  if (norm.includes("pelua")) return "/images/arepas/arepa-pelua.jpg";
  
  // Combos oficiales (2, 4, 10 arepas)
  if (norm.includes("combo") && (norm.includes("2") || norm.includes("personal"))) return "/images/combos/combo-2-arepas.jpg";
  if (norm.includes("combo") && (norm.includes("4") || norm.includes("compartir"))) return "/images/combos/combo-4-arepas.jpg";
  if (norm.includes("combo") && (norm.includes("10") || norm.includes("familiar"))) return "/images/combos/combo-10-arepas.jpg";

  // Bebidas
  if (norm.includes("pepsi")) return "/images/bebidas/pepsi-1-5l.jpg";

  return null;
}

/**
 * Serializa la selección de sabores en un formato legible para tickets y cocina.
 * Trunca a 145 caracteres máximo para proteger los campos VARCHAR(150) de base de datos.
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
    const obsLimpia = notaAdicional.trim().slice(0, 60);
    res += ` — Obs: ${obsLimpia}`;
  }

  return res.slice(0, 145);
}
