-- Migración: Soporte nativo para estado de cola en KDS (/cocina)
-- Evita modificar ventas.estado a 'pendiente' para prevenir doble deducción de inventario por trg_confirmar_pedido_web.
-- Evita concurrencia en notas_comanda para blindar abonos y pagos mixtos.

-- 1. Columna dedicada
ALTER TABLE public.ventas
    ADD COLUMN IF NOT EXISTS en_cola_kds BOOLEAN NOT NULL DEFAULT false;

-- 2. Saneamiento del tag histórico (respeta la nota legítima del cajero)
UPDATE public.ventas
SET notas_comanda = NULLIF(btrim(regexp_replace(notas_comanda, '\s*\[KDS_COLA\]', '', 'g')), '')
WHERE notas_comanda LIKE '%[KDS_COLA]%';

-- 3. Invariante auto-correctiva: en_cola_kds = true  =>  estado = 'preparando'
CREATE OR REPLACE FUNCTION public.fn_trg_ventas_kds_cola_invariante()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.en_cola_kds AND NEW.estado <> 'preparando' THEN
        NEW.en_cola_kds := false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ventas_kds_cola_invariante ON public.ventas;
CREATE TRIGGER trg_ventas_kds_cola_invariante
BEFORE UPDATE ON public.ventas
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_ventas_kds_cola_invariante();

-- 4. RPC atómica: única puerta de entrada del KDS
--    FOR UPDATE serializa a dos cocineros (cierra la pérdida de abono).
--    NO escribe NUNCA en notas_comanda  =>  no dispara triggers de inventario.
CREATE OR REPLACE FUNCTION public.rpc_mover_comanda_kds(p_venta_id UUID, p_destino TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_estado TEXT;
BEGIN
    IF p_destino IS NULL OR p_destino NOT IN ('plancha','cola') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Destino inválido: ' || COALESCE(p_destino, 'NULL'));
    END IF;

    SELECT estado INTO v_estado FROM public.ventas WHERE id = p_venta_id FOR UPDATE;
    IF v_estado IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Comanda no encontrada');
    END IF;

    IF p_destino = 'cola' THEN
        IF v_estado <> 'preparando' THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Sólo una comanda en preparación puede volver a cola');
        END IF;
        UPDATE public.ventas SET en_cola_kds = true WHERE id = p_venta_id;
    ELSE
        UPDATE public.ventas
        SET estado = CASE WHEN v_estado IN ('pendiente','credito') THEN 'preparando' ELSE estado END,
            en_cola_kds = false
        WHERE id = p_venta_id;
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_mover_comanda_kds(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_mover_comanda_kds(UUID, TEXT) TO authenticated, service_role;

