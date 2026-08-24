-- ==============================================================================
-- MIGRACIÓN MASTER: TABLA PUENTE PROVEEDOR_INSUMOS
-- Resuelve O1 (Integridad Referencial N:M) y O2 (Eliminación de Carreras RMW)
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

-- Índices de alto rendimiento para búsquedas bidireccionales
CREATE INDEX IF NOT EXISTS idx_proveedor_insumos_prov ON public.proveedor_insumos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_insumos_insumo ON public.proveedor_insumos(insumo_id);

-- Habilitar RLS
ALTER TABLE public.proveedor_insumos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS permisivas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'proveedor_insumos' AND policyname = 'Lectura pública de proveedor_insumos'
    ) THEN
        CREATE POLICY "Lectura pública de proveedor_insumos" ON public.proveedor_insumos
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'proveedor_insumos' AND policyname = 'Escritura de proveedor_insumos'
    ) THEN
        CREATE POLICY "Escritura de proveedor_insumos" ON public.proveedor_insumos
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
