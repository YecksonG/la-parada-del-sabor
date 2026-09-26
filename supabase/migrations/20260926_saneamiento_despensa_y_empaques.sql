-- ==============================================================================
-- 🚨 MIGRACIÓN OFICIAL: SANEAMIENTO MAESTRO DE INSUMOS, EMPAQUES, PRECIOS Y UNIDADES
-- Fecha: 26 de Septiembre de 2026
-- Prioridad: 10/10
--
-- Resuelve:
-- 1. Caja Dulce Kraft 3: corrección de costo PPMC inflado a $0.25 exactos.
-- 2. Mayonesa Mavesa 910g: fijar costo unitario a $4.03 por pote (und).
-- 3. Vaso Plástico Desechable: renombrar desde 'Vaso de Refresco (Bebida Servida)'
--    y ajustar costo y proveedor a $0.04.
-- 4. Tapas Desechables: fijar costo y proveedor a $0.06.
-- 5. Guantes de Nitrilo Negro L: fijar costo unitario a $0.10/guante ($10 caja 100).
-- 6. Papel Antigraso Breakfast 50 und: fijar costo a $0.0758/hoja ($3.79 paquete).
-- 7. Bolsas Plásticas: fijar costo a $0.05/bolsa.
-- 8. Servilletas: unificar Bamboo con Europapel (sumar 160 hojas @ $0.0092 ponderado).
-- 9. Eliminar insumos duplicados o temporales: 'VASOS HENCA #77 (E)' y 'A eliminar'.
-- 10. Unificar categorías 'Desechables' y 'Desechables & Limpieza' a 'Empaques y Desechables'.
-- ==============================================================================

BEGIN;

-- 1. CAJA DULCE KRAFT 3 (MEDIANA/PERSONAL)
UPDATE public.insumos
SET costo_unitario_usd = 0.25,
    actualizado_el = NOW()
WHERE id = 'b0000038-0000-0000-0000-000000000038';

-- 2. MAYONESA MAVESA 910G
UPDATE public.insumos
SET costo_unitario_usd = 4.03,
    unidad_medida = 'und',
    actualizado_el = NOW()
WHERE id = 'b0000008-0000-0000-0000-000000000008';

UPDATE public.proveedor_insumos
SET precio_referencial_usd = 4.03
WHERE insumo_id = 'b0000008-0000-0000-0000-000000000008';

-- 3. RENOMBRAR VASO Y AJUSTAR PRECIOS EN VASOS Y TAPAS
-- 3.1 Renombrar 'Vaso de Refresco (Bebida Servida)' a 'Vaso Plástico Desechable' ($0.04/und)
UPDATE public.insumos
SET nombre = 'Vaso Plástico Desechable',
    costo_unitario_usd = 0.04,
    categoria_insumo = 'Empaques y Desechables',
    actualizado_el = NOW()
WHERE id = 'a610f112-6228-40f2-a7cd-7d280e457cfb';

UPDATE public.proveedor_insumos
SET precio_referencial_usd = 0.04
WHERE insumo_id = 'a610f112-6228-40f2-a7cd-7d280e457cfb';

-- 3.2 Tapas Desechables ($0.06/und)
UPDATE public.insumos
SET costo_unitario_usd = 0.06,
    categoria_insumo = 'Empaques y Desechables',
    actualizado_el = NOW()
WHERE id = 'ffaec234-5cac-4fd1-82f4-8aa274f83544';

UPDATE public.proveedor_insumos
SET precio_referencial_usd = 0.06
WHERE insumo_id = 'ffaec234-5cac-4fd1-82f4-8aa274f83544';

-- 4. GUANTES DE NITRILO NEGRO L (100 UND)
UPDATE public.insumos
SET costo_unitario_usd = 0.10,
    categoria_insumo = 'Empaques y Desechables',
    actualizado_el = NOW()
WHERE id = 'b0000039-0000-0000-0000-000000000039';

UPDATE public.proveedor_insumos
SET precio_referencial_usd = 10.00
WHERE insumo_id = 'b0000039-0000-0000-0000-000000000039';

-- 5. PAPEL ANTIGRASO BREAKFAST 50 UND
UPDATE public.insumos
SET costo_unitario_usd = 0.0758,
    categoria_insumo = 'Empaques y Desechables',
    actualizado_el = NOW()
WHERE id = 'b0000036-0000-0000-0000-000000000036';

-- 6. BOLSAS PLÁSTICAS 10KG / 20KG
UPDATE public.insumos
SET costo_unitario_usd = 0.05,
    categoria_insumo = 'Empaques y Desechables',
    actualizado_el = NOW()
WHERE id = 'b0000041-0000-0000-0000-000000000041';

UPDATE public.proveedor_insumos
SET precio_referencial_usd = 0.05
WHERE insumo_id = 'b0000041-0000-0000-0000-000000000041';

-- 7. UNIFICAR SERVILLETAS BAMBOO CON INSUMO CANÓNICO
UPDATE public.insumos
SET nombre = 'Servilletas (160 und)',
    stock_actual = stock_actual + 160,
    costo_unitario_usd = 0.0092,
    categoria_insumo = 'Empaques y Desechables',
    actualizado_el = NOW()
WHERE id = 'b0000035-0000-0000-0000-000000000035';

UPDATE public.compras_items
SET insumo_id = 'b0000035-0000-0000-0000-000000000035',
    cantidad_base_total = 160,
    factor_conversion = 160,
    precio_unitario_usd = 0.0078
WHERE insumo_id = 'c57836b2-75ca-464d-90af-95161a58ed23';

DELETE FROM public.proveedor_insumos WHERE insumo_id = 'c57836b2-75ca-464d-90af-95161a58ed23';
DELETE FROM public.insumos WHERE id = 'c57836b2-75ca-464d-90af-95161a58ed23';

-- 8. ELIMINAR INSUMO DUPLICADO 'VASOS HENCA #77 (E)'
DELETE FROM public.proveedor_insumos WHERE insumo_id = 'd7cf9042-8190-400b-8c4a-8ce48ca5d1b6';
DELETE FROM public.insumos WHERE id = 'd7cf9042-8190-400b-8c4a-8ce48ca5d1b6';

-- 9. ELIMINAR INSUMO TEMPORAL 'A ELIMINAR'
UPDATE public.compras_items
SET insumo_id = 'b0000014-0000-0000-0000-000000000014'
WHERE insumo_id = '52a46576-6b8d-4158-a57f-90d6606cd5e4';

DELETE FROM public.proveedor_insumos WHERE insumo_id = '52a46576-6b8d-4158-a57f-90d6606cd5e4';
DELETE FROM public.insumos WHERE id = '52a46576-6b8d-4158-a57f-90d6606cd5e4';

-- 10. UNIFICAR TODAS LAS CATEGORÍAS DE DESECHABLES A 'Empaques y Desechables'
UPDATE public.insumos
SET categoria_insumo = 'Empaques y Desechables',
    actualizado_el = NOW()
WHERE categoria_insumo IN ('Desechables', 'Desechables & Limpieza');

COMMIT;
