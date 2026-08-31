import { createClient } from "@/lib/supabase/server";
import MenuClienteView from "./client";
import { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Menú Digital & Pedidos Online | La Parada del Sabor",
  description: "Arma tu pedido de arepas, rellenos y bebidas tradicionales con entrega a domicilio o retiro.",
};

export default async function PedirPage() {
  const supabase = await createClient();

  const [catRes, prodRes, extRes, tasaRes, zonasRes] = await Promise.all([
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
      .select("bcv_usd_bs, tasa_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("zonas_delivery")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true }),
  ]);

  // Excluir categoría y productos de empanadas si existen en DB
  const empanadaCatIds = new Set(
    (catRes.data || [])
      .filter((c) => c.nombre.toLowerCase().includes("empanada"))
      .map((c) => c.id)
  );

  const categorias = (catRes.data || []).filter((c) => !empanadaCatIds.has(c.id));
  const productos = (prodRes.data || []).filter(
    (p) => !empanadaCatIds.has(p.categoria_id) && !p.nombre.toLowerCase().includes("empanada")
  );
  const extras = extRes.data || [];
  const tasaBcv = Number(tasaRes.data?.tasa_usd_bs || tasaRes.data?.bcv_usd_bs) || 0;
  
  // Zonas de fallback por si la tabla aún no se ha creado en DB
  const zonasDelivery = zonasRes.data && zonasRes.data.length > 0 ? zonasRes.data : [
    { id: "zona-1", nombre: "Zona 1 - Casco Central / Centro", precio_usd: 1.50, tiempo_estimado_min: 20, orden: 1, activo: true },
    { id: "zona-2", nombre: "Zona 2 - San Antonio / Las Mercedes", precio_usd: 2.00, tiempo_estimado_min: 25, orden: 2, activo: true },
    { id: "zona-3", nombre: "Zona 3 - Zona Norte / El Bosque", precio_usd: 2.50, tiempo_estimado_min: 35, orden: 3, activo: true },
    { id: "zona-4", nombre: "Zona 4 - Periferia / Foráneo (Hasta 10km)", precio_usd: 3.50, tiempo_estimado_min: 45, orden: 4, activo: true },
  ];

  return (
    <MenuClienteView
      categorias={categorias}
      productos={productos}
      extras={extras}
      zonasDelivery={zonasDelivery}
      tasaBcv={tasaBcv}
    />
  );
}
