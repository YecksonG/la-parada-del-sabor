-- ==============================================================================
-- 📦 MIGRACIÓN: CARGA OFICIAL FACTURA #756 — TODO EN DESECHABLES C.A. ($28.00 USD)
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
BEGIN
    -- 1. Obtener tasa BCV activa
    SELECT coalesce(tasa_usd_bs, bcv_usd_bs, 60.0) INTO v_tasa_bcv
    FROM public.tasas_cambio
    ORDER BY fecha DESC
    LIMIT 1;

    IF v_tasa_bcv IS NULL OR v_tasa_bcv <= 0 THEN
        v_tasa_bcv := 60.0;
    END IF;

    -- 2. Proveedor: Todo en Desechables C.A. / Grecia Márquez
    SELECT id INTO v_prov_id 
    FROM public.proveedores 
    WHERE rif ILIKE '%27230887%' OR nombre ILIKE '%desechables%' OR nombre ILIKE '%grecia%'
    LIMIT 1;

    IF v_prov_id IS NULL THEN
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
    ELSE
        UPDATE public.proveedores
        SET nombre = 'TODO EN DESECHABLES C.A.',
            contacto_nombre = 'Grecia Márquez',
            telefono = '573242451556',
            direccion = '23 de Enero, Punta Cardón'
        WHERE id = v_prov_id;
    END IF;

    -- 3. Insumos con costos unitarios exactos de la factura
    -- 3.1 Caja Dulce Kraft 6 (Grande / Familiar) -> $0.40/und
    SELECT id INTO v_ins_caja6_id FROM public.insumos WHERE nombre ILIKE '%caja%kraft%6%' OR nombre ILIKE '%caja%familiar%' LIMIT 1;
    IF v_ins_caja6_id IS NULL THEN
        INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria)
        VALUES ('Caja Dulce Kraft 6 (Familiar)', 'unidad', 20, 10, 0.40, 'Empaques')
        RETURNING id INTO v_ins_caja6_id;
    ELSE
        UPDATE public.insumos SET costo_unitario_usd = 0.40 WHERE id = v_ins_caja6_id;
    END IF;

    -- 3.2 Caja Dulce Kraft 3 (Mediana / Pequeña) -> $0.25/und
    SELECT id INTO v_ins_caja3_id FROM public.insumos WHERE nombre ILIKE '%caja%kraft%3%' OR nombre ILIKE '%caja%mediana%' OR nombre ILIKE '%caja%personal%' LIMIT 1;
    IF v_ins_caja3_id IS NULL THEN
        INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria)
        VALUES ('Caja Dulce Kraft 3 (Mediana/Personal)', 'unidad', 20, 10, 0.25, 'Empaques')
        RETURNING id INTO v_ins_caja3_id;
    ELSE
        UPDATE public.insumos SET costo_unitario_usd = 0.25 WHERE id = v_ins_caja3_id;
    END IF;

    -- 3.3 Paquete Guantes Nitrilo Negro L (1x100) -> $10.00/paq
    SELECT id INTO v_ins_guantes_id FROM public.insumos WHERE nombre ILIKE '%guante%nitrilo%' LIMIT 1;
    IF v_ins_guantes_id IS NULL THEN
        INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria)
        VALUES ('Guantes de Nitrilo Negro L (1x100)', 'paquete', 1, 1, 10.00, 'Higiene y Desechables')
        RETURNING id INTO v_ins_guantes_id;
    ELSE
        UPDATE public.insumos SET costo_unitario_usd = 10.00 WHERE id = v_ins_guantes_id;
    END IF;

    -- 3.4 Paquete Vaso 127ss (1x50) -> $2.00/paq
    SELECT id INTO v_ins_vasos_id FROM public.insumos WHERE nombre ILIKE '%vaso%127%' OR nombre ILIKE '%vaso%' LIMIT 1;
    IF v_ins_vasos_id IS NULL THEN
        INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria)
        VALUES ('Paquete Vaso 127ss (1x50)', 'paquete', 1, 1, 2.00, 'Desechables')
        RETURNING id INTO v_ins_vasos_id;
    ELSE
        UPDATE public.insumos SET costo_unitario_usd = 2.00 WHERE id = v_ins_vasos_id;
    END IF;

    -- 3.5 Paquete Tapa 10/12 (1x50) -> $3.00/paq
    SELECT id INTO v_ins_tapas_id FROM public.insumos WHERE nombre ILIKE '%tapa%10/12%' OR nombre ILIKE '%tapa%vaso%' LIMIT 1;
    IF v_ins_tapas_id IS NULL THEN
        INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria)
        VALUES ('Paquete Tapa Vaso 10/12 (1x50)', 'paquete', 1, 1, 3.00, 'Desechables')
        RETURNING id INTO v_ins_tapas_id;
    ELSE
        UPDATE public.insumos SET costo_unitario_usd = 3.00 WHERE id = v_ins_tapas_id;
    END IF;

    -- 4. Registrar o Reemplazar Compra Oficial (Recibo #756)
    -- Si existía una compra previa provisional con este comprobante, la eliminamos limpiamente
    DELETE FROM public.compras WHERE comprobante ILIKE '%756%';

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
        'Factura oficial TODO EN DESECHABLES C.A. (Vasos 127ss, Tapas 10/12, Cajas Kraft 6 y 3, Guantes Nitrilo L)'
    ) RETURNING id INTO v_compra_id;

    -- 5. Items de la Compra Desglosados
    INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
    VALUES
        (v_compra_id, v_ins_caja6_id, 20.00, 'unidad', 1, 20.00, 0.40, 8.00),
        (v_compra_id, v_ins_caja3_id, 20.00, 'unidad', 1, 20.00, 0.25, 5.00),
        (v_compra_id, v_ins_guantes_id, 1.00, 'paquete', 1, 1.00, 10.00, 10.00),
        (v_compra_id, v_ins_vasos_id, 1.00, 'paquete', 1, 1.00, 2.00, 2.00),
        (v_compra_id, v_ins_tapas_id, 1.00, 'paquete', 1, 1.00, 3.00, 3.00);

END $$;
