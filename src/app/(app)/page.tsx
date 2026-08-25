import { createClient } from "@/lib/supabase/server";
import PosClient from "./client-pos";
import { Producto, Categoria, ExtraModificador, Insumo } from "@/types/database";

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

  const bcvTasa = Number(tasaReciente?.tasa_usd_bs || tasaReciente?.bcv_usd_bs) || 65.50;

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

  return (
    <PosClient
      categorias={(categorias as Categoria[]) || []}
      productos={(productos as Producto[]) || []}
      extras={(extras as ExtraModificador[]) || []}
      tasaBcv={bcvTasa}
      pedidosPendientes={pedidosPendientes || []}
    />
  );
}
