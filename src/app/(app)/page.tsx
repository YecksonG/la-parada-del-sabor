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
      .eq("activo", true)
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

  const categorias = catRes.data || [];
  const productos = prodRes.data || [];
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
