-- ==============================================================================
-- MIGRACIÓN MAESTRA: SANEAMIENTO DE INSUMOS, PRE-ELABORADOS Y ESCANDALLOS REALES
-- La Parada del Sabor — 29 de Agosto de 2026
-- ==============================================================================

DO $$
DECLARE
    -- Categorías de Productos
    v_cat_arepas_id UUID;
    v_cat_combos_id UUID;
    v_cat_bebidas_id UUID;

    -- Insumos Base (Materia Prima de Facturas)
    v_ins_harina_id UUID;
    v_ins_pollo_crudo_id UUID;
    v_ins_carne_cruda_id UUID;
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
    v_ins_pepsi_15_id UUID;
    v_ins_papel_id UUID;
    v_ins_caja_peq_id UUID;
    v_ins_caja_gde_id UUID;
    v_ins_servilleta_id UUID;
    v_ins_vaso_id UUID;

    -- Insumos Pre-elaborados (Mise en Place / Guisos y Rellenos Preparados)
    v_ins_guiso_pollo_id UUID;
    v_ins_guiso_carne_id UUID;
    v_ins_reina_pepiada_id UUID;

    -- Productos Finales
    v_prod_jamon_queso_id UUID;
    v_prod_reina_id UUID;
    v_prod_catira_id UUID;
    v_prod_pelua_id UUID;
    v_prod_esp_carne_id UUID;
    v_prod_esp_pollo_id UUID;
    v_prod_combo_personal_id UUID;
    v_prod_combo_compartir_id UUID;
    v_prod_combo_familiar_id UUID;
    v_prod_pepsi_15_id UUID;
BEGIN
    -- 1. Obtener Categorías
    SELECT id INTO v_cat_arepas_id FROM public.categorias WHERE nombre ILIKE '%arepa%' LIMIT 1;
    SELECT id INTO v_cat_combos_id FROM public.categorias WHERE nombre ILIKE '%combo%' LIMIT 1;
    SELECT id INTO v_cat_bebidas_id FROM public.categorias WHERE nombre ILIKE '%bebida%' LIMIT 1;

    -- 2. Limpieza de Insumos Erróneos (cubitos o caldos asignados erróneamente)
    DELETE FROM public.recetas_ingredientes 
    WHERE insumo_id IN (SELECT id FROM public.insumos WHERE nombre ILIKE '%cubito%' OR nombre ILIKE '%caldo de pollo%');

    -- 3. Crear / Actualizar Insumos Base (Materia Prima con Costos de Facturas)
    
    -- Harina PAN ($1.13/kg -> $0.00113/g)
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Harina PAN', 'g', 10000.0, 2000.0, 0.00113, 'Masas', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00113, categoria_insumo = 'Masas', activo = true
    RETURNING id INTO v_ins_harina_id;

    -- Pechuga de Pollo Cruda ($4.50/kg -> $0.00450/g)
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Pechuga de Pollo Cruda', 'g', 5000.0, 1000.0, 0.00450, 'Carnes', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00450, categoria_insumo = 'Carnes', activo = true
    RETURNING id INTO v_ins_pollo_crudo_id;

    -- Carne de Res Cruda ($9.73/kg -> $0.00973/g)
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Carne de Res Cruda', 'g', 5000.0, 1000.0, 0.00973, 'Carnes', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00973, categoria_insumo = 'Carnes', activo = true
    RETURNING id INTO v_ins_carne_cruda_id;

    -- Queso Amarillo Rallado ($7.97/kg -> $0.00797/g)
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Queso Amarillo Rallado', 'g', 3000.0, 500.0, 0.00797, 'Quesos', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00797, categoria_insumo = 'Quesos', activo = true
    RETURNING id INTO v_ins_q_amarillo_id;

    -- Queso Blanco Llanero ($7.41/kg -> $0.00741/g)
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Queso Blanco de Res', 'g', 3000.0, 500.0, 0.00741, 'Quesos', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00741, categoria_insumo = 'Quesos', activo = true
    RETURNING id INTO v_ins_q_blanco_id;

    -- Aguacate Polo Fresco ($4.48/kg -> $0.00448/g)
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Aguacate Polo Fresco', 'g', 2000.0, 500.0, 0.00448, 'Vegetales', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00448, categoria_insumo = 'Vegetales', activo = true
    RETURNING id INTO v_ins_aguacate_id;

    -- Jamón de Pavo / Pierna ($7.76/kg -> $0.00776/g)
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Pechuga de Pavo / Jamón', 'g', 2000.0, 500.0, 0.00776, 'Carnes', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00776, categoria_insumo = 'Carnes', activo = true
    RETURNING id INTO v_ins_jamon_id;

    -- Margarina Mavesa ($5.51/kg -> $0.00551/g)
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Margarina Mavesa', 'g', 2000.0, 500.0, 0.00551, 'Lácteos', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00551, categoria_insumo = 'Lácteos', activo = true
    RETURNING id INTO v_ins_mantequilla_id;

    -- Mayonesa Mavesa ($8.54/kg -> $0.00854/g)
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Mayonesa Mavesa', 'g', 2000.0, 500.0, 0.00854, 'Salsas', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00854, categoria_insumo = 'Salsas', activo = true
    RETURNING id INTO v_ins_mayonesa_id;

    -- Vegetales
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Tomate Perita', 'g', 3000.0, 500.0, 0.00299, 'Vegetales', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00299, categoria_insumo = 'Vegetales', activo = true
    RETURNING id INTO v_ins_tomate_id;

    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Cebolla Morada', 'g', 2000.0, 500.0, 0.00225, 'Vegetales', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00225, categoria_insumo = 'Vegetales', activo = true
    RETURNING id INTO v_ins_ceb_morada_id;

    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Lechuga Americana', 'g', 2000.0, 500.0, 0.00099, 'Vegetales', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00099, categoria_insumo = 'Vegetales', activo = true
    RETURNING id INTO v_ins_lechuga_id;

    -- Empaques
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Papel Antigraso Breakfast', 'und', 500.0, 50.0, 0.02000, 'Empaques', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.02000, categoria_insumo = 'Empaques', activo = true
    RETURNING id INTO v_ins_papel_id;

    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Servilletas Europapel', 'und', 1000.0, 100.0, 0.00600, 'Empaques', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00600, categoria_insumo = 'Empaques', activo = true
    RETURNING id INTO v_ins_servilleta_id;

    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Cajas Pequeñas Descartables', 'und', 100.0, 20.0, 0.15000, 'Empaques', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.15000, categoria_insumo = 'Empaques', activo = true
    RETURNING id INTO v_ins_caja_peq_id;

    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Cajas Grandes Descartables', 'und', 100.0, 20.0, 0.25000, 'Empaques', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.25000, categoria_insumo = 'Empaques', activo = true
    RETURNING id INTO v_ins_caja_gde_id;

    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Refresco Pepsi 1.5 L', 'und', 24.0, 6.0, 0.85000, 'Bebidas', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.85000, categoria_insumo = 'Bebidas', activo = true
    RETURNING id INTO v_ins_pepsi_15_id;


    -- 4. Insumos Pre-elaborados (Mise en Place / Guisos y Rellenos de Cocina)
    
    -- Guiso de Pollo Mechado ($0.00500/g = $0.25 por porción de 50g)
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Guiso de Pollo Mechado', 'g', 3000.0, 500.0, 0.00500, 'Pre-elaborados', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00500, categoria_insumo = 'Pre-elaborados', activo = true
    RETURNING id INTO v_ins_guiso_pollo_id;

    -- Guiso de Carne Mechada ($0.01050/g = $0.525 por porción de 50g)
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Guiso de Carne Mechada', 'g', 3000.0, 500.0, 0.01050, 'Pre-elaborados', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.01050, categoria_insumo = 'Pre-elaborados', activo = true
    RETURNING id INTO v_ins_guiso_carne_id;

    -- Relleno Reina Pepiada ($0.00530/g = $0.398 por porción de 75g)
    INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES ('Relleno Reina Pepiada', 'g', 2000.0, 500.0, 0.00530, 'Pre-elaborados', true)
    ON CONFLICT (nombre) DO UPDATE SET costo_unitario_usd = 0.00530, categoria_insumo = 'Pre-elaborados', activo = true
    RETURNING id INTO v_ins_reina_pepiada_id;


    -- 5. Obtener IDs de Productos
    SELECT id INTO v_prod_jamon_queso_id FROM public.productos WHERE nombre ILIKE '%jamón%queso%' OR nombre ILIKE '%jamon%queso%' LIMIT 1;
    SELECT id INTO v_prod_reina_id FROM public.productos WHERE nombre ILIKE '%reina pepiada%' LIMIT 1;
    SELECT id INTO v_prod_catira_id FROM public.productos WHERE nombre ILIKE '%catira%' LIMIT 1;
    SELECT id INTO v_prod_pelua_id FROM public.productos WHERE nombre ILIKE '%pelua%' OR nombre ILIKE '%pelúa%' LIMIT 1;
    SELECT id INTO v_prod_esp_pollo_id FROM public.productos WHERE nombre ILIKE '%especial%pollo%' LIMIT 1;
    SELECT id INTO v_prod_esp_carne_id FROM public.productos WHERE nombre ILIKE '%especial%carne%' LIMIT 1;

    SELECT id INTO v_prod_combo_personal_id FROM public.productos WHERE nombre ILIKE '%personal%' LIMIT 1;
    SELECT id INTO v_prod_combo_compartir_id FROM public.productos WHERE nombre ILIKE '%compartir%' LIMIT 1;
    SELECT id INTO v_prod_combo_familiar_id FROM public.productos WHERE nombre ILIKE '%familiar%' LIMIT 1;
    SELECT id INTO v_prod_pepsi_15_id FROM public.productos WHERE nombre ILIKE '%pepsi%1.5%' LIMIT 1;

    -- 6. Limpiar Recetas Anteriores
    DELETE FROM public.recetas_ingredientes WHERE producto_id IN (
        v_prod_jamon_queso_id, v_prod_reina_id, v_prod_catira_id, v_prod_pelua_id,
        v_prod_esp_pollo_id, v_prod_esp_carne_id,
        v_prod_combo_personal_id, v_prod_combo_compartir_id, v_prod_combo_familiar_id,
        v_prod_pepsi_15_id
    );

    -- 7. Insertar Escandallos Exactos y Corregidos por Gramaje Real (Harina PAN 27.59g para 80g de masa)

    -- A. Arepa Jamón y Queso Amarillo ($2.00)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_jamon_queso_id, v_ins_harina_id, 27.59),
        (v_prod_jamon_queso_id, v_ins_mantequilla_id, 5.00),
        (v_prod_jamon_queso_id, v_ins_jamon_id, 30.00),
        (v_prod_jamon_queso_id, v_ins_q_amarillo_id, 35.00),
        (v_prod_jamon_queso_id, v_ins_papel_id, 1.00),
        (v_prod_jamon_queso_id, v_ins_servilleta_id, 1.00);

    -- B. Arepa Catira ($2.20) -> Pollo Mechado Real + Queso Amarillo
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_catira_id, v_ins_harina_id, 27.59),
        (v_prod_catira_id, v_ins_mantequilla_id, 5.00),
        (v_prod_catira_id, v_ins_guiso_pollo_id, 50.00),
        (v_prod_catira_id, v_ins_q_amarillo_id, 35.00),
        (v_prod_catira_id, v_ins_papel_id, 1.00),
        (v_prod_catira_id, v_ins_servilleta_id, 1.00);

    -- C. Arepa Pelúa ($2.80) -> Carne Mechada Real + Queso Amarillo
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_pelua_id, v_ins_harina_id, 27.59),
        (v_prod_pelua_id, v_ins_mantequilla_id, 5.00),
        (v_prod_pelua_id, v_ins_guiso_carne_id, 50.00),
        (v_prod_pelua_id, v_ins_q_amarillo_id, 35.00),
        (v_prod_pelua_id, v_ins_papel_id, 1.00),
        (v_prod_pelua_id, v_ins_servilleta_id, 1.00);

    -- D. Arepa Reina Pepiada ($2.00) -> Relleno Reina Pepiada (Pollo + Aguacate + Mayonesa)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_reina_id, v_ins_harina_id, 27.59),
        (v_prod_reina_id, v_ins_mantequilla_id, 5.00),
        (v_prod_reina_id, v_ins_reina_pepiada_id, 75.00),
        (v_prod_reina_id, v_ins_papel_id, 1.00),
        (v_prod_reina_id, v_ins_servilleta_id, 1.00);

    -- E. Arepa Especial de Pollo Esmechado ($2.80)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_esp_pollo_id, v_ins_harina_id, 27.59),
        (v_prod_esp_pollo_id, v_ins_mantequilla_id, 5.00),
        (v_prod_esp_pollo_id, v_ins_guiso_pollo_id, 50.00),
        (v_prod_esp_pollo_id, v_ins_jamon_id, 20.00),
        (v_prod_esp_pollo_id, v_ins_q_blanco_id, 40.00),
        (v_prod_esp_pollo_id, v_ins_tomate_id, 20.00),
        (v_prod_esp_pollo_id, v_ins_ceb_morada_id, 10.00),
        (v_prod_esp_pollo_id, v_ins_lechuga_id, 15.00),
        (v_prod_esp_pollo_id, v_ins_caja_peq_id, 1.00),
        (v_prod_esp_pollo_id, v_ins_servilleta_id, 2.00);

    -- F. Arepa Especial de Carne Esmechada ($3.50)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_esp_carne_id, v_ins_harina_id, 27.59),
        (v_prod_esp_carne_id, v_ins_mantequilla_id, 5.00),
        (v_prod_esp_carne_id, v_ins_guiso_carne_id, 50.00),
        (v_prod_esp_carne_id, v_ins_jamon_id, 20.00),
        (v_prod_esp_carne_id, v_ins_q_blanco_id, 40.00),
        (v_prod_esp_carne_id, v_ins_tomate_id, 20.00),
        (v_prod_esp_carne_id, v_ins_ceb_morada_id, 10.00),
        (v_prod_esp_carne_id, v_ins_lechuga_id, 15.00),
        (v_prod_esp_carne_id, v_ins_caja_peq_id, 1.00),
        (v_prod_esp_carne_id, v_ins_servilleta_id, 2.00);

    -- G. Combo Personal (2 Arepitas) ($4.00)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_combo_personal_id, v_ins_harina_id, 34.48), -- 2 arepitas de 50g bola = 17.24g harina c/u
        (v_prod_combo_personal_id, v_ins_mantequilla_id, 5.00),
        (v_prod_combo_personal_id, v_ins_guiso_pollo_id, 30.00),
        (v_prod_combo_personal_id, v_ins_guiso_carne_id, 30.00),
        (v_prod_combo_personal_id, v_ins_q_amarillo_id, 20.00),
        (v_prod_combo_personal_id, v_ins_papel_id, 2.00),
        (v_prod_combo_personal_id, v_ins_servilleta_id, 2.00);

    -- H. Combo para Compartir (4 Arepitas) ($7.00)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_combo_compartir_id, v_ins_harina_id, 68.96), -- 4 arepitas de 50g bola = 17.24g harina c/u
        (v_prod_combo_compartir_id, v_ins_mantequilla_id, 10.00),
        (v_prod_combo_compartir_id, v_ins_guiso_pollo_id, 60.00),
        (v_prod_combo_compartir_id, v_ins_guiso_carne_id, 60.00),
        (v_prod_combo_compartir_id, v_ins_q_amarillo_id, 40.00),
        (v_prod_combo_compartir_id, v_ins_caja_peq_id, 1.00),
        (v_prod_combo_compartir_id, v_ins_servilleta_id, 4.00);

    -- I. Combo Familiar (10 Arepitas) ($13.00)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_combo_familiar_id, v_ins_harina_id, 172.41), -- 10 arepitas de 50g bola
        (v_prod_combo_familiar_id, v_ins_mantequilla_id, 25.00),
        (v_prod_combo_familiar_id, v_ins_guiso_pollo_id, 150.00),
        (v_prod_combo_familiar_id, v_ins_guiso_carne_id, 150.00),
        (v_prod_combo_familiar_id, v_ins_q_amarillo_id, 100.00),
        (v_prod_combo_familiar_id, v_ins_caja_gde_id, 1.00),
        (v_prod_combo_familiar_id, v_ins_servilleta_id, 6.00);

    -- J. Refresco Pepsi 1.5 L Individual ($1.50)
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_prod_pepsi_15_id, v_ins_pepsi_15_id, 1.00);

END $$;
