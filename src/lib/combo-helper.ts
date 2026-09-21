import { Producto } from "@/types/database";

export interface RellenoArepa {
  id: string;
  nombre: string;
  desc: string;
  icono: string;
  imagen: string;
  recargo?: number;
}

export type SaborArepa = RellenoArepa;

/**
 * Mapeo: rellenoId interno → nombre exacto en extras_modificadores (BD)
 * Usado por el modal para resolver UUIDs reales al confirmar un combo.
 */
export const RELLENO_A_EXTRA_NOMBRE: Record<string, string> = {
  catira:              "Catira (Pollo Mechado + Queso Amarillo)",
  pelua:               "Pelúa (Carne Mechada + Queso Amarillo)",
  jamon_queso_amarillo:"Jamón y Queso Amarillo",
  reina_pepiada:       "Reina Pepiada (Aguacate + Pollo)",
  especial_carne:      "Especial de Carne Esmechada (Gourmet)",
  especial_pollo:      "Especial de Pollo Esmechado (Gourmet)",
  choriarepa:          "Choriarepa (Chorizo Ahumado + Pico de Gallo)",
};

/**
 * Mapeo: rellenoId interno → nombre del producto en la tabla 'productos'
 * Usado para detectar si el sabor está agotado/inactivo.
 */
export const RELLENO_A_PRODUCTO_NOMBRE: Record<string, string> = {
  catira:              "Arepa Catira",
  pelua:               "Arepa Pelúa",
  jamon_queso_amarillo:"Arepa Jamón y Queso Amarillo",
  reina_pepiada:       "Arepa Reina Pepiada",
  especial_carne:      "Arepa Especial de Carne Esmechada",
  especial_pollo:      "Arepa Especial de Pollo Esmechado",
  choriarepa:          "Arepa de Chorizo",
};

export const RELLENOS_AREPAS_COMBO: RellenoArepa[] = [
  {
    id: "pelua",
    nombre: "Arepa Pelúa",
    desc: "Carne mechada + Queso amarillo",
    icono: "🧀",
    imagen: "/images/arepas/arepa-pelua.jpg",
  },
  {
    id: "catira",
    nombre: "Arepa Catira",
    desc: "Pollo mechado + Queso amarillo",
    icono: "🍗",
    imagen: "/images/arepas/arepa-catira.jpg",
  },
  {
    id: "jamon_queso_amarillo",
    nombre: "Arepa Jamón y Queso Amarillo",
    desc: "Jamón + Queso amarillo rallado",
    icono: "🥓",
    imagen: "/images/arepas/arepa-jamon-queso.jpg",
  },
  {
    id: "reina_pepiada",
    nombre: "Arepa Reina Pepiada",
    desc: "Pollo desmechado con aguacate y mayonesa",
    icono: "🥑",
    imagen: "/images/arepas/arepa-reina-pepiada.jpg",
  },
  {
    id: "choriarepa",
    nombre: "Choriarepa",
    desc: "Chorizo ahumado + Pico de gallo + Queso blanco (+0.50$)",
    icono: "🌭",
    imagen: "",
    recargo: 0.50,
  },
  {
    id: "especial_carne",
    nombre: "Especial de Carne Gourmet",
    desc: "Carne mechada + Jamón + Queso blanco + Salsas (+0.50$)",
    icono: "🥩",
    imagen: "/images/arepas/arepa-especial-carne.jpg",
    recargo: 0.50,
  },
  {
    id: "especial_pollo",
    nombre: "Especial de Pollo Gourmet",
    desc: "Pollo mechado + Jamón + Queso blanco + Salsas (+0.50$)",
    icono: "🍗",
    imagen: "/images/arepas/arepa-especial-pollo.jpg",
    recargo: 0.50,
  },
];

export const SABORES_AREPAS_COMBO = RELLENOS_AREPAS_COMBO;

/**
 * Determina cuántas arepas contiene un combo dado su nombre o descripción usando límites de palabra precisos.
 * Retorna null si no es un combo de arepas.
 */
export function getComboArepasCount(prod?: { nombre?: string | null } | null): number | null {
  if (!prod || !prod.nombre || typeof prod.nombre !== "string") return null;
  const nombre = prod.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b10\s*arep/i.test(nombre) || /\bcombo\s*10\b/i.test(nombre) || /\bfamiliar\b/i.test(nombre) || /\bresuelve\b/i.test(nombre)) return 10;
  if (/\b6\s*arep/i.test(nombre) || /\bcombo\s*6\b/i.test(nombre)) return 6;
  if (/\b4\s*arep/i.test(nombre) || /\bcombo\s*4\b/i.test(nombre) || /\bcompartir\b/i.test(nombre) || /\bduo\b/i.test(nombre) || /\bpara dos\b/i.test(nombre)) return 4;
  if (/\b2\s*arep/i.test(nombre) || /\bcombo\s*2\b/i.test(nombre) || /\bpersonal\b/i.test(nombre) || /\bantojo\b/i.test(nombre)) return 2;
  return null;
}

/**
 * Resuelve la imagen autoritativa para un producto o combo.
 */
export function getProductImage(prod?: { nombre?: string | null; imagen_url?: string | null } | null): string | null {
  if (!prod || !prod.nombre || typeof prod.nombre !== "string") return null;
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
  if (norm.includes("chorizo") || norm.includes("choriarepa")) return prod.imagen_url || null;
  if (norm.includes("catira")) return "/images/arepas/arepa-catira.jpg";
  if (norm.includes("especial") && norm.includes("pollo")) return "/images/arepas/arepa-especial-pollo.jpg";
  if (norm.includes("reina") || norm.includes("pepiada")) return "/images/arepas/arepa-reina-pepiada.jpg";
  if (norm.includes("jamon") && norm.includes("queso")) return "/images/arepas/arepa-jamon-queso.jpg";
  if (norm.includes("especial") && (norm.includes("carne") || norm.includes("esmechada"))) return "/images/arepas/arepa-especial-carne.jpg";
  if (norm.includes("pelua")) return "/images/arepas/arepa-pelua.jpg";
  
  // Combos oficiales gourmet
  if (norm.includes("antojo") || (norm.includes("combo") && (norm.includes("2") || norm.includes("personal")))) return "/images/combos/combo-2-arepas.jpg";
  if (norm.includes("duo") || norm.includes("para dos") || (norm.includes("combo") && (norm.includes("4") || norm.includes("compartir")))) return "/images/combos/combo-4-arepas.jpg";
  if (norm.includes("resuelve") || (norm.includes("combo") && (norm.includes("10") || norm.includes("familiar")))) return "/images/combos/combo-10-arepas.jpg";

  // Bebidas
  if (norm.includes("pepsi")) {
    if (norm.includes("1.5") || norm.includes("1,5")) return "/images/bebidas/pepsi-1-5l.jpg";
    if (norm.includes("1l") || norm.includes("1 l") || norm.includes("1 litro") || norm.includes("un litro")) return "/images/bebidas/pepsi-1l.jpg";
    return "/images/bebidas/pepsi-1l.jpg";
  }
  if (norm.includes("vaso") || norm.includes("refresco")) {
    return "/images/bebidas/vaso-refresco.jpg";
  }

  return null;
}

export type CoccionModo = "todas_fritas" | "todas_asadas" | "mixtas";

export interface CoccionDesglose {
  asadas: number;
  fritas: number;
}

/**
 * Determina si un producto es una arepa individual (no combo).
 */
export function esArepaIndividual(prod?: { nombre?: string | null; categoria?: { nombre?: string | null } | null } | null): boolean {
  if (!prod || !prod.nombre || typeof prod.nombre !== "string") return false;
  if (getComboArepasCount(prod) !== null) return false;
  const nom = prod.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const catNom = (prod.categoria?.nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return nom.includes("arepa") || catNom.includes("arepa");
}

/**
 * Serializa la selección de rellenos y cocción en un formato legible para comandas y cocina.
 * Trunca a 145 caracteres máximo para proteger los campos VARCHAR(150) de base de datos.
 */
export function serializarRellenosCombo(
  rellenosSeleccionados: Record<string, number>,
  notaAdicional?: string,
  coccionModo: CoccionModo = "todas_fritas",
  coccionDesglose?: Record<string, CoccionDesglose>
): string {
  const lineas: string[] = [];
  
  for (const relleno of RELLENOS_AREPAS_COMBO) {
    const cant = rellenosSeleccionados[relleno.id] || 0;
    if (cant > 0) {
      // Limpiar prefijo "Arepa " o sufijo "(Gourmet)" para concisión en comanda térmica
      const nombreCorto = relleno.nombre
        .replace(/^Arepa\s+/i, "")
        .replace(/\s+Gourmet/i, "")
        .trim();

      if (coccionModo === "mixtas") {
        const desglose = (coccionDesglose && coccionDesglose[relleno.id]) || { asadas: 0, fritas: cant };
        const { asadas = 0, fritas = 0 } = desglose;
        if (asadas > 0 && fritas > 0) {
          lineas.push(`${nombreCorto} (${asadas}A/${fritas}F)`);
        } else if (asadas > 0) {
          lineas.push(`${asadas}x ${nombreCorto} Asada${asadas > 1 ? "s" : ""}`);
        } else {
          lineas.push(`${fritas}x ${nombreCorto} Frita${fritas > 1 ? "s" : ""}`);
        }
      } else {
        lineas.push(`${cant}x ${nombreCorto}`);
      }
    }
  }

  let sufijoCoccion = "";
  if (coccionModo === "todas_fritas") {
    sufijoCoccion = " [Todas Fritas]";
  } else if (coccionModo === "todas_asadas") {
    sufijoCoccion = " [Todas Asadas]";
  }

  let res = `Rellenos: ${lineas.join(", ")}${sufijoCoccion}`;
  if (notaAdicional?.trim()) {
    const obsLimpia = notaAdicional.trim().slice(0, 40);
    res += ` — Obs: ${obsLimpia}`;
  }

  return res.slice(0, 145);
}

