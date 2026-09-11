-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- MIGRACIÓN: Habilitar estado 'credito' en la tabla public.ventas
-- ==============================================================================

-- 1. Eliminar el constraint restrictivo anterior
ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_estado_check;

-- 2. Crear el constraint actualizado incluyendo 'credito'
ALTER TABLE public.ventas
    ADD CONSTRAINT ventas_estado_check
    CHECK (estado IN ('pendiente', 'preparando', 'lista', 'completada', 'cancelada', 'credito'));

-- 3. Verificación rápida: debe devolver 't' (true)
SELECT convalidated, conname
FROM pg_constraint
WHERE conname = 'ventas_estado_check';
