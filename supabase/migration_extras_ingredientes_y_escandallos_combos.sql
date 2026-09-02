-- ==============================================================================
-- MIGRACIÓN: ARQUITECTURA DE MULTI-INSUMO POR EXTRA + ESCANDALLOS DE COMBOS
-- La Parada del Sabor — Septiembre 2026
-- Objetivo: Descontar TODOS los ingredientes de la arepa elegida en cada combo
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. NUEVA TABLA: extras_ingredientes (multi-insumo por extra/arepa)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.extras_ingredientes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extra_id      UUID NOT NULL REFERENCES public.extras_modificadores(id) ON DELETE CASCADE,
  insumo_id     UUID NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  cantidad      NUMERIC(10, 4) NOT NULL CHECK (cantidad > 0),
  creado_el     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(extra_id, insumo_id)
);

CREATE INDEX IF NOT EXISTS idx_extras_ingredientes_extra_id  ON public.extras_ingredientes(extra_id);
CREATE INDEX IF NOT EXISTS idx_extras_ingredientes_insumo_id ON public.extras_ingredientes(insumo_id);

ALTER TABLE public.extras_ingredientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_extras_ingredientes" ON public.extras_ingredientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CREAR EXTRAS MODIFICADORES (uno por tipo de arepa, precio 0 — incluido en combo)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.extras_modificadores (nombre, precio_extra_usd, cantidad_descuento, activo)
VALUES
  ('Catira (Pollo Mechado + Queso Amarillo)',  0, 0, true),
  ('Pelúa (Carne Mechada + Queso Amarillo)',   0, 0, true),
  ('Jamón y Queso Amarillo',                   0, 0, true),
  ('Reina Pepiada (Aguacate + Pollo)',         0, 0, true),
  ('Especial de Pollo Esmechado (Gourmet)',    0, 0, true),
  ('Especial de Carne Esmechada (Gourmet)',    0, 0, true)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. INSERTAR INGREDIENTES POR AREPA EN extras_ingredientes
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  -- Extras
  v_ext_catira        UUID;
  v_ext_pelua         UUID;
  v_ext_jamon_queso   UUID;
  v_ext_reina         UUID;
  v_ext_esp_pollo     UUID;
  v_ext_esp_carne     UUID;
  -- Insumos
  v_ins_harina        UUID;
  v_ins_margarina     UUID;
  v_ins_guiso_pollo   UUID;
  v_ins_guiso_carne   UUID;
  v_ins_relleno_reina UUID;
  v_ins_jamon         UUID;
  v_ins_q_amarillo    UUID;
  v_ins_q_blanco      UUID;
  v_ins_tomate        UUID;
  v_ins_ceb_morada    UUID;
  v_ins_lechuga       UUID;
  v_ins_salsa_bigmac  UUID;
  v_ins_salsa_ajo     UUID;
  v_ins_perejil       UUID;
  v_ins_papel         UUID;
  v_ins_servilleta    UUID;
BEGIN
  -- Obtener IDs de extras
  SELECT id INTO v_ext_catira      FROM public.extras_modificadores WHERE nombre ILIKE '%Catira%' LIMIT 1;
  SELECT id INTO v_ext_pelua       FROM public.extras_modificadores WHERE nombre ILIKE '%Pelúa%' OR nombre ILIKE '%Pelua%' LIMIT 1;
  SELECT id INTO v_ext_jamon_queso FROM public.extras_modificadores WHERE nombre ILIKE '%Jamón%' LIMIT 1;
  SELECT id INTO v_ext_reina       FROM public.extras_modificadores WHERE nombre ILIKE '%Reina%' LIMIT 1;
  SELECT id INTO v_ext_esp_pollo   FROM public.extras_modificadores WHERE nombre ILIKE '%Especial%Pollo%' LIMIT 1;
  SELECT id INTO v_ext_esp_carne   FROM public.extras_modificadores WHERE nombre ILIKE '%Especial%Carne%' LIMIT 1;

  -- Obtener IDs de insumos
  SELECT id INTO v_ins_harina        FROM public.insumos WHERE nombre = 'Harina PAN' LIMIT 1;
  SELECT id INTO v_ins_margarina     FROM public.insumos WHERE nombre ILIKE '%Margarina Mavesa%' LIMIT 1;
  SELECT id INTO v_ins_guiso_pollo   FROM public.insumos WHERE nombre ILIKE '%Guiso de Pollo Mechado%' LIMIT 1;
  SELECT id INTO v_ins_guiso_carne   FROM public.insumos WHERE nombre ILIKE '%Guiso de Carne Mechada%' LIMIT 1;
  SELECT id INTO v_ins_relleno_reina FROM public.insumos WHERE nombre ILIKE '%Relleno Reina Pepiada%' LIMIT 1;
  SELECT id INTO v_ins_jamon         FROM public.insumos WHERE nombre ILIKE '%Pechuga de Pavo%' LIMIT 1;
  SELECT id INTO v_ins_q_amarillo    FROM public.insumos WHERE nombre = 'Queso Amarillo Rallado' LIMIT 1;
  SELECT id INTO v_ins_q_blanco      FROM public.insumos WHERE nombre = 'Queso Blanco de Res' LIMIT 1;
  SELECT id INTO v_ins_tomate        FROM public.insumos WHERE nombre ILIKE '%Tomate Perita%' LIMIT 1;
  SELECT id INTO v_ins_ceb_morada    FROM public.insumos WHERE nombre ILIKE '%Cebolla Morada%' LIMIT 1;
  SELECT id INTO v_ins_lechuga       FROM public.insumos WHERE nombre ILIKE '%Lechuga Americana%' LIMIT 1;
  SELECT id INTO v_ins_salsa_bigmac  FROM public.insumos WHERE nombre ILIKE '%Big Mac%' LIMIT 1;
  SELECT id INTO v_ins_salsa_ajo     FROM public.insumos WHERE nombre ILIKE '%Salsa de Ajo Criolla%' LIMIT 1;
  SELECT id INTO v_ins_perejil       FROM public.insumos WHERE nombre = 'Perejil Liso' LIMIT 1;
  SELECT id INTO v_ins_papel         FROM public.insumos WHERE nombre ILIKE '%Papel Antigraso%' LIMIT 1;
  SELECT id INTO v_ins_servilleta    FROM public.insumos WHERE nombre ILIKE '%Servilletas Europapel%' LIMIT 1;

  -- ── CATIRA (Pollo + Queso Amarillo) ──────────────────────────────────────
  INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES
    (v_ext_catira, v_ins_harina,      27.59),
    (v_ext_catira, v_ins_margarina,    5.00),
    (v_ext_catira, v_ins_guiso_pollo, 50.00),
    (v_ext_catira, v_ins_q_amarillo,  35.00),
    (v_ext_catira, v_ins_papel,        1.00),
    (v_ext_catira, v_ins_servilleta,   1.00)
  ON CONFLICT (extra_id, insumo_id) DO NOTHING;

  -- ── PELÚA (Carne + Queso Amarillo) ───────────────────────────────────────
  INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES
    (v_ext_pelua, v_ins_harina,      27.59),
    (v_ext_pelua, v_ins_margarina,    5.00),
    (v_ext_pelua, v_ins_guiso_carne, 50.00),
    (v_ext_pelua, v_ins_q_amarillo,  35.00),
    (v_ext_pelua, v_ins_papel,        1.00),
    (v_ext_pelua, v_ins_servilleta,   1.00)
  ON CONFLICT (extra_id, insumo_id) DO NOTHING;

  -- ── JAMÓN Y QUESO AMARILLO ───────────────────────────────────────────────
  INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES
    (v_ext_jamon_queso, v_ins_harina,     27.59),
    (v_ext_jamon_queso, v_ins_margarina,   5.00),
    (v_ext_jamon_queso, v_ins_jamon,      30.00),
    (v_ext_jamon_queso, v_ins_q_amarillo, 35.00),
    (v_ext_jamon_queso, v_ins_papel,       1.00),
    (v_ext_jamon_queso, v_ins_servilleta,  1.00)
  ON CONFLICT (extra_id, insumo_id) DO NOTHING;

  -- ── REINA PEPIADA ────────────────────────────────────────────────────────
  INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES
    (v_ext_reina, v_ins_harina,        27.59),
    (v_ext_reina, v_ins_margarina,      5.00),
    (v_ext_reina, v_ins_relleno_reina, 75.00),
    (v_ext_reina, v_ins_papel,          1.00),
    (v_ext_reina, v_ins_servilleta,     1.00)
  ON CONFLICT (extra_id, insumo_id) DO NOTHING;

  -- ── ESPECIAL DE POLLO ESMECHADO (Gourmet) ────────────────────────────────
  INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES
    (v_ext_esp_pollo, v_ins_harina,       27.59),
    (v_ext_esp_pollo, v_ins_margarina,     5.00),
    (v_ext_esp_pollo, v_ins_guiso_pollo,  50.00),
    (v_ext_esp_pollo, v_ins_jamon,        20.00),
    (v_ext_esp_pollo, v_ins_q_blanco,     40.00),
    (v_ext_esp_pollo, v_ins_tomate,       20.00),
    (v_ext_esp_pollo, v_ins_ceb_morada,   10.00),
    (v_ext_esp_pollo, v_ins_lechuga,      15.00),
    (v_ext_esp_pollo, v_ins_salsa_bigmac,  9.00),
    (v_ext_esp_pollo, v_ins_perejil,       9.00),
    (v_ext_esp_pollo, v_ins_servilleta,    2.00)
  ON CONFLICT (extra_id, insumo_id) DO NOTHING;

  -- ── ESPECIAL DE CARNE ESMECHADA (Gourmet) ────────────────────────────────
  INSERT INTO public.extras_ingredientes (extra_id, insumo_id, cantidad) VALUES
    (v_ext_esp_carne, v_ins_harina,       27.59),
    (v_ext_esp_carne, v_ins_margarina,     5.00),
    (v_ext_esp_carne, v_ins_guiso_carne,  50.00),
    (v_ext_esp_carne, v_ins_jamon,        20.00),
    (v_ext_esp_carne, v_ins_q_blanco,     40.00),
    (v_ext_esp_carne, v_ins_tomate,       20.00),
    (v_ext_esp_carne, v_ins_ceb_morada,   10.00),
    (v_ext_esp_carne, v_ins_lechuga,      15.00),
    (v_ext_esp_carne, v_ins_salsa_bigmac,  9.00),
    (v_ext_esp_carne, v_ins_salsa_ajo,     9.00),
    (v_ext_esp_carne, v_ins_servilleta,    2.00)
  ON CONFLICT (extra_id, insumo_id) DO NOTHING;

END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ACTUALIZAR recetas_ingredientes DE COMBOS
--    Eliminar papel y servilletas del combo base (ahora vienen de extras por arepa)
--    Se conserva: Bolsa/Caja contenedora del combo completo
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_prod_antojo    UUID;
  v_prod_duo       UUID;
  v_prod_familiar  UUID;
  v_ins_papel      UUID;
  v_ins_servilleta UUID;
BEGIN
  SELECT id INTO v_prod_antojo    FROM public.productos WHERE nombre ILIKE '%Antojo%' LIMIT 1;
  SELECT id INTO v_prod_duo       FROM public.productos WHERE nombre ILIKE '%Dúo%' OR nombre ILIKE '%Duo%' LIMIT 1;
  SELECT id INTO v_prod_familiar  FROM public.productos WHERE nombre ILIKE '%Familiar%' LIMIT 1;
  SELECT id INTO v_ins_papel      FROM public.insumos   WHERE nombre ILIKE '%Papel Antigraso%' LIMIT 1;
  SELECT id INTO v_ins_servilleta FROM public.insumos   WHERE nombre ILIKE '%Servilletas Europapel%' LIMIT 1;

  DELETE FROM public.recetas_ingredientes
  WHERE producto_id IN (v_prod_antojo, v_prod_duo, v_prod_familiar)
    AND insumo_id IN (v_ins_papel, v_ins_servilleta);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ACTUALIZAR TRIGGER: fn_descontar_extra_venta (multi-insumo)
-- ─────────────────────────────────────────────────────────────────────────────
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
    -- Método A: insumo único (retrocompatible)
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual - (e.cantidad_descuento * NEW.cantidad),
        actualizado_el = NOW()
    FROM public.extras_modificadores e
    WHERE e.id               = NEW.extra_id
      AND e.insumo_id        = i.id
      AND e.cantidad_descuento > 0;

    -- Método B: multi-insumo via extras_ingredientes
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual - (ei.cantidad * NEW.cantidad),
        actualizado_el = NOW()
    FROM public.extras_ingredientes ei
    WHERE ei.extra_id  = NEW.extra_id
      AND ei.insumo_id = i.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ACTUALIZAR TRIGGER DE RECONCILIACIÓN (cancelaciones)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_reconciliar_cambio_estado_venta()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado != 'cancelada' AND NEW.estado = 'cancelada' THEN
    -- Devolver recetas
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual + sub.total_devuelto,
        actualizado_el = NOW()
    FROM (
      SELECT r.insumo_id, SUM(r.cantidad * vi.cantidad) AS total_devuelto
      FROM public.ventas_items vi
      JOIN public.recetas_ingredientes r ON r.producto_id = vi.producto_id
      WHERE vi.venta_id = NEW.id GROUP BY r.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

    -- Devolver extras método A
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual + sub.total_devuelto,
        actualizado_el = NOW()
    FROM (
      SELECT e.insumo_id, SUM(e.cantidad_descuento * vie.cantidad) AS total_devuelto
      FROM public.ventas_items vi
      JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
      JOIN public.extras_modificadores e ON e.id = vie.extra_id
      WHERE vi.venta_id = NEW.id AND e.insumo_id IS NOT NULL AND e.cantidad_descuento > 0
      GROUP BY e.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

    -- Devolver extras método B (multi-insumo)
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual + sub.total_devuelto,
        actualizado_el = NOW()
    FROM (
      SELECT ei.insumo_id, SUM(ei.cantidad * vie.cantidad) AS total_devuelto
      FROM public.ventas_items vi
      JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
      JOIN public.extras_ingredientes ei  ON ei.extra_id = vie.extra_id
      WHERE vi.venta_id = NEW.id GROUP BY ei.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

  ELSIF OLD.estado = 'cancelada' AND NEW.estado != 'cancelada' THEN
    -- Volver a descontar recetas
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual - sub.total_descontar,
        actualizado_el = NOW()
    FROM (
      SELECT r.insumo_id, SUM(r.cantidad * vi.cantidad) AS total_descontar
      FROM public.ventas_items vi
      JOIN public.recetas_ingredientes r ON r.producto_id = vi.producto_id
      WHERE vi.venta_id = NEW.id GROUP BY r.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

    -- Volver a descontar extras A
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual - sub.total_descontar,
        actualizado_el = NOW()
    FROM (
      SELECT e.insumo_id, SUM(e.cantidad_descuento * vie.cantidad) AS total_descontar
      FROM public.ventas_items vi
      JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
      JOIN public.extras_modificadores e ON e.id = vie.extra_id
      WHERE vi.venta_id = NEW.id AND e.insumo_id IS NOT NULL AND e.cantidad_descuento > 0
      GROUP BY e.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

    -- Volver a descontar extras B (multi-insumo)
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual - sub.total_descontar,
        actualizado_el = NOW()
    FROM (
      SELECT ei.insumo_id, SUM(ei.cantidad * vie.cantidad) AS total_descontar
      FROM public.ventas_items vi
      JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
      JOIN public.extras_ingredientes ei  ON ei.extra_id = vie.extra_id
      WHERE vi.venta_id = NEW.id GROUP BY ei.insumo_id
    ) sub WHERE i.id = sub.insumo_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. GRANTS
-- ─────────────────────────────────────────────────────────────────────────────
GRANT SELECT ON public.extras_ingredientes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.extras_ingredientes TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL — debe mostrar 6 extras con sus ingredientes
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  em.nombre AS extra,
  COUNT(ei.id) AS num_ingredientes,
  STRING_AGG(i.nombre || ' (' || ei.cantidad || ' ' || i.unidad_medida || ')', ', ' ORDER BY i.nombre) AS ingredientes
FROM public.extras_modificadores em
LEFT JOIN public.extras_ingredientes ei ON ei.extra_id = em.id
LEFT JOIN public.insumos i ON i.id = ei.insumo_id
GROUP BY em.nombre
ORDER BY num_ingredientes DESC;
