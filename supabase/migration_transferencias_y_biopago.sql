-- ==============================================================================
-- 1. EXTENSIÓN DE CUENTAS: PAGO MÓVIL, CÉDULA/RIF Y COMPATIBILIDAD BIOPAGO
-- ==============================================================================

ALTER TABLE public.cuentas_negocio
ADD COLUMN IF NOT EXISTS cedula_rif VARCHAR(30),
ADD COLUMN IF NOT EXISTS telefono_pago_movil VARCHAR(30),
ADD COLUMN IF NOT EXISTS admite_biopago BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS numero_cuenta_20digitos VARCHAR(30);

-- Actualizar flags de BioPago para los bancos afiliados por defecto
UPDATE public.cuentas_negocio 
SET admite_biopago = true 
WHERE codigo IN ('bdv_ves', 'bancamiga', 'banesco') OR banco_plataforma ILIKE '%venezuela%' OR banco_plataforma ILIKE '%bancamiga%' OR banco_plataforma ILIKE '%banesco%';

-- ==============================================================================
-- 2. TABLA DE TRANSFERENCIAS Y MOVIMIENTOS ENTRE CUENTAS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.transferencias_cuentas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    cuenta_origen_id UUID NOT NULL REFERENCES public.cuentas_negocio(id) ON DELETE RESTRICT,
    cuenta_destino_id UUID NOT NULL REFERENCES public.cuentas_negocio(id) ON DELETE RESTRICT,
    monto_origen NUMERIC(14, 2) NOT NULL CHECK (monto_origen > 0),
    moneda_origen VARCHAR(10) NOT NULL DEFAULT 'VES',
    monto_destino NUMERIC(14, 2) NOT NULL CHECK (monto_destino > 0),
    moneda_destino VARCHAR(10) NOT NULL DEFAULT 'VES',
    tasa_cambio NUMERIC(14, 4) DEFAULT 1.0,
    metodo_transferencia VARCHAR(50) DEFAULT 'pago_movil',
    referencia VARCHAR(100),
    concepto TEXT,
    comprobante_url TEXT,
    notas TEXT,
    creado_por VARCHAR(100) DEFAULT 'admin',
    creado_el TIMESTAMPTZ DEFAULT NOW(),
    actualizado_el TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transferencias_cuentas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Transferencias acceso autenticados" ON public.transferencias_cuentas;
CREATE POLICY "Transferencias acceso autenticados"
    ON public.transferencias_cuentas FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

REVOKE ALL ON public.transferencias_cuentas FROM anon;

CREATE INDEX IF NOT EXISTS idx_transf_origen ON public.transferencias_cuentas(cuenta_origen_id);
CREATE INDEX IF NOT EXISTS idx_transf_destino ON public.transferencias_cuentas(cuenta_destino_id);
CREATE INDEX IF NOT EXISTS idx_transf_fecha ON public.transferencias_cuentas(fecha);
