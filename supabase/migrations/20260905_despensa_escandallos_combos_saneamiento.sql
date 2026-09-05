-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- MIGRACIÓN MAESTRA: SANEAMIENTO DEFINITIVO DE DESPENSA, ESCANDALLOS DE COMBOS,
-- BEBIDAS, EMPAQUES, SALSAS Y PROVEEDORES
-- La Parada del Sabor — 05 de Septiembre de 2026
-- ==============================================================================

BEGIN;

-- 0. GUARD DE PRE-VALIDACIÓN
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
        RAISE EXCEPTION 'COLISIÓN UNIQUE(nombre) DETECTADA: existen insumos con nombres canónicos pero id NO canónico. Resuélvelos manualmente antes de reejecutar:%', v_colisiones;
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

-- 1.5 Sincerar Adobo La Comadre 200g
UPDATE public.insumos
SET stock_actual = 180.00,
    stock_minimo = 30.00,
    costo_unitario_usd = 0.008450,
    categoria_insumo = 'Condimentos',
    activo = true
WHERE id = 'b0000016-0000-0000-0000-000000000016' OR nombre ILIKE '%Adobo La Comadre%';

-- 1.6 Sincerar Caldo de Pollo Maggi y Costilla Criolla
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

-- 1.7 Sincerar Salsas y Pre-elaborados
UPDATE public.insumos SET stock_actual = 360.0, stock_minimo = 60.0, activo = true WHERE id = 'b0000048-0000-0000-0000-000000000048';
UPDATE public.insumos SET stock_actual = 360.0, stock_minimo = 60.0, activo = true WHERE id = 'b0000049-0000-0000-0000-000000000049';
UPDATE public.insumos SET stock_actual = 360.0, stock_minimo = 60.0, activo = true WHERE id = 'b0000050-0000-0000-0000-000000000050';

-- 2. VINCULAR PROVEEDORES A TODOS LOS INSUMOS (proveedor_insumos)

-- Super 900
INSERT INTO public.proveedor_insumos (proveedor_id, insumo_id, precio_referencial_usd) VALUES
('a0000001-0000-0000-0000-000000000001', 'b0000016-0000-0000-0000-000000000016', 1.69),
('a0000001-0000-0000-0000-000000000001', 'b0000017-0000-0000-0000-000000000017', 2.19),
('a0000001-0000-0000-0000-000000000001', 'b0000018-0000-0000-0000-000000000018', 2.19),
('a0000001-0000-0000-0000-000000000001', 'b0000051-0000-0000-0000-000000000051', 0.75),
('a0000001-0000-0000-0000-000000000001', 'b0000053-0000-0000-0000-000000000053', 1.90),
('a0000001-0000-0000-0000-000000000001', 'b0000054-0000-0000-0000-000000000054', 1.43),
('a0000001-0000-0000-0000-000000000001', 'b0000055-0000-0000-0000-000000000055', 1.21),
('a0000001-0000-0000-0000-000000000001', 'b0000056-0000-0000-0000-000000000056', 0.35),
('a0000001-0000-0000-0000-000000000001', 'b0000057-0000-0000-0000-000000000057', 0.59),
('a0000001-0000-0000-0000-000000000001', 'b0000058-0000-0000-0000-000000000058', 1.50),
('a0000001-0000-0000-0000-000000000001', 'b0000059-0000-0000-0000-000000000059', 1.44)
ON CONFLICT (proveedor_id, insumo_id) DO UPDATE SET precio_referencial_usd = EXCLUDED.precio_referencial_usd;

-- Todo en Desechables C.A.
INSERT INTO public.proveedor_insumos (proveedor_id, insumo_id, precio_referencial_usd) VALUES
('a0000004-0000-0000-0000-000000000004', 'b0000052-0000-0000-0000-000000000052', 0.20)
ON CONFLICT (proveedor_id, insumo_id) DO UPDATE SET precio_referencial_usd = EXCLUDED.precio_referencial_usd;

-- 3. ACTUALIZAR ESCANDALLOS OFICIALES DE COMBOS EN recetas_ingredientes
DO $$
DECLARE
    v_prod_antojo_id    UUID;
    v_prod_duo_id       UUID;
    v_prod_familiar_id  UUID;
BEGIN
    SELECT id INTO v_prod_antojo_id   FROM public.productos WHERE nombre ILIKE '%Antojo%' OR nombre ILIKE '%combo%2%' ORDER BY nombre ASC LIMIT 1;
    SELECT id INTO v_prod_duo_id      FROM public.productos WHERE nombre ILIKE '%Dúo%' OR nombre ILIKE '%Duo%' OR nombre ILIKE '%combo%4%' OR nombre ILIKE '%compartir%' ORDER BY nombre ASC LIMIT 1;
    SELECT id INTO v_prod_familiar_id FROM public.productos WHERE nombre ILIKE '%Familiar%' OR nombre ILIKE '%Resuelve%' OR nombre ILIKE '%combo%10%' ORDER BY nombre ASC LIMIT 1;

    IF v_prod_antojo_id IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_prod_antojo_id;
    END IF;
    IF v_prod_duo_id IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_prod_duo_id;
    END IF;
    IF v_prod_familiar_id IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_prod_familiar_id;
    END IF;

    -- A. El Antojo Rápido (2 Arepas)
    IF v_prod_antojo_id IS NOT NULL THEN
        INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_prod_antojo_id, 'b0000052-0000-0000-0000-000000000052', 1.00, false),
        (v_prod_antojo_id, 'b0000040-0000-0000-0000-000000000040', 1.00, false),
        (v_prod_antojo_id, 'b0000038-0000-0000-0000-000000000038', 1.00, false),
        (v_prod_antojo_id, 'b0000041-0000-0000-0000-000000000041', 1.00, false);
    END IF;

    -- B. El Dúo Dinámico (4 Arepas)
    IF v_prod_duo_id IS NOT NULL THEN
        INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_prod_duo_id, 'b0000051-0000-0000-0000-000000000051', 1.00, false),
        (v_prod_duo_id, 'b0000038-0000-0000-0000-000000000038', 1.00, false),
        (v_prod_duo_id, 'b0000041-0000-0000-0000-000000000041', 1.00, false);
    END IF;

    -- C. El Resuelve Familiar (10 Arepas)
    IF v_prod_familiar_id IS NOT NULL THEN
        INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_prod_familiar_id, 'b0000044-0000-0000-0000-000000000044', 1.00, false),
        (v_prod_familiar_id, 'b0000037-0000-0000-0000-000000000037', 1.00, false),
        (v_prod_familiar_id, 'b0000041-0000-0000-0000-000000000041', 1.00, false);
    END IF;

END $$;

-- 4. ACTUALIZAR extras_ingredientes PARA QUE USE LAS SALSAS PRE-ELABORADAS REALES
DO $$
DECLARE
    v_ext_esp_pollo UUID;
    v_ext_esp_carne UUID;
BEGIN
    SELECT id INTO v_ext_esp_pollo FROM public.extras_modificadores WHERE nombre ILIKE '%Especial%Pollo%' LIMIT 1;
    SELECT id INTO v_ext_esp_carne FROM public.extras_modificadores WHERE nombre ILIKE '%Especial%Carne%' LIMIT 1;

    IF v_ext_esp_pollo IS NOT NULL THEN
        DELETE FROM public.extras_ingredientes 
        WHERE extra_id = v_ext_esp_pollo 
          AND insumo_id = 'b0000028-0000-0000-0000-000000000028';

        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad)
        VALUES (v_ext_esp_pollo, 'b0000050-0000-0000-0000-000000000050', 9.00)
        ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = 9.00;
    END IF;

    IF v_ext_esp_carne IS NOT NULL THEN
        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad)
        VALUES (v_ext_esp_carne, 'b0000048-0000-0000-0000-000000000048', 9.00)
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
    'b0000016-0000-0000-0000-000000000016',
    'b0000017-0000-0000-0000-000000000017',
    'b0000018-0000-0000-0000-000000000018',
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
ORDER BY i.categoria_insumo, i.nombre;
