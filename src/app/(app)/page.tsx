import { createClient } from "@/lib/supabase/server";
import PosClient from "./client-pos";
import { Producto, Categoria, ExtraModificador, PedidoPendiente } from "@/types/database";

export default async function PosPage() {
  const supabase = await createClient();

  // 1. Obtener categorías activas
  const { data: categorias } = await supabase
    .from("categorias")
    .select("*")
    .eq("activo", true)
    .order("orden", { ascending: true });

  // 2. Obtener productos con ingredientes de receta
  const { data: productos } = await supabase
    .from("productos")
    .select("*, ingredientes:recetas_ingredientes(*, insumo:insumos(*))")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  // 3. Obtener extras y modificadores
  const { data: extras } = await supabase
    .from("extras_modificadores")
    .select("*, insumo:insumos(*)")
    .eq("activo", true);

  // 4. Obtener tasa BCV
  const { data: tasaReciente } = await supabase
    .from("tasas_cambio")
    .select("bcv_usd_bs, tasa_usd_bs")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  const bcvTasa = Number(tasaReciente?.tasa_usd_bs || tasaReciente?.bcv_usd_bs) || 0;

  // 5. Obtener pedidos web pendientes por confirmar
  const { data: pedidosPendientes } = await supabase
    .from("ventas")
    .select(`
      *,
      cliente:clientes(*),
      items:ventas_items(*, producto:productos(*), extras:ventas_items_extras(*, extra:extras_modificadores(*)))
    `)
    .eq("estado", "pendiente")
    .order("fecha", { ascending: false });

  // 6. Obtener clientes para selección rápida en POS
  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .order("nombre", { ascending: true });

  return (
    <PosClient
      categorias={(categorias as Categoria[]) || []}
      productos={(productos as Producto[]) || []}
      extras={(extras as ExtraModificador[]) || []}
      tasaBcv={bcvTasa}
      pedidosPendientes={((pedidosPendientes as PedidoPendiente[]) || [])}
      clientesIniciales={(clientes as any[]) || []}
    />
  );
}
