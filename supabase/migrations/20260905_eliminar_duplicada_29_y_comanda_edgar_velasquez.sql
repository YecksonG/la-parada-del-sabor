-- Migración: Eliminar comanda 29 duplicada y agregar comanda de Edgar Velasquez (Turno 03-Sep)

-- 1. Eliminar la comanda 29 duplicada (dejando intacta la comanda 28 original)
DELETE FROM public.ventas_items 
WHERE venta_id IN (SELECT id FROM public.ventas WHERE numero_comanda = 29);

DELETE FROM public.ventas 
WHERE numero_comanda = 29;

-- 2. Registrar al cliente Edgar Velasquez e insertar comanda en el turno de Jue, 03 sept. 2026
DO $$
DECLARE
    v_cliente_edgar_id UUID;
    v_producto_id UUID;
    v_venta_id UUID;
    v_tasa_bcv NUMERIC := 804.8109; -- Tasa oficial de la jornada del 03-Sep
    v_total_usd NUMERIC := 13.00;
    v_total_bs NUMERIC := 10462.54;
BEGIN
    -- Cliente Edgar Velasquez
    SELECT id INTO v_cliente_edgar_id 
    FROM public.clientes 
    WHERE nombre ILIKE '%Edgar%Velasquez%' 
    LIMIT 1;

    IF v_cliente_edgar_id IS NULL THEN
        INSERT INTO public.clientes (id, nombre, total_pedidos, creado_el)
        VALUES (gen_random_uuid(), 'Edgar Velasquez', 1, NOW())
        RETURNING id INTO v_cliente_edgar_id;
    ELSE
        UPDATE public.clientes
        SET total_pedidos = COALESCE(total_pedidos, 0) + 1,
            actualizado_el = NOW()
        WHERE id = v_cliente_edgar_id;
    END IF;

    -- Obtener ID del producto 'El Resuelve Familiar'
    SELECT id INTO v_producto_id
    FROM public.productos
    WHERE nombre ILIKE '%Resuelve Familiar%'
    LIMIT 1;

    -- 3. Insertar la comanda del turno de Jue, 03 sept. 2026 (21:50 hora de Caracas = 2026-09-04 01:50 UTC)
    INSERT INTO public.ventas (
        id,
        cliente_id,
        fecha,
        total_usd,
        total_bs,
        tasa_bcv,
        metodo_pago,
        tipo_entrega,
        estado,
        notas_comanda,
        creado_por,
        origen_pedido
    ) VALUES (
        gen_random_uuid(),
        v_cliente_edgar_id,
        '2026-09-04 01:50:00+00',
        v_total_usd,
        v_total_bs,
        v_tasa_bcv,
        'pago_movil',
        'puerta_cerrada',
        'completada',
        'Comanda turno Jueves 03-Sep - Pago Móvil',
        'admin',
        'pos'
    )
    RETURNING id INTO v_venta_id;

    -- Insertar el item de la comanda con sus rellenos especificados
    INSERT INTO public.ventas_items (
        id,
        venta_id,
        producto_id,
        cantidad,
        precio_unitario_usd,
        precio_unitario_bs,
        subtotal_usd,
        subtotal_bs,
        notas_item
    ) VALUES (
        gen_random_uuid(),
        v_venta_id,
        v_producto_id,
        1,
        v_total_usd,
        v_total_bs,
        v_total_usd,
        v_total_bs,
        'Rellenos: 2x Arepa Catira, 6x Arepa Pelúa, 2x Arepa Reina Pepiada'
    );
END $$;

-- 4. Verificación de integridad: comprobar eliminación de 29 y adición de la comanda de Edgar Velasquez
SELECT 
    v.numero_comanda, 
    v.fecha, 
    v.metodo_pago, 
    v.total_usd, 
    v.total_bs, 
    c.nombre AS cliente_nombre,
    vi.notas_item
FROM public.ventas v
LEFT JOIN public.clientes c ON c.id = v.cliente_id
LEFT JOIN public.ventas_items vi ON vi.venta_id = v.id
WHERE v.numero_comanda = 28 OR c.nombre ILIKE '%Edgar%Velasquez%'
ORDER BY v.numero_comanda ASC;
