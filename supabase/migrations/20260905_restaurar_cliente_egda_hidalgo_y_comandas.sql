-- Migración: Restauración de cliente 'Egda Hidalgo', vinculación de comandas 1 y 5, y normalización a pago_movil

-- 1. Crear o restaurar la ficha de la cliente 'Egda Hidalgo'
DO $$
DECLARE
    v_cliente_id UUID;
BEGIN
    SELECT id INTO v_cliente_id 
    FROM public.clientes 
    WHERE nombre ILIKE '%Egda Hidalgo%' 
    LIMIT 1;

    IF v_cliente_id IS NULL THEN
        INSERT INTO public.clientes (id, nombre, total_pedidos, creado_el)
        VALUES (gen_random_uuid(), 'Egda Hidalgo', 2, NOW())
        RETURNING id INTO v_cliente_id;
    ELSE
        UPDATE public.clientes
        SET total_pedidos = 2,
            actualizado_el = NOW()
        WHERE id = v_cliente_id;
    END IF;

    -- 2. Vincular comanda 1 y comanda 5 a Egda Hidalgo y asegurar método pago_movil
    UPDATE public.ventas
    SET cliente_id = v_cliente_id,
        metodo_pago = 'pago_movil'
    WHERE numero_comanda IN (1, 5);

    -- 3. Asegurar que todas las comandas de la jornada del 01 de septiembre de 2026 queden registradas como pago_movil (100% digital)
    UPDATE public.ventas
    SET metodo_pago = 'pago_movil'
    WHERE numero_comanda IN (1, 4, 5, 6, 8);
END $$;

-- 4. Verificación de integridad: comprobar que quedaron asociadas y en pago_movil
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
