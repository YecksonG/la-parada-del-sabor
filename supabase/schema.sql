-- ==============================================================================
-- SCHEMA MASTER: LA PARADA DEL SABOR (POS & ESCANDALLO GASTRONÓMICO)
-- Base de datos relacional para control de recetas en gramos, insumos, comandas y ventas.
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CATEGORÍAS DE PRODUCTOS
CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    icono VARCHAR(20) DEFAULT '🫓',
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INSUMOS (MATERIA PRIMA EN GRAMOS, ML Y UNIDADES)
CREATE TABLE IF NOT EXISTS public.insumos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(150) NOT NULL UNIQUE,
    unidad_medida VARCHAR(20) NOT NULL CHECK (unidad_medida IN ('g', 'ml', 'und')),
    stock_actual NUMERIC(12, 2) NOT NULL DEFAULT 0,
    stock_minimo NUMERIC(12, 2) NOT NULL DEFAULT 100,
    costo_unitario_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
    categoria_insumo VARCHAR(80) DEFAULT 'General',
    activo BOOLEAN DEFAULT true,
    actualizado_el TIMESTAMPTZ DEFAULT NOW(),
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCTOS (PLATOS TERMINADOS / AREPAS / COMBOS / BEBIDAS)
CREATE TABLE IF NOT EXISTS public.productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(150) NOT NULL UNIQUE,
    categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
    descripcion TEXT,
    precio_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
    icono VARCHAR(20) DEFAULT '🫓',
    imagen_url TEXT,
    popular BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RECETAS / ESCANDALLO (FÓRMULA EXACTA EN GRAMOS POR PLATO)
CREATE TABLE IF NOT EXISTS public.recetas_ingredientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
    cantidad NUMERIC(10, 2) NOT NULL CHECK (cantidad > 0), -- ej: 160g de masa, 90g de carne, 1 und envoltorio
    es_opcional BOOLEAN DEFAULT false,
    notas VARCHAR(150),
    creado_el TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(producto_id, insumo_id)
);

-- 6. EXTRAS Y MODIFICADORES (+Queso, +Tocineta, +Aguacate)
CREATE TABLE IF NOT EXISTS public.extras_modificadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    insumo_id UUID REFERENCES public.insumos(id) ON DELETE SET NULL,
    cantidad_descuento NUMERIC(10, 2) NOT NULL DEFAULT 0, -- ej: 40g de queso extra
    precio_extra_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CLIENTES
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(50),
    direccion_delivery TEXT,
    notas_preferencias TEXT,
    total_pedidos INT DEFAULT 0,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- 8. PROVEEDORES
CREATE TABLE IF NOT EXISTS public.proveedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(50),
    contacto VARCHAR(100),
    direccion TEXT,
    rif VARCHAR(50),
    notas TEXT,
    activo BOOLEAN DEFAULT true,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TASAS DE CAMBIO
CREATE TABLE IF NOT EXISTS public.tasas_cambio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    bcv_usd_bs NUMERIC(12, 4) NOT NULL,
    tasa_usd_bs NUMERIC(12, 4),
    cop_usd NUMERIC(12, 2),
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- 10. COMPRAS (ENTRADAS DE INSUMOS)
CREATE TABLE IF NOT EXISTS public.compras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    total_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_bs NUMERIC(14, 2) NOT NULL DEFAULT 0,
    tasa_bcv NUMERIC(12, 4) NOT NULL DEFAULT 1,
    metodo_pago VARCHAR(50) DEFAULT 'efectivo_usd',
    comprobante VARCHAR(100),
    notas TEXT,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ITEMS DE COMPRA (CONVERSIÓN BULTOS/KG -> GRAMOS)
CREATE TABLE IF NOT EXISTS public.compras_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
    cantidad_comprada NUMERIC(10, 2) NOT NULL,
    unidad_compra VARCHAR(30) NOT NULL, -- 'saco_20kg', 'kg', 'litro', 'g', 'und'
    factor_conversion NUMERIC(10, 2) NOT NULL DEFAULT 1, -- ej: saco 20kg = 20000
    cantidad_base_total NUMERIC(12, 2) NOT NULL, -- cantidad_comprada * factor_conversion
    precio_unitario_usd NUMERIC(10, 4) NOT NULL,
    subtotal_usd NUMERIC(12, 2) NOT NULL
);

-- 12. VENTAS (COMANDAS POS)
CREATE TABLE IF NOT EXISTS public.ventas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_comanda SERIAL,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_bs NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tasa_bcv NUMERIC(12, 4) NOT NULL DEFAULT 1,
    metodo_pago VARCHAR(50) NOT NULL DEFAULT 'efectivo_usd',
    tipo_entrega VARCHAR(30) NOT NULL DEFAULT 'puerta_cerrada' CHECK (tipo_entrega IN ('puerta_cerrada', 'mesa', 'pickup', 'delivery')),
    estado VARCHAR(30) NOT NULL DEFAULT 'completada' CHECK (estado IN ('preparando', 'completada', 'cancelada')),
    notas_comanda TEXT,
    creado_por VARCHAR(100) DEFAULT 'cajero'
);

-- 13. ITEMS DE VENTA
CREATE TABLE IF NOT EXISTS public.ventas_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venta_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario_usd NUMERIC(10, 2) NOT NULL,
    subtotal_usd NUMERIC(10, 2) NOT NULL,
    notas_item VARCHAR(150)
);

-- 14. EXTRAS VENDIDOS
CREATE TABLE IF NOT EXISTS public.ventas_items_extras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venta_item_id UUID NOT NULL REFERENCES public.ventas_items(id) ON DELETE CASCADE,
    extra_id UUID NOT NULL REFERENCES public.extras_modificadores(id) ON DELETE RESTRICT,
    cantidad INT NOT NULL DEFAULT 1,
    precio_unitario_usd NUMERIC(10, 2) NOT NULL,
    subtotal_usd NUMERIC(10, 2) NOT NULL
);

-- ==============================================================================
-- TRIGGERS Y FUNCIONES DE DEDUCCIÓN ATÓMICA DE STOCK EN GRAMOS
-- ==============================================================================

-- Función: Descontar ingredientes de receta al vender
CREATE OR REPLACE FUNCTION public.fn_descontar_receta_venta()
RETURNS TRIGGER AS $$
BEGIN
    -- Descuenta los insumos proporcionales a la cantidad del producto vendido
    UPDATE public.insumos i
    SET stock_actual = i.stock_actual - (r.cantidad * NEW.cantidad),
        actualizado_el = NOW()
    FROM public.recetas_ingredientes r
    WHERE r.insumo_id = i.id
      AND r.producto_id = NEW.producto_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_descontar_receta_venta
AFTER INSERT ON public.ventas_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_descontar_receta_venta();

-- Función: Descontar insumos por extras vendidos
CREATE OR REPLACE FUNCTION public.fn_descontar_extra_venta()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.insumos i
    SET stock_actual = i.stock_actual - (e.cantidad_descuento * NEW.cantidad),
        actualizado_el = NOW()
    FROM public.extras_modificadores e
    WHERE e.id = NEW.extra_id
      AND e.insumo_id = i.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_descontar_extra_venta
AFTER INSERT ON public.ventas_items_extras
FOR EACH ROW
EXECUTE FUNCTION public.fn_descontar_extra_venta();

-- Función: Sumar stock al registrar compra
CREATE OR REPLACE FUNCTION public.fn_sumar_stock_compra()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.insumos
    SET stock_actual = stock_actual + NEW.cantidad_base_total,
        costo_unitario_usd = (NEW.subtotal_usd / NULLIF(NEW.cantidad_base_total, 0)),
        actualizado_el = NOW()
    WHERE id = NEW.insumo_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sumar_stock_compra
AFTER INSERT ON public.compras_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_sumar_stock_compra();
