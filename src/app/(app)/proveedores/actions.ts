"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type GuardarProveedorPayload = {
  id?: string;
  nombre: string;
  telefono?: string;
  contacto?: string;
  direccion?: string;
  rif?: string;
  notas?: string;
};

export async function guardarProveedor(payload: GuardarProveedorPayload) {
  const supabase = await createClient();

  if (payload.id) {
    const { error } = await supabase
      .from("proveedores")
      .update({
        nombre: payload.nombre,
        telefono: payload.telefono || null,
        contacto: payload.contacto || null,
        direccion: payload.direccion || null,
        rif: payload.rif || null,
        notas: payload.notas || null,
      })
      .eq("id", payload.id);

    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("proveedores").insert({
      nombre: payload.nombre,
      telefono: payload.telefono || null,
      contacto: payload.contacto || null,
      direccion: payload.direccion || null,
      rif: payload.rif || null,
      notas: payload.notas || null,
    });

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/proveedores");
  revalidatePath("/compras");
  return { ok: true };
}
