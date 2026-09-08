-- ==============================================================================
-- MIGRACIÓN: BLINDAJE DE TRIGGERS CONTRA DOBLE DESCUENTO EN EXTRAS Y RECETAS
-- ==============================================================================
-- 1. Alinea el ciclo de vida de recetas y extras: 'pendiente' nunca descuenta hasta confirmar.
-- 2. Garantiza exclusividad mutua: si un extra existe en extras_ingredientes, usa Método B
--    y nunca Método A.
-- 3. Previene stock fantasma: cancelar ventas 'pendiente' (rechazadas) no devuelve stock inexistente.
-- 4. Reconciliación bidireccional exacta para cancelaciones y reactivaciones.
-- 5. Saneamiento compensatorio acotado estrictamente a ventas confirmadas ('preparando','lista','completada').
-- ==============================================================================

-- 1. FUNCIÓN Y TRIGGER: fn_descontar_receta_venta (M1)
CREATE OR REPLACE FUNCTION public.fn_descontar_receta_venta()
RETURNS TRIGGER AS $$
DECLARE
  v_estado VARCHAR(30);
BEGIN
  SELECT estado INTO v_estado FROM public.ventas WHERE id = NEW.venta_id;

  -- Solo descuenta stock cuando la venta está confirmada (no cuando es 'pendiente' ni 'cancelada')
  IF v_estado NOT IN ('pendiente', 'cancelada') THEN
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual - (r.cantidad * NEW.cantidad),
        actualizado_el = NOW()
    FROM public.recetas_ingredientes r
    WHERE r.insumo_id   = i.id
      AND r.producto_id = NEW.producto_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_descontar_receta_venta ON public.ventas_items;
CREATE TRIGGER trg_descontar_receta_venta
AFTER INSERT ON public.ventas_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_descontar_receta_venta();


-- 2. FUNCIÓN Y TRIGGER PRINCIPAL DE EXTRAS: fn_descontar_extra_venta
CREATE OR REPLACE FUNCTION public.fn_descontar_extra_venta()
RETURNS TRIGGER AS $$
DECLARE
  v_estado VARCHAR(30);
BEGIN
  SELECT v.estado INTO v_estado
  FROM public.ventas_items vi
  JOIN public.ventas v ON v.id = vi.venta_id
  WHERE vi.id = NEW.venta_item_id;

  -- Solo descuenta si no es 'pendiente' ni 'cancelada'
  IF v_estado NOT IN ('pendiente', 'cancelada') THEN
    -- Si el extra tiene componentes definidos en extras_ingredientes, usar Método B exclusivamente
    IF EXISTS (SELECT 1 FROM public.extras_ingredientes WHERE extra_id = NEW.extra_id) THEN
      UPDATE public.insumos i
      SET stock_actual   = i.stock_actual - (ei.cantidad * NEW.cantidad),
          actualizado_el = NOW()
      FROM public.extras_ingredientes ei
      WHERE ei.extra_id  = NEW.extra_id
        AND ei.insumo_id = i.id;
    ELSE
      -- Si no tiene desglose en extras_ingredientes, usar Método A directo
      UPDATE public.insumos i
      SET stock_actual   = i.stock_actual - (e.cantidad_descuento * NEW.cantidad),
          actualizado_el = NOW()
      FROM public.extras_modificadores e
      WHERE e.id               = NEW.extra_id
        AND e.insumo_id        = i.id
        AND e.insumo_id        IS NOT NULL
        AND e.cantidad_descuento > 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_descontar_extra_venta ON public.ventas_items_extras;
CREATE TRIGGER trg_descontar_extra_venta
AFTER INSERT ON public.ventas_items_extras
FOR EACH ROW
EXECUTE FUNCTION public.fn_descontar_extra_venta();


-- 3. FUNCIÓN Y TRIGGER PARA CONFIRMAR PEDIDOS WEB: fn_confirmar_pedido_web
CREATE OR REPLACE FUNCTION public.fn_confirmar_pedido_web()
RETURNS TRIGGER AS $$
BEGIN
  -- Si pasa de 'pendiente' a confirmada ('preparando', 'lista' o 'completada'), descontar insumos de recetas y extras
  IF OLD.estado = 'pendiente' AND NEW.estado IN ('preparando', 'lista', 'completada') THEN
    -- Descontar recetas base
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual - sub.total_descontar,
        actualizado_el = NOW()
    FROM (
      SELECT r.insumo_id, SUM(r.cantidad * vi.cantidad) AS total_descontar
      FROM public.ventas_items vi
      JOIN public.recetas_ingredientes r ON r.producto_id = vi.producto_id
      WHERE vi.venta_id = NEW.id
      GROUP BY r.insumo_id
    ) sub
    WHERE i.id = sub.insumo_id;

    -- Descontar extras Método A (excluyendo extras que tengan desglose en extras_ingredientes)
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual - sub_ext.total_extra,
        actualizado_el = NOW()
    FROM (
      SELECT e.insumo_id, SUM(e.cantidad_descuento * vie.cantidad) AS total_extra
      FROM public.ventas_items vi
      JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
      JOIN public.extras_modificadores e ON e.id = vie.extra_id
      WHERE vi.venta_id = NEW.id
        AND e.insumo_id IS NOT NULL
        AND e.cantidad_descuento > 0
        AND NOT EXISTS (SELECT 1 FROM public.extras_ingredientes ei WHERE ei.extra_id = e.id)
      GROUP BY e.insumo_id
    ) sub_ext
    WHERE i.id = sub_ext.insumo_id;

    -- Descontar extras Método B (multi-insumo desde extras_ingredientes)
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual - sub_ei.total_extra,
        actualizado_el = NOW()
    FROM (
      SELECT ei.insumo_id, SUM(ei.cantidad * vie.cantidad) AS total_extra
      FROM public.ventas_items vi
      JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
      JOIN public.extras_ingredientes ei  ON ei.extra_id = vie.extra_id
      WHERE vi.venta_id = NEW.id
      GROUP BY ei.insumo_id
    ) sub_ei
    WHERE i.id = sub_ei.insumo_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_confirmar_pedido_web ON public.ventas;
CREATE TRIGGER trg_confirmar_pedido_web
AFTER UPDATE OF estado ON public.ventas
FOR EACH ROW
EXECUTE FUNCTION public.fn_confirmar_pedido_web();


-- 4. FUNCIÓN Y TRIGGER DE RECONCILIACIÓN EN CANCELACIONES / REACTIVACIONES (G1: sin stock fantasma)
CREATE OR REPLACE FUNCTION public.fn_reconciliar_cambio_estado_venta()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Cancelación: SOLO devuelve stock si la venta había sido confirmada previamente.
  -- Si pasa de 'pendiente' a 'cancelada' (ej. pedido web rechazado), NO se devuelve stock
  -- porque el inventario nunca fue descontado en estado 'pendiente'.
  IF OLD.estado IN ('preparando', 'lista', 'completada') AND NEW.estado = 'cancelada' THEN
    -- Devolver recetas base
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual + sub.total_devuelto,
        actualizado_el = NOW()
    FROM (
      SELECT r.insumo_id, SUM(r.cantidad * vi.cantidad) AS total_devuelto
      FROM public.ventas_items vi
      JOIN public.recetas_ingredientes r ON r.producto_id = vi.producto_id
      WHERE vi.venta_id = NEW.id GROUP BY r.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

    -- Devolver extras Método A (solo si NO tiene registros en extras_ingredientes)
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual + sub.total_devuelto,
        actualizado_el = NOW()
    FROM (
      SELECT e.insumo_id, SUM(e.cantidad_descuento * vie.cantidad) AS total_devuelto
      FROM public.ventas_items vi
      JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
      JOIN public.extras_modificadores e ON e.id = vie.extra_id
      WHERE vi.venta_id = NEW.id
        AND e.insumo_id IS NOT NULL
        AND e.cantidad_descuento > 0
        AND NOT EXISTS (SELECT 1 FROM public.extras_ingredientes ei WHERE ei.extra_id = e.id)
      GROUP BY e.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

    -- Devolver extras Método B (multi-insumo)
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

  -- 2. Reactivación: Si pasa de 'cancelada' a confirmada ('preparando', 'lista', 'completada'), volver a descontar
  ELSIF OLD.estado = 'cancelada' AND NEW.estado IN ('preparando', 'lista', 'completada') THEN
    -- Volver a descontar recetas base
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual - sub.total_descontar,
        actualizado_el = NOW()
    FROM (
      SELECT r.insumo_id, SUM(r.cantidad * vi.cantidad) AS total_descontar
      FROM public.ventas_items vi
      JOIN public.recetas_ingredientes r ON r.producto_id = vi.producto_id
      WHERE vi.venta_id = NEW.id GROUP BY r.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

    -- Volver a descontar extras Método A (solo si NO tiene registros en extras_ingredientes)
    UPDATE public.insumos i
    SET stock_actual   = i.stock_actual - sub.total_descontar,
        actualizado_el = NOW()
    FROM (
      SELECT e.insumo_id, SUM(e.cantidad_descuento * vie.cantidad) AS total_descontar
      FROM public.ventas_items vi
      JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
      JOIN public.extras_modificadores e ON e.id = vie.extra_id
      WHERE vi.venta_id = NEW.id
        AND e.insumo_id IS NOT NULL
        AND e.cantidad_descuento > 0
        AND NOT EXISTS (SELECT 1 FROM public.extras_ingredientes ei WHERE ei.extra_id = e.id)
      GROUP BY e.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

    -- Volver a descontar extras Método B (multi-insumo)
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_reconciliar_cambio_estado_venta ON public.ventas;
CREATE TRIGGER trg_reconciliar_cambio_estado_venta
AFTER UPDATE OF estado ON public.ventas
FOR EACH ROW
EXECUTE FUNCTION public.fn_reconciliar_cambio_estado_venta();


-- 5. SANEAMIENTO HISTÓRICO COMPENSATORIO (H-6e / G2: solo ventas confirmadas)
-- Devuelve a los insumos el stock descontado de más por Método A en ventas confirmadas
-- donde el extra ya contaba con desglose multi-insumo en extras_ingredientes.
UPDATE public.insumos i
SET stock_actual   = i.stock_actual + sub.total_duplicado,
    actualizado_el = NOW()
FROM (
  SELECT e.insumo_id, SUM(e.cantidad_descuento * vie.cantidad) AS total_duplicado
  FROM public.ventas_items_extras vie
  JOIN public.ventas_items vi ON vi.id = vie.venta_item_id
  JOIN public.ventas v ON v.id = vi.venta_id
  JOIN public.extras_modificadores e ON e.id = vie.extra_id
  WHERE v.estado IN ('preparando', 'lista', 'completada')
    AND e.insumo_id IS NOT NULL
    AND e.cantidad_descuento > 0
    AND EXISTS (SELECT 1 FROM public.extras_ingredientes ei WHERE ei.extra_id = e.id)
  GROUP BY e.insumo_id
) sub
WHERE i.id = sub.insumo_id;
