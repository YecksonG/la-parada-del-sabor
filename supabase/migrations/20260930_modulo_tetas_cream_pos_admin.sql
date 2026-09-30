-- =============================================================================
-- MIGRACIÓN: MÓDULO TETAS CREAM EN LA PARADA DEL SABOR (POS ADMIN)
-- =============================================================================

-- 1. TABLA: Inventario de Tetas Cream (Control de Freezer)
CREATE TABLE IF NOT EXISTS public.tetas_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sabor TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL DEFAULT 'con_chocolate',
    stock_unidades INT NOT NULL DEFAULT 0 CHECK (stock_unidades >= 0),
    costo_compra_unitario_usd NUMERIC(10,2) NOT NULL DEFAULT 0.35 CHECK (costo_compra_unitario_usd >= 0),
    precio_venta_unitario_usd NUMERIC(10,2) NOT NULL DEFAULT 0.80 CHECK (precio_venta_unitario_usd >= 0),
    activo BOOLEAN NOT NULL DEFAULT true,
    actualizado_el TIMESTAMPTZ NOT NULL DEFAULT now(),
    creado_el TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asegurar columna categoria si la tabla ya existía previamente
ALTER TABLE public.tetas_inventario
ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'con_chocolate';

-- 2. TABLA: Ventas de Tetas Cream (Despacho POS)
CREATE TABLE IF NOT EXISTS public.tetas_ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    sabor_id UUID REFERENCES public.tetas_inventario(id) ON DELETE RESTRICT,
    sabor_nombre TEXT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario_usd NUMERIC(10,2) NOT NULL,
    costo_unitario_usd NUMERIC(10,2) NOT NULL DEFAULT 0.35,
    total_usd NUMERIC(10,2) NOT NULL,
    total_bs NUMERIC(12,2) NOT NULL,
    tasa_bcv NUMERIC(10,2) NOT NULL,
    metodo_pago TEXT NOT NULL DEFAULT 'efectivo_usd',
    registrado_por TEXT,
    notas TEXT,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_tetas_inventario_cat ON public.tetas_inventario(categoria);
CREATE INDEX IF NOT EXISTS idx_tetas_ventas_fecha ON public.tetas_ventas(fecha DESC);

-- 4. Trigger atómico con bloqueo de fila y prevención estricta de overselling
CREATE OR REPLACE FUNCTION public.fn_trg_descontar_stock_tetas()
RETURNS TRIGGER AS $$
DECLARE
    v_stock_actual INT;
    v_sabor_nombre TEXT;
BEGIN
    SELECT stock_unidades, sabor INTO v_stock_actual, v_sabor_nombre
    FROM public.tetas_inventario
    WHERE id = NEW.sabor_id
    FOR UPDATE;

    IF v_stock_actual < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para "%": disponibles %, solicitadas %',
            v_sabor_nombre, v_stock_actual, NEW.cantidad;
    END IF;

    UPDATE public.tetas_inventario
    SET stock_unidades = stock_unidades - NEW.cantidad,
        actualizado_el = now()
    WHERE id = NEW.sabor_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_descontar_stock_tetas ON public.tetas_ventas;
CREATE TRIGGER trg_descontar_stock_tetas
AFTER INSERT ON public.tetas_ventas
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_descontar_stock_tetas();

-- 5. RPC para abastecimiento atómico de freezer sin condiciones de carrera
CREATE OR REPLACE FUNCTION public.fn_abastecer_stock_teta(p_sabor_id UUID, p_cantidad INT)
RETURNS INT AS $$
DECLARE
    v_nuevo_stock INT;
BEGIN
    UPDATE public.tetas_inventario
    SET stock_unidades = stock_unidades + p_cantidad,
        actualizado_el = now()
    WHERE id = p_sabor_id
    RETURNING stock_unidades INTO v_nuevo_stock;

    RETURN v_nuevo_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Seguridad RPC: Solo usuarios autenticados del sistema POS
REVOKE ALL ON FUNCTION public.fn_abastecer_stock_teta(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_abastecer_stock_teta(UUID, INT) TO authenticated;

-- 6. Semilla de los 39 sabores oficiales de Tetas Cream (1x0.80$, 2x1.50$)
INSERT INTO public.tetas_inventario (sabor, categoria, stock_unidades, costo_compra_unitario_usd, precio_venta_unitario_usd, activo)
VALUES
    ('Arequipe', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Batibati', 'clasicas', 0, 0.35, 0.80, true),
    ('Batifresa', 'clasicas', 0, 0.35, 0.80, true),
    ('Choco Arequipe', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Choco Coco', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Choco Maní', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Choco Pasas', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Choco Suiza', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Chocolate con Maní', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Chocoreal', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Coco', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Coco Arequipe', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Crema Real', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Durazno (Yogurt)', 'linea_yogurt', 0, 0.35, 0.80, true),
    ('Durazno Combinado', 'yogurt_combinado', 0, 0.35, 0.80, true),
    ('Fresa (Yogurt)', 'linea_yogurt', 0, 0.35, 0.80, true),
    ('Fresa Bombón', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Fresa Clásica', 'clasicas', 0, 0.35, 0.80, true),
    ('Fresa Combinada', 'yogurt_combinado', 0, 0.35, 0.80, true),
    ('Kolita con Leche', 'clasicas', 0, 0.35, 0.80, true),
    ('Mango (Yogurt)', 'linea_yogurt', 0, 0.35, 0.80, true),
    ('Mango Mora', 'yogurt_combinado', 0, 0.35, 0.80, true),
    ('Mango Parchita', 'yogurt_combinado', 0, 0.35, 0.80, true),
    ('Maní', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Mante Arequipe', 'combinadas', 0, 0.35, 0.80, true),
    ('Mante Bati', 'combinadas', 0, 0.35, 0.80, true),
    ('Mante Fresa', 'combinadas', 0, 0.35, 0.80, true),
    ('Mante Kola', 'combinadas', 0, 0.35, 0.80, true),
    ('Mante Limón', 'combinadas', 0, 0.35, 0.80, true),
    ('Mante Mango', 'combinadas', 0, 0.35, 0.80, true),
    ('Mante Mora', 'yogurt_combinado', 0, 0.35, 0.80, true),
    ('Mora (Yogurt)', 'linea_yogurt', 0, 0.35, 0.80, true),
    ('Parchita (Yogurt)', 'linea_yogurt', 0, 0.35, 0.80, true),
    ('Parchita Combinada', 'yogurt_combinado', 0, 0.35, 0.80, true),
    ('Pirulin', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Ron Pasas', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Samba Choco', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Samba Maní', 'con_chocolate', 0, 0.35, 0.80, true),
    ('Torta Suiza', 'con_chocolate', 0, 0.35, 0.80, true)
ON CONFLICT (sabor) DO UPDATE
SET categoria = EXCLUDED.categoria,
    precio_venta_unitario_usd = EXCLUDED.precio_venta_unitario_usd;

-- 7. Políticas de Seguridad RLS Estrictas (Solo Administradores y Personal Autenticado)
ALTER TABLE public.tetas_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tetas_ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total a tetas_inventario para usuarios autenticados" ON public.tetas_inventario;
CREATE POLICY "Acceso total a tetas_inventario para usuarios autenticados"
    ON public.tetas_inventario FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- IMPORTANTE: anon NO TIENE ACCESO para proteger los costos y no exponer la carta privada fuera del POS
DROP POLICY IF EXISTS "Lectura de tetas_inventario para anon" ON public.tetas_inventario;
REVOKE ALL ON public.tetas_inventario FROM anon;
REVOKE ALL ON public.tetas_ventas FROM anon;

DROP POLICY IF EXISTS "Acceso total a tetas_ventas para usuarios autenticados" ON public.tetas_ventas;
CREATE POLICY "Acceso total a tetas_ventas para usuarios autenticados"
    ON public.tetas_ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.tetas_inventario TO authenticated, service_role;
GRANT ALL ON public.tetas_ventas TO authenticated, service_role;
