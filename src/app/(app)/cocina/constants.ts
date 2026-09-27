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

export function obtenerKdsOrFilter(hace24HorasIso: string): string {
  return `estado.in.(pendiente,preparando,credito),and(estado.eq.lista,fecha.gte.${hace24HorasIso})`;
}
