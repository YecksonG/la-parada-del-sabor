-- ==============================================================================
-- MIGRACIÓN: Pedidos Web Públicos (/pedir) y Recibos Digitales Seguros (/recibo/[uuid])
-- ==============================================================================

-- 1. Ampliar estados permitidos en ventas (permitiendo 'pendiente', 'preparando', 'lista', 'completada', 'cancelada')
ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_estado_check;
ALTER TABLE public.ventas ADD CONSTRAINT ventas_estado_check 
    CHECK (estado IN ('pendiente', 'preparando', 'lista', 'completada', 'cancelada'));

-- 2. Asegurar que los triggers de inventario no descuenten stock si el estado es 'pendiente' o 'cancelada'
CREATE OR REPLACE FUNCTION public.fn_descontar_receta_venta()
RETURNS TRIGGER AS $$
DECLARE
    v_estado VARCHAR(30);
BEGIN
    SELECT estado INTO v_estado FROM public.ventas WHERE id = NEW.venta_id;
    
    -- Solo descuenta stock cuando la venta es confirmada/preparando/completada (no cuando es pendiente ni cancelada)
    IF v_estado NOT IN ('pendiente', 'cancelada') THEN
        UPDATE public.insumos i
        SET stock_actual = i.stock_actual - (r.cantidad * NEW.cantidad),
            actualizado_el = NOW()
        FROM public.recetas_ingredientes r
        WHERE r.insumo_id = i.id
          AND r.producto_id = NEW.producto_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_descontar_extra_venta()
RETURNS TRIGGER AS $$
DECLARE
    v_estado VARCHAR(30);
BEGIN
    SELECT v.estado INTO v_estado
    FROM public.ventas_items vi
    JOIN public.ventas v ON v.id = vi.venta_id
    WHERE vi.id = NEW.venta_item_id;

    IF v_estado NOT IN ('pendiente', 'cancelada') THEN
        UPDATE public.insumos i
        SET stock_actual = i.stock_actual - (e.cantidad_descuento * NEW.cantidad),
            actualizado_el = NOW()
        FROM public.extras_modificadores e
        WHERE e.id = NEW.extra_id
          AND e.insumo_id = i.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger al cambiar de 'pendiente' a 'preparando'/'completada' (descuenta inventario)
CREATE OR REPLACE FUNCTION public.fn_confirmar_pedido_web()
RETURNS TRIGGER AS $$
BEGIN
    -- Si pasa de 'pendiente' a 'preparando' o 'completada', descontar insumos de recetas y extras
    IF OLD.estado = 'pendiente' AND NEW.estado IN ('preparando', 'completada') THEN
        -- Descontar recetas
        UPDATE public.insumos i
        SET stock_actual = i.stock_actual - sub.total_descontar,
            actualizado_el = NOW()
        FROM (
            SELECT r.insumo_id, SUM(r.cantidad * vi.cantidad) as total_descontar
            FROM public.ventas_items vi
            JOIN public.recetas_ingredientes r ON r.producto_id = vi.producto_id
            WHERE vi.venta_id = NEW.id
            GROUP BY r.insumo_id
        ) sub
        WHERE i.id = sub.insumo_id;

        -- Descontar extras
        UPDATE public.insumos i
        SET stock_actual = i.stock_actual - sub_ext.total_extra,
            actualizado_el = NOW()
        FROM (
            SELECT e.insumo_id, SUM(e.cantidad_descuento * vie.cantidad) as total_extra
            FROM public.ventas_items vi
            JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
            JOIN public.extras_modificadores e ON e.id = vie.extra_id
            WHERE vi.venta_id = NEW.id AND e.insumo_id IS NOT NULL
            GROUP BY e.insumo_id
        ) sub_ext
        WHERE i.id = sub_ext.insumo_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_confirmar_pedido_web ON public.ventas;
CREATE TRIGGER trg_confirmar_pedido_web
AFTER UPDATE OF estado ON public.ventas
FOR EACH ROW
EXECUTE FUNCTION public.fn_confirmar_pedido_web();

-- 4. POLÍTICAS PÚBLICAS RESTRINGIDAS (SOLO CATÁLOGO Y TASAS PÚBLICAS)
DO $$
BEGIN
    -- Catálogo activo (público para /pedir)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_categorias') THEN
        CREATE POLICY "anon_read_categorias" ON public.categorias FOR SELECT TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_productos') THEN
        CREATE POLICY "anon_read_productos" ON public.productos FOR SELECT TO anon USING (activo = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_extras') THEN
        CREATE POLICY "anon_read_extras" ON public.extras_modificadores FOR SELECT TO anon USING (activo = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_tasas') THEN
        CREATE POLICY "anon_read_tasas" ON public.tasas_cambio FOR SELECT TO anon USING (true);
    END IF;

    -- Eliminamos cualquier política abierta de lectura masiva de ventas o clientes para anon
    DROP POLICY IF EXISTS "anon_read_clientes" ON public.clientes;
    DROP POLICY IF EXISTS "anon_read_ventas" ON public.ventas;
    DROP POLICY IF EXISTS "anon_read_ventas_items" ON public.ventas_items;
    DROP POLICY IF EXISTS "anon_read_ventas_extras" ON public.ventas_items_extras;
    DROP POLICY IF EXISTS "anon_insert_ventas" ON public.ventas;
    DROP POLICY IF EXISTS "anon_insert_ventas_items" ON public.ventas_items;
    DROP POLICY IF EXISTS "anon_insert_ventas_extras" ON public.ventas_items_extras;
    DROP POLICY IF EXISTS "anon_insert_clientes" ON public.clientes;
END $$;

-- 5. FUNCIÓN SEGURA RPC PARA OBTENER RECIBO POR UUID EXACTO (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.fn_obtener_recibo_publico(p_venta_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recibo JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', v.id,
        'numero_comanda', v.numero_comanda,
        'fecha', v.fecha,
        'total_usd', v.total_usd,
        'total_bs', v.total_bs,
        'tasa_bcv', v.tasa_bcv,
        'metodo_pago', v.metodo_pago,
        'tipo_entrega', v.tipo_entrega,
        'estado', v.estado,
        'notas_comanda', v.notas_comanda,
        'cliente', (
            SELECT jsonb_build_object(
                'id', c.id,
                'nombre', c.nombre,
                'telefono', c.telefono,
                'direccion_delivery', c.direccion_delivery
            )
            FROM public.clientes c
            WHERE c.id = v.cliente_id
        ),
        'items', (
            SELECT coalesce(jsonb_agg(
                jsonb_build_object(
                    'id', vi.id,
                    'producto_id', vi.producto_id,
                    'cantidad', vi.cantidad,
                    'precio_unitario_usd', vi.precio_unitario_usd,
                    'subtotal_usd', vi.subtotal_usd,
                    'notas_item', vi.notas_item,
                    'producto', (
                        SELECT jsonb_build_object(
                            'id', p.id,
                            'nombre', p.nombre,
                            'icono', p.icono
                        )
                        FROM public.productos p
                        WHERE p.id = vi.producto_id
                    ),
                    'extras', (
                        SELECT coalesce(jsonb_agg(
                            jsonb_build_object(
                                'id', vie.id,
                                'cantidad', vie.cantidad,
                                'precio_unitario_usd', vie.precio_unitario_usd,
                                'subtotal_usd', vie.subtotal_usd,
                                'extra', (
                                    SELECT jsonb_build_object(
                                        'id', em.id,
                                        'nombre', em.nombre
                                    )
                                    FROM public.extras_modificadores em
                                    WHERE em.id = vie.extra_id
                                )
                            )
                        ), '[]'::jsonb)
                        FROM public.ventas_items_extras vie
                        WHERE vie.venta_item_id = vi.id
                    )
                )
            ), '[]'::jsonb)
            FROM public.ventas_items vi
            WHERE vi.venta_id = v.id
        )
    ) INTO v_recibo
    FROM public.ventas v
    WHERE v.id = p_venta_id;

    RETURN v_recibo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_obtener_recibo_publico(UUID) TO anon, authenticated;
