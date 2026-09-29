import { createClient } from "@/lib/supabase/server";
import FinanzasClient from "./client";
import {
  FinanzasEntidad,
  TetasInventario,
  TetasVenta,
  FinanzasMovimiento,
  FinanzasPrestamo,
} from "@/types/database";
import { fechaHoyEnCaracas } from "@/lib/date-vzla";

export const metadata = {
  title: "Hub Financiero & Tetas Rellenas | La Parada del Sabor",
  description:
    "Comando financiero unificado: control de ventas de tetas rellenas, finanzas personales, side hustles y préstamos cruzados.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_ENTIDADES: FinanzasEntidad[] = [
  { id: "parada", nombre: "La Parada del Sabor", tipo: "negocio", color: "#f59e0b", activo: true, creado_el: new Date().toISOString() },
  { id: "tetas", nombre: "Tetas Rellenas", tipo: "negocio", color: "#ec4899", activo: true, creado_el: new Date().toISOString() },
  { id: "yg", nombre: "Yeckson (Personal)", tipo: "personal", color: "#3b82f6", activo: true, creado_el: new Date().toISOString() },
  { id: "esposa", nombre: "Grecia (Personal)", tipo: "personal", color: "#8b5cf6", activo: true, creado_el: new Date().toISOString() },
  { id: "hogar", nombre: "Fondo Común Hogar", tipo: "comun", color: "#10b981", activo: true, creado_el: new Date().toISOString() },
];

export default async function FinanzasPage() {
  const supabase = await createClient();

  // Fecha inicio del mes actual en hora de Venezuela (UTC-4)
  const hoyVzla = fechaHoyEnCaracas();
  const primerDiaMes = `${hoyVzla.anio}-${hoyVzla.mes}-01T00:00:00-04:00`;

  // Consultas paralelas para datos de vista y agregados mensuales exactos
  const [
    entidadesRes,
    tetasInventarioRes,
    tetasVentasRes,
    tetasVentasMesRes,
    movimientosRes,
    movimientosMesRes,
    prestamosRes,
    ventasParadaMesRes,
    gastosParadaMesRes,
    tasaRes,
  ] = await Promise.all([
    supabase.from("finanzas_entidades").select("*").order("creado_el", { ascending: true }),
    supabase.from("tetas_inventario").select("*").eq("activo", true).order("sabor", { ascending: true }),
    supabase.from("tetas_ventas").select("*").order("fecha", { ascending: false }).limit(100),
    supabase.from("tetas_ventas").select("total_usd, costo_unitario_usd, cantidad").gte("fecha", primerDiaMes),
    supabase.from("finanzas_movimientos").select("*, entidad:finanzas_entidades(*)").order("fecha", { ascending: false }).limit(150),
    supabase.from("finanzas_movimientos").select("monto_usd, tipo, entidad_id").gte("fecha", primerDiaMes),
    supabase
      .from("finanzas_prestamos")
      .select("*, abonos:finanzas_prestamos_abonos(*)")
      .order("creado_el", { ascending: false }),
    supabase
      .from("ventas")
      .select("total_usd")
      .not("estado", "in", '("cancelada","credito")')
      .gte("fecha", primerDiaMes),
    supabase
      .from("gastos")
      .select("monto_usd")
      .neq("estado", "anulado")
      .gte("fecha", primerDiaMes),
    supabase
      .from("tasas_cambio")
      .select("tasa_usd_bs, bcv_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Si la tabla no existe aún o está vacía, usar entidades por defecto
  const entidades: FinanzasEntidad[] =
    entidadesRes.data && entidadesRes.data.length > 0
      ? (entidadesRes.data as FinanzasEntidad[])
      : DEFAULT_ENTIDADES;

  const tetasInventario: TetasInventario[] = (tetasInventarioRes.data as TetasInventario[]) || [];
  const tetasVentas: TetasVenta[] = (tetasVentasRes.data as TetasVenta[]) || [];
  const movimientos: FinanzasMovimiento[] = (movimientosRes.data as FinanzasMovimiento[]) || [];
  const prestamos: FinanzasPrestamo[] = (prestamosRes.data as FinanzasPrestamo[]) || [];

  // MÉTICAS DEL MES EXACTAS (SIN TRUNCAMIENTO DE LÍMITES)
  // 1. La Parada del Sabor (mes actual)
  const ventasParadaMesUsd = (ventasParadaMesRes.data || []).reduce(
    (acc, v) => acc + (Number(v.total_usd) || 0),
    0
  );
  const gastosParadaMesUsd = (gastosParadaMesRes.data || []).reduce(
    (acc, g) => acc + (Number(g.monto_usd) || 0),
    0
  );

  // 2. Tetas Rellenas (mes actual)
  const ventasTetasMesUsd = (tetasVentasMesRes.data || []).reduce(
    (acc, v) => acc + (Number(v.total_usd) || 0),
    0
  );
  const costoTetasMesUsd = (tetasVentasMesRes.data || []).reduce(
    (acc, v) => acc + ((Number(v.costo_unitario_usd) || 0.5) * (Number(v.cantidad) || 1)),
    0
  );

  // 3. Movimientos Personales (mes actual)
  const movimientosMes = movimientosMesRes.data || [];
  const ingresosPersonalesMesUsd = movimientosMes
    .filter((m) => m.tipo === "ingreso" && m.entidad_id !== "parada" && m.entidad_id !== "tetas")
    .reduce((acc, m) => acc + (Number(m.monto_usd) || 0), 0);
  const gastosPersonalesMesUsd = movimientosMes
    .filter((m) => m.tipo === "gasto" && m.entidad_id !== "parada" && m.entidad_id !== "tetas")
    .reduce((acc, m) => acc + (Number(m.monto_usd) || 0), 0);

  // Tasa canónica (tasa_usd_bs prioritaria sobre bcv_usd_bs como en el resto de la app)
  const tasaBcv = Number(tasaRes.data?.tasa_usd_bs || tasaRes.data?.bcv_usd_bs) || 60.0;

  // Bandera de disponibilidad de tablas en Supabase
  const tablasListas = !entidadesRes.error && !tetasInventarioRes.error;

  return (
    <FinanzasClient
      entidades={entidades}
      tetasInventario={tetasInventario}
      tetasVentas={tetasVentas}
      movimientos={movimientos}
      prestamos={prestamos}
      paradaMetrics={{
        ventasMesUsd: ventasParadaMesUsd,
        gastosMesUsd: gastosParadaMesUsd,
        margenNetoUsd: ventasParadaMesUsd - gastosParadaMesUsd,
      }}
      mesMetrics={{
        ventasTetasMesUsd,
        costoTetasMesUsd,
        gananciaTetasMesUsd: ventasTetasMesUsd - costoTetasMesUsd,
        ingresosPersonalesMesUsd,
        gastosPersonalesMesUsd,
      }}
      tasaBcv={tasaBcv}
      tablasListas={tablasListas}
    />
  );
}
