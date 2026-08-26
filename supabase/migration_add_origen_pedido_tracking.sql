-- ==============================================================================
-- MIGRACIÓN: RASTREO DE CANAL DE ORIGEN (INSTAGRAM / WHATSAPP / QR / DIRECTO / POS)
-- ==============================================================================

-- 1. Asegurar columna origen_pedido en la tabla ventas
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS origen_pedido VARCHAR(50) DEFAULT 'directo';

-- 2. Asegurar columna actualizado_el en la tabla clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS actualizado_el TIMESTAMPTZ DEFAULT NOW();

-- 3. Actualizar función RPC fn_crear_pedido_web con soporte para origen_pedido
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
    v_origen_pedido TEXT;
    v_items JSONB;
    v_item JSONB;
    v_extra_id TEXT;
    
    v_cliente_id UUID;
    v_tasa_bcv NUMERIC(12,4);
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
    v_origen_pedido := coalesce(nullif(trim(p_payload->>'origen_pedido'), ''), 'directo');
    v_items := p_payload->'items';

    IF v_nombre_cliente IS NULL OR v_nombre_cliente = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Por favor indica tu nombre.');
    END IF;
    IF v_telefono IS NULL OR v_telefono = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Por favor indica tu teléfono / WhatsApp.');
    END IF;
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Tu pedido no tiene productos seleccionados.');
    END IF;
    IF v_tipo_entrega = 'delivery' AND (v_direccion_delivery IS NULL OR v_direccion_delivery = '') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Por favor ingresa la dirección exacta para el delivery.');
    END IF;

    -- 1. Obtener la tasa activa del día
    SELECT coalesce(tasa_usd_bs, bcv_usd_bs) INTO v_tasa_bcv
    FROM public.tasas_cambio
    ORDER BY fecha DESC
    LIMIT 1;

    IF v_tasa_bcv IS NULL OR v_tasa_bcv <= 0 THEN
        v_tasa_bcv := 60.0;
    END IF;

    -- 2. Cliente: Búsqueda inteligente por teléfono normalizado o por nombre (sin duplicar)
    SELECT id INTO v_cliente_id 
    FROM public.clientes 
    WHERE (
        length(regexp_replace(coalesce(telefono, ''), '\D', '', 'g')) >= 7 
        AND regexp_replace(coalesce(telefono, ''), '\D', '', 'g') = regexp_replace(v_telefono, '\D', '', 'g')
    ) OR (
        lower(trim(nombre)) = lower(trim(v_nombre_cliente))
    )
    ORDER BY total_pedidos DESC
    LIMIT 1;

    IF v_cliente_id IS NOT NULL THEN
        -- Anti-Doble Clic / Spam accidental (5 segundos de gracia)
        IF EXISTS (
            SELECT 1 FROM public.ventas 
            WHERE cliente_id = v_cliente_id 
              AND estado = 'pendiente' 
              AND fecha > NOW() - INTERVAL '5 seconds'
        ) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Ya recibimos tu comanda hace unos segundos. Por favor espera un momento.');
        END IF;

        -- Actualizar datos y sumar pedido al historial
        UPDATE public.clientes
        SET nombre = v_nombre_cliente,
            telefono = coalesce(nullif(v_telefono, ''), telefono),
            direccion_delivery = coalesce(nullif(v_direccion_delivery, ''), direccion_delivery),
            total_pedidos = coalesce(total_pedidos, 0) + 1,
            actualizado_el = NOW()
        WHERE id = v_cliente_id;
    ELSE
        INSERT INTO public.clientes (nombre, telefono, direccion_delivery, total_pedidos)
        VALUES (v_nombre_cliente, v_telefono, nullif(v_direccion_delivery, ''), 1)
        RETURNING id INTO v_cliente_id;
    END IF;

    -- 3. Crear Venta cabecera con origen_pedido
    INSERT INTO public.ventas (
        cliente_id,
        tasa_bcv,
        metodo_pago,
        tipo_entrega,
        estado,
        notas_comanda,
        creado_por,
        origen_pedido,
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
        v_origen_pedido,
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
            RAISE EXCEPTION 'Cantidad inválida para uno de los productos seleccionados: %', v_cantidad;
        END IF;

        SELECT precio_usd, activo INTO v_prod_precio, v_prod_activo
        FROM public.productos
        WHERE id = v_producto_id;

        IF v_prod_precio IS NULL OR v_prod_activo IS NOT TRUE THEN
            RAISE EXCEPTION 'El producto solicitado no está disponible en este momento.';
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
        RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_crear_pedido_web(JSONB) TO anon, authenticated;
