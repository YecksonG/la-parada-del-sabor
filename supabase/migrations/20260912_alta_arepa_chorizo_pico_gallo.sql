-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- Alta de Pre-elaborado Pico de Gallo y Arepa de Chorizo
-- ==============================================================================

DO $$
DECLARE
    v_insumo_pico_gallo_id UUID := gen_random_uuid();
    v_producto_arepa_chorizo_id UUID := gen_random_uuid();
    v_categoria_arepas_id UUID := 'e3a10495-3db0-442c-8111-c8b3760e0cf8';
    
    -- IDs de Insumos Base
    v_harina UUID;
    v_margarina UUID;
    v_chorizo UUID;
    v_queso_blanco UUID;
    v_papel UUID;
    v_servilleta UUID;
BEGIN
    -- 1. Insertar el Insumo Pre-elaborado: Pico de Gallo
    INSERT INTO public.insumos (id, nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
    VALUES (v_insumo_pico_gallo_id, 'Pico de Gallo (Mise en Place)', 'g', 0, 500, 0.003923, 'Salsas & Pre-elaborados', true);

    -- 2. Insertar el Nuevo Producto: Arepa de Chorizo
    INSERT INTO public.productos (id, nombre, descripcion, precio_usd, categoria_id, icono, popular, activo)
    VALUES (
        v_producto_arepa_chorizo_id, 
        'Arepa de Chorizo', 
        'Auténtico chorizo ahumado acompañado de un fresco pico de gallo y queso blanco llanero.', 
        3.50, 
        v_categoria_arepas_id, 
        '🌭', 
        false, 
        true
    );

    -- 3. Buscar los IDs de los insumos para la receta
    SELECT id INTO v_harina FROM public.insumos WHERE nombre ILIKE '%Harina PAN Maíz Blanco%' LIMIT 1;
    SELECT id INTO v_margarina FROM public.insumos WHERE nombre ILIKE '%Margarina Mavesa%' LIMIT 1;
    SELECT id INTO v_chorizo FROM public.insumos WHERE nombre ILIKE '%CHORIZO AHUMADO (E)%' LIMIT 1;
    SELECT id INTO v_queso_blanco FROM public.insumos WHERE nombre ILIKE '%Queso Blanco de Res%' LIMIT 1;
    SELECT id INTO v_papel FROM public.insumos WHERE nombre ILIKE '%Papel Antigraso Breakfast%' LIMIT 1;
    SELECT id INTO v_servilleta FROM public.insumos WHERE nombre ILIKE '%Servilletas Europapel%' LIMIT 1;

    -- 4. Construir la Receta de la Arepa de Chorizo
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
        (v_producto_arepa_chorizo_id, v_harina, 27.59),
        (v_producto_arepa_chorizo_id, v_margarina, 7.50),
        (v_producto_arepa_chorizo_id, v_chorizo, 40.0),
        (v_producto_arepa_chorizo_id, v_insumo_pico_gallo_id, 50.0),
        (v_producto_arepa_chorizo_id, v_queso_blanco, 50.0),
        (v_producto_arepa_chorizo_id, v_papel, 1.0),
        (v_producto_arepa_chorizo_id, v_servilleta, 1.0);
END $$;
