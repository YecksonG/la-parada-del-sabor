"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { serializeProveedorInsumos } from "@/lib/proveedor-insumos-helper";

export type GuardarProveedorPayload = {
  id?: string;
  nombre: string;
  telefono?: string;
  contacto?: string;
  direccion?: string;
  rif?: string;
  notas?: string;
  insumos_ids?: string[];
};

export async function guardarProveedor(payload: GuardarProveedorPayload) {
  const supabase = await createClient();

  const notasSerializadas = serializeProveedorInsumos(
    payload.insumos_ids || [],
    payload.notas || ""
  );

  if (payload.id) {
    const { error } = await supabase
      .from("proveedores")
      .update({
        nombre: payload.nombre,
        telefono: payload.telefono || null,
        contacto: payload.contacto || null,
        direccion: payload.direccion || null,
        rif: payload.rif || null,
        notas: notasSerializadas,
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
      notas: notasSerializadas,
    });

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/proveedores");
  revalidatePath("/insumos");
  revalidatePath("/compras");
  return { ok: true };
}
