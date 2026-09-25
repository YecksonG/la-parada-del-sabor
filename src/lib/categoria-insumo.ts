export const CATEGORIAS_INSUMO = [
  "Pre-elaborados",
  "Carnes",
  "Masas",
  "Quesos",
  "Vegetales",
  "Salsas",
  "Grasas",
  "Condimentos",
  "Bebidas",
  "Empaques y Desechables",
  "General",
] as const;

export type CategoriaInsumo = (typeof CATEGORIAS_INSUMO)[number];

export function normalizarCategoriaInsumo(cat?: unknown): CategoriaInsumo {
  if (typeof cat !== "string" || !cat.trim()) return "General";
  const c = cat.toLowerCase().trim();

  // 1. Eliminar Lácteos -> Unificar en Quesos
  if (
    c === "lácteos" ||
    c === "lacteos" ||
    c.includes("lacteo") ||
    c.includes("lácteo") ||
    c.includes("leche") ||
    c.includes("queso")
  ) {
    return "Quesos";
  }

  // 2. Unificar Empaques y Desechables
  if (c.includes("empaque") || c.includes("desechable")) {
    return "Empaques y Desechables";
  }

  // 3. Bebidas (antes de carnes para evitar falsos positivos con 'res' en 'refresco')
  if (
    c.includes("bebida") ||
    c.includes("refresco") ||
    c.includes("jugo") ||
    c.includes("malta") ||
    c.includes("soda")
  ) {
    return "Bebidas";
  }

  // 4. Pre-elaborados y Guisos
  if (
    c.includes("pre-elaborado") ||
    c.includes("preelaborado") ||
    c.includes("pre elaborado") ||
    c.includes("guiso")
  ) {
    return "Pre-elaborados";
  }

  // 5. Grasas y Aceites (antes de vegetales para que 'aceite vegetal' sea Grasas)
  if (
    c.includes("grasa") ||
    c.includes("aceite") ||
    c.includes("manteca") ||
    c.includes("mantequilla") ||
    c.includes("margarina")
  ) {
    return "Grasas";
  }

  // 6. Carnes (evitar substring corta 'res' aislada)
  if (
    c.includes("carne") ||
    c.includes("proteina") ||
    c.includes("proteína") ||
    c.includes("pollo") ||
    c.includes("cerdo") ||
    c.includes("cochino") ||
    c.includes("chorizo") ||
    c.includes("tocineta") ||
    c.includes("jamon") ||
    c.includes("jamón") ||
    c.includes("vacuno") ||
    /\bres\b/.test(c)
  ) {
    return "Carnes";
  }

  if (c.includes("masa") || c.includes("harina")) {
    return "Masas";
  }
  if (c.includes("vegetal") || c.includes("verdura") || c.includes("fruta")) {
    return "Vegetales";
  }
  if (c.includes("salsa")) {
    return "Salsas";
  }
  if (
    c.includes("condimento") ||
    c.includes("especia") ||
    c.includes("aliño") ||
    c.includes("alino") ||
    c.includes("sal")
  ) {
    return "Condimentos";
  }

  // Coincidencia exacta con alguna canónica
  const match = CATEGORIAS_INSUMO.find((k) => k.toLowerCase() === c);
  if (match) return match;

  return "General";
}

