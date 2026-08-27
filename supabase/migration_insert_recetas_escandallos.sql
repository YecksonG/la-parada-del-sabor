-- ==============================================================================
-- ESCANDALLOS DE RECETA DETALLADOS PARA DEDUCCIÓN AUTOMÁTICA DE DESPENSA
-- La Parada del Sabor — 27 de Agosto de 2026
-- ==============================================================================

DELETE FROM public.recetas_ingredientes WHERE producto_id IN (
    SELECT id FROM public.productos WHERE nombre IN (
        'Arepa Reina Pepiada', 'Arepa Catira', 'Arepa Pelúa', 'Arepa Especial Mixta',
        'Combo 2 Arepas + Vaso Bebida', 'Combo 6 Arepitas + Refresco 1.5L',
        'Combo Familiar 10 Arepitas + 1.5L', 'Refresco Pepsi 1.5 Litros'
    )
);

-- Arepa Reina Pepiada
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
SELECT p.id, i.id, 50.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Reina Pepiada' AND i.nombre = 'Harina PAN'
UNION ALL
SELECT p.id, i.id, 75.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Reina Pepiada' AND i.nombre = 'Relleno Reina Pepiada'
UNION ALL
SELECT p.id, i.id, 5.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Reina Pepiada' AND i.nombre = 'Margarina Mavesa'
UNION ALL
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Reina Pepiada' AND i.nombre = 'Papel Antigraso Breakfast'
UNION ALL
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Reina Pepiada' AND i.nombre = 'Servilletas Europapel';

-- Arepa Catira
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
SELECT p.id, i.id, 50.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Catira' AND i.nombre = 'Harina PAN'
UNION ALL
SELECT p.id, i.id, 65.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Catira' AND i.nombre = 'Guiso de Pollo Mechado'
UNION ALL
SELECT p.id, i.id, 35.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Catira' AND i.nombre = 'Queso Amarillo Rallado'
UNION ALL
SELECT p.id, i.id, 5.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Catira' AND i.nombre = 'Margarina Mavesa'
UNION ALL
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Catira' AND i.nombre = 'Papel Antigraso Breakfast'
UNION ALL
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Catira' AND i.nombre = 'Servilletas Europapel';

-- Arepa Pelúa
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
SELECT p.id, i.id, 50.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Pelúa' AND i.nombre = 'Harina PAN'
UNION ALL
SELECT p.id, i.id, 65.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Pelúa' AND i.nombre = 'Guiso de Carne Mechada'
UNION ALL
SELECT p.id, i.id, 35.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Pelúa' AND i.nombre = 'Queso Amarillo Rallado'
UNION ALL
SELECT p.id, i.id, 5.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Pelúa' AND i.nombre = 'Margarina Mavesa'
UNION ALL
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Pelúa' AND i.nombre = 'Papel Antigraso Breakfast'
UNION ALL
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Pelúa' AND i.nombre = 'Servilletas Europapel';

-- Arepa Especial Mixta
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
SELECT p.id, i.id, 50.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Especial Mixta' AND i.nombre = 'Harina PAN'
UNION ALL
SELECT p.id, i.id, 40.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Especial Mixta' AND i.nombre = 'Guiso de Carne Mechada'
UNION ALL
SELECT p.id, i.id, 40.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Especial Mixta' AND i.nombre = 'Guiso de Pollo Mechado'
UNION ALL
SELECT p.id, i.id, 25.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Especial Mixta' AND i.nombre = 'Pechuga de Pavo / Jamón'
UNION ALL
SELECT p.id, i.id, 25.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Especial Mixta' AND i.nombre = 'Queso Blanco de Res'
UNION ALL
SELECT p.id, i.id, 20.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Especial Mixta' AND i.nombre = 'Lechuga Americana'
UNION ALL
SELECT p.id, i.id, 25.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Especial Mixta' AND i.nombre = 'Tomate Perita'
UNION ALL
SELECT p.id, i.id, 15.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Especial Mixta' AND i.nombre = 'Cebolla Morada'
UNION ALL
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Especial Mixta' AND i.nombre = 'Cajas Pequeñas Descartables'
UNION ALL
SELECT p.id, i.id, 2.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Arepa Especial Mixta' AND i.nombre = 'Servilletas Europapel';

-- Combo 2 Arepas + Vaso
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
SELECT p.id, i.id, 100.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 2 Arepas + Vaso Bebida' AND i.nombre = 'Harina PAN'
UNION ALL
SELECT p.id, i.id, 65.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 2 Arepas + Vaso Bebida' AND i.nombre = 'Guiso de Pollo Mechado'
UNION ALL
SELECT p.id, i.id, 65.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 2 Arepas + Vaso Bebida' AND i.nombre = 'Guiso de Carne Mechada'
UNION ALL
SELECT p.id, i.id, 10.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 2 Arepas + Vaso Bebida' AND i.nombre = 'Margarina Mavesa'
UNION ALL
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 2 Arepas + Vaso Bebida' AND i.nombre = 'Vaso con Tapa 50 und'
UNION ALL
SELECT p.id, i.id, 2.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 2 Arepas + Vaso Bebida' AND i.nombre = 'Papel Antigraso Breakfast'
UNION ALL
SELECT p.id, i.id, 2.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 2 Arepas + Vaso Bebida' AND i.nombre = 'Servilletas Europapel';

-- Combo 6 Arepitas + 1.5L
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
SELECT p.id, i.id, 150.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 6 Arepitas + Refresco 1.5L' AND i.nombre = 'Harina PAN'
UNION ALL
SELECT p.id, i.id, 90.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 6 Arepitas + Refresco 1.5L' AND i.nombre = 'Guiso de Pollo Mechado'
UNION ALL
SELECT p.id, i.id, 90.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 6 Arepitas + Refresco 1.5L' AND i.nombre = 'Guiso de Carne Mechada'
UNION ALL
SELECT p.id, i.id, 15.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 6 Arepitas + Refresco 1.5L' AND i.nombre = 'Margarina Mavesa'
UNION ALL
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 6 Arepitas + Refresco 1.5L' AND i.nombre = 'Refresco Pepsi 1.5 L'
UNION ALL
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 6 Arepitas + Refresco 1.5L' AND i.nombre = 'Cajas Pequeñas Descartables'
UNION ALL
SELECT p.id, i.id, 4.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo 6 Arepitas + Refresco 1.5L' AND i.nombre = 'Servilletas Europapel';

-- Combo 10 Arepitas + 1.5L
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
SELECT p.id, i.id, 250.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo Familiar 10 Arepitas + 1.5L' AND i.nombre = 'Harina PAN'
UNION ALL
SELECT p.id, i.id, 150.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo Familiar 10 Arepitas + 1.5L' AND i.nombre = 'Guiso de Pollo Mechado'
UNION ALL
SELECT p.id, i.id, 150.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo Familiar 10 Arepitas + 1.5L' AND i.nombre = 'Guiso de Carne Mechada'
UNION ALL
SELECT p.id, i.id, 25.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo Familiar 10 Arepitas + 1.5L' AND i.nombre = 'Margarina Mavesa'
UNION ALL
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo Familiar 10 Arepitas + 1.5L' AND i.nombre = 'Refresco Pepsi 1.5 L'
UNION ALL
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo Familiar 10 Arepitas + 1.5L' AND i.nombre = 'Cajas Grandes Descartables'
UNION ALL
SELECT p.id, i.id, 6.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Combo Familiar 10 Arepitas + 1.5L' AND i.nombre = 'Servilletas Europapel';

-- Pepsi 1.5L
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad)
SELECT p.id, i.id, 1.0 FROM public.productos p, public.insumos i WHERE p.nombre = 'Refresco Pepsi 1.5 Litros' AND i.nombre = 'Refresco Pepsi 1.5 L';
