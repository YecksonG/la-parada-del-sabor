-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- ==============================================================================
-- FIX: Preservar precio_referencial_usd al sincronizar proveedores e insumos
--
-- PROBLEMA: Las RPCs originales hacían DELETE + INSERT sin conservar el campo
-- precio_referencial_usd, provocando que cada edición desde la UI borrara
-- todos los precios referenciales comparativos sembrados.
--
-- SOLUCIÓN: Re-define ambas RPCs para que:
--   1. Solo eliminen filas que YA NO están en el nuevo arreglo seleccionado.
--   2. Inserten NUEVOS registros con ON CONFLICT DO NOTHING (preserva precio).
--
-- Ejecutar este script completo en el SQL Editor de Supabase.
-- ==============================================================================

-- RPC 1: Sincronizar Insumos de un Proveedor (preservando precios)
CREATE OR REPLACE FUNCTION public.sincronizar_proveedor_insumos(
    p_proveedor_id UUID,
    p_insumos_ids UUID[]
) RETURNS VOID AS $$
BEGIN
    -- Eliminar SOLO las filas que ya NO están en el nuevo arreglo
    DELETE FROM public.proveedor_insumos
    WHERE proveedor_id = p_proveedor_id
      AND NOT (p_insumos_ids IS NOT NULL AND insumo_id = ANY(p_insumos_ids));

    -- Insertar nuevos registros sin sobrescribir precios existentes
    IF p_insumos_ids IS NOT NULL AND array_length(p_insumos_ids, 1) > 0 THEN
        INSERT INTO public.proveedor_insumos (proveedor_id, insumo_id)
        SELECT p_proveedor_id, unnest(p_insumos_ids)
        ON CONFLICT (proveedor_id, insumo_id) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC 2: Sincronizar Proveedores de un Insumo (preservando precios)
CREATE OR REPLACE FUNCTION public.sincronizar_insumo_proveedores(
    p_insumo_id UUID,
    p_proveedores_ids UUID[]
) RETURNS VOID AS $$
BEGIN
    -- Eliminar SOLO las filas que ya NO están en el nuevo arreglo
    DELETE FROM public.proveedor_insumos
    WHERE insumo_id = p_insumo_id
      AND NOT (p_proveedores_ids IS NOT NULL AND proveedor_id = ANY(p_proveedores_ids));

    -- Insertar nuevos registros sin sobrescribir precios existentes
    IF p_proveedores_ids IS NOT NULL AND array_length(p_proveedores_ids, 1) > 0 THEN
        INSERT INTO public.proveedor_insumos (proveedor_id, insumo_id)
        SELECT unnest(p_proveedores_ids), p_insumo_id
        ON CONFLICT (proveedor_id, insumo_id) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
