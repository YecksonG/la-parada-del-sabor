"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type EstadoVenta = "pendiente" | "preparando" | "lista" | "completada" | "cancelada";

const TRANSICIONES_VALIDAS: Record<EstadoVenta, EstadoVenta[]> = {
  pendiente: ["preparando", "cancelada"],
  preparando: ["lista", "completada", "cancelada"],
  lista: ["completada", "cancelada"],
  completada: ["cancelada"],
  cancelada: ["preparando"],
};

export async function cambiarEstadoVenta(venta_id: string, nuevoEstado: EstadoVenta) {
  const supabase = await createClient();

  // 1. Obtener estado actual y verificar existencia
  const { data: ventaActual, error: errorFetch } = await supabase
    .from("ventas")
    .select("id, estado")
    .eq("id", venta_id)
    .single();

  if (errorFetch || !ventaActual) {
    return { ok: false, error: "La comanda no existe o no se pudo encontrar." };
  }

  // 2. Validar transición de estado
  const permitidos = TRANSICIONES_VALIDAS[ventaActual.estado as EstadoVenta] || [];
  if (!permitidos.includes(nuevoEstado)) {
    return {
      ok: false,
      error: `Transición no permitida: no se puede cambiar de '${ventaActual.estado}' a '${nuevoEstado}'.`,
    };
  }

  // 3. Actualizar estado
  const { error: errorUpdate } = await supabase
    .from("ventas")
    .update({ estado: nuevoEstado })
    .eq("id", venta_id);

  if (errorUpdate) return { ok: false, error: errorUpdate.message };

  revalidatePath("/ventas");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/insumos");
  revalidatePath("/");

  return { ok: true };
}
