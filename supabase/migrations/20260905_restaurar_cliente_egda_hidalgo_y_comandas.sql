-- Restauracion de Egda Hidalgo y asignacion de comandas 1 y 5 (Pago Movil)

-- 1. Insertar cliente Egda Hidalgo si no existe
INSERT INTO public.clientes (id, nombre, total_pedidos, creado_el)
SELECT gen_random_uuid(), 'Egda Hidalgo', 2, NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.clientes WHERE nombre ILIKE '%Egda Hidalgo%'
);

-- 2. Asegurar total_pedidos en 2
UPDATE public.clientes
SET total_pedidos = 2,
    actualizado_el = NOW()
WHERE nombre ILIKE '%Egda Hidalgo%';

-- 3. Vincular comandas 1 y 5 a Egda Hidalgo y fijar pago_movil
UPDATE public.ventas
SET cliente_id = (SELECT id FROM public.clientes WHERE nombre ILIKE '%Egda Hidalgo%' LIMIT 1),
    metodo_pago = 'pago_movil'
WHERE numero_comanda IN (1, 5);

-- 4. Normalizar todas las comandas del 01-Sep a pago_movil
UPDATE public.ventas
SET metodo_pago = 'pago_movil'
WHERE numero_comanda IN (1, 4, 5, 6, 8);

-- 5. Consulta de verificacion
SELECT 
    v.numero_comanda, 
    v.fecha, 
    v.metodo_pago, 
    v.total_usd, 
    v.total_bs, 
    c.nombre AS cliente_nombre
FROM public.ventas v
LEFT JOIN public.clientes c ON c.id = v.cliente_id
WHERE v.numero_comanda IN (1, 4, 5, 6, 8)
ORDER BY v.numero_comanda ASC;
