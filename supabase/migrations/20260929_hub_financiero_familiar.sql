-- =============================================================================
-- MIGRACIÓN: HUB FINANCIERO FAMILIAR, TETAS RELLENAS Y MATRIZ DE PRÉSTAMOS
-- Fecha: 2026-09-29
-- Proyecto: La Parada del Sabor — Ecosistema Multi-Negocio y Finanzas del Hogar
-- =============================================================================

-- 1. TABLA: Entidades Financieras del Ecosistema
CREATE TABLE IF NOT EXISTS public.finanzas_entidades (
    id TEXT PRIMARY KEY, -- 'parada', 'tetas', 'yg', 'esposa', 'hogar'
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('negocio', 'personal', 'comun')),
    color TEXT NOT NULL DEFAULT '#2563eb',
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semilla de entidades básicas
INSERT INTO public.finanzas_entidades (id, nombre, tipo, color) VALUES
    ('parada', 'La Parada del Sabor', 'negocio', '#f59e0b'),
    ('tetas', 'Tetas Rellenas', 'negocio', '#ec4899'),
    ('yg', 'YG (Personal)', 'personal', '#3b82f6'),
    ('esposa', 'Esposa (Personal)', 'personal', '#8b5cf6'),
    ('hogar', 'Fondo Común Hogar', 'comun', '#10b981')
ON CONFLICT (id) DO NOTHING;

-- 2. TABLA: Inventario de Tetas Rellenas (Control de Freezer)
CREATE TABLE IF NOT EXISTS public.tetas_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sabor TEXT NOT NULL UNIQUE,
    stock_unidades INT NOT NULL DEFAULT 0 CHECK (stock_unidades >= 0),
    costo_compra_unitario_usd NUMERIC(10,2) NOT NULL DEFAULT 0.50 CHECK (costo_compra_unitario_usd >= 0),
    precio_venta_unitario_usd NUMERIC(10,2) NOT NULL DEFAULT 1.00 CHECK (precio_venta_unitario_usd >= 0),
    activo BOOLEAN NOT NULL DEFAULT true,
    actualizado_el TIMESTAMPTZ NOT NULL DEFAULT now(),
    creado_el TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABLA: Ventas de Tetas Rellenas
CREATE TABLE IF NOT EXISTS public.tetas_ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    sabor_id UUID REFERENCES public.tetas_inventario(id) ON DELETE RESTRICT,
    sabor_nombre TEXT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario_usd NUMERIC(10,2) NOT NULL,
    costo_unitario_usd NUMERIC(10,2) NOT NULL,
    total_usd NUMERIC(10,2) NOT NULL,
    total_bs NUMERIC(12,2) NOT NULL,
    tasa_bcv NUMERIC(10,2) NOT NULL,
    metodo_pago TEXT NOT NULL DEFAULT 'efectivo_usd',
    registrado_por TEXT,
    notas TEXT,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para descontar stock en tetas_inventario tras venta
CREATE OR REPLACE FUNCTION public.fn_trg_descontar_stock_tetas()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.tetas_inventario
    SET stock_unidades = GREATEST(0, stock_unidades - NEW.cantidad),
        actualizado_el = now()
    WHERE id = NEW.sabor_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_descontar_stock_tetas ON public.tetas_ventas;
CREATE TRIGGER trg_descontar_stock_tetas
AFTER INSERT ON public.tetas_ventas
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_descontar_stock_tetas();

-- 4. TABLA: Movimientos Financieros (Ingresos, Gastos Personales, Side Hustles, Sueldos)
CREATE TABLE IF NOT EXISTS public.finanzas_movimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    entidad_id TEXT NOT NULL REFERENCES public.finanzas_entidades(id) ON DELETE RESTRICT,
    tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
    categoria TEXT NOT NULL, -- 'sueldo', 'side_hustle', 'freelance', 'comida_hogar', 'servicios_hogar', 'salud', 'transporte', 'otro'
    descripcion TEXT NOT NULL,
    monto_usd NUMERIC(10,2) NOT NULL CHECK (monto_usd >= 0),
    monto_bs NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_bs >= 0),
    tasa_bcv NUMERIC(10,2) NOT NULL DEFAULT 60.0,
    metodo_pago TEXT NOT NULL DEFAULT 'efectivo_usd',
    recurrente BOOLEAN NOT NULL DEFAULT false,
    frecuencia TEXT CHECK (frecuencia IN ('quincenal', 'mensual', 'semanal', NULL)),
    notas TEXT,
    creado_por TEXT,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABLA: Préstamos y Deudas (Cruzadas entre Negocios y con Terceros/Familiares)
CREATE TABLE IF NOT EXISTS public.finanzas_prestamos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    origen_tipo TEXT NOT NULL CHECK (origen_tipo IN ('entidad_interna', 'tercero_familiar')),
    origen_entidad_id TEXT REFERENCES public.finanzas_entidades(id) ON DELETE SET NULL,
    origen_nombre TEXT NOT NULL, -- ej. "La Parada", "Tetas", "Hermano", "Tío"
    destino_tipo TEXT NOT NULL CHECK (destino_tipo IN ('entidad_interna', 'tercero_familiar')),
    destino_entidad_id TEXT REFERENCES public.finanzas_entidades(id) ON DELETE SET NULL,
    destino_nombre TEXT NOT NULL,
    monto_original_usd NUMERIC(10,2) NOT NULL CHECK (monto_original_usd > 0),
    monto_original_bs NUMERIC(12,2) NOT NULL DEFAULT 0,
    saldo_pendiente_usd NUMERIC(10,2) NOT NULL CHECK (saldo_pendiente_usd >= 0),
    tasa_bcv NUMERIC(10,2) NOT NULL DEFAULT 60.0,
    concepto TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'pagado', 'anulado')),
    notas TEXT,
    creado_por TEXT,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_el TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. TABLA: Abonos y Amortizaciones a Préstamos
CREATE TABLE IF NOT EXISTS public.finanzas_prestamos_abonos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prestamo_id UUID NOT NULL REFERENCES public.finanzas_prestamos(id) ON DELETE CASCADE,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    monto_usd NUMERIC(10,2) NOT NULL CHECK (monto_usd > 0),
    monto_bs NUMERIC(12,2) NOT NULL DEFAULT 0,
    tasa_bcv NUMERIC(10,2) NOT NULL DEFAULT 60.0,
    metodo_pago TEXT NOT NULL DEFAULT 'efectivo_usd',
    notas TEXT,
    registrado_por TEXT,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para descontar automáticamente saldo_pendiente_usd y actualizar estado
CREATE OR REPLACE FUNCTION public.fn_trg_actualizar_saldo_prestamo()
RETURNS TRIGGER AS $$
DECLARE
    v_saldo_actual NUMERIC(10,2);
    v_estado_actual TEXT;
    v_nuevo_saldo NUMERIC(10,2);
BEGIN
    SELECT saldo_pendiente_usd, estado
    INTO v_saldo_actual, v_estado_actual
    FROM public.finanzas_prestamos
    WHERE id = NEW.prestamo_id
    FOR UPDATE;

    IF v_estado_actual = 'anulado' THEN
        RETURN NEW;
    END IF;

    v_nuevo_saldo := GREATEST(0, v_saldo_actual - NEW.monto_usd);

    UPDATE public.finanzas_prestamos
    SET saldo_pendiente_usd = v_nuevo_saldo,
        estado = CASE WHEN v_nuevo_saldo <= 0 THEN 'pagado' ELSE 'activo' END,
        actualizado_el = now()
    WHERE id = NEW.prestamo_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_actualizar_saldo_prestamo ON public.finanzas_prestamos_abonos;
CREATE TRIGGER trg_actualizar_saldo_prestamo
AFTER INSERT ON public.finanzas_prestamos_abonos
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_actualizar_saldo_prestamo();

-- 7. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_tetas_ventas_fecha ON public.tetas_ventas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_finanzas_movimientos_entidad ON public.finanzas_movimientos(entidad_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_finanzas_prestamos_estado ON public.finanzas_prestamos(estado, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_finanzas_prestamos_abonos_prestamo ON public.finanzas_prestamos_abonos(prestamo_id);

-- 8. POLÍTICAS DE SEGURIDAD RLS
ALTER TABLE public.finanzas_entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tetas_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tetas_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finanzas_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finanzas_prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finanzas_prestamos_abonos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total a finanzas_entidades para usuarios autenticados" ON public.finanzas_entidades;
CREATE POLICY "Acceso total a finanzas_entidades para usuarios autenticados"
    ON public.finanzas_entidades FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a tetas_inventario para usuarios autenticados" ON public.tetas_inventario;
CREATE POLICY "Acceso total a tetas_inventario para usuarios autenticados"
    ON public.tetas_inventario FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a tetas_ventas para usuarios autenticados" ON public.tetas_ventas;
CREATE POLICY "Acceso total a tetas_ventas para usuarios autenticados"
    ON public.tetas_ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a finanzas_movimientos para usuarios autenticados" ON public.finanzas_movimientos;
CREATE POLICY "Acceso total a finanzas_movimientos para usuarios autenticados"
    ON public.finanzas_movimientos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a finanzas_prestamos para usuarios autenticados" ON public.finanzas_prestamos;
CREATE POLICY "Acceso total a finanzas_prestamos para usuarios autenticados"
    ON public.finanzas_prestamos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a finanzas_prestamos_abonos para usuarios autenticados" ON public.finanzas_prestamos_abonos;
CREATE POLICY "Acceso total a finanzas_prestamos_abonos para usuarios autenticados"
    ON public.finanzas_prestamos_abonos FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.finanzas_entidades TO authenticated, service_role;
GRANT ALL ON public.tetas_inventario TO authenticated, service_role;
GRANT ALL ON public.tetas_ventas TO authenticated, service_role;
GRANT ALL ON public.finanzas_movimientos TO authenticated, service_role;
GRANT ALL ON public.finanzas_prestamos TO authenticated, service_role;
GRANT ALL ON public.finanzas_prestamos_abonos TO authenticated, service_role;
