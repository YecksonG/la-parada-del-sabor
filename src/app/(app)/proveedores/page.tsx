import { createClient } from "@/lib/supabase/server";
import ProveedoresClient from "./client";
import { Proveedor, Insumo } from "@/types/database";
import { parseProveedorInsumos, serializeProveedorInsumos } from "@/lib/proveedor-insumos-helper";

export default async function ProveedoresPage() {
  const supabase = await createClient();

  const [
    { data: proveedores },
    { data: gastos },
    { data: comprasData },
    { data: insumos },
    { data: rels },
  ] = await Promise.all([
    supabase.from("proveedores").select("*").order("nombre", { ascending: true }),
    supabase.from("gastos").select("id, proveedor_id, beneficiario, monto_usd, monto_bs, estado, notas"),
    supabase.from("compras").select("id, proveedor_id, total_usd, total_bs"),
    supabase
      .from("insumos")
      .select("*")
      .order("categoria_insumo", { ascending: true })
      .order("nombre", { ascending: true }),
    supabase.from("proveedor_insumos").select("proveedor_id, insumo_id, precio_referencial_usd"),
  ]);

  // Si existen relaciones en la tabla puente proveedor_insumos, usarlas como fuente de verdad
  const relMap: { [provId: string]: string[] } = {};
  const preciosMap: { [provId: string]: { [insumoId: string]: number } } = {};
  if (rels && rels.length > 0) {
    rels.forEach((r: any) => {
      if (!relMap[r.proveedor_id]) relMap[r.proveedor_id] = [];
      relMap[r.proveedor_id].push(r.insumo_id);

      if (!preciosMap[r.proveedor_id]) preciosMap[r.proveedor_id] = {};
      if (r.precio_referencial_usd) {
        preciosMap[r.proveedor_id][r.insumo_id] = Number(r.precio_referencial_usd);
      }
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

  // Asociar compras y gastos a cada proveedor
  const comprasPorProveedor: { [id: string]: { conteo: number; totalUsd: number; totalBs: number } } = {};
  const compraIdsContadas = new Set<string>();

  // 1. Contar compras directas de la tabla compras
  (comprasData || []).forEach((c) => {
    if (c.proveedor_id) {
      if (!comprasPorProveedor[c.proveedor_id]) {
        comprasPorProveedor[c.proveedor_id] = { conteo: 0, totalUsd: 0, totalBs: 0 };
      }
      comprasPorProveedor[c.proveedor_id].conteo += 1;
      comprasPorProveedor[c.proveedor_id].totalUsd += Number(c.total_usd) || 0;
      comprasPorProveedor[c.proveedor_id].totalBs += Number(c.total_bs) || 0;
      compraIdsContadas.add(c.id);
    }
  });

  // 2. Contar gastos adicionales asociados al proveedor (evitando duplicar si ya proviene de compras)
  (gastos || [])
    .filter((g) => g.estado !== "anulado")
    .forEach((g) => {
      // Si el gasto proviene de una compra ya contabilizada, ignorar para no duplicar
      if (g.notas && g.notas.includes("compra_id:")) {
        const matchCompra = g.notas.match(/compra_id:([a-zA-Z0-9_-]+)/);
        if (matchCompra && compraIdsContadas.has(matchCompra[1])) {
          return;
        }
      }

      let provId = g.proveedor_id;
      if (!provId && g.beneficiario) {
        const benLower = g.beneficiario.toLowerCase();
        const match = (proveedores || []).find((p) =>
          benLower.includes(p.nombre.toLowerCase()) || p.nombre.toLowerCase().includes(benLower)
        );
        if (match) provId = match.id;
      }

      if (provId) {
        if (!comprasPorProveedor[provId]) {
          comprasPorProveedor[provId] = { conteo: 0, totalUsd: 0, totalBs: 0 };
        }
        comprasPorProveedor[provId].conteo += 1;
        comprasPorProveedor[provId].totalUsd += Number(g.monto_usd) || 0;
        comprasPorProveedor[provId].totalBs += Number(g.monto_bs) || 0;
      }
    });

  return (
    <ProveedoresClient
      proveedores={(proveedoresHydrated as Proveedor[]) || []}
      insumos={(insumos as Insumo[]) || []}
      statsCompras={comprasPorProveedor}
      preciosReferenciales={preciosMap}
    />
  );
}
