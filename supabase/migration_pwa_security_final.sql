-- ============================================================
-- AUDITORÍA 2026-08-29: CORRECCIONES DE SEGURIDAD DEFINITIVAS
-- ============================================================

-- 1) ELIMINAR FUGA ANÓNIMA DE VENTAS/CLIENTES (si existe la política)
DROP POLICY IF EXISTS "anon_read_ventas_recibo" ON public.ventas;
DROP POLICY IF EXISTS "anon_read_ventas_items_recibo" ON public.ventas_items;
DROP POLICY IF EXISTS "anon_read_ventas_extras_recibo" ON public.ventas_items_extras;
DROP POLICY IF EXISTS "anon_read_ventas" ON public.ventas;
DROP POLICY IF EXISTS "anon_read_ventas_items" ON public.ventas_items;
DROP POLICY IF EXISTS "anon_read_ventas_extras" ON public.ventas_items_extras;
DROP POLICY IF EXISTS "anon_read_clientes" ON public.clientes;
DROP POLICY IF EXISTS "anon_insert_ventas" ON public.ventas;
DROP POLICY IF EXISTS "anon_insert_ventas_items" ON public.ventas_items;
DROP POLICY IF EXISTS "anon_insert_ventas_extras" ON public.ventas_items_extras;
DROP POLICY IF EXISTS "anon_insert_clientes" ON public.clientes;
-- Verificación (debe devolver 0 filas):
-- SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('ventas','ventas_items','ventas_items_extras','clientes') AND roles::text LIKE '%anon%' AND cmd='SELECT';

-- 2) BLOQUEAR RPC DE RATE-LIMIT A ANON/AUTHENTICATED (solo service_role)
REVOKE EXECUTE ON FUNCTION public.fn_check_login_rate_limit(text, int, int, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_clear_login_attempts(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_cleanup_login_attempts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_check_login_rate_limit(text, int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_clear_login_attempts(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_cleanup_login_attempts() TO service_role;

-- 3) REESCRIBIR fn_crear_pedido_web SIN FILTRAR SQLERRM y SIN ILIKE sobre zonas
CREATE OR REPLACE FUNCTION public.fn_crear_pedido_web(p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_nombre_cliente TEXT; v_telefono TEXT; v_tipo_entrega TEXT;
    v_delivery_zona_id UUID; v_delivery_zona_nombre TEXT := NULL;
    v_delivery_monto_usd NUMERIC(10,2) := 0; v_delivery_monto_bs NUMERIC(12,2) := 0;
    v_direccion_delivery TEXT; v_metodo_pago TEXT; v_notas_pedido TEXT;
    v_origen_pedido TEXT; v_items JSONB; v_item JSONB; v_extra_id TEXT;
    v_cliente_id UUID; v_tasa_bcv NUMERIC(12,4);
    v_total_usd NUMERIC(10,2) := 0; v_total_bs NUMERIC(12,2) := 0;
    v_venta_id UUID; v_numero_comanda INT; v_venta_item_id UUID;
    v_producto_id UUID; v_prod_precio NUMERIC(10,2); v_prod_activo BOOLEAN;
    v_cantidad INT; v_notas_item TEXT; v_subtotal_item NUMERIC(10,2);
    v_ext_precio NUMERIC(10,2); v_ext_activo BOOLEAN;
    v_pedidos_pendientes INT := 0; v_pedidos_hoy INT := 0;
    v_telefono_limpio TEXT;
BEGIN
    v_nombre_cliente := left(trim(p_payload->>'nombre_cliente'), 120);
    v_telefono := left(trim(p_payload->>'telefono'), 30);
    v_tipo_entrega := coalesce(p_payload->>'tipo_entrega', 'pickup');
    v_delivery_zona_id := (p_payload->>'delivery_zona_id')::UUID;
    v_direccion_delivery := left(trim(p_payload->>'direccion_delivery'), 300);
    v_metodo_pago := coalesce(p_payload->>'metodo_pago', 'pago_movil');
    v_notas_pedido := left(trim(p_payload->>'notas_pedido'), 500);
    v_origen_pedido := coalesce(nullif(trim(p_payload->>'origen_pedido'), ''), 'web');
    v_items := p_payload->'items';

    IF v_nombre_cliente IS NULL OR length(v_nombre_cliente) < 2 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Por favor indica tu nombre completo.');
    END IF;
    v_telefono_limpio := regexp_replace(v_telefono, '\D', '', 'g');
    IF v_telefono IS NULL OR length(v_telefono_limpio) < 7 OR length(v_telefono_limpio) > 20 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Por favor ingresa un número de teléfono / WhatsApp válido.');
    END IF;
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 OR jsonb_array_length(v_items) > 25 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Cantidad de productos del pedido no válida.');
    END IF;
    IF v_tipo_entrega = 'delivery' AND (v_direccion_delivery IS NULL OR length(v_direccion_delivery) < 4) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Por favor ingresa una dirección detallada para el delivery.');
    END IF;

    SELECT coalesce(tasa_usd_bs, bcv_usd_bs) INTO v_tasa_bcv FROM public.tasas_cambio
    ORDER BY fecha DESC LIMIT 1;
    IF v_tasa_bcv IS NULL OR v_tasa_bcv <= 0 THEN v_tasa_bcv := 60.0; END IF;

    -- Zona de delivery por UUID exacto (nada de ILIKE sobre input)
    IF v_tipo_entrega = 'delivery' AND v_delivery_zona_id IS NOT NULL THEN
        SELECT nombre, coalesce(precio_usd, 0) INTO v_delivery_zona_nombre, v_delivery_monto_usd
        FROM public.zonas_delivery WHERE id = v_delivery_zona_id;
        IF v_delivery_monto_usd IS NULL THEN v_delivery_monto_usd := 0; END IF;
        IF v_delivery_monto_usd > 0 THEN
            v_delivery_monto_bs := round(v_delivery_monto_usd * v_tasa_bcv, 2);
            v_total_usd := v_delivery_monto_usd; v_total_bs := v_delivery_monto_bs;
        END IF;
    END IF;

    SELECT id INTO v_cliente_id FROM public.clientes
    WHERE length(regexp_replace(coalesce(telefono, ''), '\D', '', 'g')) >= 7
      AND regexp_replace(coalesce(telefono, ''), '\D', '', 'g') = v_telefono_limpio
    ORDER BY total_pedidos DESC LIMIT 1;

    IF v_cliente_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.ventas WHERE cliente_id = v_cliente_id AND fecha > NOW() - INTERVAL '15 seconds') THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Por favor espera 15 segundos antes de enviar otro pedido.');
        END IF;
        SELECT count(*) INTO v_pedidos_pendientes FROM public.ventas
        WHERE cliente_id = v_cliente_id AND estado = 'pendiente';
        IF v_pedidos_pendientes >= 2 THEN
            RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_PENDING_ORDERS', 'error', 'Ya tienes 2 pedidos en espera de confirmación.');
        END IF;
        SELECT count(*) INTO v_pedidos_hoy FROM public.ventas
        WHERE cliente_id = v_cliente_id AND fecha >= CURRENT_DATE;
        IF v_pedidos_hoy >= 15 THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Alcanzaste el límite diario de pedidos para este número.');
        END IF;
        UPDATE public.clientes SET nombre = v_nombre_cliente, direccion_delivery = coalesce(nullif(v_direccion_delivery, ''), direccion_delivery),
            total_pedidos = coalesce(total_pedidos, 0) + 1, actualizado_el = NOW()
        WHERE id = v_cliente_id;
    ELSE
        INSERT INTO public.clientes (nombre, telefono, direccion_delivery, total_pedidos)
        VALUES (v_nombre_cliente, v_telefono, nullif(v_direccion_delivery, ''), 1) RETURNING id INTO v_cliente_id;
    END IF;

    INSERT INTO public.ventas (cliente_id, tasa_bcv, metodo_pago, tipo_entrega,
        delivery_zona_nombre, delivery_monto_usd, delivery_monto_bs, direccion_delivery,
        estado, notas_comanda, creado_por, origen_pedido, total_usd, total_bs)
    VALUES (v_cliente_id, v_tasa_bcv, v_metodo_pago, v_tipo_entrega,
        v_delivery_zona_nombre, v_delivery_monto_usd, v_delivery_monto_bs, nullif(v_direccion_delivery, ''),
        'pendiente', nullif(v_notas_pedido, ''), 'web_cliente', v_origen_pedido, 0, 0)
    RETURNING id, numero_comanda INTO v_venta_id, v_numero_comanda;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
        BEGIN
            v_producto_id := (v_item->>'producto_id')::UUID;
            v_cantidad := coalesce((v_item->>'cantidad')::INT, 1);
            v_notas_item := left(trim(v_item->>'notas_item'), 300);
            IF v_cantidad < 1 OR v_cantidad > 25 THEN
                RETURN jsonb_build_object('ok', false, 'error', 'Cantidad máxima permitida por producto: 25.');
            END IF;
            SELECT precio_usd, activo INTO v_prod_precio, v_prod_activo FROM public.productos WHERE id = v_producto_id;
            IF v_prod_precio IS NULL OR v_prod_activo IS NOT TRUE THEN
                RETURN jsonb_build_object('ok', false, 'error', 'Un producto seleccionado no está disponible.');
            END IF;
            v_subtotal_item := round(v_prod_precio * v_cantidad, 2);
            v_total_usd := v_total_usd + v_subtotal_item;
            v_total_bs := v_total_bs + round(v_subtotal_item * v_tasa_bcv, 2);
            INSERT INTO public.ventas_items (venta_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd, notas_item)
            VALUES (v_venta_id, v_producto_id, v_cantidad, v_prod_precio, v_subtotal_item, nullif(v_notas_item, ''))
            RETURNING id INTO v_venta_item_id;
            IF v_item->'extras_ids' IS NOT NULL AND jsonb_array_length(v_item->'extras_ids') > 0 AND jsonb_array_length(v_item->'extras_ids') <= 10 THEN
                FOR v_extra_id IN SELECT jsonb_array_elements_text(v_item->'extras_ids') LOOP
                    SELECT precio_extra_usd, activo INTO v_ext_precio, v_ext_activo FROM public.extras_modificadores WHERE id = v_extra_id::UUID;
                    IF v_ext_precio IS NOT NULL AND v_ext_activo IS TRUE THEN
                        v_total_usd := v_total_usd + round(v_ext_precio * v_cantidad, 2);
                        v_total_bs := v_total_bs + round(v_ext_precio * v_cantidad * v_tasa_bcv, 2);
                        INSERT INTO public.ventas_items_extras (venta_item_id, extra_id, cantidad, precio_unitario_usd, subtotal_usd)
                        VALUES (v_venta_item_id, v_extra_id::UUID, v_cantidad, v_ext_precio, round(v_ext_precio * v_cantidad, 2));
                    END IF;
                END LOOP;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Datos de pedido no válidos.');
        END;
    END LOOP;

    UPDATE public.ventas SET total_usd = round(v_total_usd, 2), total_bs = round(v_total_bs, 2)
    WHERE id = v_venta_id;

    RETURN jsonb_build_object('ok', true, 'venta_id', v_venta_id, 'numero_comanda', v_numero_comanda);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No se pudo procesar el pedido. Verifica los datos e intenta nuevamente.');
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_crear_pedido_web(JSONB) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_crear_pedido_web(JSONB) FROM PUBLIC;

-- 4) ÍNDICES PARA EL ANTI-SPAM (evita seq scans en clientes.telefono y ventas)
CREATE INDEX IF NOT EXISTS idx_ventas_cliente_fecha ON public.ventas (cliente_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON public.clientes (telefono);

-- 5) REALTIME: agregar tablas a la publicación (verificar antes si ya existen)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ventas;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sesiones_caja;
    END IF;
END $$;