-- ==============================================================================
-- AJUSTE VENEZOLANO: JUGOS Y LÍQUIDOS EN MILILITROS (ml) Y LITROS (L)
-- ==============================================================================

-- 1. Actualizar Insumo de Empaque: Vaso 16oz -> Vaso Desechable 450 ml
UPDATE public.insumos
SET
  nombre = 'Vaso Desechable 450 ml',
  categoria_insumo = 'Empaque'
WHERE nombre ILIKE '%16oz%' OR nombre ILIKE '%Vaso Desechable%';

-- 2. Asegurar Insumo de Pulpa en Mililitros (ml)
INSERT INTO public.insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo)
VALUES ('Concentrado de Pulpa de Parchita', 'ml', 25000, 3000, 0.0030, 'Bebidas')
ON CONFLICT (nombre) DO UPDATE
SET unidad_medida = 'ml';

-- 3. Actualizar Producto: Jugo de Parchita en Mililitros (450 ml)
UPDATE public.productos
SET
  nombre = 'Jugo Natural de Parchita (450 ml)',
  descripcion = 'Jugo natural fresco bien frío servido en vaso de 450 ml'
WHERE nombre ILIKE '%Parchita%';

-- 4. Asociar Receta en ml y gramos al Jugo
DO $$
DECLARE
  v_prod_id UUID;
  v_ins_pulpa UUID;
  v_ins_vaso UUID;
BEGIN
  SELECT id INTO v_prod_id FROM public.productos WHERE nombre ILIKE '%Parchita%' LIMIT 1;
  SELECT id INTO v_ins_pulpa FROM public.insumos WHERE nombre ILIKE '%Parchita%' LIMIT 1;
  SELECT id INTO v_ins_vaso FROM public.insumos WHERE nombre ILIKE '%Vaso%' LIMIT 1;

  IF v_prod_id IS NOT NULL AND v_ins_pulpa IS NOT NULL THEN
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
    VALUES (v_prod_id, v_ins_pulpa, 180) -- 180 ml de pulpa concentrada
    ON CONFLICT (producto_id, insumo_id) DO UPDATE SET cantidad = 180;
  END IF;

  IF v_prod_id IS NOT NULL AND v_ins_vaso IS NOT NULL THEN
    INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
    VALUES (v_prod_id, v_ins_vaso, 1) -- 1 vaso de 450 ml
    ON CONFLICT (producto_id, insumo_id) DO UPDATE SET cantidad = 1;
  END IF;
END $$;
