-- ==============================================================================
-- 🚨 MIGRACIÓN OFICIAL: BLINDAJE DEFINITIVO DE RECETAS EN COMBOS Y EXTRAS MULTI-INSUMO
-- Fecha: 21 de Septiembre de 2026
-- 
-- Problemas resueltos:
-- 1. Los combos ("El Antojo Rápido", "El Dúo Dinámico", "El Resuelve Familiar")
--    solo descontaban empaques y bebidas, omitiendo la Harina PAN y la Margarina
--    de la masa cruda de las arepas.
-- 2. La tabla extras_ingredientes no tenía los rellenos completos vinculados a cada
--    sabor de arepa en combos, provocando que solo se descontara un solo insumo
--    (ej: en Pelúa solo carne, sin queso amarillo; en Choriarepa solo chorizo, sin
--    pico de gallo ni queso blanco).
-- ==============================================================================

DO $$
DECLARE
    -- Insumos Canónicos
    v_harina UUID := 'b0000006-0000-0000-0000-000000000006';
    v_margarina UUID := 'b0000007-0000-0000-0000-000000000007';
    v_guiso_carne UUID := 'b0000045-0000-0000-0000-000000000045';
    v_guiso_pollo UUID := 'b0000046-0000-0000-0000-000000000046';
    v_relleno_reina UUID := 'b0000047-0000-0000-0000-000000000047';
    v_queso_amarillo UUID := 'b0000004-0000-0000-0000-000000000004';
    v_queso_blanco UUID := 'b0000005-0000-0000-0000-000000000005';
    v_jamon UUID := 'b0000003-0000-0000-0000-000000000003';
    v_chorizo UUID;
    v_pico_gallo UUID;
    v_papel UUID := 'b0000036-0000-0000-0000-000000000036';
    v_servilleta UUID := 'b0000035-0000-0000-0000-000000000035';
    v_caja_3 UUID;
    v_caja_6 UUID;
    v_bolsa UUID;
    v_vaso_beb UUID;
    v_vaso_des UUID;
    v_pepsi_1l UUID;
    v_pepsi_15l UUID;

    -- Productos Combos
    v_p_antojo UUID;
    v_p_duo UUID;
    v_p_familiar UUID;

    -- Extras Modificadores
    v_ext_catira UUID;
    v_ext_pelua UUID;
    v_ext_jamon_queso UUID;
    v_ext_reina UUID;
    v_ext_esp_carne UUID;
    v_ext_esp_pollo UUID;
    v_ext_choriarepa UUID;
BEGIN
    -- 1. Obtener insumos variables o por nombre
    SELECT id INTO v_chorizo FROM public.insumos WHERE nombre ILIKE '%CHORIZO AHUMADO (E)%' OR nombre ILIKE '%Chorizo Ahumado%' LIMIT 1;
    SELECT id INTO v_pico_gallo FROM public.insumos WHERE nombre ILIKE '%Pico de Gallo%' LIMIT 1;
    SELECT id INTO v_vaso_beb FROM public.insumos WHERE nombre ILIKE '%Vaso de Refresco (Bebida Servida)%' LIMIT 1;
    SELECT id INTO v_vaso_des FROM public.insumos WHERE nombre ILIKE '%Vasos Desechables y Tapas%' OR nombre ILIKE '%Vasos Desechables%' LIMIT 1;
    SELECT id INTO v_caja_3 FROM public.insumos WHERE nombre ILIKE '%Caja Dulce Kraft 3%' LIMIT 1;
    SELECT id INTO v_caja_6 FROM public.insumos WHERE nombre ILIKE '%Caja Dulce Kraft 6%' LIMIT 1;
    SELECT id INTO v_bolsa FROM public.insumos WHERE nombre ILIKE '%Bolsas Plásticas%' LIMIT 1;
    SELECT id INTO v_pepsi_1l FROM public.insumos WHERE nombre ILIKE '%Refresco Pepsi 1L%' LIMIT 1;
    SELECT id INTO v_pepsi_15l FROM public.insumos WHERE nombre ILIKE '%Pepsi Cola 1.5L%' OR nombre ILIKE '%Pepsi%1.5%' LIMIT 1;

    -- 2. Obtener IDs de Combos
    SELECT id INTO v_p_antojo FROM public.productos WHERE nombre ILIKE '%Antojo R_pido%' LIMIT 1;
    SELECT id INTO v_p_duo FROM public.productos WHERE nombre ILIKE '%D_o Din_mico%' LIMIT 1;
    SELECT id INTO v_p_familiar FROM public.productos WHERE nombre ILIKE '%Resuelve Familiar%' LIMIT 1;

    -- 3. ACTUALIZAR RECETA DE EL ANTOJO RÁPIDO (2 AREPAS)
    IF v_p_antojo IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_p_antojo;
        -- Masa de 2 arepas canónicas (27.59g harina + 5g margarina c/u)
        INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
            (v_p_antojo, v_harina, 55.18, false),
            (v_p_antojo, v_margarina, 10.00, false),
            (v_p_antojo, v_papel, 2.00, false),
            (v_p_antojo, v_servilleta, 2.00, false);
        -- Empaque y Bebida servida
        IF v_i_vaso_beb IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_antojo, v_vaso_beb, 1.0, false); END IF;
        IF v_i_vaso_des IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_antojo, v_vaso_des, 1.0, false); END IF;
        IF v_caja_3 IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_antojo, v_caja_3, 1.0, false); END IF;
        IF v_bolsa IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_antojo, v_bolsa, 1.0, false); END IF;
    END IF;

    -- 4. ACTUALIZAR RECETA DE EL DÚO DINÁMICO (4 AREPAS)
    IF v_p_duo IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_p_duo;
        -- Masa de 4 arepas canónicas (27.59g harina + 5g margarina c/u)
        INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
            (v_p_duo, v_harina, 110.36, false),
            (v_p_duo, v_margarina, 20.00, false),
            (v_p_duo, v_papel, 4.00, false),
            (v_p_duo, v_servilleta, 4.00, false);
        -- Empaque y Refresco 1L
        IF v_pepsi_1l IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_duo, v_pepsi_1l, 1.0, false); END IF;
        IF v_caja_3 IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_duo, v_caja_3, 1.0, false); END IF;
        IF v_bolsa IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_duo, v_bolsa, 1.0, false); END IF;
    END IF;

    -- 5. ACTUALIZAR RECETA DE EL RESUELVE FAMILIAR (10 AREPAS)
    IF v_p_familiar IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_p_familiar;
        -- Masa de 10 arepas canónicas (27.59g harina + 5g margarina c/u)
        INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
            (v_p_familiar, v_harina, 275.90, false),
            (v_p_familiar, v_margarina, 50.00, false),
            (v_p_familiar, v_papel, 10.00, false),
            (v_p_familiar, v_servilleta, 10.00, false);
        -- Empaque y Refresco 1.5L
        IF v_pepsi_15l IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_familiar, v_pepsi_15l, 1.0, false); END IF;
        IF v_caja_6 IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_familiar, v_caja_6, 1.0, false); END IF;
        IF v_bolsa IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES (v_p_familiar, v_bolsa, 1.0, false); END IF;
    END IF;

    -- 6. IDENTIFICAR EXTRAS MODIFICADORES DE SABORES EN COMBOS
    SELECT id INTO v_ext_catira FROM public.extras_modificadores WHERE nombre ILIKE '%Catira%' LIMIT 1;
    SELECT id INTO v_ext_pelua FROM public.extras_modificadores WHERE nombre ILIKE '%Pelúa%' OR nombre ILIKE '%Pelua%' LIMIT 1;
    SELECT id INTO v_ext_jamon_queso FROM public.extras_modificadores WHERE nombre ILIKE '%Jamón%' OR nombre ILIKE '%Jamon%' LIMIT 1;
    SELECT id INTO v_ext_reina FROM public.extras_modificadores WHERE nombre ILIKE '%Reina%' LIMIT 1;
    SELECT id INTO v_ext_esp_carne FROM public.extras_modificadores WHERE nombre ILIKE '%Especial%Carne%' LIMIT 1;
    SELECT id INTO v_ext_esp_pollo FROM public.extras_modificadores WHERE nombre ILIKE '%Especial%Pollo%' LIMIT 1;
    SELECT id INTO v_ext_choriarepa FROM public.extras_modificadores WHERE nombre ILIKE '%Choriarepa%' OR nombre ILIKE '%Chorizo%' LIMIT 1;

    -- 7. POBLAR TABLA extras_ingredientes CON RELLENOS COMPLETOS
    -- Asegurar tabla creada
    CREATE TABLE IF NOT EXISTS public.extras_ingredientes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        extra_id UUID NOT NULL REFERENCES public.extras_modificadores(id) ON DELETE CASCADE,
        insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
        cantidad NUMERIC(10, 4) NOT NULL CHECK (cantidad > 0),
        creado_el TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(extra_id, insumo_id)
    );

    -- Limpiar registros previos de los sabores de combo
    DELETE FROM public.extras_ingredientes 
    WHERE extra_id IN (v_ext_catira, v_ext_pelua, v_ext_jamon_queso, v_ext_reina, v_ext_esp_carne, v_ext_esp_pollo, v_ext_choriarepa);

    -- A) Catira: 50g Pollo Mechado + 50g Queso Amarillo
    IF v_ext_catira IS NOT NULL THEN
        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES
            (v_ext_catira, v_guiso_pollo, 50.00),
            (v_ext_catira, v_queso_amarillo, 50.00)
        ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = EXCLUDED.cantidad;
    END IF;

    -- B) Pelúa: 35g Carne Mechada + 35g Queso Amarillo
    IF v_ext_pelua IS NOT NULL THEN
        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES
            (v_ext_pelua, v_guiso_carne, 35.00),
            (v_ext_pelua, v_queso_amarillo, 35.00)
        ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = EXCLUDED.cantidad;
    END IF;

    -- C) Jamón y Queso Amarillo: 20g Jamón Pavo + 50g Queso Amarillo
    IF v_ext_jamon_queso IS NOT NULL THEN
        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES
            (v_ext_jamon_queso, v_jamon, 20.00),
            (v_ext_jamon_queso, v_queso_amarillo, 50.00)
        ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = EXCLUDED.cantidad;
    END IF;

    -- D) Reina Pepiada: 60g Relleno Reina Pepiada
    IF v_ext_reina IS NOT NULL THEN
        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES
            (v_ext_reina, v_relleno_reina, 60.00)
        ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = EXCLUDED.cantidad;
    END IF;

    -- E) Especial Carne: 50g Carne Mechada + 10g Jamón Pavo + 50g Queso Blanco
    IF v_ext_esp_carne IS NOT NULL THEN
        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES
            (v_ext_esp_carne, v_guiso_carne, 50.00),
            (v_ext_esp_carne, v_jamon, 10.00),
            (v_ext_esp_carne, v_queso_blanco, 50.00)
        ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = EXCLUDED.cantidad;
    END IF;

    -- F) Especial Pollo: 50g Pollo Mechado + 10g Jamón Pavo + 50g Queso Blanco
    IF v_ext_esp_pollo IS NOT NULL THEN
        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES
            (v_ext_esp_pollo, v_guiso_pollo, 50.00),
            (v_ext_esp_pollo, v_jamon, 10.00),
            (v_ext_esp_pollo, v_queso_blanco, 50.00)
        ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = EXCLUDED.cantidad;
    END IF;

    -- G) Choriarepa: 40g Chorizo Ahumado + 50g Pico de Gallo + 50g Queso Blanco
    IF v_ext_choriarepa IS NOT NULL THEN
        IF v_chorizo IS NOT NULL THEN
            INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES (v_ext_choriarepa, v_chorizo, 40.00)
            ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = EXCLUDED.cantidad;
        END IF;
        IF v_pico_gallo IS NOT NULL THEN
            INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES (v_ext_choriarepa, v_pico_gallo, 50.00)
            ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = EXCLUDED.cantidad;
        END IF;
        INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES (v_ext_choriarepa, v_queso_blanco, 50.00)
        ON CONFLICT (extra_id, insumo_id) DO UPDATE SET cantidad = EXCLUDED.cantidad;
    END IF;

END $$;

-- Verificación de Insumos en Combos
SELECT p.nombre AS combo, i.nombre AS insumo, ri.cantidad, i.unidad_medida
FROM public.recetas_ingredientes ri
JOIN public.productos p ON p.id = ri.producto_id
JOIN public.insumos i ON i.id = ri.insumo_id
WHERE p.nombre ILIKE '%Antojo%' OR p.nombre ILIKE '%D_o%' OR p.nombre ILIKE '%Familiar%'
ORDER BY p.nombre, ri.cantidad DESC;

-- Verificación de Rellenos en extras_ingredientes
SELECT em.nombre AS sabor_combo, i.nombre AS insumo_relleno, ei.cantidad, i.unidad_medida
FROM public.extras_ingredientes ei
JOIN public.extras_modificadores em ON em.id = ei.extra_id
JOIN public.insumos i ON i.id = ei.insumo_id
ORDER BY em.nombre, ei.cantidad DESC;
