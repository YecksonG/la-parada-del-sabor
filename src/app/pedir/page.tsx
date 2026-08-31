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
  
  // 9 Niveles oficiales de Delivery de La Parada del Sabor
  const zonasDelivery = zonasRes.data && zonasRes.data.length > 0 ? zonasRes.data : [
    { id: "zona-1", nombre: "Nivel 1", descripcion: "Punta Cardón, Bicentenario, Puerta Maraven, España", precio_usd: 1.50, tiempo_estimado_min: 20, orden: 1, activo: true },
    { id: "zona-2", nombre: "Nivel 2", descripcion: "Maraquiva, Maracardón, Maraven, Zarabón, Pedro Manuel Arcaya", precio_usd: 2.00, tiempo_estimado_min: 25, orden: 2, activo: true },
    { id: "zona-3", nombre: "Nivel 3", descripcion: "Mercedes, Margaritas, Centro, Santa Irene, Caciques", precio_usd: 2.50, tiempo_estimado_min: 30, orden: 3, activo: true },
    { id: "zona-4", nombre: "Nivel 4", descripcion: "Adjuntas, Carirubana, El Cardón", precio_usd: 3.00, tiempo_estimado_min: 35, orden: 4, activo: true },
    { id: "zona-5", nombre: "Nivel 5", descripcion: "Cujicana, Ciudad Federación, Bella Vista, Santa Fe", precio_usd: 3.50, tiempo_estimado_min: 40, orden: 5, activo: true },
    { id: "zona-6", nombre: "Nivel 6", descripcion: "Antiguo Aeropuerto", precio_usd: 4.00, tiempo_estimado_min: 45, orden: 6, activo: true },
    { id: "zona-7", nombre: "Nivel 7", descripcion: "Sector Universitario, Maria Auxiliadora", precio_usd: 4.50, tiempo_estimado_min: 50, orden: 7, activo: true },
    { id: "zona-8", nombre: "Nivel 8", descripcion: "Creolandia", precio_usd: 5.00, tiempo_estimado_min: 55, orden: 8, activo: true },
    { id: "zona-9", nombre: "Nivel 9", descripcion: "Judibana", precio_usd: 6.00, tiempo_estimado_min: 60, orden: 9, activo: true },
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
