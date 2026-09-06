-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- MIGRACIÓN: LIMPIEZA DEFINITIVA DE PROVEEDORES DUPLICADOS
-- La Parada del Sabor — 05 de Septiembre de 2026
-- ==============================================================================

BEGIN;

-- 1. Eliminar relaciones residuales de proveedor_insumos asociadas a los IDs duplicados
DELETE FROM public.proveedor_insumos
WHERE proveedor_id IN (
    '86291195-f88c-4a14-8fe7-7e04a451b6f0', -- Super 900 duplicado
    'fd6dbeb9-7780-4494-a3fb-cb7a0d99bfd6', -- Hortalizas El Páramo duplicado
    '76664b87-ae28-4d80-82fc-0cdc07a557d4', -- Multitienda Kariosca duplicado
    '5f5df818-0431-4648-956e-6d50814c2afc'  -- TODO EN DESECHABLES duplicado
);

-- 2. Eliminar los 4 registros duplicados de la tabla proveedores
DELETE FROM public.proveedores
WHERE id IN (
    '86291195-f88c-4a14-8fe7-7e04a451b6f0',
    'fd6dbeb9-7780-4494-a3fb-cb7a0d99bfd6',
    '76664b87-ae28-4d80-82fc-0cdc07a557d4',
    '5f5df818-0431-4648-956e-6d50814c2afc'
);

-- 3. Normalizar categoria_insumo para Guiso de Pollo Mechado y otros pre-elaborados (limpiar saltos de línea y espacios residuales)
UPDATE public.insumos
SET categoria_insumo = 'Pre-elaborados'
WHERE LOWER(categoria_insumo) LIKE '%pre%elaborado%';

COMMIT;

-- VERIFICACIÓN INMEDIATA
SELECT id, nombre, rif, contacto, activo
FROM public.proveedores
ORDER BY nombre;
