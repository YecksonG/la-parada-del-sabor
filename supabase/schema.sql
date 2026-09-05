-- ==============================================================================
-- SCHEMA MASTER V2.1: LA PARADA DEL SABOR (POS & ESCANDALLO GASTRONÓMICO)
-- Base de datos relacional robusta con PPMC, RLS, triggers compensatorios,
-- reconciliación de cancelaciones y cálculo estricto de totales server-side.
-- ==============================================================================

-- 1. TABLAS PRINCIPALES

-- Categorías de Productos
CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    icono VARCHAR(20) DEFAULT '🫓',
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- Insumos (Materia Prima en g, ml y und)
CREATE TABLE IF NOT EXISTS public.insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL UNIQUE,
    unidad_medida VARCHAR(20) NOT NULL CHECK (unidad_medida IN ('g', 'ml', 'und')),
    stock_actual NUMERIC(14, 2) NOT NULL DEFAULT 0,
    stock_minimo NUMERIC(14, 2) NOT NULL DEFAULT 100 CHECK (stock_minimo >= 0),
    costo_unitario_usd NUMERIC(12, 6) NOT NULL DEFAULT 0 CHECK (costo_unitario_usd >= 0),
    categoria_insumo VARCHAR(80) DEFAULT 'General',
    activo BOOLEAN DEFAULT true,
    actualizado_el TIMESTAMPTZ DEFAULT NOW(),
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- Productos (Platos Terminados / Arepas / Combos / Bebidas)
CREATE TABLE IF NOT EXISTS public.productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL UNIQUE,
    categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
    descripcion TEXT,
    precio_usd NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_usd >= 0),
    icono VARCHAR(20) DEFAULT '🫓',
    imagen_url TEXT,
    popular BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- Recetas / Escandallo (Ingredientes por Plato)
CREATE TABLE IF NOT EXISTS public.recetas_ingredientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
    cantidad NUMERIC(10, 2) NOT NULL CHECK (cantidad > 0),
    es_opcional BOOLEAN DEFAULT false,
    notas VARCHAR(150),
    creado_el TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(producto_id, insumo_id)
);

-- Extras y Modificadores (+Queso, +Aguacate, etc.)
CREATE TABLE IF NOT EXISTS public.extras_modificadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    insumo_id UUID REFERENCES public.insumos(id) ON DELETE SET NULL,
    cantidad_descuento NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (cantidad_descuento >= 0),
    precio_extra_usd NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (precio_extra_usd >= 0),
    activo BOOLEAN DEFAULT true,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(50),
    direccion_delivery TEXT,
    notas_preferencias TEXT,
    total_pedidos INT DEFAULT 0 CHECK (total_pedidos >= 0),
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- Proveedores
CREATE TABLE IF NOT EXISTS public.proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(50),
    contacto VARCHAR(100),
    direccion TEXT,
    rif VARCHAR(50),
    notas TEXT, -- Almacena JSON estructurado { insumos_ids: UUID[], notas_texto: string } con fallback legacy
    activo BOOLEAN DEFAULT true,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- Relación N:M Proveedores e Insumos (Tabla puente formal para migración / reportes avanzados)
CREATE TABLE IF NOT EXISTS public.proveedor_insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id UUID NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
    precio_referencial_usd NUMERIC(12, 6) DEFAULT 0,
    creado_el TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proveedor_id, insumo_id)
);

-- Tasas de Cambio (Sincronizadas con BCV Oficial, Binance USDT, Euro y Promedio)
CREATE TABLE IF NOT EXISTS public.tasas_cambio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    bcv_usd_bs NUMERIC(12, 4) NOT NULL CHECK (bcv_usd_bs > 0),
    usdt_bs NUMERIC(12, 4) CHECK (usdt_bs > 0),
    promedio_bs NUMERIC(12, 4) CHECK (promedio_bs > 0),
    eur_bs NUMERIC(12, 4) CHECK (eur_bs > 0),
    tasa_usd_bs NUMERIC(12, 4) CHECK (tasa_usd_bs > 0),
    cop_usd NUMERIC(12, 2) CHECK (cop_usd > 0),
    creado_el TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tasas_fecha UNIQUE (fecha)
);

-- Compras
CREATE TABLE IF NOT EXISTS public.compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    total_usd NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_usd >= 0),
    total_bs NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_bs >= 0),
    tasa_bcv NUMERIC(12, 4) NOT NULL DEFAULT 1 CHECK (tasa_bcv > 0),
    metodo_pago VARCHAR(50) DEFAULT 'efectivo_usd',
    comprobante VARCHAR(100),
    notas TEXT,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- Items de Compra (Conversión Bultos/Kg -> Gramos)
CREATE TABLE IF NOT EXISTS public.compras_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
    cantidad_comprada NUMERIC(10, 2) NOT NULL CHECK (cantidad_comprada > 0),
    unidad_compra VARCHAR(30) NOT NULL,
    factor_conversion NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (factor_conversion > 0),
    cantidad_base_total NUMERIC(12, 2) NOT NULL CHECK (cantidad_base_total > 0),
    precio_unitario_usd NUMERIC(10, 4) NOT NULL CHECK (precio_unitario_usd >= 0),
    subtotal_usd NUMERIC(12, 2) NOT NULL CHECK (subtotal_usd >= 0)
);

-- Ventas (Comandas POS)
CREATE TABLE IF NOT EXISTS public.ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_comanda SERIAL UNIQUE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_usd NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_usd >= 0),
    total_bs NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_bs >= 0),
    tasa_bcv NUMERIC(12, 4) NOT NULL DEFAULT 1 CHECK (tasa_bcv > 0),
    metodo_pago VARCHAR(50) NOT NULL DEFAULT 'efectivo_usd',
    tipo_entrega VARCHAR(30) NOT NULL DEFAULT 'puerta_cerrada' CHECK (tipo_entrega IN ('puerta_cerrada', 'mesa', 'pickup', 'delivery')),
    estado VARCHAR(30) NOT NULL DEFAULT 'completada' CHECK (estado IN ('pendiente', 'preparando', 'lista', 'completada', 'cancelada')),
    notas_comanda TEXT,
    creado_por VARCHAR(100) DEFAULT 'cajero'
);

-- Items de Venta
CREATE TABLE IF NOT EXISTS public.ventas_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario_usd NUMERIC(10, 2) NOT NULL CHECK (precio_unitario_usd >= 0),
    subtotal_usd NUMERIC(10, 2) NOT NULL CHECK (subtotal_usd >= 0),
    notas_item VARCHAR(150)
);

-- Extras de Items de Venta
CREATE TABLE IF NOT EXISTS public.ventas_items_extras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_item_id UUID NOT NULL REFERENCES public.ventas_items(id) ON DELETE CASCADE,
    extra_id UUID NOT NULL REFERENCES public.extras_modificadores(id) ON DELETE RESTRICT,
    cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario_usd NUMERIC(10, 2) NOT NULL CHECK (precio_unitario_usd >= 0),
    subtotal_usd NUMERIC(10, 2) NOT NULL CHECK (subtotal_usd >= 0)
);

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

-- ==============================================================================
-- 2. SEGURIDAD Y POLÍTICAS RLS (AUTHENTICATED)
-- ==============================================================================

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extras_modificadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasas_cambio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_items_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedor_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_categorias" ON public.categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_insumos" ON public.insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_productos" ON public.productos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_recetas" ON public.recetas_ingredientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_extras" ON public.extras_modificadores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_clientes" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_proveedores" ON public.proveedores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_proveedor_insumos" ON public.proveedor_insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_tasas" ON public.tasas_cambio FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_compras" ON public.compras FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_compras_items" ON public.compras_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_ventas" ON public.ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_ventas_items" ON public.ventas_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_ventas_extras" ON public.ventas_items_extras FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_sesiones_caja" ON public.sesiones_caja FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 3. TRIGGERS DE INVENTARIO Y RECONCILIACIÓN DE CANCELACIONES
-- ==============================================================================

-- A) Descontar receta al insertar item de venta
CREATE OR REPLACE FUNCTION public.fn_descontar_receta_venta()
RETURNS TRIGGER AS $$
DECLARE
    v_estado VARCHAR(30);
BEGIN
    SELECT estado INTO v_estado FROM public.ventas WHERE id = NEW.venta_id;
    
    IF v_estado IS DISTINCT FROM 'cancelada' THEN
        UPDATE public.insumos i
        SET stock_actual = i.stock_actual - (r.cantidad * NEW.cantidad),
            actualizado_el = NOW()
        FROM public.recetas_ingredientes r
        WHERE r.insumo_id = i.id
          AND r.producto_id = NEW.producto_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_descontar_receta_venta
AFTER INSERT ON public.ventas_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_descontar_receta_venta();

-- B) Descontar extra vendido
CREATE OR REPLACE FUNCTION public.fn_descontar_extra_venta()
RETURNS TRIGGER AS $$
DECLARE
    v_estado VARCHAR(30);
BEGIN
    SELECT v.estado INTO v_estado
    FROM public.ventas_items vi
    JOIN public.ventas v ON v.id = vi.venta_id
    WHERE vi.id = NEW.venta_item_id;

    IF v_estado IS DISTINCT FROM 'cancelada' THEN
        UPDATE public.insumos i
        SET stock_actual = i.stock_actual - (e.cantidad_descuento * NEW.cantidad),
            actualizado_el = NOW()
        FROM public.extras_modificadores e
        WHERE e.id = NEW.extra_id
          AND e.insumo_id = i.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_descontar_extra_venta
AFTER INSERT ON public.ventas_items_extras
FOR EACH ROW
EXECUTE FUNCTION public.fn_descontar_extra_venta();

-- C) Reconciliar stock ante cambio de estado en la venta
CREATE OR REPLACE FUNCTION public.fn_reconciliar_cambio_estado_venta()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado != 'cancelada' AND NEW.estado = 'cancelada' THEN
        -- Restaurar recetas
        UPDATE public.insumos i
        SET stock_actual = i.stock_actual + sub.total_devuelto,
            actualizado_el = NOW()
        FROM (
            SELECT r.insumo_id, SUM(r.cantidad * vi.cantidad) AS total_devuelto
            FROM public.ventas_items vi
            JOIN public.recetas_ingredientes r ON r.producto_id = vi.producto_id
            WHERE vi.venta_id = NEW.id
            GROUP BY r.insumo_id
        ) sub
        WHERE i.id = sub.insumo_id;

        -- Restaurar extras
        UPDATE public.insumos i
        SET stock_actual = i.stock_actual + sub.total_extra_devuelto,
            actualizado_el = NOW()
        FROM (
            SELECT e.insumo_id, SUM(e.cantidad_descuento * vie.cantidad) AS total_extra_devuelto
            FROM public.ventas_items vi
            JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
            JOIN public.extras_modificadores e ON e.id = vie.extra_id
            WHERE vi.venta_id = NEW.id AND e.insumo_id IS NOT NULL
            GROUP BY e.insumo_id
        ) sub
        WHERE i.id = sub.insumo_id;

    ELSIF OLD.estado = 'cancelada' AND NEW.estado != 'cancelada' THEN
        -- Volver a descontar recetas
        UPDATE public.insumos i
        SET stock_actual = i.stock_actual - sub.total_descontar,
            actualizado_el = NOW()
        FROM (
            SELECT r.insumo_id, SUM(r.cantidad * vi.cantidad) AS total_descontar
            FROM public.ventas_items vi
            JOIN public.recetas_ingredientes r ON r.producto_id = vi.producto_id
            WHERE vi.venta_id = NEW.id
            GROUP BY r.insumo_id
        ) sub
        WHERE i.id = sub.insumo_id;

        -- Volver a descontar extras
        UPDATE public.insumos i
        SET stock_actual = i.stock_actual - sub.total_extra_descontar,
            actualizado_el = NOW()
        FROM (
            SELECT e.insumo_id, SUM(e.cantidad_descuento * vie.cantidad) AS total_extra_descontar
            FROM public.ventas_items vi
            JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
            JOIN public.extras_modificadores e ON e.id = vie.extra_id
            WHERE vi.venta_id = NEW.id AND e.insumo_id IS NOT NULL
            GROUP BY e.insumo_id
        ) sub
        WHERE i.id = sub.insumo_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reconciliar_cambio_estado_venta
AFTER UPDATE OF estado ON public.ventas
FOR EACH ROW
EXECUTE FUNCTION public.fn_reconciliar_cambio_estado_venta();

-- ==============================================================================
-- 4. TRIGGERS DE COMPRAS: PPMC Y AJUSTES
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_sumar_stock_compra_ppmc()
RETURNS TRIGGER AS $$
DECLARE
    v_stock_previo NUMERIC(14, 2);
    v_costo_previo NUMERIC(12, 6);
    v_nuevo_stock NUMERIC(14, 2);
    v_costo_ponderado NUMERIC(12, 6);
BEGIN
    SELECT stock_actual, costo_unitario_usd
    INTO v_stock_previo, v_costo_previo
    FROM public.insumos
    WHERE id = NEW.insumo_id;

    v_nuevo_stock := GREATEST(v_stock_previo, 0) + NEW.cantidad_base_total;

    IF v_stock_previo > 0 THEN
        v_costo_ponderado := ((v_stock_previo * v_costo_previo) + NEW.subtotal_usd) / v_nuevo_stock;
    ELSE
        v_costo_ponderado := NEW.subtotal_usd / NEW.cantidad_base_total;
    END IF;

    UPDATE public.insumos
    SET stock_actual = stock_actual + NEW.cantidad_base_total,
        costo_unitario_usd = ROUND(v_costo_ponderado, 6),
        actualizado_el = NOW()
    WHERE id = NEW.insumo_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sumar_stock_compra
AFTER INSERT ON public.compras_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_sumar_stock_compra_ppmc();

CREATE OR REPLACE FUNCTION public.fn_revertir_stock_compra_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.insumos
    SET stock_actual = stock_actual - OLD.cantidad_base_total,
        actualizado_el = NOW()
    WHERE id = OLD.insumo_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_revertir_stock_compra
AFTER DELETE ON public.compras_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_revertir_stock_compra_delete();

-- ==============================================================================
-- 5. TRIGGERS DE TOTALES SERVER-SIDE (VENTAS Y COMPRAS)
-- ==============================================================================

-- Recalcular totales al cambiar ventas_items
CREATE OR REPLACE FUNCTION public.fn_recalcular_totales_venta()
RETURNS TRIGGER AS $$
DECLARE
    v_id UUID;
    v_total_items NUMERIC(10, 2) := 0;
    v_total_extras NUMERIC(10, 2) := 0;
    v_total_usd NUMERIC(10, 2) := 0;
    v_tasa NUMERIC(12, 4) := 1;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_id := OLD.venta_id;
    ELSE
        v_id := NEW.venta_id;
    END IF;

    SELECT COALESCE(tasa_bcv, 1) INTO v_tasa FROM public.ventas WHERE id = v_id;
    IF v_tasa IS NULL OR v_tasa <= 0 THEN v_tasa := 1; END IF;

    SELECT COALESCE(SUM(subtotal_usd), 0) INTO v_total_items
    FROM public.ventas_items
    WHERE venta_id = v_id;

    SELECT COALESCE(SUM(vie.subtotal_usd), 0) INTO v_total_extras
    FROM public.ventas_items vi
    JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
    WHERE vi.venta_id = v_id;

    v_total_usd := v_total_items + v_total_extras;

    UPDATE public.ventas
    SET total_usd = v_total_usd,
        total_bs = ROUND((v_total_usd * v_tasa)::NUMERIC, 2)
    WHERE id = v_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_totales_ventas_items
AFTER INSERT OR UPDATE OR DELETE ON public.ventas_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_recalcular_totales_venta();

-- Recalcular totales al cambiar ventas_items_extras
CREATE OR REPLACE FUNCTION public.fn_recalcular_totales_venta_extras()
RETURNS TRIGGER AS $$
DECLARE
    v_id UUID;
    v_item_id UUID;
    v_total_items NUMERIC(10, 2) := 0;
    v_total_extras NUMERIC(10, 2) := 0;
    v_total_usd NUMERIC(10, 2) := 0;
    v_tasa NUMERIC(12, 4) := 1;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_item_id := OLD.venta_item_id;
    ELSE
        v_item_id := NEW.venta_item_id;
    END IF;

    SELECT venta_id INTO v_id FROM public.ventas_items WHERE id = v_item_id;
    IF v_id IS NULL THEN RETURN NULL; END IF;

    SELECT COALESCE(tasa_bcv, 1) INTO v_tasa FROM public.ventas WHERE id = v_id;
    IF v_tasa IS NULL OR v_tasa <= 0 THEN v_tasa := 1; END IF;

    SELECT COALESCE(SUM(subtotal_usd), 0) INTO v_total_items
    FROM public.ventas_items
    WHERE venta_id = v_id;

    SELECT COALESCE(SUM(vie.subtotal_usd), 0) INTO v_total_extras
    FROM public.ventas_items vi
    JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
    WHERE vi.venta_id = v_id;

    v_total_usd := v_total_items + v_total_extras;

    UPDATE public.ventas
    SET total_usd = v_total_usd,
        total_bs = ROUND((v_total_usd * v_tasa)::NUMERIC, 2)
    WHERE id = v_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_totales_ventas_extras
AFTER INSERT OR UPDATE OR DELETE ON public.ventas_items_extras
FOR EACH ROW
EXECUTE FUNCTION public.fn_recalcular_totales_venta_extras();

-- Recalcular totales de compra
CREATE OR REPLACE FUNCTION public.fn_recalcular_totales_compra()
RETURNS TRIGGER AS $$
DECLARE
    v_id UUID;
    v_total_usd NUMERIC(12, 2) := 0;
    v_tasa NUMERIC(12, 4) := 1;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_id := OLD.compra_id;
    ELSE
        v_id := NEW.compra_id;
    END IF;

    SELECT COALESCE(tasa_bcv, 1) INTO v_tasa FROM public.compras WHERE id = v_id;
    IF v_tasa IS NULL OR v_tasa <= 0 THEN v_tasa := 1; END IF;

    SELECT COALESCE(SUM(subtotal_usd), 0) INTO v_total_usd
    FROM public.compras_items
    WHERE compra_id = v_id;

    UPDATE public.compras
    SET total_usd = v_total_usd,
        total_bs = ROUND((v_total_usd * v_tasa)::NUMERIC, 2)
    WHERE id = v_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_totales_compras_items
AFTER INSERT OR UPDATE OR DELETE ON public.compras_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_recalcular_totales_compra();
