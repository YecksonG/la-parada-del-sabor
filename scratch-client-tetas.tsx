              {/* SELECTOR DE CLIENTE (POS) */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Cliente / Comprador
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaClienteModal("");
                    setModalSeleccionarCliente(true);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    background: clienteSeleccionadoId ? "rgba(249, 115, 22, 0.08)" : "var(--bg-subtle)",
                    border: clienteSeleccionadoId ? "1px solid var(--primary)" : "1px solid var(--border)",
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                    <span style={{ fontSize: 18 }}>{clienteSeleccionadoId ? "👑" : "👤"}</span>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <strong style={{ fontSize: 13, color: "var(--text)", display: "block" }}>
                        {clienteSeleccionadoId ? listaClientes.find(c => c.id === clienteSeleccionadoId)?.nombre : "Mostrador / Casual"}
                      </strong>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {clienteSeleccionadoId ? (listaClientes.find(c => c.id === clienteSeleccionadoId)?.telefono || "Sin teléfono") : "Venta rápida sin registrar"}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700, flexShrink: 0 }}>
                    {clienteSeleccionadoId ? "Cambiar ⇄" : "Buscar 🔍"}
                  </span>
                </button>
              </div>
