-- ==============================================================================
-- 1. LIMPIEZA / RESET OPERATIVO DE COMANDAS, PRODUCTOS, RECETAS Y DESPENSA
-- (Mantiene intactos: Clientes, Proveedores, Tasas de Cambio, Zonas de Delivery y Usuarios)
-- ==============================================================================

-- Desactivar temporalmente restricciones si aplica para truncado limpio
TRUNCATE TABLE 
    public.ventas_items_extras,
    public.ventas_items,
    public.ventas,
    public.sesiones_caja,
    public.compras_items,
    public.compras,
    public.recetas_ingredientes,
    public.extras_modificadores,
    public.proveedor_insumos,
    public.productos,
    public.insumos
CASCADE;

-- Reiniciar secuencias de comandas y números
ALTER SEQUENCE IF EXISTS public.ventas_numero_comanda_seq RESTART WITH 1;

-- ==============================================================================
-- 2. NUEVA TABLA: GASTOS DEL NEGOCIO (SERVICIOS, NÓMINA, FACTURAS, CUENTAS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    categoria VARCHAR(50) NOT NULL DEFAULT 'servicios',
    -- Categorías: 'servicios', 'nomina', 'proveedores', 'alquiler', 'mantenimiento', 'marketing', 'impuestos', 'otros'
    subcategoria VARCHAR(100),
    -- Subcategorías sugeridas: 'Gas Doméstico/Comercial', 'Agua (Cisterna/Tubería)', 'Electricidad', 'Internet / WiFi', 'Sueldo Semanal', 'Adelanto / Préstamo', 'Jornal / Extra', 'Insumos / Alimentos', 'Artículos de Limpieza', 'Empaques / Descartables', 'Mantenimiento Equipos'
    descripcion TEXT NOT NULL,
    beneficiario VARCHAR(150),
    proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL,
    monto_usd NUMERIC(10, 2) NOT NULL CHECK (monto_usd >= 0),
    monto_bs NUMERIC(14, 2) NOT NULL DEFAULT 0,
    tasa_bcv NUMERIC(12, 4) NOT NULL DEFAULT 1 CHECK (tasa_bcv > 0),
    cuenta_origen VARCHAR(50) NOT NULL DEFAULT 'efectivo_usd',
    -- Cuentas: 'efectivo_usd', 'efectivo_bs', 'pago_movil_bfc', 'transferencia_bfc', 'binance', 'zelle', 'punto_venta', 'caja_chica', 'otra'
    numero_factura VARCHAR(100),
    comprobante_url TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'pagado' CHECK (estado IN ('pagado', 'pendiente', 'anulado')),
    sesion_caja_id UUID REFERENCES public.sesiones_caja(id) ON DELETE SET NULL,
    notas TEXT,
    creado_por VARCHAR(100) DEFAULT 'admin',
    creado_el TIMESTAMPTZ DEFAULT NOW(),
    actualizado_el TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON public.gastos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON public.gastos(categoria);
CREATE INDEX IF NOT EXISTS idx_gastos_cuenta ON public.gastos(cuenta_origen);
CREATE INDEX IF NOT EXISTS idx_gastos_proveedor ON public.gastos(proveedor_id);

-- RLS para gastos
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gastos acceso autenticados" ON public.gastos;
CREATE POLICY "Gastos acceso autenticados" 
    ON public.gastos FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Gastos lectura anon" ON public.gastos;
CREATE POLICY "Gastos lectura anon" 
    ON public.gastos FOR SELECT 
    TO anon 
    USING (false);

-- ==============================================================================
-- 3. STORAGE BUCKET PARA FACTURAS Y COMPROBANTES DE GASTOS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes-gastos', 'comprobantes-gastos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Permitir carga comprobantes auth" ON storage.objects;
CREATE POLICY "Permitir carga comprobantes auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comprobantes-gastos');

DROP POLICY IF EXISTS "Permitir lectura comprobantes publico" ON storage.objects;
CREATE POLICY "Permitir lectura comprobantes publico"
ON storage.objects FOR SELECT
USING (bucket_id = 'comprobantes-gastos');
