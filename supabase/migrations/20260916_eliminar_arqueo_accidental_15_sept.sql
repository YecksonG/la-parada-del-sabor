-- ==============================================================================
-- ELIMINACIÓN DE SESIÓN/ARQUEO DE CAJA ACCIDENTAL (15 DE SEPTIEMBRE 2026 ~09:04 PM)
-- ==============================================================================

-- 1. Verificación previa de la sesión accidental a eliminar
SELECT
  id,
  estado,
  monto_inicial_usd,
  monto_inicial_bs,
  fecha_apertura AT TIME ZONE 'America/Caracas' AS fecha_apertura_ve,
  fecha_cierre AT TIME ZONE 'America/Caracas' AS fecha_cierre_ve,
  usuario_apertura,
  creado_el AT TIME ZONE 'America/Caracas' AS creado_el_ve
FROM public.sesiones_caja
WHERE fecha_apertura >= '2026-09-15 20:55:00-04'
  AND fecha_apertura <= '2026-09-15 21:15:00-04'
  AND monto_inicial_usd = 20.00;

-- 2. Eliminar la sesión accidental abierta por error
DELETE FROM public.sesiones_caja
WHERE fecha_apertura >= '2026-09-15 20:55:00-04'
  AND fecha_apertura <= '2026-09-15 21:15:00-04'
  AND monto_inicial_usd = 20.00;

-- 3. Confirmar que ya no existe y ver las últimas sesiones legítimas
SELECT
  id,
  estado,
  monto_inicial_usd,
  fecha_apertura AT TIME ZONE 'America/Caracas' AS fecha_apertura_ve,
  fecha_cierre AT TIME ZONE 'America/Caracas' AS fecha_cierre_ve
FROM public.sesiones_caja
ORDER BY fecha_apertura DESC
LIMIT 5;
