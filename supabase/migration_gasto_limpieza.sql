-- ==============================================================================
-- REGISTRO DE GASTO DE APERTURA: LIMPIEZA DEL LOCAL ($10 a Tasa BCV)
-- La Parada del Sabor — 27 de Agosto de 2026
-- ==============================================================================

DO $$
DECLARE
    v_cta_grecia_id UUID;
    v_tasa_bcv NUMERIC(12, 4) := 791.3248;
BEGIN
    -- Obtener la cuenta BDV de Grecia
    SELECT id INTO v_cta_grecia_id 
    FROM public.cuentas_negocio 
    WHERE nombre = 'Banco de Venezuela (BDV) VES' OR codigo = 'bdv_ves'
    LIMIT 1;

    IF v_cta_grecia_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró la cuenta Banco de Venezuela (BDV) VES de Grecia.';
    END IF;

    -- Registrar el gasto de Limpieza del Local
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
        'servicios',
        'Limpieza y Acondicionamiento',
        'Servicio de limpieza y adecuación profunda del local para apertura',
        'Servicio de Limpieza',
        10.00,
        7913.25,
        v_tasa_bcv,
        'pago_movil',
        v_cta_grecia_id,
        'RECIBO-LIMPIEZA',
        'pagado',
        'Pagado por Grecia Márquez vía Pago Móvil BDV ($10 a tasa oficial BCV de Bs. 791,32).',
        'admin'
    );

END $$;
