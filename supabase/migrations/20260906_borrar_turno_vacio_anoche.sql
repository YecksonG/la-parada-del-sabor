-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- ELIMINAR EL TURNO HUÉRFANO VACÍO DE LAS 10:46 PM ($0.00)
-- ==============================================================================

DELETE FROM public.sesiones_caja
WHERE fecha_apertura >= '2026-09-06 02:40:00+00'
  AND fecha_apertura <= '2026-09-06 02:50:00+00'
  AND (total_ventas_efectivo_usd IS NULL OR total_ventas_efectivo_usd = 0)
  AND (total_ventas_pago_movil_bs IS NULL OR total_ventas_pago_movil_bs = 0);

-- VERIFICACIÓN DE SESIONES RESTANTES:
SELECT id, fecha_apertura, fecha_cierre, estado, total_ventas_efectivo_usd, total_ventas_pago_movil_bs, arqueo_fisico_efectivo_usd
FROM public.sesiones_caja
ORDER BY fecha_apertura DESC;
