-- ==============================================================================
-- 🚨 ACCIÓN EN SUPABASE (SQL EDITOR) — AJUSTE DE RECETA AREPA PELÚA (35g GUISO)
-- Ajusta el escandallo de la Arepa Pelúa a las porciones reales de cocina:
-- 35g Guiso de Carne Mechada + 35g Queso Amarillo Rallado
-- ==============================================================================

DO $$
DECLARE
    v_pelua_id UUID;
    v_ins_harina_id UUID;
    v_ins_guiso_carne_id UUID;
    v_ins_queso_amarillo_id UUID;
    v_ins_margarina_id UUID;
    v_ins_papel_id UUID;
    v_ins_servilleta_id UUID;
BEGIN
    -- Obtener producto Arepa Pelúa
    SELECT id INTO v_pelua_id FROM public.productos WHERE nombre = 'Arepa Pelúa' LIMIT 1;
    
    -- Obtener insumos
    SELECT id INTO v_ins_harina_id FROM public.insumos WHERE nombre = 'Harina PAN' LIMIT 1;
    SELECT id INTO v_ins_guiso_carne_id FROM public.insumos WHERE nombre = 'Guiso de Carne Mechada' LIMIT 1;
    SELECT id INTO v_ins_queso_amarillo_id FROM public.insumos WHERE nombre = 'Queso Amarillo Rallado' LIMIT 1;
    SELECT id INTO v_ins_margarina_id FROM public.insumos WHERE nombre = 'Margarina Mavesa' LIMIT 1;
    SELECT id INTO v_ins_papel_id FROM public.insumos WHERE nombre = 'Papel Antigraso Breakfast' LIMIT 1;
    SELECT id INTO v_ins_servilleta_id FROM public.insumos WHERE nombre = 'Servilletas Europapel' LIMIT 1;

    IF v_pelua_id IS NOT NULL THEN
        -- Limpiar receta previa de Arepa Pelúa
        DELETE FROM public.recetas_ingredientes WHERE producto_id = v_pelua_id;

        -- Insertar receta ajustada con 35g de guiso de carne
        INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad) VALUES
            (v_pelua_id, v_ins_harina_id, 50.0),
            (v_pelua_id, v_ins_guiso_carne_id, 35.0),
            (v_pelua_id, v_ins_queso_amarillo_id, 35.0),
            (v_pelua_id, v_ins_margarina_id, 5.0),
            (v_pelua_id, v_ins_papel_id, 1.0),
            (v_pelua_id, v_ins_servilleta_id, 1.0);
    END IF;
END $$;

-- Verificación de la receta de Arepa Pelúa:
SELECT p.nombre AS producto, i.nombre AS insumo, ri.cantidad, i.unidad_medida
FROM public.recetas_ingredientes ri
JOIN public.productos p ON p.id = ri.producto_id
JOIN public.insumos i ON i.id = ri.insumo_id
WHERE p.nombre = 'Arepa Pelúa';
