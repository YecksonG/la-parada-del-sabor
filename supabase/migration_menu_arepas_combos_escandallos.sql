-- ==============================================================================
-- CARGA OFICIAL DE PRODUCTOS, COMBOS, INSUMOS Y ESCANDALLOS DE RECETA
-- La Parada del Sabor — 27 de Agosto de 2026
-- ==============================================================================

DO $$
DECLARE
    -- Categorías
    v_cat_arepas_id UUID;
    v_cat_combos_id UUID;
    v_cat_bebidas_id UUID;

    -- Insumos Primarios
    v_ins_harina_id UUID;
    v_ins_pollo_id UUID;
    v_ins_carne_id UUID;
    v_ins_q_amarillo_id UUID;
    v_ins_q_blanco_id UUID;
    v_ins_aguacate_id UUID;
    v_ins_jamon_id UUID;
    v_ins_mantequilla_id UUID;
    v_ins_mayonesa_id UUID;
    v_ins_mostaza_id UUID;
    v_ins_ketchup_id UUID;
    v_ins_tomate_id UUID;
    v_ins_ceb_morada_id UUID;
    v_ins_lechuga_id UUID;
    v_ins_pepsi_id UUID;
    v_ins_papel_id UUID;
    v_ins_caja_peq_id UUID;
    v_ins_caja_gde_id UUID;
    v_ins_vaso_id UUID;
    v_ins_servilleta_id UUID;

    -- Sub-recetas / Guisos
    v_ins_guiso_pollo_id UUID;
    v_ins_guiso_carne_id UUID;
    v_ins_reina_pepiada_id UUID;
    v_ins_salsa_ajo_id UUID;

    -- Productos
    v_prod_reina_id UUID;
    v_prod_catira_id UUID;
    v_prod_pelua_id UUID;
    v_prod_mixta_id UUID;
    v_prod_combo2_id UUID;
    v_prod_combo6_id UUID;
    v_prod_combo10_id UUID;
    v_prod_pepsi15_id UUID;
BEGIN

    -- 1. Categorías del Menú
    SELECT id INTO v_cat_arepas_id FROM public.categorias WHERE nombre ILIKE '%Arepas%' LIMIT 1;
    IF v_cat_arepas_id IS NULL THEN
        INSERT INTO public.categorias (nombre, icono, orden, activo) 
        VALUES ('Arepas Rellenas', '🫓', 1, true) RETURNING id INTO v_cat_arepas_id;
    END IF;

    SELECT id INTO v_cat_combos_id FROM public.categorias WHERE nombre ILIKE '%Combos%' LIMIT 1;
    IF v_cat_combos_id IS NULL THEN
        INSERT INTO public.categorias (nombre, icono, orden, activo) 
        VALUES ('Combos & Promociones', '🍱', 2, true) RETURNING id INTO v_cat_combos_id;
    END IF;

    SELECT id INTO v_cat_bebidas_id FROM public.categorias WHERE nombre ILIKE '%Bebidas%' LIMIT 1;
    IF v_cat_bebidas_id IS NULL THEN
        INSERT INTO public.categorias (nombre, icono, orden, activo) 
        VALUES ('Bebidas & Jugos', '🥤', 3, true) RETURNING id INTO v_cat_bebidas_id;
    END IF;

    -- 2. Insumos Base de la Despensa (con stock de apertura y costo unitario)
    
    -- Harina PAN
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Harina PAN', 'g', 3000.0, 1000.0, 0.00113, 'Masas', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_harina_id;

    -- Pechuga de Pollo Cruda
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Pechuga de Pollo Cruda', 'g', 1310.0, 500.0, 0.00450, 'Carnes', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_pollo_id;

    -- Carne de Res para Desmechar
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Carne de Res Cruda', 'g', 1150.0, 500.0, 0.00973, 'Carnes', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_carne_id;

    -- Queso Amarillo
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Queso Amarillo Rallado', 'g', 465.0, 200.0, 0.00797, 'Quesos', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_q_amarillo_id;

    -- Queso Blanco de Res
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Queso Blanco de Res', 'g', 600.0, 200.0, 0.00741, 'Quesos', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_q_blanco_id;

    -- Aguacate Polo
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Aguacate Polo Fresco', 'g', 558.0, 200.0, 0.00448, 'Vegetales', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_aguacate_id;

    -- Pechuga de Pavo / Jamón
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Pechuga de Pavo / Jamón', 'g', 310.0, 100.0, 0.00776, 'Carnes', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_jamon_id;

    -- Margarina Mavesa
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Margarina Mavesa', 'g', 1000.0, 200.0, 0.00551, 'Lácteos', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_mantequilla_id;

    -- Mayonesa Mavesa
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Mayonesa Mavesa', 'g', 310.0, 100.0, 0.02580, 'Salsas', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_mayonesa_id;

    -- Mostaza Eureka
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Mostaza Eureka', 'ml', 430.0, 100.0, 0.00777, 'Salsas', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_mostaza_id;

    -- Ketchup / Salsa Tomate
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Salsa de Tomate Pampero', 'g', 397.0, 100.0, 0.00481, 'Salsas', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_ketchup_id;

    -- Tomate Fresco
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Tomate Perita', 'g', 690.0, 200.0, 0.00299, 'Vegetales', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_tomate_id;

    -- Cebolla Morada
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Cebolla Morada', 'g', 470.0, 200.0, 0.00225, 'Vegetales', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_ceb_morada_id;

    -- Lechuga
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Lechuga Americana', 'g', 500.0, 200.0, 0.00099, 'Vegetales', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_lechuga_id;

    -- Pepsi 1.5 L
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Refresco Pepsi 1.5 L', 'und', 6.0, 2.0, 0.849, 'Bebidas', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_pepsi_id;

    -- Papel Antigraso
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Papel Antigraso Breakfast', 'und', 50.0, 10.0, 0.074, 'Empaques', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_papel_id;

    -- Cajas Pequeñas
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Cajas Pequeñas Descartables', 'und', 20.0, 5.0, 0.650, 'Empaques', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_caja_peq_id;

    -- Cajas Grandes
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Cajas Grandes Descartables', 'und', 20.0, 5.0, 0.850, 'Empaques', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_caja_gde_id;

    -- Vasos y Tapas
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Vaso con Tapa 50 und', 'und', 50.0, 10.0, 0.100, 'Empaques', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_vaso_id;

    -- Servilletas
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Servilletas Europapel', 'und', 320.0, 50.0, 0.006, 'Empaques', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_servilleta_id;

    -- 3. Sub-Recetas y Guisos Pre-elaborados
    
    -- Guiso de Pollo Mechado
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Guiso de Pollo Mechado', 'g', 1500.0, 300.0, 0.00426, 'Pre-elaborados', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_guiso_pollo_id;

    -- Guiso de Carne Mechada
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Guiso de Carne Mechada', 'g', 1400.0, 300.0, 0.00842, 'Pre-elaborados', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_guiso_carne_id;

    -- Relleno Reina Pepiada
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Relleno Reina Pepiada', 'g', 1000.0, 200.0, 0.00714, 'Pre-elaborados', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_reina_pepiada_id;

    -- Salsa de Ajo Casera
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Salsa de Ajo de la Casa', 'g', 500.0, 100.0, 0.00385, 'Pre-elaborados', true)
    ON CONFLICT (nombre) DO UPDATE SET stock_actual = EXCLUDED.stock_actual, costo_unitario_usd = EXCLUDED.costo_unitario_usd, activo = true
    RETURNING id INTO v_ins_salsa_ajo_id;


    -- 4. Productos Finales del Menú con PVP Máximo Sugerido

    -- A. Arepa Reina Pepiada ($2.50)
    INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, icono, popular, activo)
    VALUES (
        'Arepa Reina Pepiada',
        'Pollo desmechado con aguacate polo cremoso, mayonesa Mavesa, toque de mostaza y mantequilla.',
        2.50,
        v_cat_arepas_id,
        '🥑',
        true,
        true
    )
    ON CONFLICT (nombre) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        precio_usd = EXCLUDED.precio_usd,
        categoria_id = EXCLUDED.categoria_id,
        icono = EXCLUDED.icono,
        activo = true
    RETURNING id INTO v_prod_reina_id;

    -- B. Arepa Catira ($2.50)
    INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, icono, popular, activo)
    VALUES (
        'Arepa Catira',
        'Guiso casero de pollo mechado jugoso coronado con abundante queso amarillo rallado.',
        2.50,
        v_cat_arepas_id,
        '🧀',
        true,
        true
    )
    ON CONFLICT (nombre) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        precio_usd = EXCLUDED.precio_usd,
        categoria_id = EXCLUDED.categoria_id,
        icono = EXCLUDED.icono,
        activo = true
    RETURNING id INTO v_prod_catira_id;

    -- C. Arepa Pelúa ($3.00)
    INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, icono, popular, activo)
    VALUES (
        'Arepa Pelúa',
        'Carne de res tierna mechada con sazón tradicional y abundante queso amarillo rallado.',
        3.00,
        v_cat_arepas_id,
        '🥩',
        true,
        true
    )
    ON CONFLICT (nombre) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        precio_usd = EXCLUDED.precio_usd,
        categoria_id = EXCLUDED.categoria_id,
        icono = EXCLUDED.icono,
        activo = true
    RETURNING id INTO v_prod_pelua_id;

    -- D. Arepa Especial Mixta / Cabimera ($5.00)
    INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, icono, popular, activo)
    VALUES (
        'Arepa Especial Mixta',
        'Doble proteína (Carne mechada y Pollo mechado), jamón, queso blanco de res, vegetales frescos y salsas caseras.',
        5.00,
        v_cat_arepas_id,
        '👑',
        true,
        true
    )
    ON CONFLICT (nombre) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        precio_usd = EXCLUDED.precio_usd,
        categoria_id = EXCLUDED.categoria_id,
        icono = EXCLUDED.icono,
        activo = true
    RETURNING id INTO v_prod_mixta_id;

    -- E. Combo 2 Arepas + Vaso ($5.00)
    INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, icono, popular, activo)
    VALUES (
        'Combo 2 Arepas + Vaso Bebida',
        '2 arepas grandes tradicionales rellenas a tu gusto acompañadas de 1 vaso de bebida bien fría.',
        5.00,
        v_cat_combos_id,
        '🥤',
        true,
        true
    )
    ON CONFLICT (nombre) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        precio_usd = EXCLUDED.precio_usd,
        categoria_id = EXCLUDED.categoria_id,
        icono = EXCLUDED.icono,
        activo = true
    RETURNING id INTO v_prod_combo2_id;

    -- F. Combo 6 Arepitas + 1.5 L ($7.00)
    INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, icono, popular, activo)
    VALUES (
        'Combo 6 Arepitas + Refresco 1.5L',
        '6 deliciosas arepitas pequeñas con distintos rellenos variados + 1 botella de refresco familiar 1.5 Litros.',
        7.00,
        v_cat_combos_id,
        '🍱',
        true,
        true
    )
    ON CONFLICT (nombre) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        precio_usd = EXCLUDED.precio_usd,
        categoria_id = EXCLUDED.categoria_id,
        icono = EXCLUDED.icono,
        activo = true
    RETURNING id INTO v_prod_combo6_id;

    -- G. Combo 10 Arepitas + 1.5 L ($10.00)
    INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, icono, popular, activo)
    VALUES (
        'Combo Familiar 10 Arepitas + 1.5L',
        '10 arepitas de fiesta con rellenos mixtos a elegir + 1 botella de refresco familiar 1.5 Litros.',
        10.00,
        v_cat_combos_id,
        '🎉',
        true,
        true
    )
    ON CONFLICT (nombre) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        precio_usd = EXCLUDED.precio_usd,
        categoria_id = EXCLUDED.categoria_id,
        icono = EXCLUDED.icono,
        activo = true
    RETURNING id INTO v_prod_combo10_id;

    -- H. Refresco Pepsi 1.5 L Individual ($1.50)
    INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, icono, popular, activo)
    VALUES (
        'Refresco Pepsi 1.5 Litros',
        'Botella de refresco Pepsi familiar de 1.5 Litros fría.',
        1.50,
        v_cat_bebidas_id,
        '🍾',
        false,
        true
    )
    ON CONFLICT (nombre) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        precio_usd = EXCLUDED.precio_usd,
        categoria_id = EXCLUDED.categoria_id,
        icono = EXCLUDED.icono,
        activo = true
    RETURNING id INTO v_prod_pepsi15_id;


    -- 5. Vincular Escandallos / Recetas para Descuento Automático de Inventario
    
    -- Limpiar recetas previas de estos productos para garantizar idempotencia
    DELETE FROM public.recetas_ingredientes WHERE producto_id IN (
        v_prod_reina_id, v_prod_catira_id, v_prod_pelua_id, v_prod_mixta_id, 
        v_prod_combo2_id, v_prod_combo6_id, v_prod_combo10_id, v_prod_pepsi15_id
    );

    -- Receta Arepa Reina Pepiada
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_reina_id, v_ins_harina_id, 50.0),
        (v_prod_reina_id, v_ins_reina_pepiada_id, 75.0),
        (v_prod_reina_id, v_ins_mantequilla_id, 5.0),
        (v_prod_reina_id, v_ins_papel_id, 1.0),
        (v_prod_reina_id, v_ins_servilleta_id, 1.0);

    -- Receta Arepa Catira
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_catira_id, v_ins_harina_id, 50.0),
        (v_prod_catira_id, v_ins_guiso_pollo_id, 65.0),
        (v_prod_catira_id, v_ins_q_amarillo_id, 35.0),
        (v_prod_catira_id, v_ins_mantequilla_id, 5.0),
        (v_prod_catira_id, v_ins_papel_id, 1.0),
        (v_prod_catira_id, v_ins_servilleta_id, 1.0);

    -- Receta Arepa Pelúa
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_pelua_id, v_ins_harina_id, 50.0),
        (v_prod_pelua_id, v_ins_guiso_carne_id, 65.0),
        (v_prod_pelua_id, v_ins_q_amarillo_id, 35.0),
        (v_prod_pelua_id, v_ins_mantequilla_id, 5.0),
        (v_prod_pelua_id, v_ins_papel_id, 1.0),
        (v_prod_pelua_id, v_ins_servilleta_id, 1.0);

    -- Receta Arepa Especial Mixta
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_mixta_id, v_ins_harina_id, 50.0),
        (v_prod_mixta_id, v_ins_guiso_carne_id, 40.0),
        (v_prod_mixta_id, v_ins_guiso_pollo_id, 40.0),
        (v_prod_mixta_id, v_ins_jamon_id, 25.0),
        (v_prod_mixta_id, v_ins_q_blanco_id, 25.0),
        (v_prod_mixta_id, v_ins_lechuga_id, 20.0),
        (v_prod_mixta_id, v_ins_tomate_id, 25.0),
        (v_prod_mixta_id, v_ins_ceb_morada_id, 15.0),
        (v_prod_mixta_id, v_ins_caja_peq_id, 1.0),
        (v_prod_mixta_id, v_ins_servilleta_id, 2.0);

    -- Receta Combo 2 Arepas + Vaso
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_combo2_id, v_ins_harina_id, 100.0),
        (v_prod_combo2_id, v_ins_guiso_pollo_id, 65.0),
        (v_prod_combo2_id, v_ins_guiso_carne_id, 65.0),
        (v_prod_combo2_id, v_ins_mantequilla_id, 10.0),
        (v_prod_combo2_id, v_ins_vaso_id, 1.0),
        (v_prod_combo2_id, v_ins_papel_id, 2.0),
        (v_prod_combo2_id, v_ins_servilleta_id, 2.0);

    -- Receta Combo 6 Arepitas + 1.5L
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_combo6_id, v_ins_harina_id, 150.0),
        (v_prod_combo6_id, v_ins_guiso_pollo_id, 90.0),
        (v_prod_combo6_id, v_ins_guiso_carne_id, 90.0),
        (v_prod_combo6_id, v_ins_mantequilla_id, 15.0),
        (v_prod_combo6_id, v_ins_pepsi_id, 1.0),
        (v_prod_combo6_id, v_ins_caja_peq_id, 1.0),
        (v_prod_combo6_id, v_ins_servilleta_id, 4.0);

    -- Receta Combo 10 Arepitas + 1.5L
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_combo10_id, v_ins_harina_id, 250.0),
        (v_prod_combo10_id, v_ins_guiso_pollo_id, 150.0),
        (v_prod_combo10_id, v_ins_guiso_carne_id, 150.0),
        (v_prod_combo10_id, v_ins_mantequilla_id, 25.0),
        (v_prod_combo10_id, v_ins_pepsi_id, 1.0),
        (v_prod_combo10_id, v_ins_caja_gde_id, 1.0),
        (v_prod_combo10_id, v_ins_servilleta_id, 6.0);

    -- Receta Pepsi 1.5L Individual
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_pepsi15_id, v_ins_pepsi_id, 1.0);

END $$;
