import { createClient } from "@/lib/supabase/server";
import RecetasClient from "./client";
import { Producto, Insumo, Categoria } from "@/types/database";

export default async function RecetasPage() {
  const supabase = await createClient();

  const [
    { data: productos },
    { data: insumos },
    { data: categorias },
    { data: tasas },
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("*, categoria:categorias(*), ingredientes:recetas_ingredientes(*, insumo:insumos(*))")
      .order("nombre", { ascending: true }),
    supabase
      .from("insumos")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true }),
    supabase
      .from("categorias")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase
      .from("tasas_cambio")
      .select("bcv_usd_bs, tasa_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1),
  ]);

  const tasaBcv = Number(tasas?.[0]?.tasa_usd_bs || tasas?.[0]?.bcv_usd_bs) || 0;

  return (
    <RecetasClient
      productos={(productos as Producto[]) || []}
      insumos={(insumos as Insumo[]) || []}
      categorias={(categorias as Categoria[]) || []}
      tasaBcv={tasaBcv}
    />
  );
}
