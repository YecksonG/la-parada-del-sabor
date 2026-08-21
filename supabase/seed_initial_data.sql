-- ==============================================================================
-- SEMILLERO 100% VALIDADO: LA PARADA DEL SABOR
-- ==============================================================================

-- 1. CATEGORÍAS
INSERT INTO public.categorias (nombre, icono, orden)
VALUES
  ('Arepas Rellenas', '🫓', 1),
  ('Empanadas', '🥟', 2),
  ('Bebidas & Jugos', '🥤', 3),
  ('Raciones & Extras', '🧀', 4)
ON CONFLICT (nombre) DO NOTHING;

-- 2. INSUMOS
INSERT INTO public.insumos
  (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo)
VALUES
  ('Masa de Maíz / Harina', 'g', 60000, 5000, 0.0018, 'Masas'),
  ('Carne Mechada Guisada', 'g', 20000, 2500, 0.0075, 'Carnes'),
  ('Pollo Desmechado', 'g', 18000, 2000, 0.0055, 'Carnes'),
  ('Queso Amarillo Rallado', 'g', 15000, 2000, 0.0085, 'Lácteos'),
  ('Queso Blanco Llanero', 'g', 15000, 2000, 0.0060, 'Lácteos'),
  ('Queso Guayanés / Telita', 'g', 10000, 1500, 0.0090, 'Lácteos'),
  ('Aguacate Fresco', 'g', 12000, 1500, 0.0035, 'Vegetales'),
  ('Mayonesa Casera', 'g', 8000, 1000, 0.0030, 'Salsas'),
  ('Tocineta Crocante', 'g', 6000, 800, 0.0120, 'Carnes'),
  ('Caraotas Negras Refritas', 'g', 10000, 1500, 0.0030, 'Vegetales'),
  ('Papel Envoltorio / Servilleta', 'und', 1000, 200, 0.0200, 'Empaque'),
  ('Vaso Desechable 16oz', 'und', 500, 100, 0.0500, 'Empaque'),
  ('Malta Polar 355ml', 'und', 120, 24, 0.9000, 'Bebidas')
ON CONFLICT (nombre) DO NOTHING;

-- 3. PRODUCTOS
INSERT INTO public.productos
  (nombre, categoria_id, descripcion, precio_usd, icono, popular)
VALUES
  (
    'Arepa Pelúa',
    (SELECT id FROM public.categorias WHERE nombre = 'Arepas Rellenas'),
    'Carne mechada jugosa con abundante queso amarillo',
    3.5,
    '🫓',
    true
  ),
  (
    'Arepa Catira',
    (SELECT id FROM public.categorias WHERE nombre = 'Arepas Rellenas'),
    'Pollo tierno desmechado con queso amarillo',
    3.5,
    '🫓',
    false
  ),
  (
    'Arepa Reina Pepiada',
    (SELECT id FROM public.categorias WHERE nombre = 'Arepas Rellenas'),
    'Pollo desmechado, aguacate cremoso y mayonesa',
    4.0,
    '🫓',
    true
  ),
  (
    'Arepa Sifrina',
    (SELECT id FROM public.categorias WHERE nombre = 'Arepas Rellenas'),
    'Reina Pepiada coronada con queso amarillo',
    4.5,
    '🫓',
    true
  ),
  (
    'Arepa Pabellón',
    (SELECT id FROM public.categorias WHERE nombre = 'Arepas Rellenas'),
    'Carne mechada, caraotas negras y queso blanco',
    4.5,
    '🫓',
    false
  ),
  (
    'Empanada Operada de Carne',
    (SELECT id FROM public.categorias WHERE nombre = 'Empanadas'),
    'Crujiente empanada con queso amarillo',
    2.0,
    '🥟',
    true
  ),
  (
    'Empanada de Queso Blanco',
    (SELECT id FROM public.categorias WHERE nombre = 'Empanadas'),
    'Empanada con queso blanco llanero',
    1.5,
    '🥟',
    false
  ),
  (
    'Jugo Natural de Parchita 16oz',
    (SELECT id FROM public.categorias WHERE nombre = 'Bebidas & Jugos'),
    'Jugo natural fresco bien frío',
    1.8,
    '🥤',
    false
  ),
  (
    'Malta Polar Fría',
    (SELECT id FROM public.categorias WHERE nombre = 'Bebidas & Jugos'),
    'Botella servida en vaso con hielo',
    1.5,
    '🥤',
    true
  )
ON CONFLICT (nombre) DO NOTHING;

-- 4. RECETAS (FÓRMULAS EN GRAMOS)
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
VALUES
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Pelúa'),
    (SELECT id FROM public.insumos WHERE nombre = 'Masa de Maíz / Harina'),
    160
  ),
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Pelúa'),
    (SELECT id FROM public.insumos WHERE nombre = 'Carne Mechada Guisada'),
    90
  ),
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Pelúa'),
    (SELECT id FROM public.insumos WHERE nombre = 'Queso Amarillo Rallado'),
    50
  ),
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Pelúa'),
    (SELECT id FROM public.insumos WHERE nombre = 'Papel Envoltorio / Servilleta'),
    1
  ),
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Catira'),
    (SELECT id FROM public.insumos WHERE nombre = 'Masa de Maíz / Harina'),
    160
  ),
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Catira'),
    (SELECT id FROM public.insumos WHERE nombre = 'Pollo Desmechado'),
    90
  ),
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Catira'),
    (SELECT id FROM public.insumos WHERE nombre = 'Queso Amarillo Rallado'),
    50
  ),
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Catira'),
    (SELECT id FROM public.insumos WHERE nombre = 'Papel Envoltorio / Servilleta'),
    1
  ),
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Reina Pepiada'),
    (SELECT id FROM public.insumos WHERE nombre = 'Masa de Maíz / Harina'),
    160
  ),
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Reina Pepiada'),
    (SELECT id FROM public.insumos WHERE nombre = 'Pollo Desmechado'),
    80
  ),
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Reina Pepiada'),
    (SELECT id FROM public.insumos WHERE nombre = 'Aguacate Fresco'),
    45
  ),
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Reina Pepiada'),
    (SELECT id FROM public.insumos WHERE nombre = 'Mayonesa Casera'),
    25
  ),
  (
    (SELECT id FROM public.productos WHERE nombre = 'Arepa Reina Pepiada'),
    (SELECT id FROM public.insumos WHERE nombre = 'Papel Envoltorio / Servilleta'),
    1
  )
ON CONFLICT (producto_id, insumo_id) DO NOTHING;

-- 5. EXTRAS / MODIFICADORES
INSERT INTO public.extras_modificadores
  (nombre, insumo_id, cantidad_descuento, precio_extra_usd)
VALUES
  (
    '+ Extra Queso Amarillo',
    (SELECT id FROM public.insumos WHERE nombre = 'Queso Amarillo Rallado'),
    40,
    0.8
  ),
  (
    '+ Extra Queso Guayanés',
    (SELECT id FROM public.insumos WHERE nombre = 'Queso Guayanés / Telita'),
    40,
    0.9
  ),
  (
    '+ Extra Aguacate',
    (SELECT id FROM public.insumos WHERE nombre = 'Aguacate Fresco'),
    40,
    0.8
  ),
  (
    '+ Extra Tocineta Crocante',
    (SELECT id FROM public.insumos WHERE nombre = 'Tocineta Crocante'),
    30,
    1.0
  ),
  (
    '+ Extra Carne Mechada',
    (SELECT id FROM public.insumos WHERE nombre = 'Carne Mechada Guisada'),
    50,
    1.2
  ),
  (
    '+ Extra Pollo Desmechado',
    (SELECT id FROM public.insumos WHERE nombre = 'Pollo Desmechado'),
    50,
    1.0
  )
ON CONFLICT (nombre) DO NOTHING;

-- 6. TASA BCV
INSERT INTO public.tasas_cambio (fecha, bcv_usd_bs, tasa_usd_bs, cop_usd)
VALUES (CURRENT_DATE, 65.50, 65.50, 4100);
