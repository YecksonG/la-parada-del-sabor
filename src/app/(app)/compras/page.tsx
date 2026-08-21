import { createClient } from "@/lib/supabase/server";
import ComprasClient from "./client";
import { Insumo, Proveedor } from "@/types/database";

export default async function ComprasPage() {
  const supabase = await createClient();

  const { data: compras } = await supabase
    .from("compras")
    .select("*, proveedor:proveedores(*), items:compras_items(*, insumo:insumos(*))")
    .order("fecha", { ascending: false })
    .limit(50);

  const { data: insumos } = await supabase
    .from("insumos")
    .select("*")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  const { data: proveedores } = await supabase
    .from("proveedores")
    .select("*")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  const { data: tasaReciente } = await supabase
    .from("tasas_cambio")
    .select("bcv_usd_bs, tasa_usd_bs")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  const bcvTasa = Number(tasaReciente?.bcv_usd_bs || tasaReciente?.tasa_usd_bs) || 65.50;

  return (
    <ComprasClient
      compras={compras || []}
      insumos={(insumos as Insumo[]) || []}
      proveedores={(proveedores as Proveedor[]) || []}
      tasaBcv={bcvTasa}
    />
  );
}
