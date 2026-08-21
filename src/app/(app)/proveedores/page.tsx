import { createClient } from "@/lib/supabase/server";
import ProveedoresClient from "./client";
import { Proveedor } from "@/types/database";

export default async function ProveedoresPage() {
  const supabase = await createClient();

  const { data: proveedores } = await supabase
    .from("proveedores")
    .select("*")
    .order("nombre", { ascending: true });

  const { data: compras } = await supabase
    .from("compras")
    .select("proveedor_id, total_usd");

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
      statsCompras={comprasPorProveedor}
    />
  );
}
