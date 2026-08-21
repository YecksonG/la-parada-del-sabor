-- ==============================================================================
-- MIGRACIÓN: 4 TASAS DEL BOLÍVAR & CIERRE DE CAJA (ARQUEO X / Z)
-- ==============================================================================

-- 1. Ampliar columnas de Tasas de Cambio
ALTER TABLE public.tasas_cambio
  ADD COLUMN IF NOT EXISTS paralelo_usd_bs NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS efectivo_usd_bs NUMERIC(12, 4);

-- 2. Tabla de Sesiones de Caja y Cierres (Arqueo Diario)
CREATE TABLE IF NOT EXISTS public.sesiones_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre TIMESTAMPTZ,
    estado VARCHAR(20) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
    monto_inicial_usd NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monto_inicial_usd >= 0),
    monto_inicial_bs NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (monto_inicial_bs >= 0),
    total_ventas_efectivo_usd NUMERIC(12, 2) DEFAULT 0,
    total_ventas_pago_movil_bs NUMERIC(14, 2) DEFAULT 0,
    total_ventas_transferencia_bs NUMERIC(14, 2) DEFAULT 0,
    total_ventas_binance_usd NUMERIC(12, 2) DEFAULT 0,
    total_ventas_punto_bs NUMERIC(14, 2) DEFAULT 0,
    total_gastos_usd NUMERIC(12, 2) DEFAULT 0,
    total_gastos_bs NUMERIC(14, 2) DEFAULT 0,
    arqueo_fisico_efectivo_usd NUMERIC(12, 2),
    arqueo_fisico_efectivo_bs NUMERIC(14, 2),
    diferencia_usd NUMERIC(12, 2),
    diferencia_bs NUMERIC(14, 2),
    notas_cierre TEXT,
    usuario_apertura VARCHAR(100),
    usuario_cierre VARCHAR(100),
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.sesiones_caja ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'sesiones_caja' AND policyname = 'auth_sesiones_caja'
    ) THEN
        CREATE POLICY "auth_sesiones_caja" ON public.sesiones_caja FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
