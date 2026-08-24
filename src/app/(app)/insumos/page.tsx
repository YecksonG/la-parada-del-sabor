import { createClient } from "@/lib/supabase/server";
import InsumosClient from "./client";
import { Insumo, Proveedor } from "@/types/database";

export default async function InsumosPage() {
  const supabase = await createClient();

  const [{ data: insumos }, { data: proveedores }] = await Promise.all([
    supabase
      .from("insumos")
      .select("*")
      .order("categoria_insumo", { ascending: true })
      .order("nombre", { ascending: true }),
    supabase
      .from("proveedores")
      .select("*")
      .order("nombre", { ascending: true }),
  ]);

  return (
    <InsumosClient
      insumos={(insumos as Insumo[]) || []}
      proveedores={(proveedores as Proveedor[]) || []}
    />
  );
}
