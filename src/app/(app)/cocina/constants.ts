export const KDS_SELECT_VENTAS = `
  *,
  cliente:clientes(id, nombre, telefono),
  items:ventas_items(
    *,
    producto:productos(
      *,
      categoria:categorias(nombre)
    ),
    extras:ventas_items_extras(
      *,
      extra:extras_modificadores(*)
    )
  )
`;

export const KDS_ESTADOS_ACTIVOS = ["pendiente", "preparando", "credito", "lista"] as const;
