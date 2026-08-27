-- ==============================================================================
-- TABLA: CUENTAS FINANCIERAS Y MÉTODOS DE PAGO DEL NEGOCIO
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.cuentas_negocio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    tipo VARCHAR(50) NOT NULL DEFAULT 'banco_nacional', 
    moneda VARCHAR(10) NOT NULL DEFAULT 'VES',
    banco_plataforma VARCHAR(100),
    titular VARCHAR(150),
    numero_cuenta_telefono VARCHAR(100),
    saldo_inicial NUMERIC(14, 2) DEFAULT 0,
    icono VARCHAR(20) DEFAULT '🏦',
    color VARCHAR(30) DEFAULT '#3b82f6',
    activo BOOLEAN DEFAULT true,
    notas TEXT,
    creado_el TIMESTAMPTZ DEFAULT NOW(),
    actualizado_el TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cuentas_negocio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cuentas acceso autenticados" ON public.cuentas_negocio;
CREATE POLICY "Cuentas acceso autenticados" 
    ON public.cuentas_negocio FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

REVOKE ALL ON public.cuentas_negocio FROM anon;

INSERT INTO public.cuentas_negocio (nombre, codigo, tipo, moneda, banco_plataforma, titular, numero_cuenta_telefono, icono, color)
VALUES
  ('Efectivo USD (Gaveta)', 'efectivo_usd', 'efectivo_usd', 'USD', 'Gaveta Física', 'La Parada del Sabor', 'Caja Mostrador', '💵', '#10b981'),
  ('Efectivo Bs (Gaveta)', 'efectivo_bs', 'efectivo_bs', 'VES', 'Gaveta Física', 'La Parada del Sabor', 'Caja Mostrador', '🇻🇪', '#059669'),
  ('Banco Fondo Común (BFC) VES', 'pago_movil_bfc', 'banco_nacional', 'VES', 'Banco Fondo Común (BFC)', 'La Parada del Sabor', 'Pago Móvil / Transferencia', '📱', '#3b82f6'),
  ('Banco de Venezuela (BDV) VES', 'bdv_ves', 'banco_nacional', 'VES', 'Banco de Venezuela', 'La Parada del Sabor', 'Pago Móvil / Cuenta', '🏛️', '#ef4444'),
  ('Bancamiga VES / USD', 'bancamiga', 'banco_nacional', 'VES', 'Bancamiga Banco Universal', 'La Parada del Sabor', 'Pago Móvil / Tarjeta Débito', '💳', '#0284c7'),
  ('Banesco VES', 'banesco', 'banco_nacional', 'VES', 'Banesco Banco Universal', 'La Parada del Sabor', 'Pago Móvil / Transferencia', '🏦', '#16a34a'),
  ('Binance Pay USDT', 'binance', 'cripto', 'USDT', 'Binance', 'La Parada del Sabor', 'Pay ID / Email', '🟡', '#f59e0b'),
  ('Zelle USD', 'zelle', 'billetera_digital', 'USD', 'Zelle', 'La Parada del Sabor', 'Correo / Teléfono', '🟣', '#7c3aed'),
  ('Caja Chica Operativa', 'caja_chica', 'caja_chica', 'USD', 'Caja Chica', 'Administración', 'Efectivo Rápido', '💼', '#64748b')
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE public.gastos 
ADD COLUMN IF NOT EXISTS cuenta_id UUID REFERENCES public.cuentas_negocio(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gastos_cuenta_id ON public.gastos(cuenta_id);
