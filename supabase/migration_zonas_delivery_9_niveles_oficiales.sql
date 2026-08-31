-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- MIGRACIÓN: 9 NIVELES OFICIALES DE ZONAS DE DELIVERY Y ESTRUCTURA DE LIQUIDACIÓN
-- ==============================================================================

-- 1. Asegurar tabla de zonas_delivery con RLS
CREATE TABLE IF NOT EXISTS public.zonas_delivery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio_usd NUMERIC(10,2) NOT NULL DEFAULT 1.50 CHECK (precio_usd >= 0),
    tiempo_estimado_min INT DEFAULT 25,
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.zonas_delivery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Zonas delivery lectura publica" ON public.zonas_delivery;
CREATE POLICY "Zonas delivery lectura publica" 
  ON public.zonas_delivery FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Zonas delivery modificacion autenticados" ON public.zonas_delivery;
CREATE POLICY "Zonas delivery modificacion autenticados" 
  ON public.zonas_delivery FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- 2. Limpiar y Sembrar los 9 Niveles Oficiales de Delivery
TRUNCATE TABLE public.zonas_delivery RESTART IDENTITY CASCADE;

INSERT INTO public.zonas_delivery (nombre, descripcion, precio_usd, tiempo_estimado_min, orden, activo) VALUES
('Nivel 1', 'Punta Cardón, Bicentenario, Puerta Maraven, España', 1.50, 20, 1, true),
('Nivel 2', 'Maraquiva, Maracardón, Maraven, Zarabón, Pedro Manuel Arcaya', 2.00, 25, 2, true),
('Nivel 3', 'Mercedes, Margaritas, Centro, Santa Irene, Caciques', 2.50, 30, 3, true),
('Nivel 4', 'Adjuntas, Carirubana, El Cardón', 3.00, 35, 4, true),
('Nivel 5', 'Cujicana, Ciudad Federación, Bella Vista, Santa Fe', 3.50, 40, 5, true),
('Nivel 6', 'Antiguo Aeropuerto', 4.00, 45, 6, true),
('Nivel 7', 'Sector Universitario, Maria Auxiliadora', 4.50, 50, 7, true),
('Nivel 8', 'Creolandia', 5.00, 55, 8, true),
('Nivel 9', 'Judibana', 6.00, 60, 9, true);

-- 3. Asegurar campos en ventas para auditoría y liquidación contable de delivery
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS delivery_zona_id UUID REFERENCES public.zonas_delivery(id) ON DELETE SET NULL;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS delivery_zona_nombre TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS delivery_monto_usd NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS delivery_monto_bs NUMERIC(12,2) DEFAULT 0;

-- 4. Vista de Liquidación Semanal para Pago a Empresa de Delivery
CREATE OR REPLACE VIEW public.vw_liquidacion_delivery_semanal AS
SELECT 
    date_trunc('week', v.fecha)::date AS semana_inicio,
    (date_trunc('week', v.fecha)::date + interval '6 days')::date AS semana_fin,
    count(v.id) AS total_viajes,
    coalesce(sum(v.delivery_monto_usd), 0) AS total_pagar_delivery_usd,
    coalesce(sum(v.delivery_monto_bs), 0) AS total_pagar_delivery_bs,
    jsonb_agg(
        jsonb_build_object(
            'comanda', v.numero_comanda,
            'fecha', v.fecha,
            'zona', coalesce(v.delivery_zona_nombre, 'Sin zona'),
            'monto_usd', v.delivery_monto_usd,
            'monto_bs', v.delivery_monto_bs,
            'metodo_pago', v.metodo_pago,
            'estado', v.estado
        ) ORDER BY v.fecha DESC
    ) AS detalle_viajes
FROM public.ventas v
WHERE v.tipo_entrega = 'delivery' 
  AND v.estado != 'cancelada'
  AND coalesce(v.delivery_monto_usd, 0) > 0
GROUP BY date_trunc('week', v.fecha);

GRANT SELECT ON public.vw_liquidacion_delivery_semanal TO authenticated;
