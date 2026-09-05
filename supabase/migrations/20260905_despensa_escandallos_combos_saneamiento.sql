-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- MIGRACIÓN MAESTRA ULTRA-SEGURA: SANEAMIENTO DEFINITIVO DE DESPENSA Y COMBOS
-- Blindada contra wrap de texto en navegador (resolución dinámica de IDs)
-- ==============================================================================

BEGIN;

-- 1. CREAR / ACTUALIZAR INSUMOS CANÓNICOS (INSERT con ON CONFLICT por nombre)

-- 1.1 Pepsi 1L
INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
VALUES ('Refresco Pepsi 1L', 'und', 6, 2, 0.75, 'Bebidas', true)
ON CONFLICT (nombre) DO UPDATE SET
    unidad_medida = EXCLUDED.unidad_medida,
    costo_unitario_usd = EXCLUDED.costo_unitario_usd,
    categoria_insumo = EXCLUDED.categoria_insumo,
    activo = true;

-- 1.2 Vaso de Refresco (Bebida Servida)
INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
VALUES ('Vaso de Refresco (Bebida Servida)', 'und', 50, 10, 0.20, 'Bebidas', true)
ON CONFLICT (nombre) DO UPDATE SET
    unidad_medida = EXCLUDED.unidad_medida,
    categoria_insumo = EXCLUDED.categoria_insumo,
    activo = true;

-- 1.3 Envoplast y Papel Aluminio (Separados)
INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
VALUES 
('Envoplast La Plas (Rollo 30m)', 'und', 1, 1, 1.90, 'Desechables', true),
('Papel Aluminio Hugme (Rollo 8m)', 'und', 1, 1, 1.43, 'Desechables', true)
ON CONFLICT (nombre) DO UPDATE SET
    unidad_medida = EXCLUDED.unidad_medida,
    costo_unitario_usd = EXCLUDED.costo_unitario_usd,
    categoria_insumo = EXCLUDED.categoria_insumo,
    activo = true;

UPDATE public.insumos 
SET activo = false, stock_actual = 0 
WHERE nombre ILIKE '%Envoplast y Papel Aluminio%';

-- 1.4 Especias Doña Delia en gramos
INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
VALUES 
('Pimienta Negra Molida Doña Delia', 'g', 30, 10, 0.04033, 'Condimentos', true),
('Orégano Molido Doña Delia', 'g', 15, 5, 0.02333, 'Condimentos', true),
('Laurel Entero Doña Delia', 'g', 10, 5, 0.05900, 'Condimentos', true),
('Onoto Molido Doña Delia', 'g', 100, 20, 0.01500, 'Condimentos', true),
('Comino Molido Doña Delia', 'g', 50, 15, 0.02880, 'Condimentos', true)
ON CONFLICT (nombre) DO UPDATE SET
    unidad_medida = EXCLUDED.unidad_medida,
    stock_actual = EXCLUDED.stock_actual,
    costo_unitario_usd = EXCLUDED.costo_unitario_usd,
    categoria_insumo = EXCLUDED.categoria_insumo,
    activo = true;

UPDATE public.insumos 
SET activo = false, stock_actual = 0 
WHERE nombre ILIKE '%Especias Sachet%';

-- 1.5 Sincerar Adobo La Comadre 200g
UPDATE public.insumos
SET stock_actual = 180.00,
    stock_minimo = 30.00,
    costo_unitario_usd = 0.00845,
    categoria_insumo = 'Condimentos',
    activo = true
WHERE nombre ILIKE '%Adobo La Comadre%';

-- 1.6 Sincerar Caldos Maggi
UPDATE public.insumos
SET stock_actual = 5.00,
    stock_minimo = 2.00,
    costo_unitario_usd = 0.27375,
    categoria_insumo = 'Condimentos',
    activo = true
WHERE nombre ILIKE '%Caldo de Pollo Maggi%';

UPDATE public.insumos
SET stock_actual = 5.00,
    stock_minimo = 2.00,
    costo_unitario_usd = 0.27375,
    categoria_insumo = 'Condimentos',
    activo = true
WHERE nombre ILIKE '%Caldo de Costilla Criolla Maggi%';

-- 1.7 Sincerar Salsas de Cocina
UPDATE public.insumos 
SET stock_actual = 360.0, stock_minimo = 60.0, activo = true 
WHERE nombre ILIKE '%Salsa Ajo%';

UPDATE public.insumos 
SET stock_actual = 360.0, stock_minimo = 60.0, activo = true 
WHERE nombre ILIKE '%Salsa Big Mac%';

UPDATE public.insumos 
SET stock_actual = 360.0, stock_minimo = 60.0, activo = true 
WHERE nombre ILIKE '%Salsa Perejil%';

-- 2. VINCULAR PROVEEDORES (resolución dinámica por nombre, sin IDs fijos)
INSERT INTO public.proveedor_insumos (proveedor_id, insumo_id, precio_referencial_usd)
SELECT p.id, i.id, v.precio
FROM (VALUES
    ('Super 900%', '%Adobo La Comadre%', 1.69),
    ('Super 900%', '%Caldo de Pollo Maggi%', 2.19),
    ('Super 900%', '%Caldo de Costilla Criolla Maggi%', 2.19),
    ('Super 900%', '%Refresco Pepsi 1L%', 0.75),
    ('Super 900%', '%Envoplast La Plas%', 1.90),
    ('Super 900%', '%Papel Aluminio Hugme%', 1.43),
    ('Super 900%', '%Pimienta Negra Molida%', 1.21),
    ('Super 900%', '%Orégano Molido%', 0.35),
    ('Super 900%', '%Laurel Entero%', 0.59),
    ('Super 900%', '%Onoto Molido%', 1.50),
    ('Super 900%', '%Comino Molido%', 1.44),
    ('Todo en Desechables%', '%Vaso de Refresco%', 0.20)
) AS v(prov_pat, ins_pat, precio)
JOIN public.proveedores p ON p.nombre ILIKE v.prov_pat
JOIN public.insumos i ON i.nombre ILIKE v.ins_pat
ON CONFLICT (proveedor_id, insumo_id) DO UPDATE
SET precio_referencial_usd = EXCLUDED.precio_referencial_usd;

-- 3. ACTUALIZAR ESCANDALLOS OFICIALES DE COMBOS
DO $$
DECLARE
    v_p_antojo    UUID;
    v_p_duo       UUID;
    v_p_familiar  UUID;
    v_i_vaso_beb  UUID;
    v_i_vaso_des  UUID;
    v_i_caja_3    UUID;
    v_i_caja_6    UUID;
    v_i_bolsa     UUID;
    v_i_pepsi_1l  UUID;
    v_i_pepsi_15l UUID;
BEGIN
    SELECT id INTO v_p_antojo FROM public.productos WHERE nombre ILIKE '%Antojo%' OR nombre ILIKE '%combo%2%' ORDER BY nombre ASC LIMIT 1;
    SELECT id INTO v_p_duo FROM public.productos WHERE nombre ILIKE '%Dúo%' OR nombre ILIKE '%Duo%' OR nombre ILIKE '%combo%4%' ORDER BY nombre ASC LIMIT 1;
    SELECT id INTO v_p_familiar FROM public.productos WHERE nombre ILIKE '%Familiar%' OR nombre ILIKE '%Resuelve%' OR nombre ILIKE '%combo%10%' ORDER BY nombre ASC LIMIT 1;

    SELECT id INTO v_i_vaso_beb FROM public.insumos WHERE nombre ILIKE '%Vaso de Refresco (Bebida Servida)%' LIMIT 1;
    SELECT id INTO v_i_vaso_des FROM public.insumos WHERE nombre ILIKE '%Vasos Desechables y Tapas%' OR nombre ILIKE '%Vasos Desechables%' LIMIT 1;
    SELECT id INTO v_i_caja_3 FROM public.insumos WHERE nombre ILIKE '%Caja Dulce Kraft 3%' LIMIT 1;
    SELECT id INTO v_i_caja_6 FROM public.insumos WHERE nombre ILIKE '%Caja Dulce Kraft 6%' LIMIT 1;
    SELECT id INTO v_i_bolsa FROM public.insumos WHERE nombre ILIKE '%Bolsas Plásticas%' LIMIT 1;
    SELECT id INTO v_i_pepsi_1l FROM public.insumos WHERE nombre ILIKE '%Refresco Pepsi 1L%' LIMIT 1;
    SELECT id INTO v_i_pepsi_15l FROM public.insumos WHERE nombre ILIKE '%Pepsi Cola 1.5L%' OR nombre ILIKE '%Pepsi%1.5%' LIMIT 1;

    -- A. El Antojo Rápido (2 Arepas)
    IF v_p_antojo IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_p_antojo;
        IF v_i_vaso_beb IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_antojo, v_i_vaso_beb, 1.0, false); END IF;
        IF v_i_vaso_des IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_antojo, v_i_vaso_des, 1.0, false); END IF;
        IF v_i_caja_3 IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_antojo, v_i_caja_3, 1.0, false); END IF;
        IF v_i_bolsa IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_antojo, v_i_bolsa, 1.0, false); END IF;
    END IF;

    -- B. El Dúo Dinámico (4 Arepas)
    IF v_p_duo IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_p_duo;
        IF v_i_pepsi_1l IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_duo, v_i_pepsi_1l, 1.0, false); END IF;
        IF v_i_caja_3 IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_duo, v_i_caja_3, 1.0, false); END IF;
        IF v_i_bolsa IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_duo, v_i_bolsa, 1.0, false); END IF;
    END IF;

    -- C. El Resuelve Familiar (10 Arepas)
    IF v_p_familiar IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_p_familiar;
        IF v_i_pepsi_15l IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_familiar, v_i_pepsi_15l, 1.0, false); END IF;
        IF v_i_caja_6 IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_familiar, v_i_caja_6, 1.0, false); END IF;
        IF v_i_bolsa IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_familiar, v_i_bolsa, 1.0, false); END IF;
    END IF;
END $$;

-- 4. ACTUALIZAR EXTRAS DE SALSAS PRE-ELABORADAS
DO $$
DECLARE
    v_e_pollo UUID;
    v_e_carne UUID;
    v_i_salsa_per UUID;
    v_i_salsa_ajo UUID;
    v_i_perejil_hoja UUID;
BEGIN
    SELECT id INTO v_e_pollo FROM public.extras_modificadores WHERE nombre ILIKE '%Especial%Pollo%' LIMIT 1;
    SELECT id INTO v_e_carne FROM public.extras_modificadores WHERE nombre ILIKE '%Especial%Carne%' LIMIT 1;
    SELECT id INTO v_i_salsa_per FROM public.insumos WHERE nombre ILIKE '%Salsa Perejil%' LIMIT 1;
    SELECT id INTO v_i_salsa_ajo FROM public.insumos WHERE nombre ILIKE '%Salsa Ajo%' LIMIT 1;
    SELECT id INTO v_i_perejil_hoja FROM public.insumos WHERE nombre = 'Perejil Liso' LIMIT 1;

    IF v_e_pollo IS NOT NULL AND v_i_salsa_per IS NOT NULL THEN
        IF v_i_perejil_hoja IS NOT NULL THEN
            DELETE FROM public.extras_ingredientes WHERE extra_id = v_e_pollo AND insumo_id = v_i_perejil_hoja;
        END IF;
        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad)
        VALUES (v_e_pollo, v_i_salsa_per, 9.00)
        ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = 9.00;
    END IF;

    IF v_e_carne IS NOT NULL AND v_i_salsa_ajo IS NOT NULL THEN
        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad)
        VALUES (v_e_carne, v_i_salsa_ajo, 9.00)
        ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = 9.00;
    END IF;
END $$;

COMMIT;

-- VERIFICACIÓN FINAL
SELECT 
    categoria_insumo,
    nombre,
    stock_actual,
    unidad_medida,
    costo_unitario_usd
FROM public.insumos
WHERE nombre ILIKE '%Pepsi%'
   OR nombre ILIKE '%Vaso%'
   OR nombre ILIKE '%Envoplast%'
   OR nombre ILIKE '%Aluminio%'
   OR nombre ILIKE '%Doña Delia%'
   OR nombre ILIKE '%Adobo%'
   OR nombre ILIKE '%Caldo%'
   OR nombre ILIKE '%Salsa%'
ORDER BY categoria_insumo, nombre;
