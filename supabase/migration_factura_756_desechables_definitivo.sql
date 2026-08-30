-- ==============================================================================
-- 📦 MIGRACIÓN: CARGA OFICIAL FACTURA #756 Y ACTUALIZACIÓN DE GASTO
-- La Parada del Sabor — 29 Ago 2026
-- ==============================================================================

DO $$
DECLARE
    v_prov_id UUID;
    v_compra_id UUID;
    v_tasa_bcv NUMERIC(12,4);
    
    v_ins_caja6_id UUID;
    v_ins_caja3_id UUID;
    v_ins_guantes_id UUID;
    v_ins_vasos_id UUID;
    v_ins_tapas_id UUID;
    
    v_cta_grecia_id UUID;
    v_gasto_id UUID;
BEGIN
    -- 1. Obtener tasa BCV activa
    SELECT coalesce(tasa_usd_bs, bcv_usd_bs, 60.0) INTO v_tasa_bcv
    FROM public.tasas_cambio
    ORDER BY fecha DESC
    LIMIT 1;

    IF v_tasa_bcv IS NULL OR v_tasa_bcv <= 0 THEN
        v_tasa_bcv := 60.0;
    END IF;

    -- ==========================================
    -- 2. ACTUALIZACIÓN DE INSUMOS
    -- ==========================================
    
    -- 2.1 Caja Dulce Kraft 6 (Grande / Familiar) -> $0.40/und
    SELECT id INTO v_ins_caja6_id FROM public.insumos WHERE nombre ILIKE '%caja%kraft%6%' OR nombre ILIKE '%caja%familiar%' LIMIT 1;
    IF v_ins_caja6_id IS NOT NULL THEN
        UPDATE public.insumos SET costo_unitario_usd = 0.40 WHERE id = v_ins_caja6_id;
    END IF;

    -- 2.2 Caja Dulce Kraft 3 (Mediana / Pequeña) -> $0.25/und
    SELECT id INTO v_ins_caja3_id FROM public.insumos WHERE (nombre ILIKE '%caja%kraft%3%' OR nombre ILIKE '%caja%mediana%' OR nombre ILIKE '%caja%personal%' OR nombre ILIKE '%caja pequeña%') AND nombre NOT ILIKE '%kraft%6%' LIMIT 1;
    IF v_ins_caja3_id IS NOT NULL THEN
        UPDATE public.insumos SET costo_unitario_usd = 0.25 WHERE id = v_ins_caja3_id;
    END IF;

    -- 2.3 Paquete Guantes Nitrilo Negro L (1x100) -> $10.00/paq
    SELECT id INTO v_ins_guantes_id FROM public.insumos WHERE nombre ILIKE '%guante%nitrilo%' LIMIT 1;
    IF v_ins_guantes_id IS NOT NULL THEN
        UPDATE public.insumos SET costo_unitario_usd = 10.00 WHERE id = v_ins_guantes_id;
    END IF;

    -- 2.4 Paquete Vaso 127ss (1x50) -> $2.00/paq
    SELECT id INTO v_ins_vasos_id FROM public.insumos WHERE (nombre ILIKE '%vaso%127%' OR nombre ILIKE '%vaso%') AND nombre NOT ILIKE '%tapa%' LIMIT 1;
    IF v_ins_vasos_id IS NOT NULL THEN
        UPDATE public.insumos SET costo_unitario_usd = 2.00 WHERE id = v_ins_vasos_id;
    END IF;

    -- 2.5 Paquete Tapa 10/12 (1x50) -> $3.00/paq
    SELECT id INTO v_ins_tapas_id FROM public.insumos WHERE nombre ILIKE '%tapa%10/12%' OR (nombre ILIKE '%tapa%' AND nombre ILIKE '%vaso%') LIMIT 1;
    IF v_ins_tapas_id IS NOT NULL THEN
        UPDATE public.insumos SET costo_unitario_usd = 3.00 WHERE id = v_ins_tapas_id;
    END IF;

    -- ==========================================
    -- 3. ACTUALIZACIÓN DEL GASTO MANUAL PREVIO
    -- ==========================================
    
    -- Identificar la cuenta de Grecia (que pagó el gasto original manual)
    SELECT id INTO v_cta_grecia_id 
    FROM public.cuentas_negocio 
    WHERE codigo = 'bdv_ves' OR codigo = 'bdv_grecia'
    LIMIT 1;

    -- Buscar el gasto antiguo manual (MANUAL-DESECHABLES)
    SELECT id INTO v_gasto_id 
    FROM public.gastos 
    WHERE numero_factura = 'MANUAL-DESECHABLES' OR beneficiario ILIKE '%Todo en Desechables%'
    LIMIT 1;

    IF v_gasto_id IS NOT NULL THEN
        -- Si existe, lo actualizamos con los datos reales
        UPDATE public.gastos SET
            fecha = '2026-08-29',
            monto_usd = 28.00,
            monto_bs = round(28.00 * v_tasa_bcv, 2),
            tasa_bcv = v_tasa_bcv,
            numero_factura = '756',
            descripcion = 'Cajas grandes (20 und - $8), cajas pequeñas (20 und - $5), guantes (1 und - $10), vasos 127ss (1 paq - $2) y tapas 10/12 (1 paq - $3)',
            notas = 'Gasto actualizado con factura real #756. Pagado por Grecia Márquez.',
            comprobante_url = '/telegram_media/telegram_1788056926_AgACAgEA.jpg',
            estado = 'pagado'
        WHERE id = v_gasto_id;
    ELSE
        -- Si no existe el manual, insertamos el nuevo
        INSERT INTO public.gastos (
            fecha,
            categoria,
            subcategoria,
            descripcion,
            beneficiario,
            monto_usd,
            monto_bs,
            tasa_bcv,
            cuenta_origen,
            cuenta_id,
            numero_factura,
            estado,
            notas,
            comprobante_url,
            creado_por
        ) VALUES (
            '2026-08-29',
            'desechables',
            'Empaques Todo en Desechables',
            'Cajas grandes (20 und - $8), cajas pequeñas (20 und - $5), guantes (1 und - $10), vasos 127ss (1 paq - $2) y tapas 10/12 (1 paq - $3)',
            'Todo en Desechables',
            28.00,
            round(28.00 * v_tasa_bcv, 2),
            v_tasa_bcv,
            'biopago',
            v_cta_grecia_id,
            '756',
            'pagado',
            'Gasto cargado con factura real #756. Pagado por Grecia Márquez.',
            '/telegram_media/telegram_1788056926_AgACAgEA.jpg',
            'admin'
        );
    END IF;

    -- ==========================================
    -- 4. ACTUALIZACIÓN DEL MÓDULO DE INVENTARIO/COMPRAS
    -- ==========================================
    
    -- Proveedor: Todo en Desechables C.A.
    SELECT id INTO v_prov_id 
    FROM public.proveedores 
    WHERE rif ILIKE '%27230887%' OR nombre ILIKE '%desechables%' OR nombre ILIKE '%grecia%'
    LIMIT 1;

    IF v_prov_id IS NOT NULL THEN
        UPDATE public.proveedores
        SET nombre = 'TODO EN DESECHABLES C.A.',
            contacto_nombre = 'Grecia Márquez',
            telefono = '573242451556',
            direccion = '23 de Enero, Punta Cardón'
        WHERE id = v_prov_id;
    ELSE
        INSERT INTO public.proveedores (nombre, rif, contacto_nombre, telefono, direccion, categoria)
        VALUES (
            'TODO EN DESECHABLES C.A.',
            'V-27.230.887',
            'Grecia Márquez',
            '573242451556',
            '23 de Enero, Punta Cardón',
            'Empaques y Desechables'
        )
        RETURNING id INTO v_prov_id;
    END IF;

    -- Eliminar registro previo de compra si existía para recrear limpio
    DELETE FROM public.compras WHERE comprobante ILIKE '%756%';

    -- Insertar la compra en el inventario
    INSERT INTO public.compras (
        proveedor_id,
        fecha,
        total_usd,
        total_bs,
        tasa_bcv,
        metodo_pago,
        comprobante,
        notas
    ) VALUES (
        v_prov_id,
        '2026-08-29',
        28.00,
        round(28.00 * v_tasa_bcv, 2),
        v_tasa_bcv,
        'efectivo_usd',
        'RECIBO #756',
        'Factura oficial TODO EN DESECHABLES C.A.'
    ) RETURNING id INTO v_compra_id;

    -- Insertar items del inventario si encontramos los insumos
    IF v_ins_caja6_id IS NOT NULL THEN
        INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
        VALUES (v_compra_id, v_ins_caja6_id, 20.00, 'unidad', 1, 20.00, 0.40, 8.00);
    END IF;

    IF v_ins_caja3_id IS NOT NULL THEN
        INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
        VALUES (v_compra_id, v_ins_caja3_id, 20.00, 'unidad', 1, 20.00, 0.25, 5.00);
    END IF;

    IF v_ins_guantes_id IS NOT NULL THEN
        INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
        VALUES (v_compra_id, v_ins_guantes_id, 1.00, 'paquete', 1, 1.00, 10.00, 10.00);
    END IF;

    IF v_ins_vasos_id IS NOT NULL THEN
        INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
        VALUES (v_compra_id, v_ins_vasos_id, 1.00, 'paquete', 1, 1.00, 2.00, 2.00);
    END IF;

    IF v_ins_tapas_id IS NOT NULL THEN
        INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
        VALUES (v_compra_id, v_ins_tapas_id, 1.00, 'paquete', 1, 1.00, 3.00, 3.00);
    END IF;

END $$;
