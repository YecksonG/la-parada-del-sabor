-- ==============================================================================
-- MIGRACIÓN: Selección de Tasa Activa para Facturación y Clientes
-- ==============================================================================

-- 1. Agregar columnas a tasas_cambio
ALTER TABLE public.tasas_cambio 
ADD COLUMN IF NOT EXISTS tasa_activa_tipo VARCHAR(30) DEFAULT 'bcv',
ADD COLUMN IF NOT EXISTS tasa_personalizada_bs NUMERIC(12, 4);

-- 2. Asegurar que tasa_usd_bs tenga por defecto el valor de bcv_usd_bs si está nulo
UPDATE public.tasas_cambio
SET tasa_usd_bs = bcv_usd_bs,
    tasa_activa_tipo = 'bcv'
WHERE tasa_usd_bs IS NULL OR tasa_activa_tipo IS NULL;

-- 3. Documentación semántica de ventas.tasa_bcv
COMMENT ON COLUMN public.ventas.tasa_bcv IS 'Tasa de cambio efectiva aplicada a la comanda/factura al momento de registrar la venta';

-- 3. Actualizar la función RPC fn_crear_pedido_web para usar la tasa_usd_bs activa
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

    -- 1. Obtener la tasa activa de facturación del día (tasa_usd_bs o bcv_usd_bs)
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
        IF v_tipo_entrega = 'delivery' AND v_direccion_delivery <> '' THEN
            UPDATE public.clientes
            SET nombre = v_nombre_cliente,
                direccion_delivery = v_direccion_delivery,
                total_pedidos = total_pedidos + 1,
                actualizado_el = NOW()
            WHERE id = v_cliente_id;
        ELSE
            UPDATE public.clientes
            SET nombre = v_nombre_cliente,
                total_pedidos = total_pedidos + 1,
                actualizado_el = NOW()
            WHERE id = v_cliente_id;
        END IF;
    ELSE
        INSERT INTO public.clientes (nombre, telefono, direccion_delivery, total_pedidos)
        VALUES (v_nombre_cliente, v_telefono, nullif(v_direccion_delivery, ''), 1)
        RETURNING id INTO v_cliente_id;
    END IF;

    -- 3. Crear Venta cabecera inicial (total temporal en 0, luego se actualiza)
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

    -- 4. Procesar Items y validar cantidades estrictas (1..50)
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_producto_id := (v_item->>'producto_id')::UUID;
        v_cantidad := coalesce((v_item->>'cantidad')::INT, 1);
        v_notas_item := trim(v_item->>'notas_item');

        -- Validación estricta de cantidad
        IF v_cantidad < 1 OR v_cantidad > 50 THEN
            RAISE EXCEPTION 'Cantidad inválida para el producto: %', v_cantidad;
        END IF;

        -- Obtener producto autoritativo
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

    -- 5. Actualizar totales autoritativos de la venta
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
