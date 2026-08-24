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

  let providerId = payload.id;

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
    const { data, error } = await supabase
      .from("proveedores")
      .insert({
        nombre: payload.nombre,
        telefono: payload.telefono || null,
        contacto: payload.contacto || null,
        direccion: payload.direccion || null,
        rif: payload.rif || null,
        notas: notasSerializadas,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    if (data) providerId = data.id;
  }

  // Sincronización atómica en la tabla puente proveedor_insumos (si existe)
  if (providerId && payload.insumos_ids !== undefined) {
    try {
      await supabase
        .from("proveedor_insumos")
        .delete()
        .eq("proveedor_id", providerId);

      if (payload.insumos_ids.length > 0) {
        const rows = payload.insumos_ids.map((insId) => ({
          proveedor_id: providerId,
          insumo_id: insId,
        }));
        await supabase.from("proveedor_insumos").insert(rows);
      }
    } catch {
      // Ignorar si la tabla puente aún no está migrada en la base de datos
    }
  }

  revalidatePath("/proveedores");
  revalidatePath("/insumos");
  revalidatePath("/compras");
  return { ok: true };
}
