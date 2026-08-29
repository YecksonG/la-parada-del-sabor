-- ==============================================================================
-- MIGRACIÓN DE AUDITORÍA: SEGURIDAD DE DATOS (DATA LEAKS & RATE LIMITING)
-- La Parada del Sabor — 29 Ago 2026
-- ==============================================================================

-- 1. ELIMINAR EXPOSICIÓN DE DATOS A USUARIOS ANÓNIMOS (DATA LEAK)
DROP POLICY IF EXISTS "anon_read_ventas" ON public.ventas;
DROP POLICY IF EXISTS "anon_read_ventas_items" ON public.ventas_items;
DROP POLICY IF EXISTS "anon_read_ventas_extras" ON public.ventas_items_extras;
DROP POLICY IF EXISTS "anon_read_clientes" ON public.clientes;

-- Categorías anónimas solo deben ver las activas
DROP POLICY IF EXISTS "anon_read_categorias" ON public.categorias;
CREATE POLICY "anon_read_categorias" ON public.categorias FOR SELECT TO anon USING (activo = true);

-- 2. AMPLIAR LA RPC SEGURA DE RECIBOS PARA CUBRIR EL FALLBACK (Evita select a public.ventas)
CREATE OR REPLACE FUNCTION public.fn_obtener_recibo_publico(p_venta_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_recibo JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', v.id, 'numero_comanda', v.numero_comanda, 'fecha', v.fecha,
        'total_usd', v.total_usd, 'total_bs', v.total_bs, 'tasa_bcv', v.tasa_bcv,
        'metodo_pago', v.metodo_pago, 'tipo_entrega', v.tipo_entrega,
        'estado', v.estado, 'notas_comanda', v.notas_comanda,
        'delivery_zona_nombre', v.delivery_zona_nombre,
        'delivery_monto_usd', v.delivery_monto_usd,
        'delivery_monto_bs', v.delivery_monto_bs,
        'direccion_delivery', v.direccion_delivery,
        'cliente', (SELECT jsonb_build_object('id', c.id, 'nombre', c.nombre, 'telefono', c.telefono, 'direccion_delivery', c.direccion_delivery) FROM public.clientes c WHERE c.id = v.cliente_id),
        'items', (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', vi.id, 'producto_id', vi.producto_id, 'cantidad', vi.cantidad,
            'precio_unitario_usd', vi.precio_unitario_usd, 'subtotal_usd', vi.subtotal_usd,
            'notas_item', vi.notas_item,
            'producto', (SELECT jsonb_build_object('id', p.id, 'nombre', p.nombre, 'icono', p.icono) FROM public.productos p WHERE p.id = vi.producto_id),
            'extras', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', vie.id, 'cantidad', vie.cantidad, 'precio_unitario_usd', vie.precio_unitario_usd,
                'subtotal_usd', vie.subtotal_usd,
                'extra', (SELECT jsonb_build_object('id', em.id, 'nombre', em.nombre) FROM public.extras_modificadores em WHERE em.id = vie.extra_id)
            )), '[]'::jsonb) FROM public.ventas_items_extras vie WHERE vie.venta_item_id = vi.id)
        )), '[]'::jsonb) FROM public.ventas_items vi WHERE vi.venta_id = v.id)
    ) INTO v_recibo
    FROM public.ventas v WHERE v.id = p_venta_id;
    RETURN v_recibo;
END; $$;
GRANT EXECUTE ON FUNCTION public.fn_obtener_recibo_publico(UUID) TO anon, authenticated;

-- 3. PERMISOS PARA PREVENCIÓN DE FUERZA BRUTA EN LOGIN (RATE LIMITING)
GRANT EXECUTE ON FUNCTION public.fn_check_login_rate_limit(text, int, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_clear_login_attempts(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cleanup_login_attempts() TO anon, authenticated;


