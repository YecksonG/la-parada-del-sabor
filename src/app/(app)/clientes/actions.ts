"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type GuardarClientePayload = {
  id?: string;
  nombre: string;
  telefono?: string;
  direccion_delivery?: string;
  notas_preferencias?: string;
};

export async function guardarCliente(payload: GuardarClientePayload) {
  const supabase = await createClient();

  if (payload.id) {
    const { error } = await supabase
      .from("clientes")
      .update({
        nombre: payload.nombre,
        telefono: payload.telefono || null,
        direccion_delivery: payload.direccion_delivery || null,
        notas_preferencias: payload.notas_preferencias || null,
      })
      .eq("id", payload.id);

    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("clientes").insert({
      nombre: payload.nombre,
      telefono: payload.telefono || null,
      direccion_delivery: payload.direccion_delivery || null,
      notas_preferencias: payload.notas_preferencias || null,
    });

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/clientes");
  return { ok: true };
}

export async function eliminarCliente(id: string) {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "ID de cliente no proporcionado o inválido." };
  }

  // Validación de formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return { ok: false, error: "Identificador de cliente no válido." };
  }

  const supabase = await createClient();

  // 1. Desvincular ventas históricas de forma segura con verificación de error
  const { error: errorDesvincular } = await supabase
    .from("ventas")
    .update({ cliente_id: null })
    .eq("cliente_id", id);

  if (errorDesvincular) {
    return { ok: false, error: `Error al desvincular comandas del cliente: ${errorDesvincular.message}` };
  }

  // 2. Eliminar registro del cliente
  const { error: errorDelete } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id);

  if (errorDelete) {
    return { ok: false, error: `Error al eliminar el cliente: ${errorDelete.message}` };
  }

  revalidatePath("/clientes");
  revalidatePath("/");
  revalidatePath("/dashboard");
  return { ok: true };
}
