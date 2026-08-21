import { createClient } from "@/lib/supabase/server";
import RecetasClient from "./client";
import { Producto, Insumo, Categoria } from "@/types/database";

export default async function RecetasPage() {
  const supabase = await createClient();

  const { data: productos } = await supabase
    .from("productos")
    .select("*, categoria:categorias(*), ingredientes:recetas_ingredientes(*, insumo:insumos(*))")
    .order("nombre", { ascending: true });

  const { data: insumos } = await supabase
    .from("insumos")
    .select("*")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  const { data: categorias } = await supabase
    .from("categorias")
    .select("*")
    .eq("activo", true)
    .order("orden", { ascending: true });

  return (
    <RecetasClient
      productos={(productos as Producto[]) || []}
      insumos={(insumos as Insumo[]) || []}
      categorias={(categorias as Categoria[]) || []}
    />
  );
}
