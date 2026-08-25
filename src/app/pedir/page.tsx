import { createClient } from "@/lib/supabase/server";
import MenuClienteView from "./client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Menú Digital & Pedidos Online | La Parada del Sabor",
  description: "Arma tu pedido de arepas, rellenos y bebidas tradicionales con entrega a domicilio o retiro.",
};

export default async function PedirPage() {
  const supabase = await createClient();

  const [catRes, prodRes, extRes, tasaRes] = await Promise.all([
    supabase.from("categorias").select("*").order("orden", { ascending: true }),
    supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true }),
    supabase
      .from("extras_modificadores")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true }),
    supabase
      .from("tasas_cambio")
      .select("bcv_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const categorias = catRes.data || [];
  const productos = prodRes.data || [];
  const extras = extRes.data || [];
  const tasaBcv = Number(tasaRes.data?.bcv_usd_bs) || 1;

  return (
    <MenuClienteView
      categorias={categorias}
      productos={productos}
      extras={extras}
      tasaBcv={tasaBcv}
    />
  );
}
