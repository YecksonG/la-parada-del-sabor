-- ==============================================================================
-- MIGRACIÓN: ZONAS DE DELIVERY TARIFADAS Y CÁLCULO INTEGRADO EN PEDIDOS
-- ==============================================================================

-- 1. Tabla de Zonas de Delivery Tarifadas
CREATE TABLE IF NOT EXISTS public.zonas_delivery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio_usd NUMERIC(10,2) NOT NULL DEFAULT 1.50 CHECK (precio_usd >= 0),
    tiempo_estimado_min INT DEFAULT 25,
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para zonas_delivery
ALTER TABLE public.zonas_delivery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Zonas delivery lectura publica" ON public.zonas_delivery;
CREATE POLICY "Zonas delivery lectura publica" 
  ON public.zonas_delivery FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Zonas delivery modificacion autenticados" ON public.zonas_delivery;
CREATE POLICY "Zonas delivery modificacion autenticados" 
  ON public.zonas_delivery FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- 2. Asegurar columnas de delivery en public.ventas
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS delivery_zona_id UUID REFERENCES public.zonas_delivery(id) ON DELETE SET NULL;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS delivery_zona_nombre TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS delivery_monto_usd NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS delivery_monto_bs NUMERIC(12,2) DEFAULT 0;

-- 3. Semilla Inicial de Zonas de Prueba (Totalmente editables desde mañana)
INSERT INTO public.zonas_delivery (nombre, descripcion, precio_usd, tiempo_estimado_min, orden, activo)
VALUES 
    ('Zona 1 - Casco Central / Centro', 'Casco histórico, Plaza Bolívar y avenidas céntricas', 1.50, 20, 1, true),
    ('Zona 2 - San Antonio / Las Mercedes', 'Sectores residenciales medios y comercios', 2.00, 25, 2, true),
    ('Zona 3 - Zona Norte / El Bosque', 'Zona norte y avenidas extendidas', 2.50, 35, 3, true),
    ('Zona 4 - Periferia / Foráneo (Hasta 10km)', 'Sectores lejanos o límites de cobertura', 3.50, 45, 4, true)
ON CONFLICT DO NOTHING;

-- 4. Función RPC atómica actualizada con soporte de Zonas Tarifadas
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
    
    v_delivery_zona_id UUID;
    v_delivery_zona_nombre TEXT := NULL;
    v_delivery_monto_usd NUMERIC(10,2) := 0;
    v_delivery_monto_bs NUMERIC(12,2) := 0;
    
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
    v_pedidos_pendientes INT := 0;
    v_pedidos_hoy INT := 0;
BEGIN
    -- Validaciones básicas de entrada
    v_nombre_cliente := trim(p_payload->>'nombre_cliente');
    v_telefono := trim(p_payload->>'telefono');
    v_tipo_entrega := coalesce(p_payload->>'tipo_entrega', 'pickup');
    v_direccion_delivery := trim(p_payload->>'direccion_delivery');
    v_metodo_pago := coalesce(p_payload->>'metodo_pago', 'pago_movil');
    v_notas_pedido := trim(p_payload->>'notas_pedido');
    v_origen_pedido := coalesce(nullif(trim(p_payload->>'origen_pedido'), ''), 'directo');
    v_items := p_payload->'items';

    IF v_nombre_cliente IS NULL OR length(v_nombre_cliente) < 2 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Por favor indica tu nombre completo.');
    END IF;
    IF v_telefono IS NULL OR length(regexp_replace(v_telefono, '\D', '', 'g')) < 7 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Por favor ingresa un número de teléfono / WhatsApp válido.');
    END IF;
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Tu pedido no tiene productos seleccionados.');
    END IF;
    IF jsonb_array_length(v_items) > 30 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Límite de items por pedido excedido.');
    END IF;

    -- 1. Obtener la tasa activa del día
    SELECT coalesce(tasa_usd_bs, bcv_usd_bs) INTO v_tasa_bcv
    FROM public.tasas_cambio
    ORDER BY fecha DESC
    LIMIT 1;

    IF v_tasa_bcv IS NULL OR v_tasa_bcv <= 0 THEN
        v_tasa_bcv := 60.0;
    END IF;

    -- 2. Procesar y Validar Zona de Delivery si aplica
    IF v_tipo_entrega = 'delivery' THEN
        IF v_direccion_delivery IS NULL OR length(v_direccion_delivery) < 4 THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Por favor ingresa una dirección detallada para el delivery.');
        END IF;

        IF p_payload->>'delivery_zona_id' IS NOT NULL AND length(trim(p_payload->>'delivery_zona_id')) > 0 THEN
            BEGIN
                v_delivery_zona_id := (p_payload->>'delivery_zona_id')::UUID;
                
                SELECT nombre, precio_usd INTO v_delivery_zona_nombre, v_delivery_monto_usd
                FROM public.zonas_delivery
                WHERE id = v_delivery_zona_id AND activo = true;

                IF v_delivery_zona_nombre IS NULL THEN
                    v_delivery_monto_usd := 0;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_delivery_zona_id := NULL;
                v_delivery_monto_usd := 0;
            END;
        END IF;

        v_delivery_monto_bs := coalesce(v_delivery_monto_usd, 0) * v_tasa_bcv;
    END IF;

    -- 3. Cliente: Búsqueda inteligente por teléfono normalizado o por nombre
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
        -- BLINDAJE 1: Anti-Spam / Ráfagas de pedidos (15 segundos de cooldown entre envíos)
        IF EXISTS (
            SELECT 1 FROM public.ventas 
            WHERE cliente_id = v_cliente_id 
              AND fecha > NOW() - INTERVAL '15 seconds'
        ) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Por favor espera 15 segundos antes de enviar otro pedido.');
        END IF;

        -- BLINDAJE 2: Límite de pedidos pendientes simultáneos (Máximo 2 sin procesar)
        SELECT count(*) INTO v_pedidos_pendientes
        FROM public.ventas 
        WHERE cliente_id = v_cliente_id 
          AND estado = 'pendiente';

        IF v_pedidos_pendientes >= 2 THEN
            RETURN jsonb_build_object(
                'ok', false, 
                'code', 'LIMIT_PENDING_ORDERS',
                'error', 'Actualmente tienes 2 pedidos en cola de confirmación. En cuanto cocina comience a preparar uno de ellos, podrás realizar otro.'
            );
        END IF;

        -- BLINDAJE 3: Cuota máxima diaria por cliente (Máximo 15 pedidos al día)
        SELECT count(*) INTO v_pedidos_hoy
        FROM public.ventas 
        WHERE cliente_id = v_cliente_id 
          AND fecha >= CURRENT_DATE;

        IF v_pedidos_hoy >= 15 THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Has alcanzado el límite de pedidos diarios para este número de teléfono.');
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

    -- 4. Crear Venta cabecera
    INSERT INTO public.ventas (
        cliente_id,
        tasa_bcv,
        metodo_pago,
        tipo_entrega,
        delivery_zona_id,
        delivery_zona_nombre,
        delivery_monto_usd,
        delivery_monto_bs,
        direccion_delivery,
        notas_comanda,
        creado_por,
        origen_pedido,
        estado,
        fecha,
        total_usd,
        total_bs
    ) VALUES (
        v_cliente_id,
        v_tasa_bcv,
        v_metodo_pago,
        v_tipo_entrega,
        v_delivery_zona_id,
        v_delivery_zona_nombre,
        coalesce(v_delivery_monto_usd, 0),
        coalesce(v_delivery_monto_bs, 0),
        nullif(v_direccion_delivery, ''),
        nullif(v_notas_pedido, ''),
        'web_cliente',
        v_origen_pedido,
        'pendiente',
        NOW(),
        0,
        0
    )
    RETURNING id, numero_comanda INTO v_venta_id, v_numero_comanda;

    -- 5. Procesar Items y calcular totales con validación de precios en DB
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_producto_id := (v_item->>'producto_id')::UUID;
        v_cantidad := coalesce((v_item->>'cantidad')::INT, 1);
        v_notas_item := trim(v_item->>'notas_item');

        IF v_cantidad <= 0 OR v_cantidad > 25 THEN
            v_cantidad := 1;
        END IF;

        SELECT precio_usd, activo INTO v_prod_precio, v_prod_activo
        FROM public.productos
        WHERE id = v_producto_id;

        IF v_prod_precio IS NULL OR NOT v_prod_activo THEN
            RAISE EXCEPTION 'Producto no disponible o inactivo.';
        END IF;

        v_subtotal_item := v_prod_precio * v_cantidad;

        INSERT INTO public.ventas_items (
            venta_id,
            producto_id,
            cantidad,
            precio_unitario_usd,
            precio_unitario_bs,
            subtotal_usd,
            subtotal_bs,
            notas,
            notas_item
        ) VALUES (
            v_venta_id,
            v_producto_id,
            v_cantidad,
            v_prod_precio,
            v_prod_precio * v_tasa_bcv,
            v_subtotal_item,
            v_subtotal_item * v_tasa_bcv,
            nullif(v_notas_item, ''),
            nullif(v_notas_item, '')
        )
        RETURNING id INTO v_venta_item_id;

        -- Procesar extras si existen
        IF v_item->'extras_ids' IS NOT NULL AND jsonb_array_length(v_item->'extras_ids') > 0 THEN
            FOR v_extra_id IN SELECT jsonb_array_elements_text(v_item->'extras_ids')
            LOOP
                SELECT precio_extra_usd, activo INTO v_ext_precio, v_ext_activo
                FROM public.producto_extras
                WHERE id = v_extra_id::UUID;

                IF v_ext_precio IS NOT NULL AND v_ext_activo THEN
                    INSERT INTO public.ventas_items_extras (
                        venta_item_id,
                        extra_id,
                        precio_extra_usd,
                        precio_extra_bs,
                        precio_unitario_usd,
                        precio_unitario_bs,
                        subtotal_usd,
                        subtotal_bs
                    ) VALUES (
                        v_venta_item_id,
                        v_extra_id::UUID,
                        v_ext_precio,
                        v_ext_precio * v_tasa_bcv,
                        v_ext_precio,
                        v_ext_precio * v_cantidad,
                        v_ext_precio * v_cantidad * v_tasa_bcv
                    );
                    v_subtotal_item := v_subtotal_item + (v_ext_precio * v_cantidad);
                END IF;
            END LOOP;
        END IF;

        v_total_usd := v_total_usd + v_subtotal_item;
    END LOOP;

    -- Sumar el costo de delivery al total si aplica
    IF v_tipo_entrega = 'delivery' AND coalesce(v_delivery_monto_usd, 0) > 0 THEN
        v_total_usd := v_total_usd + v_delivery_monto_usd;
    END IF;

    v_total_bs := v_total_usd * v_tasa_bcv;

    -- 6. Actualizar totales autoritativos en cabecera
    UPDATE public.ventas
    SET total_usd = v_total_usd,
        total_bs = v_total_bs
    WHERE id = v_venta_id;

    RETURN jsonb_build_object(
        'ok', true,
        'venta_id', v_venta_id,
        'numero_comanda', v_numero_comanda,
        'total_usd', v_total_usd,
        'total_bs', v_total_bs,
        'delivery_monto_usd', v_delivery_monto_usd,
        'delivery_zona_nombre', v_delivery_zona_nombre
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_crear_pedido_web(JSONB) TO anon, authenticated;
