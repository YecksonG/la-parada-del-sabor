-- ==============================================================================
-- MIGRACIÓN DE AUDITORÍA: FIX ANTI-SPAM EN PEDIDOS (HIDE SQLERRM)
-- La Parada del Sabor — 29 Ago 2026
-- ==============================================================================

-- Modificamos la función para no filtrar SQLERRM crudo, lo que puede revelar tablas y columnas.
CREATE OR REPLACE FUNCTION public.fn_crear_pedido_web(p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
    v_cliente_id UUID;
    v_venta_id UUID;
    v_numero_comanda TEXT;
    v_tasa_bcv NUMERIC;
    
    v_nombre_cliente TEXT := p_payload->>'nombre_cliente';
    v_telefono TEXT := p_payload->>'telefono';
    v_tipo_entrega TEXT := p_payload->>'tipo_entrega';
    v_delivery_zona_id UUID := (p_payload->>'delivery_zona_id')::UUID;
    v_direccion_delivery TEXT := p_payload->>'direccion_delivery';
    v_metodo_pago TEXT := p_payload->>'metodo_pago';
    v_notas_pedido TEXT := p_payload->>'notas_pedido';
    v_origen_pedido TEXT := COALESCE(p_payload->>'origen_pedido', 'web');
    
    v_items JSONB := p_payload->'items';
    v_item JSONB;
    v_extras JSONB;
    v_extra_id TEXT;
    
    v_total_usd NUMERIC := 0;
    v_total_bs NUMERIC := 0;
    
    v_delivery_monto_usd NUMERIC := 0;
    v_delivery_monto_bs NUMERIC := 0;
    v_delivery_zona_nombre TEXT := NULL;
    
    v_producto_precio NUMERIC;
    v_extra_precio NUMERIC;
    
    v_subtotal_usd NUMERIC;
    
    -- Variables para el control de SPAM
    v_telefono_limpio TEXT;
    v_ultimo_pedido TIMESTAMP;
    v_pedidos_pendientes INT;
    v_pedidos_hoy INT;
BEGIN
    -- 1. Limpiar y validar el teléfono para evitar evasión de spam
    v_telefono_limpio := regexp_replace(v_telefono, '\D', '', 'g');
    
    -- RATE LIMITING & ANTI-SPAM LOGIC
    IF v_telefono_limpio IS NOT NULL AND length(v_telefono_limpio) > 5 THEN
        -- 1.1 Cooldown (Anti ráfagas rápidas)
        SELECT MAX(fecha) INTO v_ultimo_pedido 
        FROM public.ventas v 
        JOIN public.clientes c ON v.cliente_id = c.id
        WHERE regexp_replace(c.telefono, '\D', '', 'g') = v_telefono_limpio;

        IF v_ultimo_pedido IS NOT NULL AND (extract(epoch from (now() - v_ultimo_pedido)) < 15) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Has realizado un pedido recientemente. Por favor, espera 15 segundos antes de intentar nuevamente.');
        END IF;

        -- 1.2 Límite de pedidos pendientes (Anti congestión)
        SELECT COUNT(*) INTO v_pedidos_pendientes 
        FROM public.ventas v 
        JOIN public.clientes c ON v.cliente_id = c.id
        WHERE regexp_replace(c.telefono, '\D', '', 'g') = v_telefono_limpio
        AND v.estado = 'pendiente';

        IF v_pedidos_pendientes >= 2 THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Ya tienes pedidos en curso. Por favor, espera a que sean procesados antes de realizar otro pedido.');
        END IF;

        -- 1.3 Límite diario (Anti abuso masivo)
        SELECT COUNT(*) INTO v_pedidos_hoy 
        FROM public.ventas v 
        JOIN public.clientes c ON v.cliente_id = c.id
        WHERE regexp_replace(c.telefono, '\D', '', 'g') = v_telefono_limpio
        AND date_trunc('day', v.fecha) = date_trunc('day', now());

        IF v_pedidos_hoy >= 15 THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Has alcanzado el límite diario de pedidos. Por favor contáctanos por WhatsApp para pedidos de gran volumen.');
        END IF;
    END IF;

    -- Obtener la tasa BCV actual
    SELECT tasa_usd_bs INTO v_tasa_bcv FROM public.tasas_cambio ORDER BY fecha DESC LIMIT 1;
    IF v_tasa_bcv IS NULL THEN 
        v_tasa_bcv := 60; 
    END IF;

    -- Upsert Cliente
    SELECT id INTO v_cliente_id FROM public.clientes WHERE telefono = v_telefono LIMIT 1;
    IF v_cliente_id IS NULL THEN
        INSERT INTO public.clientes (nombre, telefono, direccion_delivery)
        VALUES (v_nombre_cliente, v_telefono, v_direccion_delivery)
        RETURNING id INTO v_cliente_id;
    ELSE
        UPDATE public.clientes 
        SET nombre = v_nombre_cliente, direccion_delivery = COALESCE(v_direccion_delivery, direccion_delivery)
        WHERE id = v_cliente_id;
    END IF;

    -- Si es delivery y tiene zona
    IF v_tipo_entrega = 'delivery' AND v_delivery_zona_id IS NOT NULL THEN
        SELECT nombre, tarifa_usd INTO v_delivery_zona_nombre, v_delivery_monto_usd 
        FROM public.delivery_zonas WHERE id = v_delivery_zona_id;
        
        IF v_delivery_monto_usd IS NOT NULL THEN
            v_delivery_monto_bs := v_delivery_monto_usd * v_tasa_bcv;
            v_total_usd := v_total_usd + v_delivery_monto_usd;
            v_total_bs := v_total_bs + v_delivery_monto_bs;
        END IF;
    END IF;

    -- Generar Número de Comanda Diario
    SELECT COALESCE(MAX(CAST(numero_comanda AS INTEGER)), 0) + 1 
    INTO v_numero_comanda
    FROM public.ventas
    WHERE date_trunc('day', fecha) = date_trunc('day', now());

    -- Crear Venta (Estado pendiente)
    INSERT INTO public.ventas (
        numero_comanda, fecha, cliente_id, estado, 
        metodo_pago, tipo_entrega, delivery_zona_nombre, delivery_monto_usd, delivery_monto_bs, direccion_delivery,
        total_usd, total_bs, tasa_bcv, creado_por, notas_comanda, origen_pedido
    ) VALUES (
        v_numero_comanda::TEXT, now(), v_cliente_id, 'pendiente', 
        v_metodo_pago, v_tipo_entrega, v_delivery_zona_nombre, v_delivery_monto_usd, v_delivery_monto_bs, v_direccion_delivery,
        0, 0, v_tasa_bcv, NULL, v_notas_pedido, v_origen_pedido
    ) RETURNING id INTO v_venta_id;

    -- Procesar Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        SELECT precio_usd INTO v_producto_precio FROM public.productos WHERE id = (v_item->>'producto_id')::UUID;
        IF v_producto_precio IS NULL THEN CONTINUE; END IF;

        v_subtotal_usd := v_producto_precio * (v_item->>'cantidad')::NUMERIC;

        INSERT INTO public.ventas_items (
            venta_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd, notas_item
        ) VALUES (
            v_venta_id, (v_item->>'producto_id')::UUID, (v_item->>'cantidad')::INTEGER, 
            v_producto_precio, v_subtotal_usd, v_item->>'notas_item'
        );

        v_total_usd := v_total_usd + v_subtotal_usd;
        v_total_bs := v_total_bs + (v_subtotal_usd * v_tasa_bcv);

        v_extras := v_item->'extras_ids';
        IF v_extras IS NOT NULL AND jsonb_array_length(v_extras) > 0 THEN
            FOR v_extra_id IN SELECT * FROM jsonb_array_elements_text(v_extras)
            LOOP
                SELECT precio_usd INTO v_extra_precio FROM public.extras_modificadores WHERE id = v_extra_id::UUID;
                IF v_extra_precio IS NOT NULL THEN
                    v_subtotal_usd := v_extra_precio * (v_item->>'cantidad')::NUMERIC;
                    
                    INSERT INTO public.ventas_items_extras (
                        venta_item_id, extra_id, cantidad, precio_unitario_usd, subtotal_usd
                    ) VALUES (
                        currval(pg_get_serial_sequence('public.ventas_items', 'id')), v_extra_id::UUID, (v_item->>'cantidad')::INTEGER, 
                        v_extra_precio, v_subtotal_usd
                    );
                    
                    v_total_usd := v_total_usd + v_subtotal_usd;
                    v_total_bs := v_total_bs + (v_subtotal_usd * v_tasa_bcv);
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    -- Actualizar Total
    UPDATE public.ventas 
    SET total_usd = v_total_usd, total_bs = v_total_bs
    WHERE id = v_venta_id;

    RETURN jsonb_build_object(
        'ok', true,
        'venta_id', v_venta_id,
        'numero_comanda', v_numero_comanda
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Error al procesar el pedido. Por favor intente nuevamente.');
END;
$$;
