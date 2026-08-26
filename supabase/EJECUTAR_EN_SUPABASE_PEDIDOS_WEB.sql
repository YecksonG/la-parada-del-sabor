-- ==============================================================================
-- MIGRACIÓN UNIFICADA COMPLETA: Pedidos Web Públicos (/pedir), Recibos y Triggers de Inventario
-- ==============================================================================

-- 1. Ampliar estados permitidos en ventas
ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_estado_check;
ALTER TABLE public.ventas ADD CONSTRAINT ventas_estado_check 
    CHECK (estado IN ('pendiente', 'preparando', 'lista', 'completada', 'cancelada'));

-- 2. Asegurar columnas de tasa activa en tasas_cambio
ALTER TABLE public.tasas_cambio 
ADD COLUMN IF NOT EXISTS tasa_activa_tipo VARCHAR(30) DEFAULT 'bcv',
ADD COLUMN IF NOT EXISTS tasa_personalizada_bs NUMERIC(12, 4);

UPDATE public.tasas_cambio
SET tasa_usd_bs = bcv_usd_bs,
    tasa_activa_tipo = 'bcv'
WHERE tasa_usd_bs IS NULL OR tasa_activa_tipo IS NULL;

-- 3. POLÍTICAS PÚBLICAS RESTRINGIDAS (Catálogo y tasas para clientes web)
DO $$
BEGIN
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
END $$;

-- 4. TRIGGERS DE INVENTARIO PARA CONTROL DE PEDIDOS WEB Y POS
CREATE OR REPLACE FUNCTION public.fn_descontar_receta_venta()
RETURNS TRIGGER AS $$
DECLARE
    v_estado VARCHAR(30);
BEGIN
    SELECT estado INTO v_estado FROM public.ventas WHERE id = NEW.venta_id;
    
    -- Solo descuenta stock cuando la venta es directa/confirmada (no cuando es pendiente ni cancelada)
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

CREATE OR REPLACE FUNCTION public.fn_confirmar_pedido_web()
RETURNS TRIGGER AS $$
BEGIN
    -- Al pasar de 'pendiente' a 'preparando' o 'completada', descontar insumos de recetas y extras
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

-- 5. FUNCIÓN ATÓMICA RPC PARA CREAR PEDIDOS WEB (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.fn_crear_pedido_web(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_nombre_cliente TEXT;
    v_telefono TEXT;
    v_tipo_entrega TEXT;
    v_direccion_delivery TEXT;
    v_metodo_pago TEXT;
    v_notas_pedido TEXT;
    v_items JSONB;
    v_item JSONB;
    v_extra_id TEXT;
    
    v_cliente_id UUID;
    v_tasa_bcv NUMERIC(10,2);
    v_total_usd NUMERIC(10,2) := 0;
    v_total_bs NUMERIC(12,2) := 0;
    v_venta_id UUID;
    v_numero_comanda INT;
    v_venta_item_id UUID;
    
    v_producto_id UUID;
    v_prod_precio NUMERIC(10,2);
    v_prod_activo BOOLEAN;
    v_cantidad INT;
    v_notas_item TEXT;
    v_subtotal_item NUMERIC(10,2);
    
    v_ext_precio NUMERIC(10,2);
    v_ext_activo BOOLEAN;
BEGIN
    -- Validaciones básicas
    v_nombre_cliente := trim(p_payload->>'nombre_cliente');
    v_telefono := trim(p_payload->>'telefono');
    v_tipo_entrega := coalesce(p_payload->>'tipo_entrega', 'pickup');
    v_direccion_delivery := trim(p_payload->>'direccion_delivery');
    v_metodo_pago := coalesce(p_payload->>'metodo_pago', 'pago_movil');
    v_notas_pedido := trim(p_payload->>'notas_pedido');
    v_items := p_payload->'items';

    IF v_nombre_cliente IS NULL OR v_nombre_cliente = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Por favor indica tu nombre.');
    END IF;
    IF v_telefono IS NULL OR v_telefono = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Por favor indica tu teléfono / WhatsApp.');
    END IF;
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Tu pedido no tiene productos.');
    END IF;
    IF v_tipo_entrega = 'delivery' AND (v_direccion_delivery IS NULL OR v_direccion_delivery = '') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Indica la dirección para el delivery.');
    END IF;

    -- 1. Obtener la tasa activa del día
    SELECT coalesce(tasa_usd_bs, bcv_usd_bs) INTO v_tasa_bcv
    FROM public.tasas_cambio
    ORDER BY fecha DESC
    LIMIT 1;

    IF v_tasa_bcv IS NULL OR v_tasa_bcv <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No se pudo obtener la tasa de cambio oficial. Intenta en unos momentos.');
    END IF;

    -- 2. Cliente
    SELECT id INTO v_cliente_id FROM public.clientes WHERE telefono = v_telefono LIMIT 1;
    IF v_cliente_id IS NOT NULL THEN
        UPDATE public.clientes
        SET nombre = v_nombre_cliente,
            direccion_delivery = coalesce(nullif(v_direccion_delivery, ''), direccion_delivery),
            total_pedidos = total_pedidos + 1,
            actualizado_el = NOW()
        WHERE id = v_cliente_id;
    ELSE
        INSERT INTO public.clientes (nombre, telefono, direccion_delivery, total_pedidos)
        VALUES (v_nombre_cliente, v_telefono, nullif(v_direccion_delivery, ''), 1)
        RETURNING id INTO v_cliente_id;
    END IF;

    -- 3. Crear Venta cabecera
    INSERT INTO public.ventas (
        cliente_id,
        tasa_bcv,
        metodo_pago,
        tipo_entrega,
        estado,
        notas_comanda,
        creado_por,
        total_usd,
        total_bs
    ) VALUES (
        v_cliente_id,
        v_tasa_bcv,
        v_metodo_pago,
        v_tipo_entrega,
        'pendiente',
        nullif(v_notas_pedido, ''),
        'web_cliente',
        0,
        0
    ) RETURNING id, numero_comanda INTO v_venta_id, v_numero_comanda;

    -- 4. Procesar Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_producto_id := (v_item->>'producto_id')::UUID;
        v_cantidad := coalesce((v_item->>'cantidad')::INT, 1);
        v_notas_item := trim(v_item->>'notas_item');

        IF v_cantidad < 1 OR v_cantidad > 50 THEN
            RAISE EXCEPTION 'Cantidad inválida para el producto: %', v_cantidad;
        END IF;

        SELECT precio_usd, activo INTO v_prod_precio, v_prod_activo
        FROM public.productos
        WHERE id = v_producto_id;

        IF v_prod_precio IS NULL OR v_prod_activo IS NOT TRUE THEN
            RAISE EXCEPTION 'El producto solicitado no está disponible o no existe.';
        END IF;

        v_subtotal_item := round(v_prod_precio * v_cantidad, 2);
        v_total_usd := v_total_usd + v_subtotal_item;

        INSERT INTO public.ventas_items (
            venta_id,
            producto_id,
            cantidad,
            precio_unitario_usd,
            subtotal_usd,
            notas_item
        ) VALUES (
            v_venta_id,
            v_producto_id,
            v_cantidad,
            v_prod_precio,
            v_subtotal_item,
            nullif(v_notas_item, '')
        ) RETURNING id INTO v_venta_item_id;

        -- Extras del item
        IF v_item->'extras_ids' IS NOT NULL AND jsonb_array_length(v_item->'extras_ids') > 0 THEN
            FOR v_extra_id IN SELECT jsonb_array_elements_text(v_item->'extras_ids')
            LOOP
                SELECT precio_extra_usd, activo INTO v_ext_precio, v_ext_activo
                FROM public.extras_modificadores
                WHERE id = v_extra_id::UUID;

                IF v_ext_precio IS NOT NULL AND v_ext_activo IS TRUE THEN
                    v_total_usd := v_total_usd + round(v_ext_precio * v_cantidad, 2);
                    
                    INSERT INTO public.ventas_items_extras (
                        venta_item_id,
                        extra_id,
                        cantidad,
                        precio_unitario_usd,
                        subtotal_usd
                    ) VALUES (
                        v_venta_item_id,
                        v_extra_id::UUID,
                        v_cantidad,
                        v_ext_precio,
                        round(v_ext_precio * v_cantidad, 2)
                    );
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    -- 5. Totales finales
    v_total_bs := round(v_total_usd * v_tasa_bcv, 2);
    UPDATE public.ventas
    SET total_usd = v_total_usd,
        total_bs = v_total_bs
    WHERE id = v_venta_id;

    RETURN jsonb_build_object(
        'ok', true,
        'venta_id', v_venta_id,
        'numero_comanda', v_numero_comanda
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No se pudo procesar el pedido. Por favor verifica los datos e intenta nuevamente.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_crear_pedido_web(JSONB) TO anon, authenticated;

-- 6. FUNCIÓN RPC PARA OBTENER RECIBO POR UUID EXACTO (SECURITY DEFINER)
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
