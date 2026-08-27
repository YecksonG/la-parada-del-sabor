-- ==============================================================================
-- REGISTRO FINANCIERO OFICIAL DE APERTURA: FLUJO DE FONDOS, CUENTAS Y GASTOS
-- La Parada del Sabor — 27 de Agosto de 2026
-- ==============================================================================

DO $$
DECLARE
    v_cta_grecia_id UUID;
    v_cta_yeckson_id UUID;
BEGIN
    -- 1. Buscar o actualizar la cuenta de Grecia por nombre
    SELECT id INTO v_cta_grecia_id FROM public.cuentas_negocio WHERE nombre ILIKE '%Banco de Venezuela (BDV) VES' AND nombre NOT ILIKE '% Y' LIMIT 1;
    
    IF v_cta_grecia_id IS NOT NULL THEN
        UPDATE public.cuentas_negocio SET
            nombre = 'Banco de Venezuela (BDV) VES',
            tipo = 'banco_nacional',
            moneda = 'VES',
            banco_plataforma = 'Banco de Venezuela (BDV)',
            titular = 'Grecia Márquez',
            cedula_rif = 'V-27230887',
            telefono_pago_movil = '0412-6608761',
            admite_biopago = true,
            icono = '🏛️',
            color = '#ef4444',
            activo = true,
            notas = 'Cuenta receptora del préstamo de apertura ($150 / Bs. 137.872,00). Pagos vía BioPago y Pago Móvil.'
        WHERE id = v_cta_grecia_id;
    ELSE
        INSERT INTO public.cuentas_negocio (
            nombre, codigo, tipo, moneda, banco_plataforma, titular, cedula_rif, telefono_pago_movil, admite_biopago, icono, color, activo, notas
        ) VALUES (
            'Banco de Venezuela (BDV) VES', 'bdv_grecia', 'banco_nacional', 'VES', 'Banco de Venezuela (BDV)', 'Grecia Márquez', 'V-27230887', '0412-6608761', true, '🏛️', '#ef4444', true, 'Cuenta receptora del préstamo de apertura ($150 / Bs. 137.872,00). Pagos vía BioPago y Pago Móvil.'
        ) RETURNING id INTO v_cta_grecia_id;
    END IF;

    -- 2. Buscar o actualizar la cuenta de Yeckson por nombre
    SELECT id INTO v_cta_yeckson_id FROM public.cuentas_negocio WHERE nombre ILIKE '%Banco de Venezuela (BDV) VES Y' LIMIT 1;
    
    IF v_cta_yeckson_id IS NOT NULL THEN
        UPDATE public.cuentas_negocio SET
            nombre = 'Banco de Venezuela (BDV) VES Y',
            tipo = 'banco_nacional',
            moneda = 'VES',
            banco_plataforma = 'Banco de Venezuela (BDV)',
            titular = 'Yeckson González',
            cedula_rif = 'V-29524984',
            telefono_pago_movil = '0412-2595386',
            admite_biopago = true,
            icono = '🏛️',
            color = '#3b82f6',
            activo = true,
            notas = 'Cuenta operativa de Yeckson para pagos en La Pradera (Lucky Strike) y compra de Hielo vía Débito.'
        WHERE id = v_cta_yeckson_id;
    ELSE
        INSERT INTO public.cuentas_negocio (
            nombre, codigo, tipo, moneda, banco_plataforma, titular, cedula_rif, telefono_pago_movil, admite_biopago, icono, color, activo, notas
        ) VALUES (
            'Banco de Venezuela (BDV) VES Y', 'bdv_yeckson', 'banco_nacional', 'VES', 'Banco de Venezuela (BDV)', 'Yeckson González', 'V-29524984', '0412-2595386', true, '🏛️', '#3b82f6', true, 'Cuenta operativa de Yeckson para pagos en La Pradera (Lucky Strike) y compra de Hielo vía Débito.'
        ) RETURNING id INTO v_cta_yeckson_id;
    END IF;

    -- 3. Limpiar movimientos previos de prueba de la fecha
    DELETE FROM public.transferencias_cuentas WHERE fecha = '2026-08-27';
    DELETE FROM public.gastos WHERE fecha = '2026-08-27';

    -- 4. Registrar las 2 Transferencias entre Cuentas (Grecia ➡️ Yeckson)
    
    -- Transferencia 1: Fondeo para Lucky Strike en La Pradera
    INSERT INTO public.transferencias_cuentas (
        fecha,
        cuenta_origen_id,
        cuenta_destino_id,
        monto_origen,
        moneda_origen,
        monto_destino,
        moneda_destino,
        tasa_cambio,
        metodo_transferencia,
        referencia,
        concepto,
        notas,
        creado_por
    ) VALUES (
        '2026-08-27',
        v_cta_grecia_id,
        v_cta_yeckson_id,
        3000.00,
        'VES',
        3000.00,
        'VES',
        1.0,
        'pago_movil',
        'PM-LUCKY-PRADERA',
        'Fondeo de Grecia a Yeckson para compra en La Pradera (Lucky Strike)',
        'Transferencia interbancaria BDV a BDV vía Pago Móvil',
        'admin'
    );

    -- Transferencia 2: Fondeo para compra de Hielo
    INSERT INTO public.transferencias_cuentas (
        fecha,
        cuenta_origen_id,
        cuenta_destino_id,
        monto_origen,
        moneda_origen,
        monto_destino,
        moneda_destino,
        tasa_cambio,
        metodo_transferencia,
        referencia,
        concepto,
        notas,
        creado_por
    ) VALUES (
        '2026-08-27',
        v_cta_grecia_id,
        v_cta_yeckson_id,
        1500.00,
        'VES',
        1500.00,
        'VES',
        1.0,
        'pago_movil',
        'PM-HIELO-2BOLSAS',
        'Fondeo de Grecia a Yeckson para compra de 2 bolsas de hielo',
        'Transferencia interbancaria BDV a BDV vía Pago Móvil',
        'admin'
    );

    -- 5. Registrar los 6 Gastos Reales de Apertura
    
    -- Gasto 1: Super 900 (Factura 00044240)
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
        comprobante_url,
        estado,
        notas,
        creado_por
    ) VALUES (
        '2026-08-27',
        'materia_prima',
        'Insumos y Víveres Super 900',
        'Compra de víveres, salsas, verduras, pechuga de pavo, quesos y condimentos para apertura',
        'Super 900 (Inversiones El Sol de Falcón, C.A. - J-504442402)',
        84.18,
        77374.52,
        919.1466,
        'biopago',
        v_cta_grecia_id,
        '00044240',
        '/facturas/super_900_27_08_26.jpg',
        'pagado',
        'Pagado por Grecia Márquez vía BioPago BDV. Factura: 00044240.',
        'admin'
    );

    -- Gasto 2: Hortalizas El Páramo (Orden #00157206)
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
        comprobante_url,
        estado,
        notas,
        creado_por
    ) VALUES (
        '2026-08-27',
        'materia_prima',
        'Vegetales y Pollo El Páramo',
        'Compra de aguacate polo, pechuga de pollo con hueso y hortalizas frescas',
        'Hortalizas El Páramo C.A. (J-412566464)',
        8.91,
        8194.12,
        919.1466,
        'biopago',
        v_cta_grecia_id,
        '00157206',
        '/facturas/el_paramo_27_08_26.jpg',
        'pagado',
        'Pagado por Grecia Márquez vía BioPago BDV. Orden #00157206.',
        'admin'
    );

    -- Gasto 3: Multitiendas Kariosca (Factura 00002781)
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
        comprobante_url,
        estado,
        notas,
        creado_por
    ) VALUES (
        '2026-08-27',
        'desechables',
        'Empaques y Salseros Kariosca',
        'Compra de 3 potes salseros 360ml CP2041, 1 paquete papel antigraso breakfast 50 und y bolsas plásticas 10kg',
        'Multitienda Kariosca, C.A. (J-309848909)',
        10.39,
        9549.89,
        919.1466,
        'pago_movil',
        v_cta_grecia_id,
        '00002781',
        '/facturas/kariosca_27_08_26.jpg',
        'pagado',
        'Pagado por Grecia Márquez vía Pago Móvil BDV. Factura: 00002781.',
        'admin'
    );

    -- Gasto 4: Todo en Desechables
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
        creado_por
    ) VALUES (
        '2026-08-27',
        'desechables',
        'Empaques Todo en Desechables',
        'Cajas grandes (20 und), cajas pequeñas (20 und - Bs 10.287,16), guantes (Bs 7.913,20) y vasos con tapas 50 und (Bs 3.960,00)',
        'Todo en Desechables',
        24.11,
        22160.36,
        919.1466,
        'biopago',
        v_cta_grecia_id,
        'MANUAL-DESECHABLES',
        'pagado',
        'Pagado por Grecia Márquez vía BioPago BDV. Desglose: $13 Cajas pq + $10 Guantes + $5 Vasos/Tapas.',
        'admin'
    );

    -- Gasto 5: La Pradera (Factura 0005727)
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
        comprobante_url,
        estado,
        notas,
        creado_por
    ) VALUES (
        '2026-08-27',
        'otros',
        'Consumo / Insumos La Pradera',
        'Compra de Lucky Strike Cosmic en La Pradera',
        'La Pradera, C.A. (J-502717960)',
        3.22,
        2959.96,
        919.1466,
        'pago_movil',
        v_cta_yeckson_id,
        '0005727',
        '/facturas/la_pradera_27_08_26.jpg',
        'pagado',
        'Pagado por Yeckson González con fondos transferidos desde la cuenta de Grecia. Factura: 0005727.',
        'admin'
    );

    -- Gasto 6: Hielo (2 bolsas)
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
        creado_por
    ) VALUES (
        '2026-08-27',
        'materia_prima',
        'Hielo Operativo',
        'Compra de 2 bolsas de hielo para operación de bebidas y cocina',
        'Distribuidora de Hielo / Comercio Local',
        1.74,
        1600.00,
        919.1466,
        'debito',
        v_cta_yeckson_id,
        'TICKET-HIELO',
        'pagado',
        'Pagado por Yeckson González con tarjeta de débito BDV (Bs. 1.500 fondeados por Grecia + Bs. 59,96 propios).',
        'admin'
    );

END $$;
