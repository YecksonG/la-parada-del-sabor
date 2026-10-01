import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { data, error } = await supabase.from('tetas_inventario').select('*');
  
  if (body.action === 'crear_generico') {
    const res = await supabase.from('tetas_inventario').insert({
        sabor: 'Varios (Histórico)',
        stock_unidades: 1000,
        costo_compra_unitario_usd: 0.35,
        precio_venta_unitario_usd: 0.80,
    }).select().single();
    return NextResponse.json(res);
  }
  
  if (body.action === 'cargar_ventas') {
    // ventas is an array of { fecha: 'YYYY-MM-DD', cantidad: number }
    const { ventas, sabor_id, sabor_nombre } = body;
    const inserts = ventas.map((v: any) => ({
      fecha: `${v.fecha}T12:00:00Z`,
      sabor_id,
      sabor_nombre,
      cantidad: v.cantidad,
      precio_unitario_usd: 0.80,
      costo_unitario_usd: 0.35,
      total_usd: v.cantidad * 0.80,
      total_bs: v.cantidad * 0.80 * 40.0, // dummy bcv, it's historical
      tasa_bcv: 40.0,
      metodo_pago: 'efectivo_usd',
      registrado_por: 'migracion'
    }));
    const res = await supabase.from('tetas_ventas').insert(inserts);
    return NextResponse.json(res);
  }

  return NextResponse.json({ data, error });
}
