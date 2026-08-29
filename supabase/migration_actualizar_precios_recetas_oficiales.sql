-- ==============================================================================
-- ACTUALIZACION OFICIAL DE PRECIOS, COMBOS Y RECETAS (ESCANDALLOS EXACTOS)
-- ==============================================================================

DO $$
DECLARE
    v_cat_arepas_id UUID;
    v_cat_combos_id UUID;

    v_ins_harina_id UUID;
    v_ins_pollo_id UUID;
    v_ins_carne_id UUID;
    v_ins_q_amarillo_id UUID;
    v_ins_q_blanco_id UUID;
    v_ins_aguacate_id UUID;
    v_ins_jamon_id UUID;
    v_ins_mantequilla_id UUID;
    v_ins_mayonesa_id UUID;
    v_ins_pepsi_15_id UUID;

    v_prod_jamon_queso_id UUID;
    v_prod_reina_id UUID;
    v_prod_catira_id UUID;
    v_prod_pelua_id UUID;
    v_prod_esp_carne_id UUID;
    v_prod_esp_pollo_id UUID;

    v_combo_personal_id UUID;
    v_combo_compartir_id UUID;
    v_combo_familiar_id UUID;
BEGIN
    SELECT id INTO v_cat_arepas_id FROM public.categorias WHERE nombre ILIKE '%arepa%' LIMIT 1;
    SELECT id INTO v_cat_combos_id FROM public.categorias WHERE nombre ILIKE '%combo%' LIMIT 1;

    SELECT id INTO v_ins_harina_id FROM public.insumos WHERE nombre ILIKE '%harina%' LIMIT 1;
    SELECT id INTO v_ins_pollo_id FROM public.insumos WHERE nombre ILIKE '%pechuga%pollo%' OR nombre ILIKE '%pollo%' LIMIT 1;
    SELECT id INTO v_ins_carne_id FROM public.insumos WHERE nombre ILIKE '%carne%res%' OR nombre ILIKE '%carne%' LIMIT 1;
    SELECT id INTO v_ins_q_amarillo_id FROM public.insumos WHERE nombre ILIKE '%queso amarillo%' LIMIT 1;
    SELECT id INTO v_ins_q_blanco_id FROM public.insumos WHERE nombre ILIKE '%queso blanco%' OR nombre ILIKE '%llanero%' LIMIT 1;
    SELECT id INTO v_ins_aguacate_id FROM public.insumos WHERE nombre ILIKE '%aguacate%' LIMIT 1;
    SELECT id INTO v_ins_jamon_id FROM public.insumos WHERE nombre ILIKE '%jamon%' OR nombre ILIKE '%pavo%' LIMIT 1;
    SELECT id INTO v_ins_mantequilla_id FROM public.insumos WHERE nombre ILIKE '%margarina%' OR nombre ILIKE '%mantequilla%' LIMIT 1;
    SELECT id INTO v_ins_mayonesa_id FROM public.insumos WHERE nombre ILIKE '%mayonesa%' LIMIT 1;
    SELECT id INTO v_ins_pepsi_15_id FROM public.insumos WHERE nombre ILIKE '%pepsi%1.5%' OR nombre ILIKE '%pepsi%' LIMIT 1;

    -- 1. Arepa Jamon y Queso ($2.00)
    SELECT id INTO v_prod_jamon_queso_id FROM public.productos WHERE nombre ILIKE '%jamón%queso%' OR nombre ILIKE '%jamon%queso%' LIMIT 1;
    IF v_prod_jamon_queso_id IS NULL THEN
        INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, activo, imagen_url)
        VALUES ('Arepa Jamón y Queso Amarillo', 'Arepa asada o frita rellena con jamón de pavo y queso amarillo con un toque de mantequilla.', 2.00, v_cat_arepas_id, true, '/images/menu-arepas.png')
        RETURNING id INTO v_prod_jamon_queso_id;
    ELSE
        UPDATE public.productos SET 
            nombre = 'Arepa Jamón y Queso Amarillo',
            descripcion = 'Arepa asada o frita rellena con jamón de pavo y queso amarillo con un toque de mantequilla.',
            precio_usd = 2.00,
            activo = true
        WHERE id = v_prod_jamon_queso_id;
    END IF;

    -- 2. Arepa Reina Pepiada ($2.00)
    SELECT id INTO v_prod_reina_id FROM public.productos WHERE nombre ILIKE '%reina pepiada%' LIMIT 1;
    IF v_prod_reina_id IS NULL THEN
        INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, activo, imagen_url)
        VALUES ('Arepa Reina Pepiada', 'Arepa rellena con pollo mechado en una mezcla de aguacate y especias. Frita o asada, con un toque de mantequilla.', 2.00, v_cat_arepas_id, true, '/images/menu-arepas.png')
        RETURNING id INTO v_prod_reina_id;
    ELSE
        UPDATE public.productos SET 
            nombre = 'Arepa Reina Pepiada',
            descripcion = 'Arepa rellena con pollo mechado en una mezcla de aguacate y especias. Frita o asada, con un toque de mantequilla.',
            precio_usd = 2.00,
            activo = true
        WHERE id = v_prod_reina_id;
    END IF;

    -- 3. Arepa Catira ($2.20)
    SELECT id INTO v_prod_catira_id FROM public.productos WHERE nombre ILIKE '%catira%' LIMIT 1;
    IF v_prod_catira_id IS NULL THEN
        INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, activo, imagen_url)
        VALUES ('Arepa Catira', 'Arepa asada o frita rellena con pollo mechado, queso amarillo y un toque de mantequilla.', 2.20, v_cat_arepas_id, true, '/images/menu-arepas.png')
        RETURNING id INTO v_prod_catira_id;
    ELSE
        UPDATE public.productos SET 
            nombre = 'Arepa Catira',
            descripcion = 'Arepa asada o frita rellena con pollo mechado, queso amarillo y un toque de mantequilla.',
            precio_usd = 2.20,
            activo = true
        WHERE id = v_prod_catira_id;
    END IF;

    -- 4. Arepa Pelua ($2.80)
    SELECT id INTO v_prod_pelua_id FROM public.productos WHERE nombre ILIKE '%pelua%' OR nombre ILIKE '%pelúa%' LIMIT 1;
    IF v_prod_pelua_id IS NULL THEN
        INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, activo, imagen_url)
        VALUES ('Arepa Pelúa', 'Arepa asada o frita rellena con carne mechada y queso amarillo con un toque de mantequilla.', 2.80, v_cat_arepas_id, true, '/images/menu-arepas.png')
        RETURNING id INTO v_prod_pelua_id;
    ELSE
        UPDATE public.productos SET 
            nombre = 'Arepa Pelúa',
            descripcion = 'Arepa asada o frita rellena con carne mechada y queso amarillo con un toque de mantequilla.',
            precio_usd = 2.80,
            activo = true
        WHERE id = v_prod_pelua_id;
    END IF;

    -- 5. Arepa Especial de Carne ($3.50)
    SELECT id INTO v_prod_esp_carne_id FROM public.productos WHERE nombre ILIKE '%especial%carne%' LIMIT 1;
    IF v_prod_esp_carne_id IS NULL THEN
        INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, activo, imagen_url)
        VALUES ('Arepa Especial de Carne Esmechada', 'Arepa asada o frita rellena de carne esmechada, jamón de pavo, queso rayado llanero, vegetales y salsas.', 3.50, v_cat_arepas_id, true, '/images/menu-arepas.png')
        RETURNING id INTO v_prod_esp_carne_id;
    ELSE
        UPDATE public.productos SET 
            nombre = 'Arepa Especial de Carne Esmechada',
            descripcion = 'Arepa asada o frita rellena de carne esmechada, jamón de pavo, queso rayado llanero, vegetales y salsas.',
            precio_usd = 3.50,
            activo = true
        WHERE id = v_prod_esp_carne_id;
    END IF;

    -- 6. Arepa Especial de Pollo ($2.80)
    SELECT id INTO v_prod_esp_pollo_id FROM public.productos WHERE nombre ILIKE '%especial%pollo%' LIMIT 1;
    IF v_prod_esp_pollo_id IS NULL THEN
        INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, activo, imagen_url)
        VALUES ('Arepa Especial de Pollo Esmechado', 'Arepa asada o frita rellena de pollo esmechado, jamón de pavo, queso rayado llanero, vegetales y salsas.', 2.80, v_cat_arepas_id, true, '/images/menu-arepas.png')
        RETURNING id INTO v_prod_esp_pollo_id;
    ELSE
        UPDATE public.productos SET 
            nombre = 'Arepa Especial de Pollo Esmechado',
            descripcion = 'Arepa asada o frita rellena de pollo esmechado, jamón de pavo, queso rayado llanero, vegetales y salsas.',
            precio_usd = 2.80,
            activo = true
        WHERE id = v_prod_esp_pollo_id;
    END IF;

    -- 7. Combo Personal ($4.00)
    SELECT id INTO v_combo_personal_id FROM public.productos WHERE nombre ILIKE '%combo%2%' OR nombre ILIKE '%personal%' LIMIT 1;
    IF v_combo_personal_id IS NULL THEN
        INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, activo, imagen_url)
        VALUES ('Combo Personal (2 Arepitas)', '2 arepitas rellenas a tu elección + 1 vaso de refresco bien frío.', 4.00, v_cat_combos_id, true, '/images/combo-arepas.png')
        RETURNING id INTO v_combo_personal_id;
    ELSE
        UPDATE public.productos SET 
            nombre = 'Combo Personal (2 Arepitas)',
            descripcion = '2 arepitas rellenas a tu elección + 1 vaso de refresco bien frío.',
            precio_usd = 4.00,
            activo = true
        WHERE id = v_combo_personal_id;
    END IF;

    -- 8. Combo para Compartir ($7.00)
    SELECT id INTO v_combo_compartir_id FROM public.productos WHERE nombre ILIKE '%combo%4%' OR nombre ILIKE '%compartir%' OR nombre ILIKE '%combo%6%' LIMIT 1;
    IF v_combo_compartir_id IS NULL THEN
        INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, activo, imagen_url)
        VALUES ('Combo para Compartir (4 Arepitas)', '4 arepitas rellenas a tu elección + 1 refresco de 1 Litro.', 7.00, v_cat_combos_id, true, '/images/combo-arepas.png')
        RETURNING id INTO v_combo_compartir_id;
    ELSE
        UPDATE public.productos SET 
            nombre = 'Combo para Compartir (4 Arepitas)',
            descripcion = '4 arepitas rellenas a tu elección + 1 refresco de 1 Litro.',
            precio_usd = 7.00,
            activo = true
        WHERE id = v_combo_compartir_id;
    END IF;

    -- 9. Combo Familiar ($13.00)
    SELECT id INTO v_combo_familiar_id FROM public.productos WHERE nombre ILIKE '%combo%10%' OR nombre ILIKE '%familiar%' LIMIT 1;
    IF v_combo_familiar_id IS NULL THEN
        INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, activo, imagen_url)
        VALUES ('Combo Familiar (10 Arepitas)', '10 arepitas rellenas con tus sabores favoritos + 1 refresco de 1.5 Litros.', 13.00, v_cat_combos_id, true, '/images/combo-arepas.png')
        RETURNING id INTO v_combo_familiar_id;
    ELSE
        UPDATE public.productos SET 
            nombre = 'Combo Familiar (10 Arepitas)',
            descripcion = '10 arepitas rellenas con tus sabores favoritos + 1 refresco de 1.5 Litros.',
            precio_usd = 13.00,
            activo = true
        WHERE id = v_combo_familiar_id;
    END IF;

    -- 10. Limpiar y Reasignar Recetas e Insumos
    DELETE FROM public.recetas_ingredientes WHERE producto_id IN (
        v_prod_jamon_queso_id, v_prod_reina_id, v_prod_catira_id, v_prod_pelua_id,
        v_prod_esp_carne_id, v_prod_esp_pollo_id,
        v_combo_personal_id, v_combo_compartir_id, v_combo_familiar_id
    );

    IF v_ins_harina_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_jamon_queso_id, v_ins_harina_id, 27.59); END IF;
    IF v_ins_mantequilla_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_jamon_queso_id, v_ins_mantequilla_id, 7.50); END IF;
    IF v_ins_jamon_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_jamon_queso_id, v_ins_jamon_id, 20.00); END IF;
    IF v_ins_q_amarillo_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_jamon_queso_id, v_ins_q_amarillo_id, 50.00); END IF;

    IF v_ins_harina_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_reina_id, v_ins_harina_id, 27.59); END IF;
    IF v_ins_mantequilla_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_reina_id, v_ins_mantequilla_id, 7.50); END IF;
    IF v_ins_pollo_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_reina_id, v_ins_pollo_id, 50.00); END IF;
    IF v_ins_aguacate_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_reina_id, v_ins_aguacate_id, 30.00); END IF;

    IF v_ins_harina_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_catira_id, v_ins_harina_id, 27.59); END IF;
    IF v_ins_mantequilla_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_catira_id, v_ins_mantequilla_id, 7.50); END IF;
    IF v_ins_pollo_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_catira_id, v_ins_pollo_id, 50.00); END IF;
    IF v_ins_q_amarillo_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_catira_id, v_ins_q_amarillo_id, 50.00); END IF;

    IF v_ins_harina_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_pelua_id, v_ins_harina_id, 27.59); END IF;
    IF v_ins_mantequilla_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_pelua_id, v_ins_mantequilla_id, 7.50); END IF;
    IF v_ins_carne_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_pelua_id, v_ins_carne_id, 50.00); END IF;
    IF v_ins_q_amarillo_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_pelua_id, v_ins_q_amarillo_id, 50.00); END IF;

    IF v_ins_harina_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_esp_carne_id, v_ins_harina_id, 27.59); END IF;
    IF v_ins_mantequilla_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_esp_carne_id, v_ins_mantequilla_id, 7.50); END IF;
    IF v_ins_carne_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_esp_carne_id, v_ins_carne_id, 50.00); END IF;
    IF v_ins_jamon_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_esp_carne_id, v_ins_jamon_id, 10.00); END IF;
    IF v_ins_q_blanco_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_esp_carne_id, v_ins_q_blanco_id, 50.00); END IF;

    IF v_ins_harina_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_esp_pollo_id, v_ins_harina_id, 27.59); END IF;
    IF v_ins_mantequilla_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_esp_pollo_id, v_ins_mantequilla_id, 7.50); END IF;
    IF v_ins_pollo_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_esp_pollo_id, v_ins_pollo_id, 50.00); END IF;
    IF v_ins_jamon_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_esp_pollo_id, v_ins_jamon_id, 10.00); END IF;
    IF v_ins_q_blanco_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_prod_esp_pollo_id, v_ins_q_blanco_id, 50.00); END IF;

    IF v_ins_harina_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_combo_personal_id, v_ins_harina_id, 55.17); END IF;
    IF v_ins_mantequilla_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_combo_personal_id, v_ins_mantequilla_id, 15.00); END IF;

    IF v_ins_harina_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_combo_compartir_id, v_ins_harina_id, 110.34); END IF;
    IF v_ins_mantequilla_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_combo_compartir_id, v_ins_mantequilla_id, 30.00); END IF;

    IF v_ins_harina_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_combo_familiar_id, v_ins_harina_id, 275.86); END IF;
    IF v_ins_mantequilla_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_combo_familiar_id, v_ins_mantequilla_id, 75.00); END IF;
    IF v_ins_pepsi_15_id IS NOT NULL THEN INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES (v_combo_familiar_id, v_ins_pepsi_15_id, 1.00); END IF;

END $$;
