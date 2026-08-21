-- ==============================================================================
-- SEMILLERO INICIAL DE DATOS: LA PARADA DEL SABOR
-- Categorías, Insumos en gramos, Platos con recetas (BOM) y Modificadores
-- ==============================================================================

-- 1. CATEGORÍAS
INSERT INTO public.categorias (id, nombre, icono, orden)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'Arepas Rellenas', '🫓', 1),
    ('c2222222-2222-2222-2222-222222222222', 'Empanadas', '🥟', 2),
    ('c3333333-3333-3333-3333-333333333333', 'Bebidas & Jugos', '🥤', 3),
    ('c4444444-4444-4444-4444-444444444444', 'Raciones & Extras', '🧀', 4)
ON CONFLICT (nombre) DO UPDATE SET icono = EXCLUDED.icono;

-- 2. INSUMOS DE MATERIA PRIMA (EN GRAMOS, ML Y UNIDADES)
INSERT INTO public.insumos (id, nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo)
VALUES
    ('i1111111-1111-1111-1111-111111111111', 'Masa de Maíz / Harina', 'g', 60000, 5000, 0.0018, 'Masas'),
    ('i2222222-2222-2222-2222-222222222222', 'Carne Mechada Guisada', 'g', 20000, 2500, 0.0075, 'Carnes'),
    ('i3333333-3333-3333-3333-333333333333', 'Pollo Desmechado', 'g', 18000, 2000, 0.0055, 'Carnes'),
    ('i4444444-4444-4444-4444-444444444444', 'Queso Amarillo Rallado', 'g', 15000, 2000, 0.0085, 'Lácteos'),
    ('i5555555-5555-5555-5555-555555555555', 'Queso Blanco Llanero', 'g', 15000, 2000, 0.0060, 'Lácteos'),
    ('i6666666-6666-6666-6666-666666666666', 'Queso Guayanés / Telita', 'g', 10000, 1500, 0.0090, 'Lácteos'),
    ('i7777777-7777-7777-7777-777777777777', 'Aguacate Fresco', 'g', 12000, 1500, 0.0035, 'Vegetales'),
    ('i8888888-8888-8888-8888-888888888888', 'Mayonesa Casera', 'g', 8000, 1000, 0.0030, 'Salsas'),
    ('i9999999-9999-9999-9999-999999999999', 'Tocineta Crocante', 'g', 6000, 800, 0.0120, 'Carnes'),
    ('iaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Caraotas Negras Refritas', 'g', 10000, 1500, 0.0030, 'Vegetales'),
    ('ibbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Papel Envoltorio / Servilleta', 'und', 1000, 200, 0.0200, 'Empaque'),
    ('iccccccc-cccc-cccc-cccc-cccccccccccc', 'Vaso Desechable 16oz', 'und', 500, 100, 0.0500, 'Empaque'),
    ('iddddddd-dddd-dddd-dddd-dddddddddddd', 'Malta Polar 355ml', 'und', 120, 24, 0.9000, 'Bebidas')
ON CONFLICT (nombre) DO NOTHING;

-- 3. PRODUCTOS DEL MENÚ (PLATOS TERMINADOS)
INSERT INTO public.productos (id, nombre, categoria_id, descripcion, precio_usd, icono, popular)
VALUES
    ('p1111111-1111-1111-1111-111111111111', 'Arepa Pelúa', 'c1111111-1111-1111-1111-111111111111', 'Carne mechada jugosa con abundante queso amarillo rallado', 3.50, '🫓', true),
    ('p2222222-2222-2222-2222-222222222222', 'Arepa Catira', 'c1111111-1111-1111-1111-111111111111', 'Pollo tierno desmechado con queso amarillo rallado', 3.50, '🫓', false),
    ('p3333333-3333-3333-3333-333333333333', 'Arepa Reina Pepiada', 'c1111111-1111-1111-1111-111111111111', 'Nuestra clásica mezcla de pollo desmechado, aguacate cremoso y mayonesa', 4.00, '🫓', true),
    ('p4444444-4444-4444-4444-444444444444', 'Arepa Sifrina', 'c1111111-1111-1111-1111-111111111111', 'Reina Pepiada coronada con queso amarillo rallado', 4.50, '🫓', true),
    ('p5555555-5555-5555-5555-555555555555', 'Arepa Pabellón', 'c1111111-1111-1111-1111-111111111111', 'Carne mechada, caraotas negras y queso blanco rallado', 4.50, '🫓', false),
    ('p6666666-6666-6666-6666-666666666666', 'Empanada Operada de Carne', 'c2222222-2222-2222-2222-222222222222', 'Crujiente empanada de carne abierta y rellena de queso amarillo', 2.00, '🥟', true),
    ('p7777777-7777-7777-7777-777777777777', 'Empanada de Queso Blanco', 'c2222222-2222-2222-2222-222222222222', 'Empanada rellena de abundante queso blanco llanero', 1.50, '🥟', false),
    ('p8888888-8888-8888-8888-888888888888', 'Jugo Natural de Parchita 16oz', 'c3333333-3333-3333-3333-333333333333', 'Jugo natural de fruta fresca bien frío', 1.80, '🥤', false),
    ('p9999999-9999-9999-9999-999999999999', 'Malta Polar Fría', 'c3333333-3333-3333-3333-333333333333', 'Botella de malta polar servida en vaso con hielo', 1.50, '🥤', true)
ON CONFLICT (nombre) DO NOTHING;

-- 4. RECETAS / ESCANDALLO (GRAMOS EXACTOS POR PLATO)
-- Arepa Pelúa
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
VALUES
    ('p1111111-1111-1111-1111-111111111111', 'i1111111-1111-1111-1111-111111111111', 160), -- Masa
    ('p1111111-1111-1111-1111-111111111111', 'i2222222-2222-2222-2222-222222222222', 90),  -- Carne
    ('p1111111-1111-1111-1111-111111111111', 'i4444444-4444-4444-4444-444444444444', 50),  -- Queso amarillo
    ('p1111111-1111-1111-1111-111111111111', 'ibbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1)    -- Envoltorio
ON CONFLICT DO NOTHING;

-- Arepa Catira
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
VALUES
    ('p2222222-2222-2222-2222-222222222222', 'i1111111-1111-1111-1111-111111111111', 160), -- Masa
    ('p2222222-2222-2222-2222-222222222222', 'i3333333-3333-3333-3333-333333333333', 90),  -- Pollo
    ('p2222222-2222-2222-2222-222222222222', 'i4444444-4444-4444-4444-444444444444', 50),  -- Queso amarillo
    ('p2222222-2222-2222-2222-222222222222', 'ibbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1)
ON CONFLICT DO NOTHING;

-- Arepa Reina Pepiada
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
VALUES
    ('p3333333-3333-3333-3333-333333333333', 'i1111111-1111-1111-1111-111111111111', 160), -- Masa
    ('p3333333-3333-3333-3333-333333333333', 'i3333333-3333-3333-3333-333333333333', 80),  -- Pollo
    ('p3333333-3333-3333-3333-333333333333', 'i7777777-7777-7777-7777-777777777777', 45),  -- Aguacate
    ('p3333333-3333-3333-3333-333333333333', 'i8888888-8888-8888-8888-888888888888', 25),  -- Mayonesa
    ('p3333333-3333-3333-3333-333333333333', 'ibbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1)
ON CONFLICT DO NOTHING;

-- Arepa Sifrina
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
VALUES
    ('p4444444-4444-4444-4444-444444444444', 'i1111111-1111-1111-1111-111111111111', 160),
    ('p4444444-4444-4444-4444-444444444444', 'i3333333-3333-3333-3333-333333333333', 80),
    ('p4444444-4444-4444-4444-444444444444', 'i7777777-7777-7777-7777-777777777777', 45),
    ('p4444444-4444-4444-4444-444444444444', 'i8888888-8888-8888-8888-888888888888', 25),
    ('p4444444-4444-4444-4444-444444444444', 'i4444444-4444-4444-4444-444444444444', 40),
    ('p4444444-4444-4444-4444-444444444444', 'ibbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1)
ON CONFLICT DO NOTHING;

-- Arepa Pabellón
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
VALUES
    ('p5555555-5555-5555-5555-555555555555', 'i1111111-1111-1111-1111-111111111111', 160),
    ('p5555555-5555-5555-5555-555555555555', 'i2222222-2222-2222-2222-222222222222', 80),
    ('p5555555-5555-5555-5555-555555555555', 'iaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 60),
    ('p5555555-5555-5555-5555-555555555555', 'i5555555-5555-5555-5555-555555555555', 40),
    ('p5555555-5555-5555-5555-555555555555', 'ibbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1)
ON CONFLICT DO NOTHING;

-- 5. EXTRAS / MODIFICADORES (+Queso, +Aguacate, etc.)
INSERT INTO public.extras_modificadores (id, nombre, insumo_id, cantidad_descuento, precio_extra_usd)
VALUES
    ('e1111111-1111-1111-1111-111111111111', '+ Extra Queso Amarillo', 'i4444444-4444-4444-4444-444444444444', 40, 0.80),
    ('e2222222-2222-2222-2222-222222222222', '+ Extra Queso Guayanés', 'i6666666-6666-6666-6666-666666666666', 40, 0.90),
    ('e3333333-3333-3333-3333-333333333333', '+ Extra Aguacate', 'i7777777-7777-7777-7777-777777777777', 40, 0.80),
    ('e4444444-4444-4444-4444-444444444444', '+ Extra Tocineta Crocante', 'i9999999-9999-9999-9999-999999999999', 30, 1.00),
    ('e5555555-5555-5555-5555-555555555555', '+ Extra Carne Mechada', 'i2222222-2222-2222-2222-222222222222', 50, 1.20),
    ('e6666666-6666-6666-6666-666666666666', '+ Extra Pollo Desmechado', 'i3333333-3333-3333-3333-333333333333', 50, 1.00)
ON CONFLICT (nombre) DO NOTHING;

-- 6. TASA BCV INICIAL
INSERT INTO public.tasas_cambio (fecha, bcv_usd_bs, tasa_usd_bs, cop_usd)
VALUES (CURRENT_DATE, 65.50, 65.50, 4100)
ON CONFLICT DO NOTHING;
