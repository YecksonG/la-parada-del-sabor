import { createClient } from "@/lib/supabase/server";
import PosClient from "./client-pos";
import { Producto, Categoria, ExtraModificador, PedidoPendiente, ZonaDelivery } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PosPage() {
  const supabase = await createClient();

  // Acotar pedidos pendientes a los últimos 48h: cubre un turno nocturno
  // completo sin saturar la bandeja con pedidos abandonados de meses.
  const limitePedidos = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Ejecutar todas las consultas en paralelo con Promise.all
  const [
    catRes,
    prodRes,
    extRes,
    tasaRes,
    pedidosRes,
    clientesRes,
    zonasRes,
  ] = await Promise.all([
    supabase
      .from("categorias")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase
      .from("productos")
      .select("*, ingredientes:recetas_ingredientes(*, insumo:insumos(*))")
      .order("nombre", { ascending: true }),
    supabase
      .from("extras_modificadores")
      .select("*, insumo:insumos(*)")
      .eq("activo", true),
    supabase
      .from("tasas_cambio")
      .select("bcv_usd_bs, tasa_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ventas")
      .select(`
        *,
        cliente:clientes(*),
        items:ventas_items(*, producto:productos(*), extras:ventas_items_extras(*, extra:extras_modificadores(*)))
      `)
      .eq("estado", "pendiente")
      .gte("fecha", limitePedidos)
      .order("fecha", { ascending: false }),
    supabase
      .from("clientes")
      .select("*")
      .order("nombre", { ascending: true }),
    supabase
      .from("zonas_delivery")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true }),
  ]);

  const categoriasExcluidas = new Set(
    (catRes.data || [])
      .filter((c) => {
        const nom = c.nombre.toLowerCase();
        return nom.includes("empanada") || nom.includes("raciones") || nom.includes("extras");
      })
      .map((c) => c.id)
  );

  const categorias = (catRes.data || [])
    .filter((c) => !categoriasExcluidas.has(c.id))
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const productos = (prodRes.data || []).filter((p) => {
    const nom = p.nombre.toLowerCase();
    return (
      !categoriasExcluidas.has(p.categoria_id) &&
      !nom.includes("empanada") &&
      !nom.includes("coctel")
    );
  });
  const extras = extRes.data || [];
  const bcvTasa = Number(tasaRes.data?.tasa_usd_bs || tasaRes.data?.bcv_usd_bs) || 0;
  const pedidosPendientes = pedidosRes.data || [];
  const clientes = clientesRes.data || [];
  const zonasDelivery = zonasRes.data || [];

  return (
    <PosClient
      categorias={(categorias as Categoria[]) || []}
      productos={(productos as Producto[]) || []}
      extras={(extras as ExtraModificador[]) || []}
      tasaBcv={bcvTasa}
      pedidosPendientes={(pedidosPendientes as PedidoPendiente[]) || []}
      clientesIniciales={(clientes as any[]) || []}
      zonasDelivery={(zonasDelivery as ZonaDelivery[]) || []}
    />
  );
}
