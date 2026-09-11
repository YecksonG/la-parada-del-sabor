import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./client";
import { Venta, Cliente, Insumo, Producto, SesionCaja, Gasto, ZonaDelivery } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 1. Ejecutar consultas en paralelo para máxima velocidad
  const [ventasRes, clientesRes, insumosRes, productosRes, tasaRes, sesionesRes, gastosRes, zonasRes] = await Promise.all([
    supabase
      .from("ventas")
      .select("*, cliente:clientes(*), items:ventas_items(*, producto:productos(*), extras:ventas_items_extras(*, extra:extras_modificadores(*)))")
      .neq("estado", "cancelada")
      .order("fecha", { ascending: false }),
    supabase
      .from("clientes")
      .select("*")
      .order("total_pedidos", { ascending: false }),
    supabase
      .from("insumos")
      .select("*")
      .order("stock_actual", { ascending: true }),
    supabase
      .from("productos")
      .select("*, categoria:categorias(*), ingredientes:recetas_ingredientes(*, insumo:insumos(*))"),
    supabase
      .from("tasas_cambio")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sesiones_caja")
      .select("*")
      .order("fecha_apertura", { ascending: false })
      .limit(30),
    supabase
      .from("gastos")
      .select("*, proveedor:proveedores(*)")
      .neq("estado", "anulado")
      .order("fecha", { ascending: false }),
    supabase
      .from("zonas_delivery")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true }),
  ]);

  const ventas = ventasRes.data || [];
  const clientes = clientesRes.data || [];
  const insumos = insumosRes.data || [];
  const productos = productosRes.data || [];
  const tasaReciente = tasaRes.data;
  const historialCajas = sesionesRes.data || [];
  const gastos = gastosRes.data || [];

  const zonasDelivery: ZonaDelivery[] = zonasRes.data && zonasRes.data.length > 0 ? zonasRes.data : [
    { id: "zona-1", nombre: "Nivel 1", descripcion: "Punta Cardón, Bicentenario, Puerta Maraven, España", precio_usd: 1.50, tiempo_estimado_min: 20, orden: 1, activo: true, creado_el: new Date().toISOString() },
    { id: "zona-2", nombre: "Nivel 2", descripcion: "Maraquiva, Maracardón, Maraven, Zarabón, Pedro Manuel Arcaya", precio_usd: 2.00, tiempo_estimado_min: 25, orden: 2, activo: true, creado_el: new Date().toISOString() },
    { id: "zona-3", nombre: "Nivel 3", descripcion: "Mercedes, Margaritas, Centro, Santa Irene, Caciques", precio_usd: 2.50, tiempo_estimado_min: 30, orden: 3, activo: true, creado_el: new Date().toISOString() },
    { id: "zona-4", nombre: "Nivel 4", descripcion: "Adjuntas, Carirubana, El Cardón", precio_usd: 3.00, tiempo_estimado_min: 35, orden: 4, activo: true, creado_el: new Date().toISOString() },
    { id: "zona-5", nombre: "Nivel 5", descripcion: "Cujicana, Ciudad Federación, Bella Vista, Santa Fe", precio_usd: 3.50, tiempo_estimado_min: 40, orden: 5, activo: true, creado_el: new Date().toISOString() },
    { id: "zona-6", nombre: "Nivel 6", descripcion: "Antiguo Aeropuerto", precio_usd: 4.00, tiempo_estimado_min: 45, orden: 6, activo: true, creado_el: new Date().toISOString() },
    { id: "zona-7", nombre: "Nivel 7", descripcion: "Sector Universitario, Maria Auxiliadora", precio_usd: 4.50, tiempo_estimado_min: 50, orden: 7, activo: true, creado_el: new Date().toISOString() },
    { id: "zona-8", nombre: "Nivel 8", descripcion: "Creolandia", precio_usd: 5.00, tiempo_estimado_min: 55, orden: 8, activo: true, creado_el: new Date().toISOString() },
    { id: "zona-9", nombre: "Nivel 9", descripcion: "Judibana", precio_usd: 6.00, tiempo_estimado_min: 60, orden: 9, activo: true, creado_el: new Date().toISOString() },
  ];

  return (
    <DashboardClient
      ventas={(ventas as Venta[]) || []}
      clientes={(clientes as Cliente[]) || []}
      insumos={(insumos as Insumo[]) || []}
      productos={(productos as Producto[]) || []}
      historialCajas={(historialCajas as SesionCaja[]) || []}
      gastos={(gastos as Gasto[]) || []}
      zonasDelivery={zonasDelivery}
      tasaBcv={Number(tasaReciente?.tasa_usd_bs || tasaReciente?.bcv_usd_bs) || 0}
    />
  );
}
