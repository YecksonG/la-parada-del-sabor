-- ==============================================================================
-- MIGRACIÓN AUDITORÍA OPENCODE: UNIQUE CONSTRAINT EN FECHA + 4 TASAS
-- ==============================================================================

-- 1. Ampliar columnas para las 4 tasas exactas
ALTER TABLE public.tasas_cambio
  ADD COLUMN IF NOT EXISTS usdt_bs NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS promedio_bs NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS eur_bs NUMERIC(12, 4);

-- 2. Limpiar duplicados de fecha dejando el más reciente antes de agregar el constraint
DELETE FROM public.tasas_cambio a
USING public.tasas_cambio b
WHERE a.fecha = b.fecha AND a.creado_el < b.creado_el;

-- 3. Agregar UNIQUE constraint en fecha para idempotencia total
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_tasas_fecha'
  ) THEN
    ALTER TABLE public.tasas_cambio
      ADD CONSTRAINT uq_tasas_fecha UNIQUE (fecha);
  END IF;
END $$;
