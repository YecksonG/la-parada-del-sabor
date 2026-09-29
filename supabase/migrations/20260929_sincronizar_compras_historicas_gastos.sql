-- ==============================================================================
-- 🚨 MIGRACIÓN: Sincronización de Compras Históricas a Gastos Financieros
-- Fecha: 2026-09-29
-- Descripción: Inserta en public.gastos todas las compras registradas en public.compras
-- (incluyendo compras fundacionales de Agosto 2026) que no cuenten con asiento en gastos.
-- ==============================================================================

DO $$
DECLARE
    v_total_insertados INTEGER := 0;
BEGIN
    -- 1. Insertar compras de insumos que falten en la tabla gastos
    WITH compras_a_insertar AS (
        SELECT 
            c.id AS compra_id,
            c.fecha,
            c.proveedor_id,
            p.nombre AS proveedor_nombre,
            c.total_usd,
            c.total_bs,
            c.tasa_bcv,
            COALESCE(c.metodo_pago, 'efectivo_usd') AS metodo_pago,
            c.comprobante,
            c.notas
        FROM public.compras c
        LEFT JOIN public.proveedores p ON p.id = c.proveedor_id
        WHERE NOT EXISTS (
            SELECT 1 FROM public.gastos g 
            WHERE (g.notas IS NOT NULL AND g.notas LIKE '%' || c.id::text || '%')
               OR (
                   g.numero_factura IS NOT NULL 
                   AND TRIM(g.numero_factura) != ''
                   AND c.comprobante IS NOT NULL 
                   AND TRIM(c.comprobante) != ''
                   AND TRIM(g.numero_factura) = TRIM(c.comprobante)
               )
        )
    ),
    filas_insertadas AS (
        INSERT INTO public.gastos (
            fecha,
            categoria,
            subcategoria,
            descripcion,
            beneficiario,
            proveedor_id,
            monto_usd,
            monto_bs,
            tasa_bcv,
            cuenta_origen,
            numero_factura,
            estado,
            notas,
            creado_por
        )
        SELECT 
            c.fecha,
            'proveedores',
            'Insumos / Despensa',
            COALESCE(NULLIF(TRIM(c.notas), ''), 'Compra de insumos: ' || COALESCE(c.proveedor_nombre, 'Proveedor')),
            c.proveedor_nombre,
            c.proveedor_id,
            c.total_usd,
            c.total_bs,
            c.tasa_bcv,
            c.metodo_pago,
            NULLIF(TRIM(c.comprobante), ''),
            'pagado',
            'compra_id:' || c.compra_id::text || CASE WHEN c.notas IS NOT NULL AND TRIM(c.notas) != '' THEN ' | ' || c.notas ELSE '' END,
            'sincronizacion_historica'
        FROM compras_a_insertar c
        RETURNING id
    )
    SELECT COUNT(*) INTO v_total_insertados FROM filas_insertadas;

    RAISE NOTICE 'Sincronización completada: % compras históricas insertadas en public.gastos', v_total_insertados;

    -- 2. Asegurar el gasto operativo de Hielo de Apertura del 27/08/2026 solo si no existe
    IF NOT EXISTS (
        SELECT 1 FROM public.gastos 
        WHERE fecha = '2026-08-27' AND (descripcion ILIKE '%hielo%' OR subcategoria ILIKE '%hielo%')
    ) THEN
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
            numero_factura,
            estado,
            notas,
            creado_por
        ) VALUES (
            '2026-08-27',
            'otros',
            'Hielo Operativo Apertura',
            'Compra de 2 bolsas de hielo para operación de apertura',
            'Distribuidora de Hielo / Comercio Local',
            2.02,
            1600.00,
            791.3248,
            'efectivo_bs',
            'TICKET-HIELO',
            'pagado',
            'Compra operativa apertura 27-08-2026',
            'migracion_apertura'
        );
        RAISE NOTICE 'Gasto operativo de Hielo Apertura (27/08/2026) insertado con éxito.';
    END IF;
END $$;
