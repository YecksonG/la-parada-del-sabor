-- ==============================================================================
-- MIGRACIÓN: Ampliar CHECK de ventas.estado a los 5 estados del flujo POS
-- ------------------------------------------------------------------------------
-- Problema: la columna `ventas.estado` tiene un CHECK viejo que solo permite
-- ('preparando', 'completada', 'cancelada'), pero el sistema ya opera con
-- ('pendiente', 'preparando', 'lista', 'completada', 'cancelada').
-- Esto hace que INSERTs/UPDATEs con 'pendiente' o 'lista' fallen en producción.
--
-- Fix: eliminar el constraint auto-generado y recrearlo con los 5 estados.
-- ==============================================================================

ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_estado_check;

ALTER TABLE public.ventas
    ADD CONSTRAINT ventas_estado_check
    CHECK (estado IN ('pendiente', 'preparando', 'lista', 'completada', 'cancelada'));

-- Verificación rápida: debe devolver 't'
SELECT convalidated
FROM pg_constraint
WHERE conname = 'ventas_estado_check';