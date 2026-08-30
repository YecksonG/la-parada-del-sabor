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
        INSERT INTO public.proveedores (nombre, rif, contacto, telefono, direccion)
        VALUES (
            'TODO EN DESECHABLES C.A.',
            'V-27.230.887',
            'Grecia Márquez',
            '573242451556',
            '23 de Enero, Punta Cardón'
        )
        RETURNING id INTO v_prov_id;
    ELSE
        UPDATE public.proveedores
        SET nombre = 'TODO EN DESECHABLES C.A.',
            contacto = 'Grecia Márquez',
            telefono = '573242451556',
            direccion = '23 de Enero, Punta Cardón'
        WHERE id = v_prov_id;
    END IF;

    -- 3. Insumos con costos unitarios exactos y unidad 'und'
    -- 3.1 Caja Dulce Kraft 6 (Grande / Familiar) -> $0.40/und
    SELECT id INTO v_ins_caja6_id FROM public.insumos WHERE nombre ILIKE '%caja%kraft%6%' OR nombre ILIKE '%caja%familiar%' LIMIT 1;
    IF v_ins_caja6_id IS NULL THEN
        INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo)
        VALUES ('Caja Dulce Kraft 6 (Familiar)', 'und', 20, 10, 0.40, 'Empaques')
        RETURNING id INTO v_ins_caja6_id;
    ELSE
        UPDATE public.insumos SET costo_unitario_usd = 0.40 WHERE id = v_ins_caja6_id;
    END IF;

    -- 3.2 Caja Dulce Kraft 3 (Mediana / Pequeña) -> $0.25/und
    SELECT id INTO v_ins_caja3_id FROM public.insumos WHERE nombre ILIKE '%caja%kraft%3%' OR nombre ILIKE '%caja%mediana%' OR nombre ILIKE '%caja%personal%' LIMIT 1;
    IF v_ins_caja3_id IS NULL THEN
        INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo)
        VALUES ('Caja Dulce Kraft 3 (Mediana/Personal)', 'und', 20, 10, 0.25, 'Empaques')
        RETURNING id INTO v_ins_caja3_id;
    ELSE
        UPDATE public.insumos SET costo_unitario_usd = 0.25 WHERE id = v_ins_caja3_id;
    END IF;

    -- 3.3 Paquete Guantes Nitrilo Negro L (1x100) -> Costo por unidad $0.10/guante ($10/paq)
    SELECT id INTO v_ins_guantes_id FROM public.insumos WHERE nombre ILIKE '%guante%nitrilo%' LIMIT 1;
    IF v_ins_guantes_id IS NULL THEN
        INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo)
        VALUES ('Guantes de Nitrilo Negro L (100 und)', 'und', 100, 20, 0.10, 'Higiene y Desechables')
        RETURNING id INTO v_ins_guantes_id;
    ELSE
        UPDATE public.insumos SET costo_unitario_usd = 0.10 WHERE id = v_ins_guantes_id;
    END IF;

    -- 3.4 Paquete Vaso 127ss (1x50) -> Costo por unidad $0.04/vaso ($2/paq)
    SELECT id INTO v_ins_vasos_id FROM public.insumos WHERE nombre ILIKE '%vaso%127%' OR nombre ILIKE '%vaso%' LIMIT 1;
    IF v_ins_vasos_id IS NULL THEN
        INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo)
        VALUES ('Vasos Desechables 127ss (50 und)', 'und', 50, 20, 0.04, 'Desechables')
        RETURNING id INTO v_ins_vasos_id;
    ELSE
        UPDATE public.insumos SET costo_unitario_usd = 0.04 WHERE id = v_ins_vasos_id;
    END IF;

    -- 3.5 Paquete Tapa 10/12 (1x50) -> Costo por unidad $0.06/tapa ($3/paq)
    SELECT id INTO v_ins_tapas_id FROM public.insumos WHERE nombre ILIKE '%tapa%10/12%' OR nombre ILIKE '%tapa%vaso%' LIMIT 1;
    IF v_ins_tapas_id IS NULL THEN
        INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo)
        VALUES ('Tapas para Vaso 10/12 (50 und)', 'und', 50, 20, 0.06, 'Desechables')
        RETURNING id INTO v_ins_tapas_id;
    ELSE
        UPDATE public.insumos SET costo_unitario_usd = 0.06 WHERE id = v_ins_tapas_id;
    END IF;

    -- 4. Registrar o Reemplazar Compra Oficial (Recibo #756)
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

    -- 5. Items de la Compra Desglosados con Factor de Conversión a 'und'
    INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
    VALUES
        (v_compra_id, v_ins_caja6_id, 20.00, 'und', 1.00, 20.00, 0.40, 8.00),
        (v_compra_id, v_ins_caja3_id, 20.00, 'und', 1.00, 20.00, 0.25, 5.00),
        (v_compra_id, v_ins_guantes_id, 1.00, 'paquete', 100.00, 100.00, 10.00, 10.00),
        (v_compra_id, v_ins_vasos_id, 1.00, 'paquete', 50.00, 50.00, 2.00, 2.00),
        (v_compra_id, v_ins_tapas_id, 1.00, 'paquete', 50.00, 50.00, 3.00, 3.00);

END $$;
