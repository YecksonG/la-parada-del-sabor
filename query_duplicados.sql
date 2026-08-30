WITH nombres_normalizados AS (
    SELECT id, 
           TRIM(LOWER(nombre)) AS nombre_limpio,
           nombre,
           unidad_medida,
           stock_actual,
           costo_unitario_usd
    FROM public.insumos
),
duplicados AS (
    SELECT nombre_limpio
    FROM nombres_normalizados
    GROUP BY nombre_limpio
    HAVING COUNT(*) > 1
)
SELECT n.id, n.nombre, n.unidad_medida, n.stock_actual, n.costo_unitario_usd,
       (SELECT COUNT(*) FROM public.compras_items ci WHERE ci.insumo_id = n.id) as compras_asociadas,
       (SELECT COUNT(*) FROM public.recetas_ingredientes ri WHERE ri.insumo_id = n.id) as recetas_asociadas
FROM nombres_normalizados n
JOIN duplicados d ON n.nombre_limpio = d.nombre_limpio
ORDER BY n.nombre_limpio, compras_asociadas DESC;
