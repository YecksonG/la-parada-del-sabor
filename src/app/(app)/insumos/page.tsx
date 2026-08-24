import { createClient } from "@/lib/supabase/server";
import InsumosClient from "./client";
import { Insumo, Proveedor } from "@/types/database";
import { parseProveedorInsumos, serializeProveedorInsumos } from "@/lib/proveedor-insumos-helper";

export default async function InsumosPage() {
  const supabase = await createClient();

  const [{ data: insumos }, { data: proveedores }, { data: rels }] = await Promise.all([
    supabase
      .from("insumos")
      .select("*")
      .order("categoria_insumo", { ascending: true })
      .order("nombre", { ascending: true }),
    supabase
      .from("proveedores")
      .select("*")
      .order("nombre", { ascending: true }),
    supabase.from("proveedor_insumos").select("proveedor_id, insumo_id"),
  ]);

  // Si existen relaciones en la tabla puente proveedor_insumos, usarlas como fuente de verdad
  const relMap: { [provId: string]: string[] } = {};
  if (rels && rels.length > 0) {
    rels.forEach((r) => {
      if (!relMap[r.proveedor_id]) relMap[r.proveedor_id] = [];
      relMap[r.proveedor_id].push(r.insumo_id);
    });
  }

  const proveedoresHydrated = (proveedores || []).map((p) => {
    if (relMap[p.id]) {
      const { notas_texto } = parseProveedorInsumos(p.notas);
      return {
        ...p,
        notas: serializeProveedorInsumos(relMap[p.id], notas_texto),
      };
    }
    return p;
  });

  return (
    <InsumosClient
      insumos={(insumos as Insumo[]) || []}
      proveedores={(proveedoresHydrated as Proveedor[]) || []}
    />
  );
}
