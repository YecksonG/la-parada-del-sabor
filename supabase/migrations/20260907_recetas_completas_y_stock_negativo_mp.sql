-- ==============================================================================
-- MIGRACIÓN: PERMITIR STOCK NEGATIVO DE MATERIA PRIMA EN PRODUCCIÓN DE GUISOS
-- Y ACTUALIZACIÓN DE RECETAS / ESCANDALLOS OFICIALES PARA TODAS LAS AREPAS
-- ==============================================================================

-- 1. ACTUALIZAR RPC fn_registrar_produccion_guiso:
-- Permite que la materia prima quede en descubierto (negativo) para no bloquear cocina
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
    -- 1. Validaciones de entrada
    IF p_insumo_producido_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ID de insumo producido es obligatorio.');
    END IF;

    IF p_cantidad_producida IS NULL OR p_cantidad_producida <= 0 OR p_cantidad_producida = 'NaN'::numeric THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La cantidad producida debe ser un número válido mayor a 0.');
    END IF;

    IF p_insumo_materia_prima_id IS NOT NULL AND p_insumo_materia_prima_id = p_insumo_producido_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La materia prima no puede ser el mismo insumo producido.');
    END IF;

    -- 2. Bloquear y validar el insumo PRODUCIDO
    SELECT stock_actual, costo_unitario_usd INTO v_stock_prod, v_costo_prod
    FROM public.insumos
    WHERE id = p_insumo_producido_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Insumo producido no encontrado en base de datos.');
    END IF;

    -- 3. Bloquear y calcular la MATERIA PRIMA (se permite saldo en negativo)
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

        UPDATE public.insumos
        SET stock_actual = v_nuevo_stock_mp, actualizado_el = NOW()
        WHERE id = p_insumo_materia_prima_id;
    END IF;

    -- 4. Actualizar stock del insumo producido
    v_nuevo_stock_prod := COALESCE(v_stock_prod, 0) + p_cantidad_producida;

    -- 5. Recalcular PPMC (Promedio Ponderado Móvil)
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


-- 2. VINCULAR EXTRAS MODIFICADORES A LOS INSUMOS PREPARADOS CANÓNICOS EXACTOS
UPDATE public.extras_modificadores
SET insumo_id = 'b0000045-0000-0000-0000-000000000045', cantidad_descuento = 50
WHERE id = '4623d5c8-b516-49b0-a81d-b0fd143e632e';

UPDATE public.extras_modificadores
SET insumo_id = 'b0000046-0000-0000-0000-000000000046', cantidad_descuento = 50
WHERE id = '95c556b0-22e7-4801-bac4-dfbc20f5a3f9';

UPDATE public.extras_modificadores
SET insumo_id = 'b0000047-0000-0000-0000-000000000047', cantidad_descuento = 50
WHERE id = '127f76bb-4b2f-40b9-8cc4-055ac5a0b2db';

UPDATE public.extras_modificadores
SET insumo_id = 'b0000004-0000-0000-0000-000000000004', cantidad_descuento = 30
WHERE id = '11fc81b4-cd48-4659-aca4-a8775d7e91e1';

UPDATE public.extras_modificadores
SET insumo_id = 'b0000045-0000-0000-0000-000000000045', cantidad_descuento = 65
WHERE id = '15facba4-aaeb-4d2b-871b-030f756194a5';

UPDATE public.extras_modificadores
SET insumo_id = 'b0000046-0000-0000-0000-000000000046', cantidad_descuento = 65
WHERE id = 'a82b0f8b-7dc3-4c00-958b-26d02001e9d2';


-- 3. REGENERAR RECETAS_INGREDIENTES PARA CADA AREPA INDIVIDUAL (FÓRMULAS EXACTAS)
DELETE FROM public.recetas_ingredientes
WHERE producto_id IN (
    '9412fbe8-48fc-4e99-af39-188ae693336e',
    'a2370716-4627-4482-9179-099828bc8034',
    'dfa9815f-2a47-435e-a0c8-79a823cf7aca',
    'c6be1110-c54c-4f3b-bb8b-50a94e705466',
    'd1c7be3d-72b4-4be8-9fab-c3bcdbf99c82',
    'd635320e-ddc6-496c-aebd-f542660f490d'
);

INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional)
VALUES
('a2370716-4627-4482-9179-099828bc8034', 'b0000006-0000-0000-0000-000000000006', 100, false),
('a2370716-4627-4482-9179-099828bc8034', 'b0000045-0000-0000-0000-000000000045', 50, false),
('a2370716-4627-4482-9179-099828bc8034', 'b0000004-0000-0000-0000-000000000004', 30, false),
('a2370716-4627-4482-9179-099828bc8034', 'b0000036-0000-0000-0000-000000000036', 1, false),
('a2370716-4627-4482-9179-099828bc8034', 'b0000035-0000-0000-0000-000000000035', 1, false),
('a2370716-4627-4482-9179-099828bc8034', 'b0000041-0000-0000-0000-000000000041', 1, false),

('9412fbe8-48fc-4e99-af39-188ae693336e', 'b0000006-0000-0000-0000-000000000006', 100, false),
('9412fbe8-48fc-4e99-af39-188ae693336e', 'b0000046-0000-0000-0000-000000000046', 50, false),
('9412fbe8-48fc-4e99-af39-188ae693336e', 'b0000004-0000-0000-0000-000000000004', 30, false),
('9412fbe8-48fc-4e99-af39-188ae693336e', 'b0000036-0000-0000-0000-000000000036', 1, false),
('9412fbe8-48fc-4e99-af39-188ae693336e', 'b0000035-0000-0000-0000-000000000035', 1, false),
('9412fbe8-48fc-4e99-af39-188ae693336e', 'b0000041-0000-0000-0000-000000000041', 1, false),

('dfa9815f-2a47-435e-a0c8-79a823cf7aca', 'b0000006-0000-0000-0000-000000000006', 100, false),
('dfa9815f-2a47-435e-a0c8-79a823cf7aca', 'b0000047-0000-0000-0000-000000000047', 60, false),
('dfa9815f-2a47-435e-a0c8-79a823cf7aca', 'b0000036-0000-0000-0000-000000000036', 1, false),
('dfa9815f-2a47-435e-a0c8-79a823cf7aca', 'b0000035-0000-0000-0000-000000000035', 1, false),
('dfa9815f-2a47-435e-a0c8-79a823cf7aca', 'b0000041-0000-0000-0000-000000000041', 1, false),

('c6be1110-c54c-4f3b-bb8b-50a94e705466', 'b0000006-0000-0000-0000-000000000006', 100, false),
('c6be1110-c54c-4f3b-bb8b-50a94e705466', 'b0000003-0000-0000-0000-000000000003', 40, false),
('c6be1110-c54c-4f3b-bb8b-50a94e705466', 'b0000004-0000-0000-0000-000000000004', 30, false),
('c6be1110-c54c-4f3b-bb8b-50a94e705466', 'b0000036-0000-0000-0000-000000000036', 1, false),
('c6be1110-c54c-4f3b-bb8b-50a94e705466', 'b0000035-0000-0000-0000-000000000035', 1, false),
('c6be1110-c54c-4f3b-bb8b-50a94e705466', 'b0000041-0000-0000-0000-000000000041', 1, false),

('d1c7be3d-72b4-4be8-9fab-c3bcdbf99c82', 'b0000006-0000-0000-0000-000000000006', 100, false),
('d1c7be3d-72b4-4be8-9fab-c3bcdbf99c82', 'b0000045-0000-0000-0000-000000000045', 65, false),
('d1c7be3d-72b4-4be8-9fab-c3bcdbf99c82', 'b0000003-0000-0000-0000-000000000003', 30, false),
('d1c7be3d-72b4-4be8-9fab-c3bcdbf99c82', 'b0000005-0000-0000-0000-000000000005', 30, false),
('d1c7be3d-72b4-4be8-9fab-c3bcdbf99c82', 'b0000036-0000-0000-0000-000000000036', 1, false),
('d1c7be3d-72b4-4be8-9fab-c3bcdbf99c82', 'b0000035-0000-0000-0000-000000000035', 1, false),
('d1c7be3d-72b4-4be8-9fab-c3bcdbf99c82', 'b0000041-0000-0000-0000-000000000041', 1, false),

('d635320e-ddc6-496c-aebd-f542660f490d', 'b0000006-0000-0000-0000-000000000006', 100, false),
('d635320e-ddc6-496c-aebd-f542660f490d', 'b0000046-0000-0000-0000-000000000046', 65, false),
('d635320e-ddc6-496c-aebd-f542660f490d', 'b0000003-0000-0000-0000-000000000003', 30, false),
('d635320e-ddc6-496c-aebd-f542660f490d', 'b0000005-0000-0000-0000-000000000005', 30, false),
('d635320e-ddc6-496c-aebd-f542660f490d', 'b0000036-0000-0000-0000-000000000036', 1, false),
('d635320e-ddc6-496c-aebd-f542660f490d', 'b0000035-0000-0000-0000-000000000035', 1, false),
('d635320e-ddc6-496c-aebd-f542660f490d', 'b0000041-0000-0000-0000-000000000041', 1, false);
