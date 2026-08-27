import { createClient } from "@/lib/supabase/server";
import GastosClient from "./client";
import { Gasto, Proveedor, CuentaNegocio, Insumo, TransferenciaCuenta } from "@/types/database";

export const metadata = {
  title: "Compras & Gastos | La Parada del Sabor",
  description: "Centro administrativo unificado de compras de insumos, servicios, nómina, cuentas bancarias, transferencias y facturas.",
};

export default async function GastosPage() {
  const supabase = await createClient();

  const [gastosRes, comprasRes, insumosRes, provRes, cuentasRes, transferenciasRes, tasaRes] = await Promise.all([
    supabase
      .from("gastos")
      .select("*, proveedor:proveedores(*), cuenta:cuentas_negocio(*)")
      .order("fecha", { ascending: false })
      .limit(150),
    supabase
      .from("compras")
      .select("*, proveedor:proveedores(*), items:compras_items(*, insumo:insumos(*))")
      .order("fecha", { ascending: false })
      .limit(50),
    supabase
      .from("insumos")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true }),
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
      .from("transferencias_cuentas")
      .select("*, cuenta_origen:cuentas_negocio!transferencias_cuentas_cuenta_origen_id_fkey(*), cuenta_destino:cuentas_negocio!transferencias_cuentas_cuenta_destino_id_fkey(*)")
      .order("fecha", { ascending: false })
      .limit(100),
    supabase
      .from("tasas_cambio")
      .select("bcv_usd_bs, tasa_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const gastos = (gastosRes.data as Gasto[]) || [];
  const compras = (comprasRes.data as any[]) || [];
  const insumos = (insumosRes.data as Insumo[]) || [];
  const proveedores = (provRes.data as Proveedor[]) || [];
  const cuentas = (cuentasRes.data as CuentaNegocio[]) || [];
  const transferencias = (transferenciasRes.data as TransferenciaCuenta[]) || [];
  const tasaBcv = Number(tasaRes.data?.tasa_usd_bs || tasaRes.data?.bcv_usd_bs) || 60.0;

  return (
    <GastosClient
      gastosIniciales={gastos}
      comprasIniciales={compras}
      insumos={insumos}
      cuentasIniciales={cuentas}
      transferenciasIniciales={transferencias}
      proveedores={proveedores}
      tasaBcv={tasaBcv}
    />
  );
}
