import { createClient } from "@/lib/supabase/server";
import ProveedoresClient from "./client";
import { Proveedor, Insumo } from "@/types/database";

export default async function ProveedoresPage() {
  const supabase = await createClient();

  const [{ data: proveedores }, { data: compras }, { data: insumos }] =
    await Promise.all([
      supabase.from("proveedores").select("*").order("nombre", { ascending: true }),
      supabase.from("compras").select("proveedor_id, total_usd"),
      supabase
        .from("insumos")
        .select("*")
        .order("categoria_insumo", { ascending: true })
        .order("nombre", { ascending: true }),
    ]);

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
      proveedores={(proveedores as Proveedor[]) || []}
      insumos={(insumos as Insumo[]) || []}
      statsCompras={comprasPorProveedor}
    />
  );
}
