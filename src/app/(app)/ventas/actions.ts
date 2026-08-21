"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function cambiarEstadoVenta(venta_id: string, nuevoEstado: "preparando" | "completada" | "cancelada") {
  const supabase = await createClient();

  // Al actualizar el estado, si pasa a 'cancelada', el trigger PostgreSQL `trg_reconciliar_cambio_estado_venta`
  // devolverá de inmediato los insumos de recetas y extras al stock general
  const { error } = await supabase
    .from("ventas")
    .update({ estado: nuevoEstado })
    .eq("id", venta_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ventas");
  revalidatePath("/insumos");
  revalidatePath("/");

  return { ok: true };
}
