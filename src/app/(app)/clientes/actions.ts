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
