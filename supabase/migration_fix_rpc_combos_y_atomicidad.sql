-- ==============================================================================
-- 🚨 MIGRACIÓN DE BLINDAJE DEFINITIVO: RPC fn_crear_pedido_web & TOTALES DELIVERY
-- ==============================================================================
-- 1. Rechaza con RAISE EXCEPTION si un ítem combo no incluye "rellenos:" en notas_item.
-- 2. Transacción atómica: Cualquier error (producto agotado, cantidad inválida, combo sin relleno)
--    lanza RAISE EXCEPTION, abortando toda la transacción sin dejar cabecera huérfana.
-- 3. Blindaje de concurrencia: Bloqueo de cliente con FOR UPDATE al validar pedidos pendientes.
-- 4. Triggers de totales actualizados con delivery_monto_usd.

-- Triggers de totales consolidados con delivery
CREATE OR REPLACE FUNCTION public.fn_recalcular_totales_venta()
RETURNS TRIGGER AS $$
DECLARE
    v_id UUID;
    v_total_items NUMERIC(10, 2) := 0;
    v_total_extras NUMERIC(10, 2) := 0;
    v_delivery NUMERIC(10, 2) := 0;
    v_total_usd NUMERIC(10, 2) := 0;
    v_tasa NUMERIC(12, 4) := 1;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_id := OLD.venta_id;
    ELSE
        v_id := NEW.venta_id;
    END IF;

    SELECT COALESCE(tasa_bcv, 1), COALESCE(delivery_monto_usd, 0)
    INTO v_tasa, v_delivery
    FROM public.ventas
    WHERE id = v_id;

    IF v_tasa IS NULL OR v_tasa <= 0 THEN v_tasa := 1; END IF;
    IF v_delivery IS NULL OR v_delivery < 0 THEN v_delivery := 0; END IF;

    SELECT COALESCE(SUM(subtotal_usd), 0) INTO v_total_items
    FROM public.ventas_items
    WHERE venta_id = v_id;

    SELECT COALESCE(SUM(vie.subtotal_usd), 0) INTO v_total_extras
    FROM public.ventas_items vi
    JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
    WHERE vi.venta_id = v_id;

    v_total_usd := v_total_items + v_total_extras + v_delivery;

    UPDATE public.ventas
    SET total_usd = v_total_usd,
        total_bs = ROUND((v_total_usd * v_tasa)::NUMERIC, 2)
    WHERE id = v_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_totales_ventas_items ON public.ventas_items;
CREATE TRIGGER trg_recalc_totales_ventas_items
AFTER INSERT OR UPDATE OR DELETE ON public.ventas_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_recalcular_totales_venta();

CREATE OR REPLACE FUNCTION public.fn_recalcular_totales_venta_extras()
RETURNS TRIGGER AS $$
DECLARE
    v_id UUID;
    v_item_id UUID;
    v_total_items NUMERIC(10, 2) := 0;
    v_total_extras NUMERIC(10, 2) := 0;
    v_delivery NUMERIC(10, 2) := 0;
    v_total_usd NUMERIC(10, 2) := 0;
    v_tasa NUMERIC(12, 4) := 1;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_item_id := OLD.venta_item_id;
    ELSE
        v_item_id := NEW.venta_item_id;
    END IF;

    SELECT venta_id INTO v_id FROM public.ventas_items WHERE id = v_item_id;
    IF v_id IS NULL THEN RETURN NULL; END IF;

    SELECT COALESCE(tasa_bcv, 1), COALESCE(delivery_monto_usd, 0)
    INTO v_tasa, v_delivery
    FROM public.ventas
    WHERE id = v_id;

    IF v_tasa IS NULL OR v_tasa <= 0 THEN v_tasa := 1; END IF;
    IF v_delivery IS NULL OR v_delivery < 0 THEN v_delivery := 0; END IF;

    SELECT COALESCE(SUM(subtotal_usd), 0) INTO v_total_items
    FROM public.ventas_items
    WHERE venta_id = v_id;

    SELECT COALESCE(SUM(vie.subtotal_usd), 0) INTO v_total_extras
    FROM public.ventas_items vi
    JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
    WHERE vi.venta_id = v_id;

    v_total_usd := v_total_items + v_total_extras + v_delivery;

    UPDATE public.ventas
    SET total_usd = v_total_usd,
        total_bs = ROUND((v_total_usd * v_tasa)::NUMERIC, 2)
    WHERE id = v_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_totales_ventas_extras ON public.ventas_items_extras;
CREATE TRIGGER trg_recalc_totales_ventas_extras
AFTER INSERT OR UPDATE OR DELETE ON public.ventas_items_extras
FOR EACH ROW
EXECUTE FUNCTION public.fn_recalcular_totales_venta_extras();

-- RPC DEFINITIVA DE CREACIÓN DE PEDIDO WEB CON BLINDAJE Y ATOMICIDAD TOTAL
CREATE OR REPLACE FUNCTION public.fn_crear_pedido_web(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_nombre_cliente TEXT;
    v_telefono_cliente TEXT;
    v_telefono_limpio TEXT;
    v_direccion_delivery TEXT;
    v_tipo_entrega TEXT;
    v_metodo_pago TEXT;
    v_delivery_zona_id UUID;
    v_delivery_zona_nombre TEXT := NULL;
    v_delivery_monto_usd NUMERIC(10,2) := 0;
    v_delivery_monto_bs NUMERIC(12,2) := 0;
    v_notas_pedido TEXT;
    v_origen_pedido TEXT;
    v_items JSONB;
    v_cliente_id UUID;
    v_venta_id UUID;
    v_numero_comanda INT;
    v_tasa_bcv NUMERIC(12,4);
    v_total_usd NUMERIC(10,2) := 0;
    v_total_bs NUMERIC(12,2) := 0;
    v_item JSONB;
    v_producto_id UUID;
    v_prod_nombre TEXT;
    v_prod_precio NUMERIC(10,2);
    v_prod_activo BOOLEAN;
    v_cantidad INT;
    v_notas_item TEXT;
    v_subtotal_item NUMERIC(10,2);
    v_venta_item_id UUID;
    v_extra_id TEXT;
    v_ext_precio NUMERIC(10,2);
    v_ext_activo BOOLEAN;
    v_pedidos_pendientes INT;
    v_pedidos_hoy INT;
    v_cliente_bloqueado BOOLEAN;
BEGIN
    -- 1. Validar y Sanitizar Inputs Principales
    v_nombre_cliente := left(trim(coalesce(p_payload->>'nombre_cliente', '')), 100);
    v_telefono_cliente := left(trim(coalesce(p_payload->>'telefono_cliente', '')), 30);
    v_telefono_limpio := regexp_replace(v_telefono_cliente, '\D', '', 'g');
    v_direccion_delivery := left(trim(coalesce(p_payload->>'direccion_delivery', '')), 300);
    v_tipo_entrega := coalesce(p_payload->>'tipo_entrega', 'pickup');
    v_metodo_pago := coalesce(p_payload->>'metodo_pago', 'pago_movil');
    v_notas_pedido := left(trim(coalesce(p_payload->>'notas_pedido', '')), 500);
    v_origen_pedido := coalesce(p_payload->>'origen_pedido', 'web');
    v_items := p_payload->'items';

    IF length(v_nombre_cliente) < 2 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El nombre debe tener al menos 2 caracteres.');
    END IF;

    IF length(v_telefono_limpio) < 7 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Número de teléfono inválido (mínimo 7 dígitos numéricos).');
    END IF;

    IF v_tipo_entrega NOT IN ('pickup', 'delivery', 'puerta_cerrada', 'mesa') THEN
        v_tipo_entrega := 'pickup';
    END IF;

    IF v_metodo_pago NOT IN ('pago_movil', 'efectivo_usd', 'efectivo_bs', 'binance', 'zelle', 'punto_de_venta') THEN
        v_metodo_pago := 'pago_movil';
    END IF;

    IF v_items IS NULL OR jsonb_typeof(v_items) != 'array' OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El carrito de compras está vacío.');
    END IF;

    IF jsonb_array_length(v_items) > 30 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Máximo 30 productos diferentes por orden.');
    END IF;

    -- Obtener Tasa de Cambio BCV Oficial
    SELECT coalesce(tasa_usd_bs, coalesce(bcv_usd_bs, 1)) INTO v_tasa_bcv
    FROM public.tasas_cambio
    ORDER BY fecha DESC LIMIT 1;
    IF v_tasa_bcv IS NULL OR v_tasa_bcv <= 0 THEN v_tasa_bcv := 1; END IF;

    -- Validar Zona de Delivery
    IF v_tipo_entrega = 'delivery' THEN
        IF length(v_direccion_delivery) < 5 THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Por favor ingresa una dirección clara para la entrega a domicilio.');
        END IF;

        IF p_payload->>'delivery_zona_id' IS NOT NULL AND trim(p_payload->>'delivery_zona_id') != '' THEN
            BEGIN
                v_delivery_zona_id := (p_payload->>'delivery_zona_id')::UUID;
            EXCEPTION WHEN OTHERS THEN
                v_delivery_zona_id := NULL;
            END;
        END IF;

        IF v_delivery_zona_id IS NOT NULL THEN
            SELECT nombre, coalesce(precio_usd, 0)
            INTO v_delivery_zona_nombre, v_delivery_monto_usd
            FROM public.zonas_delivery
            WHERE id = v_delivery_zona_id AND activa = true;
        END IF;

        IF v_delivery_zona_nombre IS NULL THEN
            SELECT nombre, coalesce(precio_usd, 0)
            INTO v_delivery_zona_nombre, v_delivery_monto_usd
            FROM public.zonas_delivery
            WHERE activa = true
            ORDER BY orden ASC LIMIT 1;
        END IF;

        IF v_delivery_monto_usd IS NULL THEN v_delivery_monto_usd := 0; END IF;
        IF v_delivery_monto_usd > 0 THEN
            v_delivery_monto_bs := round(v_delivery_monto_usd * v_tasa_bcv, 2);
            v_total_usd := v_delivery_monto_usd;
            v_total_bs := v_delivery_monto_bs;
        END IF;
    END IF;

    -- 2. Cliente: Búsqueda y Protección
    SELECT id, coalesce(bloqueado, false) INTO v_cliente_id, v_cliente_bloqueado
    FROM public.clientes
    WHERE (
        length(regexp_replace(coalesce(telefono, ''), '\D', '', 'g')) >= 7
        AND regexp_replace(coalesce(telefono, ''), '\D', '', 'g') = v_telefono_limpio
    ) OR (
        lower(trim(nombre)) = lower(trim(v_nombre_cliente))
    )
    ORDER BY total_pedidos DESC
    LIMIT 1;

    IF v_cliente_bloqueado IS TRUE THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No se puede procesar el pedido. Por favor contacta al restaurante directamente.');
    END IF;

    IF v_cliente_id IS NOT NULL THEN
        -- Control de concurrencia y límites
        PERFORM 1 FROM public.clientes WHERE id = v_cliente_id FOR UPDATE;

        IF EXISTS (
            SELECT 1 FROM public.ventas
            WHERE cliente_id = v_cliente_id
              AND fecha > NOW() - INTERVAL '15 seconds'
        ) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Por favor espera 15 segundos antes de enviar otro pedido.');
        END IF;

        SELECT count(*) INTO v_pedidos_pendientes
        FROM public.ventas
        WHERE cliente_id = v_cliente_id
          AND estado = 'pendiente';

        IF v_pedidos_pendientes >= 2 THEN
            RETURN jsonb_build_object(
                'ok', false,
                'code', 'LIMIT_PENDING_ORDERS',
                'error', 'Actualmente ya tienes 2 pedidos en cola de confirmación asociados a tu número de teléfono.'
            );
        END IF;

        SELECT count(*) INTO v_pedidos_hoy
        FROM public.ventas
        WHERE cliente_id = v_cliente_id
          AND fecha >= CURRENT_DATE;

        IF v_pedidos_hoy >= 15 THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Has alcanzado el límite de pedidos diarios para este número de teléfono.');
        END IF;

        UPDATE public.clientes
        SET direccion = coalesce(nullif(v_direccion_delivery, ''), direccion),
            notas = coalesce(nullif(v_notas_pedido, ''), notas),
            total_pedidos = coalesce(total_pedidos, 0) + 1
        WHERE id = v_cliente_id;
    ELSE
        INSERT INTO public.clientes (nombre, telefono, direccion, notas, total_pedidos)
        VALUES (v_nombre_cliente, v_telefono_cliente, nullif(v_direccion_delivery, ''), nullif(v_notas_pedido, ''), 1)
        RETURNING id INTO v_cliente_id;
    END IF;

    -- 3. Crear Cabecera de Venta
    INSERT INTO public.ventas (
        cliente_id, tasa_bcv, metodo_pago, tipo_entrega,
        delivery_zona_nombre, delivery_monto_usd, delivery_monto_bs, direccion_delivery,
        estado, notas_comanda, creado_por, origen_pedido, total_usd, total_bs
    ) VALUES (
        v_cliente_id, v_tasa_bcv, v_metodo_pago, v_tipo_entrega,
        v_delivery_zona_nombre, v_delivery_monto_usd, v_delivery_monto_bs, nullif(v_direccion_delivery, ''),
        'pendiente', nullif(v_notas_pedido, ''), 'web_cliente', v_origen_pedido, 0, 0
    ) RETURNING id, numero_comanda INTO v_venta_id, v_numero_comanda;

    -- 4. Procesar Items (Con validación estricta de combos de arepas y atomicidad)
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
        v_producto_id := (v_item->>'producto_id')::UUID;
        v_cantidad := coalesce((v_item->>'cantidad')::INT, 1);
        v_notas_item := left(trim(coalesce(v_item->>'notas_item', '')), 300);

        IF v_cantidad < 1 OR v_cantidad > 50 THEN
            RAISE EXCEPTION 'Cantidad no permitida por producto (mínimo 1, máximo 50).';
        END IF;

        SELECT nombre, precio_usd, activo INTO v_prod_nombre, v_prod_precio, v_prod_activo
        FROM public.productos
        WHERE id = v_producto_id;

        IF v_prod_precio IS NULL OR v_prod_activo IS NOT TRUE THEN
            RAISE EXCEPTION 'El producto seleccionado no está disponible en este momento.';
        END IF;

        -- 🛡️ BLINDAJE DE COMBOS DE AREPAS EN BASE DE DATOS:
        -- Si el nombre del producto corresponde a un combo de arepas, EXIGIR que vengan los rellenos seleccionados
        IF (v_prod_nombre ILIKE '%combo%arepa%' OR v_prod_nombre ILIKE '%antojo r_pido%' OR v_prod_nombre ILIKE '%d_o parrandero%' OR v_prod_nombre ILIKE '%tr_o parrandero%' OR v_prod_nombre ILIKE '%banquete familiar%') THEN
            IF v_notas_item IS NULL OR v_notas_item NOT ILIKE '%rellenos:%' THEN
                RAISE EXCEPTION 'El combo de arepas "%" requiere la selección obligatoria de sus rellenos.', v_prod_nombre;
            END IF;
        END IF;

        v_subtotal_item := round(v_prod_precio * v_cantidad, 2);
        v_total_usd := v_total_usd + v_subtotal_item;
        v_total_bs := v_total_bs + round(v_subtotal_item * v_tasa_bcv, 2);

        INSERT INTO public.ventas_items (venta_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd, notas_item)
        VALUES (v_venta_id, v_producto_id, v_cantidad, v_prod_precio, v_subtotal_item, nullif(v_notas_item, ''))
        RETURNING id INTO v_venta_item_id;

        IF v_item->'extras_ids' IS NOT NULL AND jsonb_array_length(v_item->'extras_ids') > 0 THEN
            FOR v_extra_id IN SELECT jsonb_array_elements_text(v_item->'extras_ids') LOOP
                SELECT precio_extra_usd, activo INTO v_ext_precio, v_ext_activo
                FROM public.extras_modificadores
                WHERE id = v_extra_id::UUID;

                IF v_ext_precio IS NOT NULL AND v_ext_activo IS TRUE THEN
                    v_total_usd := v_total_usd + round(v_ext_precio * v_cantidad, 2);
                    v_total_bs := v_total_bs + round(v_ext_precio * v_cantidad * v_tasa_bcv, 2);

                    INSERT INTO public.ventas_items_extras (venta_item_id, extra_id, cantidad, precio_unitario_usd, subtotal_usd)
                    VALUES (v_venta_item_id, v_extra_id::UUID, v_cantidad, v_ext_precio, round(v_ext_precio * v_cantidad, 2));
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    -- 5. Actualizar Totales Finales
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
        -- Aborta cualquier operación y revierte la transacción automáticamente
        RETURN jsonb_build_object('ok', false, 'error', 'Error al procesar el pedido: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_crear_pedido_web(JSONB) TO anon, authenticated;
