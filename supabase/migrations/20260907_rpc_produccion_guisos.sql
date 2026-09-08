-- ==============================================================================
-- MIGRACIÓN: FUNCIÓN RPC ATÓMICA PARA REGISTRO DE PRODUCCIÓN Y GUISOS
-- ==============================================================================
-- Permite registrar la producción de guisos o pre-elaborados en cocina,
-- descontando de forma atómica la materia prima utilizada (ej. carne cruda),
-- registrando la merma y actualizando el costo por PPMC (Precio Promedio Ponderado).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_registrar_produccion_guiso(
    p_insumo_producido_id UUID,
    p_cantidad_producida NUMERIC,
    p_insumo_materia_prima_id UUID DEFAULT NULL,
    p_cantidad_materia_prima NUMERIC DEFAULT NULL,
    p_costo_lote_usd NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stock_prod NUMERIC;
    v_costo_prod NUMERIC;
    v_nuevo_stock_prod NUMERIC;
    v_nuevo_costo_prod NUMERIC;
    v_stock_mp NUMERIC;
    v_nuevo_stock_mp NUMERIC;
BEGIN
    -- 1. Validaciones de entrada (sin DML previo)
    IF p_insumo_producido_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ID de insumo producido es obligatorio.');
    END IF;

    IF p_cantidad_producida IS NULL OR p_cantidad_producida <= 0 OR p_cantidad_producida = 'NaN'::numeric THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La cantidad producida debe ser un número válido mayor a 0.');
    END IF;

    IF p_insumo_materia_prima_id IS NOT NULL AND p_insumo_materia_prima_id = p_insumo_producido_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La materia prima no puede ser el mismo insumo producido.');
    END IF;

    -- 2. Bloquear y validar el insumo PRODUCIDO primero (SELECT FOR UPDATE, sin DML)
    SELECT stock_actual, costo_unitario_usd INTO v_stock_prod, v_costo_prod
    FROM public.insumos
    WHERE id = p_insumo_producido_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Insumo producido no encontrado en base de datos.');
    END IF;

    -- 3. Bloquear y validar la MATERIA PRIMA (también sin DML)
    IF p_insumo_materia_prima_id IS NOT NULL THEN
        IF p_cantidad_materia_prima IS NULL OR p_cantidad_materia_prima <= 0 OR p_cantidad_materia_prima = 'NaN'::numeric THEN
            RETURN jsonb_build_object('ok', false, 'error', 'La cantidad de materia prima debe ser un número válido mayor a 0.');
        END IF;

        SELECT stock_actual INTO v_stock_mp
        FROM public.insumos
        WHERE id = p_insumo_materia_prima_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Insumo de materia prima no encontrado en base de datos.');
        END IF;

        -- Permite que quede en negativo (descontado en descubierto hasta que se cargue la compra)
        v_nuevo_stock_mp := COALESCE(v_stock_mp, 0) - p_cantidad_materia_prima;
    END IF;

    -- 4. Ejecutar DMLs tras validar completamente ambas entidades
    IF p_insumo_materia_prima_id IS NOT NULL THEN
        UPDATE public.insumos
        SET stock_actual = v_nuevo_stock_mp, actualizado_el = NOW()
        WHERE id = p_insumo_materia_prima_id;
    END IF;

    v_nuevo_stock_prod := COALESCE(v_stock_prod, 0) + p_cantidad_producida;

    -- 5. PPMC (Promedio Móvil Ponderado)
    IF p_costo_lote_usd IS NOT NULL AND p_costo_lote_usd > 0 AND p_costo_lote_usd != 'NaN'::numeric THEN
        IF COALESCE(v_stock_prod, 0) > 0 AND COALESCE(v_costo_prod, 0) > 0 THEN
            v_nuevo_costo_prod := ((v_stock_prod * v_costo_prod) + (p_cantidad_producida * p_costo_lote_usd)) / v_nuevo_stock_prod;
        ELSE
            v_nuevo_costo_prod := p_costo_lote_usd;
        END IF;
    ELSE
        v_nuevo_costo_prod := v_costo_prod;
    END IF;

    UPDATE public.insumos
    SET stock_actual = v_nuevo_stock_prod,
        costo_unitario_usd = ROUND(COALESCE(v_nuevo_costo_prod, 0), 6),
        actualizado_el = NOW()
    WHERE id = p_insumo_producido_id;

    RETURN jsonb_build_object(
        'ok', true,
        'nuevo_stock_producido', v_nuevo_stock_prod,
        'nuevo_costo_producido', ROUND(COALESCE(v_nuevo_costo_prod, 0), 6),
        'nuevo_stock_mp', v_nuevo_stock_mp
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Error al registrar producción: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_registrar_produccion_guiso TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_registrar_produccion_guiso TO service_role;
