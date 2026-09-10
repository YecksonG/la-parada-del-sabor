-- ==============================================================================
-- 🚨 REGISTRO DE COMPRAS HISTÓRICAS (CABECERAS SIN TOCAR DESPENSA NI CUENTAS)
-- ==============================================================================

-- 1. Limpiar registros si existieran previamente para evitar duplicados
DELETE FROM public.compras WHERE id IN (
    'c0000001-0000-0000-0000-000000000001',
    'c0000002-0000-0000-0000-000000000002',
    'c0000003-0000-0000-0000-000000000003',
    'c0000004-0000-0000-0000-000000000004',
    'c0000007-0000-0000-0000-000000000027',
    'c0000030-0000-0000-0000-000000000030',
    'c0000040-0000-0000-0000-000000000040'
);

-- 2. Inserción directa en public.compras (No toca compras_items ni stock)

-- 2.1 Super 900 (27/08/2026) - Factura 00044240
INSERT INTO public.compras (
    id,
    proveedor_id,
    fecha,
    total_usd,
    total_bs,
    tasa_bcv,
    comprobante,
    notas
) VALUES (
    'c0000001-0000-0000-0000-000000000001',
    'a0000001-0000-0000-0000-000000000001',
    '2026-08-27',
    97.78,
    77374.52,
    791.3248,
    '00044240',
    'Factura Super 900 apertura'
);

-- 2.2 Hortalizas El Páramo (27/08/2026) - Factura 00157296
INSERT INTO public.compras (
    id,
    proveedor_id,
    fecha,
    total_usd,
    total_bs,
    tasa_bcv,
    comprobante,
    notas
) VALUES (
    'c0000002-0000-0000-0000-000000000002',
    'a0000002-0000-0000-0000-000000000002',
    '2026-08-27',
    10.35,
    8194.12,
    791.3248,
    '00157296',
    'Factura El Páramo'
);

-- 2.3 Multitienda Kariosca (27/08/2026) - Factura 00002781
INSERT INTO public.compras (
    id,
    proveedor_id,
    fecha,
    total_usd,
    total_bs,
    tasa_bcv,
    comprobante,
    notas
) VALUES (
    'c0000003-0000-0000-0000-000000000003',
    'a0000003-0000-0000-0000-000000000003',
    '2026-08-27',
    12.07,
    9549.89,
    791.3248,
    '00002781',
    'Factura Multitienda Kariosca'
);

-- 2.4 Distribuidora y Comercializadora La Pradera (27/08/2026) - Factura 0005722
INSERT INTO public.compras (
    id,
    proveedor_id,
    fecha,
    total_usd,
    total_bs,
    tasa_bcv,
    comprobante,
    notas
) VALUES (
    'c0000007-0000-0000-0000-000000000027',
    'a1a6bb6d-e5db-4238-8c8c-c801af82befa',
    '2026-08-27',
    3.74,
    2959.54,
    791.3248,
    '0005722',
    'Factura La Pradera'
);

-- 2.5 Todo en Desechables (29/08/2026) - Recibo #756
INSERT INTO public.compras (
    id,
    proveedor_id,
    fecha,
    total_usd,
    total_bs,
    tasa_bcv,
    comprobante,
    notas
) VALUES (
    'c0000004-0000-0000-0000-000000000004',
    'a0000004-0000-0000-0000-000000000004',
    '2026-08-29',
    28.00,
    22166.67,
    791.6667,
    'RECIBO #756',
    'Recibo Todo en Desechables'
);

-- 2.6 Super 900 (03/09/2026) - Factura 00073657
INSERT INTO public.compras (
    id,
    proveedor_id,
    fecha,
    total_usd,
    total_bs,
    tasa_bcv,
    comprobante,
    notas
) VALUES (
    'c0000030-0000-0000-0000-000000000030',
    'a0000001-0000-0000-0000-000000000001',
    '2026-09-03',
    11.89,
    9565.28,
    804.8109,
    '00073657',
    'Factura Super 900'
);

-- 2.7 Super 900 (04/09/2026) - Factura 00073767
INSERT INTO public.compras (
    id,
    proveedor_id,
    fecha,
    total_usd,
    total_bs,
    tasa_bcv,
    comprobante,
    notas
) VALUES (
    'c0000040-0000-0000-0000-000000000040',
    'a0000001-0000-0000-0000-000000000001',
    '2026-09-04',
    19.17,
    15481.63,
    807.3862,
    '00073767',
    'Factura Super 900'
);
