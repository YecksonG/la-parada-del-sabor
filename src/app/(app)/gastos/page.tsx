import { createClient } from "@/lib/supabase/server";
import GastosClient from "./client";
import { Gasto, Proveedor, CuentaNegocio } from "@/types/database";

export const metadata = {
  title: "Gestión de Gastos y Cuentas | La Parada del Sabor",
  description: "Control administrativo de gastos operativos, servicios, nómina, cuentas de pago y facturas.",
};

export default async function GastosPage() {
  const supabase = await createClient();

  const [gastosRes, provRes, cuentasRes, tasaRes] = await Promise.all([
    supabase
      .from("gastos")
      .select("*, proveedor:proveedores(*), cuenta:cuentas_negocio(*)")
      .order("fecha", { ascending: false })
      .limit(100),
    supabase
      .from("proveedores")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true }),
    supabase
      .from("cuentas_negocio")
      .select("*")
      .order("nombre", { ascending: true }),
    supabase
      .from("tasas_cambio")
      .select("bcv_usd_bs, tasa_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const gastos = (gastosRes.data as Gasto[]) || [];
  const proveedores = (provRes.data as Proveedor[]) || [];
  const cuentas = (cuentasRes.data as CuentaNegocio[]) || [];
  const tasaBcv = Number(tasaRes.data?.tasa_usd_bs || tasaRes.data?.bcv_usd_bs) || 60.0;

  return (
    <GastosClient
      gastosIniciales={gastos}
      cuentasIniciales={cuentas}
      proveedores={proveedores}
      tasaBcv={tasaBcv}
    />
  );
}
