-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- MIGRACIÓN MAESTRA: SANEAMIENTO DEFINITIVO DE DESPENSA, ESCANDALLOS DE COMBOS,
-- BEBIDAS, EMPAQUES, SALSAS Y PROVEEDORES
-- La Parada del Sabor — 05 de Septiembre de 2026
-- ==============================================================================

BEGIN;

-- 0. GUARD DE PRE-VALIDACIÓN: colisión UNIQUE(nombre) con insumos creados por la UI
-- public.insumos.nombre es VARCHAR(150) UNIQUE. Si el usuario creó por la UI un insumo con el
-- MISMO nombre canónico (pero id NO canónico), el ON CONFLICT (id) DO UPDATE de las secciones
-- 1.1-1.4 arrojaría error 23505 y REVERTIRÍA toda la transacción. Este guard aborta ANTES con
-- un mensaje claro listando las colisiones para resolverlas manualmente; si no hay colisión,
-- el bloque continúa silenciosamente (no genera salida de error).
DO $$
DECLARE
    v_colisiones TEXT := '';
    v_colision   RECORD;
BEGIN
    FOR v_colision IN
        SELECT i.nombre, i.id
        FROM public.insumos i
        WHERE i.nombre IN (
            'Refresco Pepsi 1L',
            'Vaso de Refresco (Bebida Servida)',
            'Envoplast La Plas (Rollo 30m)',
            'Papel Aluminio Hugme (Rollo 8m)',
            'Pimienta Negra Molida Doña Delia',
            'Orégano Molido Doña Delia',
            'Laurel Entero Doña Delia',
            'Onoto Molido Doña Delia',
            'Comino Molido Doña Delia'
        )
        AND i.id NOT IN (
            'b0000051-0000-0000-0000-000000000051',
            'b0000052-0000-0000-0000-000000000052',
            'b0000053-0000-0000-0000-000000000053',
            'b0000054-0000-0000-0000-000000000054',
            'b0000055-0000-0000-0000-000000000055',
            'b0000056-0000-0000-0000-000000000056',
            'b0000057-0000-0000-0000-000000000057',
            'b0000058-0000-0000-0000-000000000058',
            'b0000059-0000-0000-0000-000000000059'
        )
        ORDER BY i.nombre
    LOOP
        v_colisiones := v_colisiones || E'\n  - ' || v_colision.nombre || ' (id: ' || v_colision.id::text || ')';
    END LOOP;

    IF v_colisiones <> '' THEN
        RAISE EXCEPTION 'COLISIÓN UNIQUE(nombre) DETECTADA: existen insumos con nombres canónicos pero id NO canónico. Resuélvelos manualmente (renombra/fusiona/elimina) antes de reejecutar la migración:%', v_colisiones;
    END IF;
END $$;

-- 1. SEPARAR Y CREAR INSUMOS FALTANTES / CORREGIDOS CON IDENTIFICADORES CANÓNICOS

-- 1.1 Insumo Pepsi 1L
INSERT INTO public.insumos (id, nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
VALUES ('b0000051-0000-0000-0000-000000000051', 'Refresco Pepsi 1L', 'und', 6, 2, 0.750000, 'Bebidas', true)
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    unidad_medida = EXCLUDED.unidad_medida,
    costo_unitario_usd = EXCLUDED.costo_unitario_usd,
    categoria_insumo = EXCLUDED.categoria_insumo;

-- 1.2 Insumo Vaso de Refresco (Bebida Servida)
INSERT INTO public.insumos (id, nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
VALUES ('b0000052-0000-0000-0000-000000000052', 'Vaso de Refresco (Bebida Servida)', 'und', 50, 10, 0.200000, 'Bebidas', true)
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    unidad_medida = EXCLUDED.unidad_medida,
    categoria_insumo = EXCLUDED.categoria_insumo;

-- 1.3 Separar Envoplast y Papel Aluminio en dos insumos independientes
INSERT INTO public.insumos (id, nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
VALUES 
('b0000053-0000-0000-0000-000000000053', 'Envoplast La Plas (Rollo 30m)', 'und', 1, 1, 1.900000, 'Desechables', true),
('b0000054-0000-0000-0000-000000000054', 'Papel Aluminio Hugme (Rollo 8m)', 'und', 1, 1, 1.430000, 'Desechables', true)
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    unidad_medida = EXCLUDED.unidad_medida,
    costo_unitario_usd = EXCLUDED.costo_unitario_usd,
    categoria_insumo = EXCLUDED.categoria_insumo;

-- Desactivar el insumo combinado anterior
UPDATE public.insumos 
SET activo = false, stock_actual = 0 
WHERE id = 'b0000042-0000-0000-0000-000000000042' OR nombre ILIKE '%Envoplast y Papel Aluminio%';

-- 1.4 Separar Especias Sachet en gramos (Doña Delia)
INSERT INTO public.insumos (id, nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
VALUES 
('b0000055-0000-0000-0000-000000000055', 'Pimienta Negra Molida Doña Delia', 'g', 30, 10, 0.040330, 'Condimentos', true),
('b0000056-0000-0000-0000-000000000056', 'Orégano Molido Doña Delia', 'g', 15, 5, 0.023330, 'Condimentos', true),
('b0000057-0000-0000-0000-000000000057', 'Laurel Entero Doña Delia', 'g', 10, 5, 0.059000, 'Condimentos', true),
('b0000058-0000-0000-0000-000000000058', 'Onoto Molido Doña Delia', 'g', 100, 20, 0.015000, 'Condimentos', true),
('b0000059-0000-0000-0000-000000000059', 'Comino Molido Doña Delia', 'g', 50, 15, 0.028800, 'Condimentos', true)
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    unidad_medida = EXCLUDED.unidad_medida,
    stock_actual = EXCLUDED.stock_actual,
    costo_unitario_usd = EXCLUDED.costo_unitario_usd,
    categoria_insumo = EXCLUDED.categoria_insumo,
    activo = true;

-- Desactivar el paquete genérico sachet
UPDATE public.insumos 
SET activo = false, stock_actual = 0 
WHERE id = 'b0000019-0000-0000-0000-000000000019' OR nombre ILIKE '%Especias Sachet%';

-- 1.5 Sincerar Adobo La Comadre 200g (quedan 180g reales de 200g comprados)
UPDATE public.insumos
SET stock_actual = 180.00,
    stock_minimo = 30.00,
    costo_unitario_usd = 0.008450,
    categoria_insumo = 'Condimentos',
    activo = true
WHERE id = 'b0000016-0000-0000-0000-000000000016' OR nombre ILIKE '%Adobo La Comadre%';

-- 1.6 Sincerar Caldo de Pollo Maggi y Costilla Criolla (quedan 5 cubitos reales de 8 comprados)
UPDATE public.insumos
SET stock_actual = 5.00,
    stock_minimo = 2.00,
    costo_unitario_usd = 0.273750,
    categoria_insumo = 'Condimentos',
    activo = true
WHERE id = 'b0000017-0000-0000-0000-000000000017' OR nombre ILIKE '%Caldo de Pollo Maggi%';

UPDATE public.insumos
SET stock_actual = 5.00,
    stock_minimo = 2.00,
    costo_unitario_usd = 0.273750,
    categoria_insumo = 'Condimentos',
    activo = true
WHERE id = 'b0000018-0000-0000-0000-000000000018' OR nombre ILIKE '%Caldo de Costilla Criolla Maggi%';

-- 1.7 Sincerar Salsas y Pre-elaborados (Botes de 360ml)
UPDATE public.insumos SET stock_actual = 360.0, stock_minimo = 60.0, activo = true WHERE id = 'b0000048-0000-0000-0000-000000000048'; -- Salsa Ajo
UPDATE public.insumos SET stock_actual = 360.0, stock_minimo = 60.0, activo = true WHERE id = 'b0000049-0000-0000-0000-000000000049'; -- Salsa Big Mac
UPDATE public.insumos SET stock_actual = 360.0, stock_minimo = 60.0, activo = true WHERE id = 'b0000050-0000-0000-0000-000000000050'; -- Salsa Perejil


-- 2. VINCULAR PROVEEDORES A TODOS LOS INSUMOS (proveedor_insumos)

-- Proveedor 1: Super 900
INSERT INTO public.proveedor_insumos (proveedor_id, insumo_id, precio_referencial_usd) VALUES
('a0000001-0000-0000-0000-000000000001', 'b0000016-0000-0000-0000-000000000016', 1.69), -- Adobo La Comadre 200g
('a0000001-0000-0000-0000-000000000001', 'b0000017-0000-0000-0000-000000000017', 2.19), -- Caldo de Pollo Maggi (8 und)
('a0000001-0000-0000-0000-000000000001', 'b0000018-0000-0000-0000-000000000018', 2.19), -- Caldo de Costilla Maggi (8 und)
('a0000001-0000-0000-0000-000000000001', 'b0000051-0000-0000-0000-000000000051', 0.75), -- Pepsi 1L
('a0000001-0000-0000-0000-000000000001', 'b0000053-0000-0000-0000-000000000053', 1.90), -- Envoplast
('a0000001-0000-0000-0000-000000000001', 'b0000054-0000-0000-0000-000000000054', 1.43), -- Papel Aluminio
('a0000001-0000-0000-0000-000000000001', 'b0000055-0000-0000-0000-000000000055', 1.21), -- Pimienta Molida 30g
('a0000001-0000-0000-0000-000000000001', 'b0000056-0000-0000-0000-000000000056', 0.35), -- Orégano 15g
('a0000001-0000-0000-0000-000000000001', 'b0000057-0000-0000-0000-000000000057', 0.59), -- Laurel 10g
('a0000001-0000-0000-0000-000000000001', 'b0000058-0000-0000-0000-000000000058', 1.50), -- Onoto 100g
('a0000001-0000-0000-0000-000000000001', 'b0000059-0000-0000-0000-000000000059', 1.44)  -- Comino 50g
ON CONFLICT (proveedor_id, insumo_id) DO UPDATE SET precio_referencial_usd = EXCLUDED.precio_referencial_usd;

-- Proveedor 4: Todo en Desechables C.A.
INSERT INTO public.proveedor_insumos (proveedor_id, insumo_id, precio_referencial_usd) VALUES
('a0000004-0000-0000-0000-000000000004', 'b0000052-0000-0000-0000-000000000052', 0.20) -- Vaso de refresco con tapa
ON CONFLICT (proveedor_id, insumo_id) DO UPDATE SET precio_referencial_usd = EXCLUDED.precio_referencial_usd;


-- 3. ACTUALIZAR ESCANDALLOS OFICIALES DE COMBOS EN recetas_ingredientes
-- Los guisos y masas se descuentan por las arepitas seleccionadas (extras_ingredientes).
-- El combo padre descuenta: LA BEBIDA OFICIAL, LA CAJA DE EMPAQUE Y LA BOLSA CONTENEDORA.

DO $$
DECLARE
    v_prod_antojo_id    UUID;
    v_prod_duo_id       UUID;
    v_prod_familiar_id  UUID;
BEGIN
    SELECT id INTO v_prod_antojo_id   FROM public.productos WHERE nombre ILIKE '%Antojo%' OR nombre ILIKE '%combo%2%' ORDER BY nombre ASC LIMIT 1;
    SELECT id INTO v_prod_duo_id      FROM public.productos WHERE nombre ILIKE '%Dúo%' OR nombre ILIKE '%Duo%' OR nombre ILIKE '%combo%4%' OR nombre ILIKE '%compartir%' ORDER BY nombre ASC LIMIT 1;
    SELECT id INTO v_prod_familiar_id FROM public.productos WHERE nombre ILIKE '%Familiar%' OR nombre ILIKE '%Resuelve%' OR nombre ILIKE '%combo%10%' ORDER BY nombre ASC LIMIT 1;

    -- Limpiar escandallos anteriores de los 3 combos para reconstruirlos perfectamente
    IF v_prod_antojo_id IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_prod_antojo_id;
    END IF;
    IF v_prod_duo_id IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_prod_duo_id;
    END IF;
    IF v_prod_familiar_id IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_prod_familiar_id;
    END IF;

    -- A. EL ANTOJO RÁPIDO (2 Arepas)
    -- Incluye: 1 Vaso de Refresco (Bebida) + 1 Vaso y Tapa Desechable + 1 Caja Kraft 3 + 1 Bolsa
    IF v_prod_antojo_id IS NOT NULL THEN
        INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_prod_antojo_id, 'b0000052-0000-0000-0000-000000000052', 1.00, false), -- Vaso de Refresco Bebida
        (v_prod_antojo_id, 'b0000040-0000-0000-0000-000000000040', 1.00, false), -- Vaso Desechable y Tapa
        (v_prod_antojo_id, 'b0000038-0000-0000-0000-000000000038', 1.00, false), -- Caja Dulce Kraft 3 (Mediana/Personal)
        (v_prod_antojo_id, 'b0000041-0000-0000-0000-000000000041', 1.00, false); -- Bolsa Plástica
    END IF;

    -- B. EL DÚO DINÁMICO (4 Arepas)
    -- Incluye: 1 Refresco Pepsi 1L + 1 Caja Kraft 3 + 1 Bolsa Plástica
    IF v_prod_duo_id IS NOT NULL THEN
        INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_prod_duo_id, 'b0000051-0000-0000-0000-000000000051', 1.00, false), -- Refresco Pepsi 1L
        (v_prod_duo_id, 'b0000038-0000-0000-0000-000000000038', 1.00, false), -- Caja Dulce Kraft 3 (Mediana/Personal)
        (v_prod_duo_id, 'b0000041-0000-0000-0000-000000000041', 1.00, false); -- Bolsa Plástica
    END IF;

    -- C. EL RESUELVE FAMILIAR (10 Arepas)
    -- Incluye: 1 Refresco Pepsi 1.5L + 1 Caja Kraft 6 (Familiar) + 1 Bolsa Plástica
    IF v_prod_familiar_id IS NOT NULL THEN
        INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_prod_familiar_id, 'b0000044-0000-0000-0000-000000000044', 1.00, false), -- Pepsi Cola 1.5L
        (v_prod_familiar_id, 'b0000037-0000-0000-0000-000000000037', 1.00, false), -- Caja Dulce Kraft 6 (Familiar)
        (v_prod_familiar_id, 'b0000041-0000-0000-0000-000000000041', 1.00, false); -- Bolsa Plástica
    END IF;

END $$;


-- 4. ACTUALIZAR extras_ingredientes PARA QUE USE LAS SALSAS PRE-ELABORADAS REALES
-- Evitar que la Arepa Especial de Pollo descuente Perejil en hoja en vez de Salsa de Perejil
DO $$
DECLARE
    v_ext_esp_pollo UUID;
    v_ext_esp_carne UUID;
BEGIN
    SELECT id INTO v_ext_esp_pollo FROM public.extras_modificadores WHERE nombre ILIKE '%Especial%Pollo%' LIMIT 1;
    SELECT id INTO v_ext_esp_carne FROM public.extras_modificadores WHERE nombre ILIKE '%Especial%Carne%' LIMIT 1;

    -- Reemplazar perejil en hoja por salsa de perejil casera
    IF v_ext_esp_pollo IS NOT NULL THEN
        DELETE FROM public.extras_ingredientes 
        WHERE extra_id = v_ext_esp_pollo 
          AND insumo_id = 'b0000028-0000-0000-0000-000000000028'; -- Perejil Liso

        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad)
        VALUES (v_ext_esp_pollo, 'b0000050-0000-0000-0000-000000000050', 9.00) -- Salsa Perejil Casera (ml)
        ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = 9.00;
    END IF;

    -- Asegurar Salsa Ajo Casera en Especial de Carne
    IF v_ext_esp_carne IS NOT NULL THEN
        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad)
        VALUES (v_ext_esp_carne, 'b0000048-0000-0000-0000-000000000048', 9.00) -- Salsa Ajo Casera (ml)
        ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = 9.00;
    END IF;
END $$;

COMMIT;

-- VERIFICACIÓN INMEDIATA
SELECT 
    i.categoria_insumo,
    i.nombre,
    i.stock_actual,
    i.unidad_medida,
    i.costo_unitario_usd
FROM public.insumos i
WHERE i.id IN (
    'b0000016-0000-0000-0000-000000000016', -- Adobo
    'b0000017-0000-0000-0000-000000000017', -- Caldo Pollo
    'b0000018-0000-0000-0000-000000000018', -- Caldo Costilla
    'b0000051-0000-0000-0000-000000000051', -- Pepsi 1L
    'b0000052-0000-0000-0000-000000000052', -- Vaso Refresco
    'b0000053-0000-0000-0000-000000000053', -- Envoplast
    'b0000054-0000-0000-0000-000000000054', -- Papel Aluminio
    'b0000055-0000-0000-0000-000000000055', -- Pimienta
    'b0000056-0000-0000-0000-000000000056', -- Orégano
    'b0000057-0000-0000-0000-000000000057', -- Laurel
    'b0000058-0000-0000-0000-000000000058', -- Onoto
    'b0000059-0000-0000-0000-000000000059'  -- Comino
)
ORDER BY i.categoria_insumo, i.nombre;
