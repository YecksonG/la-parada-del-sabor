-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- 1. UNIFICACIÓN COMPLETA DE TODAS LAS RECETAS DE AREPAS:
--    - Masa estándar: 27.59g Harina PAN Maíz Blanco (80g masa) + 7.50g Margarina Mavesa
--    - Arepa Pelúa: 27.59g Harina + 5g Margarina + 35g Guiso Carne + 35g Queso Amarillo
--    - Arepa Catira: 27.59g Harina + 7.5g Margarina + 50g Guiso Pollo + 50g Queso Amarillo
--    - Arepa Reina Pepiada: 27.59g Harina + 7.5g Margarina + 60g Relleno Reina Pepiada
--    - Arepa Jamón y Queso: 27.59g Harina + 7.5g Margarina + 20g Jamón Pavo + 50g Queso Amarillo
--    - Arepa Especial Carne: 27.59g Harina + 7.5g Margarina + 50g Guiso Carne + 10g Jamón Pavo + 50g Queso Blanco
--    - Arepa Especial Pollo: 27.59g Harina + 7.5g Margarina + 50g Guiso Pollo + 10g Jamón Pavo + 50g Queso Blanco
--    - Arepa de Chorizo: 27.59g Harina + 7.5g Margarina + 40g Chorizo Ahumado + 50g Pico de Gallo + 50g Queso Blanco
--
-- 2. ALTA DE LA NUEVA PROMOCIÓN: "Promo 50 Mini Arepas Coctel ($50.00 USD)"
--    - Masa de mini arepa: 50g de masa húmeda en balanza -> 17.24g Harina PAN seca (50 / 2.9)
--    - Para 50 mini arepas: 17.24g * 50 = 862g Harina PAN + 150g Margarina
--    - Empaque: Caja Dulce Kraft 6 (Familiar) + Servilletas
-- ==============================================================================

DO $$
DECLARE
    -- Categorías
    v_cat_combos_id UUID := '05c7b9bf-60d4-408c-af73-68d3525df268';
    
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
    v_caja_familiar UUID := 'b0000037-0000-0000-0000-000000000037';
    
    -- Productos IDs
    v_p_catira UUID := '9412fbe8-48fc-4e99-af39-188ae693336e';
    v_p_pelua UUID := 'a2370716-4627-4482-9179-099828bc8034';
    v_p_reina UUID := 'dfa9815f-2a47-435e-a0c8-79a823cf7aca';
    v_p_jamon_queso UUID := 'c6be1110-c54c-4f3b-bb8b-50a94e705466';
    v_p_esp_carne UUID := 'd1c7be3d-72b4-4be8-9fab-c3bcdbf99c82';
    v_p_esp_pollo UUID := 'd635320e-ddc6-496c-aebd-f542660f490d';
    v_p_chorizo UUID;
    v_p_promo_50 UUID;
BEGIN
    SELECT id INTO v_chorizo FROM public.insumos WHERE nombre ILIKE '%CHORIZO AHUMADO (E)%' LIMIT 1;
    SELECT id INTO v_pico_gallo FROM public.insumos WHERE nombre ILIKE '%Pico de Gallo%' LIMIT 1;
    SELECT id INTO v_p_chorizo FROM public.productos WHERE nombre = 'Arepa de Chorizo' LIMIT 1;

    -- 1. LIMPIAR RECETAS DE TODAS LAS AREPAS INDIVIDUALES PARA RE-ESTANDARIZAR
    DELETE FROM public.recetas_ingredientes 
    WHERE producto_id IN (v_p_catira, v_p_pelua, v_p_reina, v_p_jamon_queso, v_p_esp_carne, v_p_esp_pollo);
    
    IF v_p_chorizo IS NOT NULL THEN
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_p_chorizo;
    END IF;

    -- A) AREPA PELÚA (27.59g Harina = 80g masa, 5g margarina, 35g carne, 35g queso)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_p_pelua, v_harina, 27.59, false),
        (v_p_pelua, v_margarina, 5.00, false),
        (v_p_pelua, v_guiso_carne, 35.00, false),
        (v_p_pelua, v_queso_amarillo, 35.00, false),
        (v_p_pelua, v_papel, 1.00, false),
        (v_p_pelua, v_servilleta, 1.00, false);

    -- B) AREPA CATIRA (27.59g Harina, 7.5g margarina, 50g pollo, 50g queso)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_p_catira, v_harina, 27.59, false),
        (v_p_catira, v_margarina, 7.50, false),
        (v_p_catira, v_guiso_pollo, 50.00, false),
        (v_p_catira, v_queso_amarillo, 50.00, false),
        (v_p_catira, v_papel, 1.00, false),
        (v_p_catira, v_servilleta, 1.00, false);

    -- C) AREPA REINA PEPIADA (27.59g Harina, 7.5g margarina, 60g relleno reina)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_p_reina, v_harina, 27.59, false),
        (v_p_reina, v_margarina, 7.50, false),
        (v_p_reina, v_relleno_reina, 60.00, false),
        (v_p_reina, v_papel, 1.00, false),
        (v_p_reina, v_servilleta, 1.00, false);

    -- D) AREPA JAMÓN Y QUESO (27.59g Harina, 7.5g margarina, 20g jamón, 50g queso)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_p_jamon_queso, v_harina, 27.59, false),
        (v_p_jamon_queso, v_margarina, 7.50, false),
        (v_p_jamon_queso, v_jamon, 20.00, false),
        (v_p_jamon_queso, v_queso_amarillo, 50.00, false),
        (v_p_jamon_queso, v_papel, 1.00, false),
        (v_p_jamon_queso, v_servilleta, 1.00, false);

    -- E) AREPA ESPECIAL DE CARNE (27.59g Harina, 7.5g margarina, 50g carne, 10g jamón, 50g queso blanco)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_p_esp_carne, v_harina, 27.59, false),
        (v_p_esp_carne, v_margarina, 7.50, false),
        (v_p_esp_carne, v_guiso_carne, 50.00, false),
        (v_p_esp_carne, v_jamon, 10.00, false),
        (v_p_esp_carne, v_queso_blanco, 50.00, false),
        (v_p_esp_carne, v_papel, 1.00, false),
        (v_p_esp_carne, v_servilleta, 1.00, false);

    -- F) AREPA ESPECIAL DE POLLO (27.59g Harina, 7.5g margarina, 50g pollo, 10g jamón, 50g queso blanco)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_p_esp_pollo, v_harina, 27.59, false),
        (v_p_esp_pollo, v_margarina, 7.50, false),
        (v_p_esp_pollo, v_guiso_pollo, 50.00, false),
        (v_p_esp_pollo, v_jamon, 10.00, false),
        (v_p_esp_pollo, v_queso_blanco, 50.00, false),
        (v_p_esp_pollo, v_papel, 1.00, false),
        (v_p_esp_pollo, v_servilleta, 1.00, false);

    -- G) AREPA DE CHORIZO (27.59g Harina, 7.5g margarina, 40g chorizo, 50g pico gallo, 50g queso blanco)
    IF v_p_chorizo IS NOT NULL THEN
        INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
            (v_p_chorizo, v_harina, 27.59, false),
            (v_p_chorizo, v_margarina, 7.50, false),
            (v_p_chorizo, v_chorizo, 40.00, false),
            (v_p_chorizo, v_pico_gallo, 50.00, false),
            (v_p_chorizo, v_queso_blanco, 50.00, false),
            (v_p_chorizo, v_papel, 1.00, false),
            (v_p_chorizo, v_servilleta, 1.00, false);
    END IF;

    -- 2. DAR DE ALTA EL PRODUCTO: "Promo 50 Mini Arepas Coctel" ($50.00 USD)
    SELECT id INTO v_p_promo_50 FROM public.productos WHERE nombre ILIKE '%50%mini%arepa%' LIMIT 1;
    IF v_p_promo_50 IS NULL THEN
        v_p_promo_50 := gen_random_uuid();
        INSERT INTO public.productos (id, nombre, descripcion, precio_usd, categoria_id, icono, popular, activo)
        VALUES (
            v_p_promo_50,
            'Promo 50 Mini Arepas Coctel',
            'Bandeja para eventos de 50 mini arepas tipo coctel (50g masa cruda c/u) con sabores surtidos (carne, pollo, reina, jamón/queso y chorizo con pico de gallo).',
            50.00,
            v_cat_combos_id,
            '🎉',
            true,
            true
        );
    ELSE
        UPDATE public.productos 
        SET precio_usd = 50.00, activo = true 
        WHERE id = v_p_promo_50;
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_p_promo_50;
    END IF;

    -- Escandallo base para 50 mini arepas (50g masa húmeda c/u = 17.24g harina seca x 50 = 862g):
    -- Rellenos proporcionales a 50g de masa: ~25g de relleno total por mini arepita
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional) VALUES
        (v_p_promo_50, v_harina, 862.00, false),         -- 50 arepas x 17.24g harina seca
        (v_p_promo_50, v_margarina, 100.00, false),      -- Margarina masa
        (v_p_promo_50, v_guiso_carne, 250.00, false),    -- Relleno carne (10 mini arepas)
        (v_p_promo_50, v_guiso_pollo, 250.00, false),    -- Relleno pollo (10 mini arepas)
        (v_p_promo_50, v_relleno_reina, 250.00, false),  -- Relleno reina (10 mini arepas)
        (v_p_promo_50, v_queso_amarillo, 250.00, false), -- Queso amarillo
        (v_p_promo_50, v_chorizo, 200.00, false),        -- Chorizo (10 mini arepas)
        (v_p_promo_50, v_pico_gallo, 200.00, false),     -- Pico gallo (10 mini arepas)
        (v_p_promo_50, v_caja_familiar, 2.00, false),    -- 2 Cajas grandes/bandejas
        (v_p_promo_50, v_servilleta, 25.00, false);      -- Servilletas
END $$;
