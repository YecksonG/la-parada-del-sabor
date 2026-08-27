"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { serializeProveedorInsumos } from "@/lib/proveedor-insumos-helper";
import { requireAuth } from "@/lib/auth-guard";

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
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

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

  // Sincronización atómica en la tabla puente proveedor_insumos
  if (providerId && payload.insumos_ids !== undefined) {
    // 1. Intentar vía RPC transaccional
    const { error: rpcError } = await supabase.rpc("sincronizar_proveedor_insumos", {
      p_proveedor_id: providerId,
      p_insumos_ids: payload.insumos_ids,
    });

    // 2. Si la RPC no está instalada, ejecutar directamente contra la tabla con validación
    if (rpcError) {
      const { error: delErr } = await supabase
        .from("proveedor_insumos")
        .delete()
        .eq("proveedor_id", providerId);

      if (!delErr && payload.insumos_ids.length > 0) {
        const rows = payload.insumos_ids.map((insId) => ({
          proveedor_id: providerId,
          insumo_id: insId,
        }));
        const { error: insErr } = await supabase.from("proveedor_insumos").insert(rows);
        if (insErr && insErr.code !== "PGRST204" && insErr.code !== "42P01") {
          console.error("Error al sincronizar proveedor_insumos:", insErr.message);
        }
      }
    }
  }

  revalidatePath("/proveedores");
  revalidatePath("/insumos");
  revalidatePath("/compras");
  return { ok: true };
}

export async function eliminarProveedor(id: string) {
  if (!id) return { ok: false, error: "Identificador no válido." };

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

  // Eliminar referencias en tabla puente primero si existen
  await supabase.from("proveedor_insumos").delete().eq("proveedor_id", id);

  // Desvincular de gastos y compras para preservar el histórico
  await supabase.from("gastos").update({ proveedor_id: null }).eq("proveedor_id", id);
  await supabase.from("compras").update({ proveedor_id: null }).eq("proveedor_id", id);

  // Eliminar el proveedor
  const { error } = await supabase.from("proveedores").delete().eq("id", id);

  if (error) {
    return { ok: false, error: error.message || "Error al eliminar proveedor." };
  }

  revalidatePath("/proveedores");
  revalidatePath("/insumos");
  revalidatePath("/compras");
  revalidatePath("/gastos");
  return { ok: true };
}

