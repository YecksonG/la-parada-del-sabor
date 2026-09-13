import { Proveedor, Insumo } from "@/types/database";

export type ProveedorNotasStructured = {
  insumos_ids: string[];
  notas_texto: string;
};

/**
 * Parsea el campo `notas` de un proveedor para extraer los IDs de insumos seleccionados
 * y las notas textuales adicionales, con compatibilidad total para cadenas legacy.
 */
export function parseProveedorInsumos(notas: string | null): ProveedorNotasStructured {
  if (!notas) {
    return { insumos_ids: [], notas_texto: "" };
  }

  const trimmed = notas.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        insumos_ids: Array.isArray(parsed.insumos_ids) ? parsed.insumos_ids : [],
        notas_texto: typeof parsed.notas_texto === "string" ? parsed.notas_texto : "",
      };
    } catch {
      // Si falla el JSON, se asume texto plano legacy
    }
  }

  return {
    insumos_ids: [],
    notas_texto: trimmed,
  };
}

/**
 * Serializa los IDs de insumos y las notas a una cadena JSON estructurada para almacenar en `notas`.
 */
export function serializeProveedorInsumos(
  insumos_ids: string[],
  notas_texto: string = ""
): string {
  return JSON.stringify({
    insumos_ids: Array.from(new Set(insumos_ids)),
    notas_texto: notas_texto.trim(),
  });
}

