import { createClient } from "@/lib/supabase/server";
import ReciboClienteView from "./client";
import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Recibo de Compra #${id.slice(0, 8)} | La Parada del Sabor`,
    description: "Comprobante digital y estado de tu orden en La Parada del Sabor.",
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // G1 Fix: Validación estricta contra enumeración secuencial.
  // Solo se permite acceso mediante UUID criptográfico de 128-bits.
  if (!UUID_REGEX.test(id)) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-[#14100c] text-white">
        <div className="max-w-md w-full text-center p-8 bg-[#1f1914] rounded-3xl border border-[#3d2f22] shadow-2xl">
          <span className="text-5xl block mb-4">🧾🔍</span>
          <h1 className="text-2xl font-black text-[#ffb703] mb-2">Enlace no Válido</h1>
          <p className="text-sm text-stone-400 mb-6">
            Por motivos de privacidad y seguridad, los comprobantes requieren el identificador completo de seguridad.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#e65c00] text-white font-bold text-sm shadow-lg hover:brightness-110 transition"
          >
            Ir a La Parada del Sabor
          </a>
        </div>
      </main>
    );
  }

  const supabase = await createClient();

  // G2 Fix: Obtener recibo mediante RPC seguro con SECURITY DEFINER o query puntual por UUID
  const { data: rpcData, error: rpcError } = await supabase.rpc("fn_obtener_recibo_publico", {
    p_venta_id: id,
  });

  let venta = rpcData;

  // Fallback si la función RPC aún no fue ejecutada en la base de datos
  if (rpcError || !venta || !venta.id) {
    const { data: directData } = await supabase
      .from("ventas")
      .select(`
        id,
        numero_comanda,
        fecha,
        total_usd,
        total_bs,
        tasa_bcv,
        metodo_pago,
        tipo_entrega,
        estado,
        notas_comanda,
        creado_por,
        cliente:clientes (
          id,
          nombre,
          telefono,
          direccion_delivery
        ),
        items:ventas_items (
          id,
          producto_id,
          cantidad,
          precio_unitario_usd,
          subtotal_usd,
          notas_item,
          producto:productos (
            id,
            nombre,
            icono
          ),
          extras:ventas_items_extras (
            id,
            cantidad,
            precio_unitario_usd,
            subtotal_usd,
            extra:extras_modificadores (
              id,
              nombre
            )
          )
        )
      `)
      .eq("id", id)
      .maybeSingle();

    venta = directData;
  }

  if (!venta || !venta.id) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-[#14100c] text-white">
        <div className="max-w-md w-full text-center p-8 bg-[#1f1914] rounded-3xl border border-[#3d2f22] shadow-2xl">
          <span className="text-5xl block mb-4">🧾🔍</span>
          <h1 className="text-2xl font-black text-[#ffb703] mb-2">Comprobante no Encontrado</h1>
          <p className="text-sm text-stone-400 mb-6">
            El recibo que intentas consultar no existe o ha expirado. Verifica el enlace o comunícate con el restaurante.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#e65c00] text-white font-bold text-sm shadow-lg hover:brightness-110 transition"
          >
            Ir a La Parada del Sabor
          </a>
        </div>
      </main>
    );
  }

  return <ReciboClienteView venta={venta as any} />;
}
