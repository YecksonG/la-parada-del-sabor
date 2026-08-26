-- ==============================================================================
-- CORRECCIÓN: AGREGAR NOT NULL A COLUMNAS CALCULADAS EN VENTAS_ITEMS Y VENTAS_ITEMS_EXTRAS
-- ==============================================================================
-- Problema: Las columnas subtotal_bs, precio_unitario_bs, etc. fueron agregadas
-- con DEFAULT 0 pero SIN restricción NOT NULL, creando inconsistencia con el
-- schema original y permitiendo valores NULL en columnas numéricas críticas.
-- ==============================================================================

-- 1. Asegurar que no existan NULLs en columnas existentes (backup por si acaso)
UPDATE public.ventas_items 
SET subtotal_usd = 0 
WHERE subtotal_usd IS NULL;

UPDATE public.ventas_items 
SET subtotal_bs = 0 
WHERE subtotal_bs IS NULL;

UPDATE public.ventas_items 
SET precio_unitario_bs = 0 
WHERE precio_unitario_bs IS NULL;

UPDATE public.ventas_items_extras 
SET precio_extra_usd = 0 
WHERE precio_extra_usd IS NULL;

UPDATE public.ventas_items_extras 
SET precio_extra_bs = 0 
WHERE precio_extra_bs IS NULL;

UPDATE public.ventas_items_extras 
SET precio_unitario_usd = 0 
WHERE precio_unitario_usd IS NULL;

UPDATE public.ventas_items_extras 
SET precio_unitario_bs = 0 
WHERE precio_unitario_bs IS NULL;

UPDATE public.ventas_items_extras 
SET subtotal_usd = 0 
WHERE subtotal_usd IS NULL;

UPDATE public.ventas_items_extras 
SET subtotal_bs = 0 
WHERE subtotal_bs IS NULL;

-- 2. Eliminar constraints DEFAULT existentes para poder modificar
ALTER TABLE public.ventas_items 
    ALTER COLUMN subtotal_usd DROP DEFAULT,
    ALTER COLUMN subtotal_bs DROP DEFAULT,
    ALTER COLUMN precio_unitario_bs DROP DEFAULT;

ALTER TABLE public.ventas_items_extras 
    ALTER COLUMN precio_extra_usd DROP DEFAULT,
    ALTER COLUMN precio_extra_bs DROP DEFAULT,
    ALTER COLUMN precio_unitario_usd DROP DEFAULT,
    ALTER COLUMN precio_unitario_bs DROP DEFAULT,
    ALTER COLUMN subtotal_usd DROP DEFAULT,
    ALTER COLUMN subtotal_bs DROP DEFAULT;

-- 3. Agregar restricciones NOT NULL
ALTER TABLE public.ventas_items 
    ALTER COLUMN subtotal_usd SET NOT NULL,
    ALTER COLUMN subtotal_bs SET NOT NULL,
    ALTER COLUMN precio_unitario_bs SET NOT NULL;

ALTER TABLE public.ventas_items_extras 
    ALTER COLUMN precio_extra_usd SET NOT NULL,
    ALTER COLUMN precio_extra_bs SET NOT NULL,
    ALTER COLUMN precio_unitario_usd SET NOT NULL,
    ALTER COLUMN precio_unitario_bs SET NOT NULL,
    ALTER COLUMN subtotal_usd SET NOT NULL,
    ALTER COLUMN subtotal_bs SET NOT NULL;

-- 4. Restaurar constraints DEFAULT 0 para nuevas inserciones
ALTER TABLE public.ventas_items 
    ALTER COLUMN subtotal_usd SET DEFAULT 0,
    ALTER COLUMN subtotal_bs SET DEFAULT 0,
    ALTER COLUMN precio_unitario_bs SET DEFAULT 0;

ALTER TABLE public.ventas_items_extras 
    ALTER COLUMN precio_extra_usd SET DEFAULT 0,
    ALTER COLUMN precio_extra_bs SET DEFAULT 0,
    ALTER COLUMN precio_unitario_usd SET DEFAULT 0,
    ALTER COLUMN precio_unitario_bs SET DEFAULT 0,
    ALTER COLUMN subtotal_usd SET DEFAULT 0,
    ALTER COLUMN subtotal_bs SET DEFAULT 0;

-- 5. Agregar CHECK constraints para integridad de datos
ALTER TABLE public.ventas_items 
    ADD CONSTRAINT check_ventas_items_subtotal_usd CHECK (subtotal_usd >= 0),
    ADD CONSTRAINT check_ventas_items_subtotal_bs CHECK (subtotal_bs >= 0),
    ADD CONSTRAINT check_ventas_items_precio_unitario_bs CHECK (precio_unitario_bs >= 0);

ALTER TABLE public.ventas_items_extras 
    ADD CONSTRAINT check_ventas_extras_precio_extra_usd CHECK (precio_extra_usd >= 0),
    ADD CONSTRAINT check_ventas_extras_precio_extra_bs CHECK (precio_extra_bs >= 0),
    ADD CONSTRAINT check_ventas_extras_precio_unitario_usd CHECK (precio_unitario_usd >= 0),
    ADD CONSTRAINT check_ventas_extras_precio_unitario_bs CHECK (precio_unitario_bs >= 0),
    ADD CONSTRAINT check_ventas_extras_subtotal_usd CHECK (subtotal_usd >= 0),
    ADD CONSTRAINT check_ventas_extras_subtotal_bs CHECK (subtotal_bs >= 0);

-- ==============================================================================
-- VERIFICACIÓN: Ejecutar estas consultas para confirmar que todo está correcto
-- ==============================================================================
-- SELECT column_name, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'ventas_items' 
-- AND column_name IN ('subtotal_usd', 'subtotal_bs', 'precio_unitario_bs');

-- SELECT column_name, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'ventas_items_extras' 
-- AND column_name IN ('precio_extra_usd', 'precio_extra_bs', 'precio_unitario_usd', 'precio_unitario_bs', 'subtotal_usd', 'subtotal_bs');