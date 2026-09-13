-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- Actualización de Trigger de Reconciliación de Stock + Eliminación de Comanda #74
-- ==============================================================================

-- 1. Asegurar que la función de reconciliación de stock devuelva inventario para estados que realmente descontaron (excluye 'pendiente')
CREATE OR REPLACE FUNCTION public.fn_reconciliar_cambio_estado_venta()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Cancelación: devuelve stock si la venta descontó stock (preparando, lista, completada, credito)
  -- NOTA CRÍTICA: NO incluir 'pendiente' ya que los pedidos de la web en pendiente NUNCA descuentan stock inicial
  IF OLD.estado IN ('preparando', 'lista', 'completada', 'credito') AND NEW.estado = 'cancelada' THEN
    UPDATE public.insumos i
    SET stock_actual = i.stock_actual + sub.total_devuelto, actualizado_el = NOW()
    FROM (
      SELECT r.insumo_id, SUM(r.cantidad * vi.cantidad) AS total_devuelto
      FROM public.ventas_items vi
      JOIN public.recetas_ingredientes r ON r.producto_id = vi.producto_id
      WHERE vi.venta_id = NEW.id GROUP BY r.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

    UPDATE public.insumos i
    SET stock_actual = i.stock_actual + sub.total_devuelto, actualizado_el = NOW()
    FROM (
      SELECT e.insumo_id, SUM(e.cantidad_descuento * vie.cantidad) AS total_devuelto
      FROM public.ventas_items vi
      JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
      JOIN public.extras_modificadores e ON e.id = vie.extra_id
      WHERE vi.venta_id = NEW.id AND e.insumo_id IS NOT NULL AND e.cantidad_descuento > 0
        AND NOT EXISTS (SELECT 1 FROM public.extras_ingredientes ei WHERE ei.extra_id = e.id)
      GROUP BY e.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

    UPDATE public.insumos i
    SET stock_actual = i.stock_actual + sub.total_devuelto, actualizado_el = NOW()
    FROM (
      SELECT ei.insumo_id, SUM(ei.cantidad * vie.cantidad) AS total_devuelto
      FROM public.ventas_items vi
      JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
      JOIN public.extras_ingredientes ei ON ei.extra_id = vie.extra_id
      WHERE vi.venta_id = NEW.id GROUP BY ei.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

  -- 2. Reactivación: cancelada → activa vuelve a descontar stock (incluye 'credito')
  ELSIF OLD.estado = 'cancelada' AND NEW.estado IN ('preparando', 'lista', 'completada', 'credito') THEN
    UPDATE public.insumos i
    SET stock_actual = i.stock_actual - sub.total_descontar, actualizado_el = NOW()
    FROM (
      SELECT r.insumo_id, SUM(r.cantidad * vi.cantidad) AS total_descontar
      FROM public.ventas_items vi
      JOIN public.recetas_ingredientes r ON r.producto_id = vi.producto_id
      WHERE vi.venta_id = NEW.id GROUP BY r.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

    UPDATE public.insumos i
    SET stock_actual = i.stock_actual - sub.total_descontar, actualizado_el = NOW()
    FROM (
      SELECT e.insumo_id, SUM(e.cantidad_descuento * vie.cantidad) AS total_descontar
      FROM public.ventas_items vi
      JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
      JOIN public.extras_modificadores e ON e.id = vie.extra_id
      WHERE vi.venta_id = NEW.id AND e.insumo_id IS NOT NULL AND e.cantidad_descuento > 0
        AND NOT EXISTS (SELECT 1 FROM public.extras_ingredientes ei WHERE ei.extra_id = e.id)
      GROUP BY e.insumo_id
    ) sub WHERE i.id = sub.insumo_id;

    UPDATE public.insumos i
    SET stock_actual = i.stock_actual - sub.total_descontar, actualizado_el = NOW()
    FROM (
      SELECT ei.insumo_id, SUM(ei.cantidad * vie.cantidad) AS total_descontar
      FROM public.ventas_items vi
      JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
      JOIN public.extras_ingredientes ei ON ei.extra_id = vie.extra_id
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

-- 2. Eliminar Comanda #74 y revertir stock
DO $$
DECLARE
    v_venta_id UUID;
    v_estado_actual VARCHAR(30);
    v_num_comanda INT := 74;
BEGIN
    SELECT id, estado INTO v_venta_id, v_estado_actual
    FROM public.ventas
    WHERE numero_comanda = v_num_comanda;

    IF v_venta_id IS NULL THEN
        RAISE NOTICE 'La comanda #% no existe o ya fue eliminada.', v_num_comanda;
        RETURN;
    END IF;

    -- Si estaba en estado que descontó stock, pasar a cancelada para activar el trigger de devolución
    IF v_estado_actual != 'cancelada' THEN
        UPDATE public.ventas
        SET estado = 'cancelada'
        WHERE id = v_venta_id;
        
        RAISE NOTICE 'Comanda #% cambiada a cancelada. Trigger de devolución de stock ejecutado.', v_num_comanda;
    END IF;

    -- Eliminar la venta (las FKs con ON DELETE CASCADE limpian ventas_items y ventas_items_extras)
    DELETE FROM public.ventas
    WHERE id = v_venta_id;

    RAISE NOTICE 'Comanda #% eliminada definitivamente de la base de datos.', v_num_comanda;
END $$;

-- 3. Verificación de comprobación
SELECT count(*) AS comanda_74_restante
FROM public.ventas
WHERE numero_comanda = 74;
