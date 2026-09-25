-- ==============================================================================
-- MIGRACIÓN DEFINITIVA: UNIFICACIÓN Y NORMALIZACIÓN DE CATEGORÍAS DE INSUMOS
-- 1. Eliminar 'Lácteos' -> Unificar en 'Quesos'
-- 2. Unificar 'Empaques' y 'Desechables' -> 'Empaques y Desechables'
-- 3. Mapeo en cascada idéntico a TypeScript (orden de precedencia garantizado)
-- 4. Idempotente: solo actualiza si categoria_insumo es distinta (sin bump innecesario de actualizado_el)
-- 5. Verificación estricta: aborta con RAISE EXCEPTION si queda algún valor no canónico
-- 6. Candado de integridad: constraint CHECK con las 11 categorías canónicas
-- ==============================================================================

BEGIN;

-- 1. Lácteos / Quesos
UPDATE public.insumos
   SET categoria_insumo = 'Quesos',
       actualizado_el = NOW()
 WHERE categoria_insumo IS DISTINCT FROM 'Quesos'
   AND (
     LOWER(TRIM(categoria_insumo)) LIKE '%lácteo%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%lacteo%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%leche%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%queso%'
   );

-- 2. Empaques y Desechables
UPDATE public.insumos
   SET categoria_insumo = 'Empaques y Desechables',
       actualizado_el = NOW()
 WHERE categoria_insumo IS DISTINCT FROM 'Empaques y Desechables'
   AND (
     LOWER(TRIM(categoria_insumo)) LIKE '%empaque%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%desechable%'
   );

-- 3. Bebidas (antes de carnes para evitar falsos positivos con 'res' en 'refresco')
UPDATE public.insumos
   SET categoria_insumo = 'Bebidas',
       actualizado_el = NOW()
 WHERE categoria_insumo IS DISTINCT FROM 'Bebidas'
   AND (
     LOWER(TRIM(categoria_insumo)) LIKE '%bebida%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%refresco%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%jugo%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%malta%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%soda%'
   );

-- 4. Pre-elaborados y Guisos (antes de carnes y salsas para atrapar combinadas)
UPDATE public.insumos
   SET categoria_insumo = 'Pre-elaborados',
       actualizado_el = NOW()
 WHERE categoria_insumo IS DISTINCT FROM 'Pre-elaborados'
   AND (
     LOWER(TRIM(categoria_insumo)) LIKE '%pre-elaborado%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%preelaborado%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%pre elaborado%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%guiso%'
   );

-- 5. Grasas y Aceites (antes de vegetales para que 'aceite vegetal' sea Grasas)
UPDATE public.insumos
   SET categoria_insumo = 'Grasas',
       actualizado_el = NOW()
 WHERE categoria_insumo IS DISTINCT FROM 'Grasas'
   AND (
     LOWER(TRIM(categoria_insumo)) LIKE '%grasa%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%aceite%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%manteca%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%mantequilla%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%margarina%'
   );

-- 6. Carnes
UPDATE public.insumos
   SET categoria_insumo = 'Carnes',
       actualizado_el = NOW()
 WHERE categoria_insumo IS DISTINCT FROM 'Carnes'
   AND (
     LOWER(TRIM(categoria_insumo)) LIKE '%carne%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%proteina%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%proteína%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%pollo%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%cerdo%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%cochino%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%chorizo%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%tocineta%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%jamon%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%jamón%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%vacuno%'
     OR LOWER(TRIM(categoria_insumo)) ~* '\yres\y'
   );

-- 7. Masas
UPDATE public.insumos
   SET categoria_insumo = 'Masas',
       actualizado_el = NOW()
 WHERE categoria_insumo IS DISTINCT FROM 'Masas'
   AND (
     LOWER(TRIM(categoria_insumo)) LIKE '%masa%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%harina%'
   );

-- 8. Vegetales
UPDATE public.insumos
   SET categoria_insumo = 'Vegetales',
       actualizado_el = NOW()
 WHERE categoria_insumo IS DISTINCT FROM 'Vegetales'
   AND (
     LOWER(TRIM(categoria_insumo)) LIKE '%vegetal%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%verdura%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%fruta%'
   );

-- 9. Salsas
UPDATE public.insumos
   SET categoria_insumo = 'Salsas',
       actualizado_el = NOW()
 WHERE categoria_insumo IS DISTINCT FROM 'Salsas'
   AND LOWER(TRIM(categoria_insumo)) LIKE '%salsa%';

-- 10. Condimentos
UPDATE public.insumos
   SET categoria_insumo = 'Condimentos',
       actualizado_el = NOW()
 WHERE categoria_insumo IS DISTINCT FROM 'Condimentos'
   AND (
     LOWER(TRIM(categoria_insumo)) LIKE '%condimento%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%especia%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%aliño%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%alino%'
     OR LOWER(TRIM(categoria_insumo)) LIKE '%sal%'
   );

-- 11. Cualquier otro remanente (null, vacíos, Abarrotes, Otros) -> 'General'
UPDATE public.insumos
   SET categoria_insumo = 'General',
       actualizado_el = NOW()
 WHERE categoria_insumo IS DISTINCT FROM 'General'
   AND (
     categoria_insumo IS NULL
     OR TRIM(categoria_insumo) = ''
     OR categoria_insumo NOT IN (
       'Pre-elaborados',
       'Carnes',
       'Masas',
       'Quesos',
       'Vegetales',
       'Salsas',
       'Grasas',
       'Condimentos',
       'Bebidas',
       'Empaques y Desechables'
     )
   );

-- 12. Normalizar tipo y default
ALTER TABLE public.insumos
  ALTER COLUMN categoria_insumo SET DEFAULT 'General',
  ALTER COLUMN categoria_insumo SET NOT NULL;

-- 13. Verificación atómica estricta: ABORTA la transacción si existe anomalía
DO $$
DECLARE
  v_non_canonical_count integer;
  v_non_canonical_sample text;
BEGIN
  SELECT COUNT(*), string_agg(DISTINCT categoria_insumo, ', ')
    INTO v_non_canonical_count, v_non_canonical_sample
    FROM public.insumos
   WHERE categoria_insumo NOT IN (
     'Pre-elaborados',
     'Carnes',
     'Masas',
     'Quesos',
     'Vegetales',
     'Salsas',
     'Grasas',
     'Condimentos',
     'Bebidas',
     'Empaques y Desechables',
     'General'
   );

  IF v_non_canonical_count > 0 THEN
    RAISE EXCEPTION 'ABORTANDO MIGRACIÓN: Se encontraron % registros con categorías no canónicas: [%]',
      v_non_canonical_count, v_non_canonical_sample;
  END IF;
END $$;

-- 14. Candado de Integridad Permanente: CHECK constraint
ALTER TABLE public.insumos
  DROP CONSTRAINT IF EXISTS chk_insumos_categoria_insumo;

ALTER TABLE public.insumos
  ADD CONSTRAINT chk_insumos_categoria_insumo
  CHECK (categoria_insumo IN (
    'Pre-elaborados',
    'Carnes',
    'Masas',
    'Quesos',
    'Vegetales',
    'Salsas',
    'Grasas',
    'Condimentos',
    'Bebidas',
    'Empaques y Desechables',
    'General'
  ));

COMMIT;
