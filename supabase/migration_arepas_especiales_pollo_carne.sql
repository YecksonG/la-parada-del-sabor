-- ==============================================================================
-- SUSTITUCIÓN DE AREPA MIXTA POR AREPA ESPECIAL DE POLLO Y AREPA ESPECIAL DE CARNE
-- La Parada del Sabor — 27 de Agosto de 2026
-- ==============================================================================

DO $$
DECLARE
    v_cat_arepas_id UUID;
    v_ins_harina_id UUID;
    v_ins_guiso_pollo_id UUID;
    v_ins_guiso_carne_id UUID;
    v_ins_jamon_id UUID;
    v_ins_q_blanco_id UUID;
    v_ins_lechuga_id UUID;
    v_ins_tomate_id UUID;
    v_ins_ceb_morada_id UUID;
    v_ins_salsa_ajo_id UUID;
    v_ins_caja_peq_id UUID;
    v_ins_servilleta_id UUID;

    v_prod_esp_pollo_id UUID;
    v_prod_esp_carne_id UUID;
BEGIN
    -- Categoría Arepas
    SELECT id INTO v_cat_arepas_id FROM public.categorias WHERE nombre ILIKE '%Arepas%' LIMIT 1;

    -- Obtener IDs de insumos
    SELECT id INTO v_ins_harina_id FROM public.insumos WHERE nombre = 'Harina PAN' LIMIT 1;
    SELECT id INTO v_ins_guiso_pollo_id FROM public.insumos WHERE nombre = 'Guiso de Pollo Mechado' LIMIT 1;
    SELECT id INTO v_ins_guiso_carne_id FROM public.insumos WHERE nombre = 'Guiso de Carne Mechada' LIMIT 1;
    SELECT id INTO v_ins_jamon_id FROM public.insumos WHERE nombre = 'Pechuga de Pavo / Jamón' LIMIT 1;
    SELECT id INTO v_ins_q_blanco_id FROM public.insumos WHERE nombre = 'Queso Blanco de Res' LIMIT 1;
    SELECT id INTO v_ins_lechuga_id FROM public.insumos WHERE nombre = 'Lechuga Americana' LIMIT 1;
    SELECT id INTO v_ins_tomate_id FROM public.insumos WHERE nombre = 'Tomate Perita' LIMIT 1;
    SELECT id INTO v_ins_ceb_morada_id FROM public.insumos WHERE nombre = 'Cebolla Morada' LIMIT 1;
    SELECT id INTO v_ins_salsa_ajo_id FROM public.insumos WHERE nombre = 'Salsa de Ajo de la Casa' LIMIT 1;
    SELECT id INTO v_ins_caja_peq_id FROM public.insumos WHERE nombre = 'Cajas Pequeñas Descartables' LIMIT 1;
    SELECT id INTO v_ins_servilleta_id FROM public.insumos WHERE nombre = 'Servilletas Europapel' LIMIT 1;

    -- 1. Desactivar / Eliminar la Arepa Especial Mixta previa
    DELETE FROM public.recetas_ingredientes WHERE producto_id IN (
        SELECT id FROM public.productos WHERE nombre = 'Arepa Especial Mixta'
    );
    DELETE FROM public.productos WHERE nombre = 'Arepa Especial Mixta';

    -- 2. Insertar Arepa Especial de Pollo ($4.50)
    INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, icono, popular, activo)
    VALUES (
        'Arepa Especial de Pollo',
        'Arepa rellena de abundante guiso casero de pollo mechado, jamón, queso blanco rallado, lechuga fresca, tomate, cebolla morada y salsas de la casa en caja.',
        4.50,
        v_cat_arepas_id,
        '🍗',
        true,
        true
    )
    ON CONFLICT (nombre) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        precio_usd = EXCLUDED.precio_usd,
        categoria_id = EXCLUDED.categoria_id,
        icono = EXCLUDED.icono,
        activo = true
    RETURNING id INTO v_prod_esp_pollo_id;

    -- 3. Insertar Arepa Especial de Carne ($5.00)
    INSERT INTO public.productos (nombre, descripcion, precio_usd, categoria_id, icono, popular, activo)
    VALUES (
        'Arepa Especial de Carne',
        'Arepa rellena de jugosa carne mechada de res sazonada, jamón, queso blanco rallado, vegetales frescos (lechuga, tomate, cebolla morada) y salsas de la casa en caja.',
        5.00,
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
    RETURNING id INTO v_prod_esp_carne_id;

    -- 4. Vincular Escandallos de Receta para cada Arepa Especial

    -- Limpiar recetas previas
    DELETE FROM public.recetas_ingredientes WHERE producto_id IN (v_prod_esp_pollo_id, v_prod_esp_carne_id);

    -- Receta Arepa Especial de Pollo
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_esp_pollo_id, v_ins_harina_id, 50.0),
        (v_prod_esp_pollo_id, v_ins_guiso_pollo_id, 80.0),
        (v_prod_esp_pollo_id, v_ins_jamon_id, 25.0),
        (v_prod_esp_pollo_id, v_ins_q_blanco_id, 25.0),
        (v_prod_esp_pollo_id, v_ins_lechuga_id, 20.0),
        (v_prod_esp_pollo_id, v_ins_tomate_id, 25.0),
        (v_prod_esp_pollo_id, v_ins_ceb_morada_id, 15.0),
        (v_prod_esp_pollo_id, v_ins_caja_peq_id, 1.0),
        (v_prod_esp_pollo_id, v_ins_servilleta_id, 2.0);

    -- Receta Arepa Especial de Carne
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_esp_carne_id, v_ins_harina_id, 50.0),
        (v_prod_esp_carne_id, v_ins_guiso_carne_id, 80.0),
        (v_prod_esp_carne_id, v_ins_jamon_id, 25.0),
        (v_prod_esp_carne_id, v_ins_q_blanco_id, 25.0),
        (v_prod_esp_carne_id, v_ins_lechuga_id, 20.0),
        (v_prod_esp_carne_id, v_ins_tomate_id, 25.0),
        (v_prod_esp_carne_id, v_ins_ceb_morada_id, 15.0),
        (v_prod_esp_carne_id, v_ins_caja_peq_id, 1.0),
        (v_prod_esp_carne_id, v_ins_servilleta_id, 2.0);

END $$;
