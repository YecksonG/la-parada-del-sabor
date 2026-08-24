import { createClient } from "@/lib/supabase/server";
import ProveedoresClient from "./client";
import { Proveedor, Insumo } from "@/types/database";
import { parseProveedorInsumos, serializeProveedorInsumos } from "@/lib/proveedor-insumos-helper";

export default async function ProveedoresPage() {
  const supabase = await createClient();

  const [
    { data: proveedores },
    { data: compras },
    { data: insumos },
    { data: rels },
  ] = await Promise.all([
    supabase.from("proveedores").select("*").order("nombre", { ascending: true }),
    supabase.from("compras").select("proveedor_id, total_usd"),
    supabase
      .from("insumos")
      .select("*")
      .order("categoria_insumo", { ascending: true })
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

  // Asociar compras a cada proveedor
  const comprasPorProveedor: { [id: string]: { conteo: number; totalUsd: number } } = {};
  (compras || []).forEach((c) => {
    if (c.proveedor_id) {
      if (!comprasPorProveedor[c.proveedor_id]) {
        comprasPorProveedor[c.proveedor_id] = { conteo: 0, totalUsd: 0 };
      }
      comprasPorProveedor[c.proveedor_id].conteo += 1;
      comprasPorProveedor[c.proveedor_id].totalUsd += Number(c.total_usd) || 0;
    }
  });

  return (
    <ProveedoresClient
      proveedores={(proveedoresHydrated as Proveedor[]) || []}
      insumos={(insumos as Insumo[]) || []}
      statsCompras={comprasPorProveedor}
    />
  );
}
