-- ==============================================================================
-- MIGRACIÓN MASTER: TABLA PUENTE PROVEEDOR_INSUMOS CON RLS AUTHENTICATED Y RPCs TRANSACCIONALES
-- Resuelve G1 (RLS authenticated), M1 (Transacciones atómicas) y O1/O2
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.proveedor_insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id UUID NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
    precio_referencial_usd NUMERIC(12, 6) DEFAULT 0 CHECK (precio_referencial_usd >= 0),
    notas TEXT,
    creado_el TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_proveedor_insumo UNIQUE (proveedor_id, insumo_id)
);

-- Índices para búsquedas bidireccionales rápidas
CREATE INDEX IF NOT EXISTS idx_proveedor_insumos_prov ON public.proveedor_insumos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_insumos_insumo ON public.proveedor_insumos(insumo_id);

-- Habilitar RLS estricto estándar del proyecto
ALTER TABLE public.proveedor_insumos ENABLE ROW LEVEL SECURITY;

-- Política estándar: Acceso total para usuarios autenticados
DO $$
BEGIN
    DROP POLICY IF EXISTS "Lectura pública de proveedor_insumos" ON public.proveedor_insumos;
    DROP POLICY IF EXISTS "Escritura de proveedor_insumos" ON public.proveedor_insumos;
    DROP POLICY IF EXISTS "proveedor_insumos_authenticated_all" ON public.proveedor_insumos;
    
    CREATE POLICY "proveedor_insumos_authenticated_all" ON public.proveedor_insumos
        FOR ALL TO authenticated
        USING (true) WITH CHECK (true);
END $$;

-- RPC Transaccional Atómica: Sincronizar Insumos de un Proveedor
CREATE OR REPLACE FUNCTION public.sincronizar_proveedor_insumos(
    p_proveedor_id UUID,
    p_insumos_ids UUID[]
) RETURNS VOID AS $$
BEGIN
    DELETE FROM public.proveedor_insumos WHERE proveedor_id = p_proveedor_id;
    IF p_insumos_ids IS NOT NULL AND array_length(p_insumos_ids, 1) > 0 THEN
        INSERT INTO public.proveedor_insumos (proveedor_id, insumo_id)
        SELECT p_proveedor_id, unnest(p_insumos_ids);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC Transaccional Atómica: Sincronizar Proveedores de un Insumo
CREATE OR REPLACE FUNCTION public.sincronizar_insumo_proveedores(
    p_insumo_id UUID,
    p_proveedores_ids UUID[]
) RETURNS VOID AS $$
BEGIN
    DELETE FROM public.proveedor_insumos WHERE insumo_id = p_insumo_id;
    IF p_proveedores_ids IS NOT NULL AND array_length(p_proveedores_ids, 1) > 0 THEN
        INSERT INTO public.proveedor_insumos (proveedor_id, insumo_id)
        SELECT unnest(p_proveedores_ids), p_insumo_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
