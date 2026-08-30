WITH duplicados AS (
    SELECT id, nombre, categoria_insumo, stock_actual, costo_unitario_usd,
           (SELECT COUNT(*) FROM public.recetas_ingredientes ri WHERE ri.insumo_id = i.id) as recetas_asociadas
    FROM public.insumos i
    WHERE nombre IN (
        'Aguacate Fresco Polo', 'Aguacate Polo Fresco',
        'Carne de Res Cruda', 'Carne para Desmechar Halal',
        'Harina PAN', 'Harina PAN Maíz Blanco',
        'Pechuga Cocida de Pavo Superior Magros', 'Pechuga de Pavo / Jamón',
        'Pechuga de Pollo con Hueso', 'Pechuga de Pollo Cruda',
        'Queso Amarillo Rallado', 'Queso Amarillo Rallado Oriany',
        'Queso Blanco de Res', 'Queso Blanco de Res Charle',
        'Tomate Fresco', 'Tomate Perita'
    )
)
SELECT * FROM duplicados ORDER BY nombre;
