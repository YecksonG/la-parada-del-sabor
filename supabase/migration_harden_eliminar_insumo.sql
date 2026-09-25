-- =========================================================================
-- MIGRACIÓN: HARDENING DE SEGURIDAD EN fn_eliminar_insumo_seguro
-- Prioridad: 10/10
-- Descripción:
-- 1. Agrega SET search_path = public a fn_eliminar_insumo_seguro para prevenir
--    vulnerabilidades de search_path injection en funciones SECURITY DEFINER.
-- 2. Revoca permisos de ejecución a PUBLIC y anon.
-- 3. Concede ejecución únicamente a authenticated y service_role.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.fn_eliminar_insumo_seguro(p_insumo_id UUID)
RETURNS JSON AS $$
DECLARE
    v_nombre TEXT;
    v_stock NUMERIC;
    v_tiene_compras BOOLEAN;
    v_tiene_extras BOOLEAN;
    v_prov RECORD;
    v_nuevos_ids JSONB;
BEGIN
    -- 1. Verificar si el insumo existe
    SELECT nombre, stock_actual INTO v_nombre, v_stock
    FROM public.insumos
    WHERE id = p_insumo_id;

    IF NOT FOUND THEN
        RETURN json_build_object('ok', false, 'error', 'El insumo no existe o ya fue eliminado.');
    END IF;

    -- 2. Validar que no tenga stock positivo
    IF v_stock > 0 THEN
        RETURN json_build_object('ok', false, 'error', 'No se puede eliminar un insumo que posee stock físico (' || v_stock || '). Ajusta el stock a 0 primero.');
    END IF;

    -- 3. Validar historial en compras_items
    SELECT EXISTS (
        SELECT 1 FROM public.compras_items WHERE insumo_id = p_insumo_id LIMIT 1
    ) INTO v_tiene_compras;

    IF v_tiene_compras THEN
        RETURN json_build_object('ok', false, 'error', 'No se puede eliminar: tiene historial de compras registrado. Desactívalo en su lugar.');
    END IF;

    -- 4. Validar si está enlazado a extras modificadores
    SELECT EXISTS (
        SELECT 1 FROM public.extras_modificadores WHERE insumo_id = p_insumo_id LIMIT 1
    ) INTO v_tiene_extras;

    IF v_tiene_extras THEN
        RETURN json_build_object('ok', false, 'error', 'No se puede eliminar: está configurado en un extra o modificador de ventas.');
    END IF;

    -- 4.1 Validar insumos enlazados en extras_ingredientes (FK ON DELETE RESTRICT)
    IF EXISTS (SELECT 1 FROM public.extras_ingredientes WHERE insumo_id = p_insumo_id LIMIT 1) THEN
        RETURN json_build_object('ok', false, 'error', 'No se puede eliminar: el insumo es ingrediente de un extra o modificador de ventas.');
    END IF;

    -- 5. Limpiezas en cascada seguras
    -- 5.1 Eliminar de recetas
    DELETE FROM public.recetas_ingredientes WHERE insumo_id = p_insumo_id;

    -- 5.2 Eliminar de catálogo de proveedores
    DELETE FROM public.proveedor_insumos WHERE insumo_id = p_insumo_id;

    -- 5.3 Limpiar de arrays JSON en notas de proveedores
    FOR v_prov IN 
        SELECT id, notas 
        FROM public.proveedores 
        WHERE notas IS NOT NULL AND notas LIKE '%"insumos_ids"%' AND notas LIKE '%' || p_insumo_id::text || '%'
    LOOP
        BEGIN
            SELECT jsonb_agg(elem)
            INTO v_nuevos_ids
            FROM jsonb_array_elements(v_prov.notas::jsonb->'insumos_ids') AS elem
            WHERE elem::text <> ('"' || p_insumo_id::text || '"');

            IF v_nuevos_ids IS NULL THEN
                v_nuevos_ids := '[]'::jsonb;
            END IF;

            UPDATE public.proveedores 
            SET notas = jsonb_set(
                v_prov.notas::jsonb, 
                '{insumos_ids}', 
                v_nuevos_ids
            )::text
            WHERE id = v_prov.id;
        EXCEPTION WHEN OTHERS THEN
            CONTINUE;
        END;
    END LOOP;

    -- 6. Finalmente eliminar el insumo
    BEGIN
        DELETE FROM public.insumos WHERE id = p_insumo_id;
    EXCEPTION WHEN foreign_key_violation THEN
        RETURN json_build_object('ok', false, 'error', 'No se puede eliminar el insumo porque aún está referenciado en otros registros del sistema.');
    END;

    RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Permisos estrictos de seguridad
REVOKE EXECUTE ON FUNCTION public.fn_eliminar_insumo_seguro(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_eliminar_insumo_seguro(UUID) TO authenticated, service_role;
