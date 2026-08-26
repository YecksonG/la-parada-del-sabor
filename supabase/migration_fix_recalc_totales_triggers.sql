-- ==============================================================================
-- MIGRACIÓN DE CORRECCIÓN: TRIGGERS DE TOTALES DE VENTA & BACKFILL
-- ==============================================================================

-- 1. Función para recalcular totales de venta desde ventas_items
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

DROP TRIGGER IF EXISTS trg_recalc_totales_ventas_items ON public.ventas_items;
CREATE TRIGGER trg_recalc_totales_ventas_items
AFTER INSERT OR UPDATE OR DELETE ON public.ventas_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_recalcular_totales_venta();

-- 2. Función para recalcular totales de venta desde ventas_items_extras
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

DROP TRIGGER IF EXISTS trg_recalc_totales_ventas_extras ON public.ventas_items_extras;
CREATE TRIGGER trg_recalc_totales_ventas_extras
AFTER INSERT OR UPDATE OR DELETE ON public.ventas_items_extras
FOR EACH ROW
EXECUTE FUNCTION public.fn_recalcular_totales_venta_extras();

-- 3. Backfill: Actualizar ventas históricas que tengan total_usd en 0
UPDATE public.ventas v
SET total_usd = COALESCE((
    SELECT SUM(vi.subtotal_usd)
    FROM public.ventas_items vi
    WHERE vi.venta_id = v.id
), 0) + COALESCE((
    SELECT SUM(vie.subtotal_usd)
    FROM public.ventas_items vi
    JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
    WHERE vi.venta_id = v.id
), 0),
total_bs = ROUND((
    (COALESCE((
        SELECT SUM(vi.subtotal_usd)
        FROM public.ventas_items vi
        WHERE vi.venta_id = v.id
    ), 0) + COALESCE((
        SELECT SUM(vie.subtotal_usd)
        FROM public.ventas_items vi
        JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
        WHERE vi.venta_id = v.id
    ), 0)) * COALESCE(v.tasa_bcv, 1)
)::NUMERIC, 2)
WHERE v.total_usd = 0 OR v.total_usd IS NULL;
