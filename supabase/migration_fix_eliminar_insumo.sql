CREATE OR REPLACE FUNCTION public.fn_eliminar_insumo_seguro(p_insumo_id UUID)
RETURNS JSON AS $$
DECLARE
    v_en_compras BOOLEAN;
    v_en_extras BOOLEAN;
    v_prov RECORD;
    v_nuevos_ids JSONB;
BEGIN
    -- 1. Validar si está en compras_items
    SELECT EXISTS (
        SELECT 1 FROM public.compras_items WHERE insumo_id = p_insumo_id
    ) INTO v_en_compras;
    
    IF v_en_compras THEN
        RETURN json_build_object('ok', false, 'error', 'No se puede eliminar: el insumo tiene historial en compras de despensa.');
    END IF;

    -- 2. Validar si está en extras_modificadores
    SELECT EXISTS (
        SELECT 1 FROM public.extras_modificadores WHERE insumo_id = p_insumo_id
    ) INTO v_en_extras;

    IF v_en_extras THEN
        RETURN json_build_object('ok', false, 'error', 'No se puede eliminar: el insumo está asignado a un Modificador/Extra activo.');
    END IF;

    -- 3. Limpiar recetas (seguro porque ON DELETE RESTRICT bloquearía de todos modos)
    DELETE FROM public.recetas_ingredientes WHERE insumo_id = p_insumo_id;

    -- 4. Limpiar tabla puente de proveedores
    DELETE FROM public.proveedor_insumos WHERE insumo_id = p_insumo_id;

    -- 5. Limpiar los JSON arrays "insumos_ids" en notas de proveedores
    FOR v_prov IN 
        SELECT id, notas FROM public.proveedores 
        WHERE notas ILIKE '%"' || p_insumo_id::text || '"%'
    LOOP
        BEGIN
            -- Extraemos el JSON y filtramos el ID
            v_nuevos_ids := (
                SELECT jsonb_agg(elem) 
                FROM jsonb_array_elements_text((v_prov.notas::jsonb)->'insumos_ids') AS elem
                WHERE elem != p_insumo_id::text
            );
            
            -- Si quedó null porque se vació, lo convertimos a array vacío
            IF v_nuevos_ids IS NULL THEN
                v_nuevos_ids := '[]'::jsonb;
            END IF;

            -- Actualizamos el JSON
            UPDATE public.proveedores 
            SET notas = jsonb_set(
                v_prov.notas::jsonb, 
                '{insumos_ids}', 
                v_nuevos_ids
            )::text
            WHERE id = v_prov.id;
        EXCEPTION WHEN OTHERS THEN
            -- Ignorar si la nota no era un JSON válido (legacy)
            CONTINUE;
        END;
    END LOOP;

    -- 6. Finalmente eliminar el insumo
    DELETE FROM public.insumos WHERE id = p_insumo_id;

    RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
