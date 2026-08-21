-- ==============================================================================
-- MIGRACIÓN: 4 TASAS EXACTAS DE RADIADORES DABAJURO (BCV, USDT, PROMEDIO, EUR)
-- ==============================================================================

ALTER TABLE public.tasas_cambio
  ADD COLUMN IF NOT EXISTS usdt_bs NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS promedio_bs NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS eur_bs NUMERIC(12, 4);

-- Actualizar registros existentes con valores por defecto
UPDATE public.tasas_cambio
SET
  usdt_bs = COALESCE(usdt_bs, paralelo_usd_bs, 72.80),
  promedio_bs = COALESCE(promedio_bs, efectivo_usd_bs, 68.00),
  eur_bs = COALESCE(eur_bs, ROUND(bcv_usd_bs * 1.08, 2))
WHERE usdt_bs IS NULL OR promedio_bs IS NULL OR eur_bs IS NULL;
