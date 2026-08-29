CREATE OR REPLACE FUNCTION public.fn_fusionar_insumos(p_id_maestro UUID, p_id_duplicado UUID)
RETURNS VOID AS $$
DECLARE
    v_stock_duplicado NUMERIC;
    v_prov RECORD;
    v_nuevos_ids JSONB;
BEGIN
    -- 1. Obtener stock del duplicado para sumarlo al maestro
    SELECT stock_actual INTO v_stock_duplicado FROM public.insumos WHERE id = p_id_duplicado;
    
    IF v_stock_duplicado IS NULL THEN
        RETURN; -- El duplicado no existe
    END IF;

    -- 2. Sumar el stock al maestro
    UPDATE public.insumos 
    SET stock_actual = stock_actual + v_stock_duplicado 
    WHERE id = p_id_maestro;

    -- 3. Mover historial de compras (evitando violaciones si no hay constraints únicas que molesten)
    UPDATE public.compras_items 
    SET insumo_id = p_id_maestro 
    WHERE insumo_id = p_id_duplicado;

    -- 4. Mover modificadores extras
    UPDATE public.extras_modificadores 
    SET insumo_id = p_id_maestro 
    WHERE insumo_id = p_id_duplicado;

    -- 5. Mover recetas (CUIDADO: puede violar UNIQUE(producto_id, insumo_id))
    -- Solo movemos las recetas donde el maestro no esté ya presente en ese producto
    UPDATE public.recetas_ingredientes
    SET insumo_id = p_id_maestro
    WHERE insumo_id = p_id_duplicado
      AND producto_id NOT IN (
          SELECT producto_id FROM public.recetas_ingredientes WHERE insumo_id = p_id_maestro
      );
    -- Borramos el resto de recetas duplicadas que no se pudieron mover
    DELETE FROM public.recetas_ingredientes WHERE insumo_id = p_id_duplicado;

    -- 6. Mover proveedores puente (evitar duplicados)
    UPDATE public.proveedor_insumos
    SET insumo_id = p_id_maestro
    WHERE insumo_id = p_id_duplicado
      AND proveedor_id NOT IN (
          SELECT proveedor_id FROM public.proveedor_insumos WHERE insumo_id = p_id_maestro
      );
    DELETE FROM public.proveedor_insumos WHERE insumo_id = p_id_duplicado;

    -- 7. Limpiar notas JSON de proveedores (remplazar id duplicado por maestro si no está, o borrar si ya está)
    FOR v_prov IN 
        SELECT id, notas FROM public.proveedores 
        WHERE notas ILIKE '%"' || p_id_duplicado::text || '"%'
    LOOP
        BEGIN
            -- Generamos el nuevo array de JSON (quitando el duplicado y añadiendo el maestro si no está)
            v_nuevos_ids := (
                SELECT jsonb_agg(DISTINCT elem) 
                FROM (
                    SELECT jsonb_array_elements_text((v_prov.notas::jsonb)->'insumos_ids') AS elem
                    UNION
                    SELECT p_id_maestro::text AS elem -- Añadimos el maestro
                ) sub
                WHERE elem != p_id_duplicado::text -- Quitamos el duplicado
            );
            
            IF v_nuevos_ids IS NULL THEN v_nuevos_ids := '[]'::jsonb; END IF;

            UPDATE public.proveedores 
            SET notas = jsonb_set(v_prov.notas::jsonb, '{insumos_ids}', v_nuevos_ids)::text
            WHERE id = v_prov.id;
        EXCEPTION WHEN OTHERS THEN
            CONTINUE;
        END;
    END LOOP;

    -- 8. Finalmente, eliminar el insumo duplicado
    DELETE FROM public.insumos WHERE id = p_id_duplicado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
