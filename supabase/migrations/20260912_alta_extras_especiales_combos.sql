-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- Alta de Extras Modificadores para Rellenos Especiales en Combos (+Recargo)
-- 1. Actualiza los precios de Especial de Carne y Especial de Pollo a +$0.50
-- 2. Inserta el Extra Modificador para la Choriarepa (Arepa de Chorizo) con +$0.50
-- ==============================================================================

-- 1. Configurar precio_extra_usd a 0.50 en las Especiales de Carne y Pollo
UPDATE public.extras_modificadores
SET precio_extra_usd = 0.50, activo = true
WHERE id = '15facba4-aaeb-4d2b-871b-030f756194a5'; -- Especial de Carne Esmechada (Gourmet)

UPDATE public.extras_modificadores
SET precio_extra_usd = 0.50, activo = true
WHERE id = 'a82b0f8b-7dc3-4c00-958b-26d02001e9d2'; -- Especial de Pollo Esmechado (Gourmet)

-- 2. Insertar o actualizar el Extra para la Choriarepa
DO $$
DECLARE
    v_insumo_chorizo_id UUID;
    v_extra_chorizo_id UUID := 'c0000001-0000-0000-0000-000000000001';
BEGIN
    SELECT id INTO v_insumo_chorizo_id FROM public.insumos WHERE nombre ILIKE '%CHORIZO AHUMADO (E)%' LIMIT 1;

    IF EXISTS (SELECT 1 FROM public.extras_modificadores WHERE id = v_extra_chorizo_id) THEN
        UPDATE public.extras_modificadores
        SET nombre = 'Choriarepa (Chorizo Ahumado + Pico de Gallo)',
            insumo_id = v_insumo_chorizo_id,
            cantidad_descuento = 40,
            precio_extra_usd = 0.50,
            activo = true
        WHERE id = v_extra_chorizo_id;
    ELSE
        INSERT INTO public.extras_modificadores (id, nombre, insumo_id, cantidad_descuento, precio_extra_usd, activo)
        VALUES (
            v_extra_chorizo_id,
            'Choriarepa (Chorizo Ahumado + Pico de Gallo)',
            v_insumo_chorizo_id,
            40,
            0.50,
            true
        );
    END IF;
END $$;

-- Verificación:
SELECT id, nombre, precio_extra_usd, cantidad_descuento, activo 
FROM public.extras_modificadores 
ORDER BY precio_extra_usd ASC, nombre ASC;
