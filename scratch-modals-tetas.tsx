      {modalSeleccionarCliente && (
        <div className="modal-overlay" onClick={() => setModalSeleccionarCliente(false)}>
          <div
            className="modal-recipe-card"
            style={{ maxWidth: 480, maxHeight: "88vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-recipe-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24 }}>👥</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>Seleccionar Cliente</h2>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
                    Asigna un cliente a la orden de tetas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalSeleccionarCliente(false)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, margin: "14px 0 10px" }}>
              <div className="search-input-wrapper" style={{ flex: 1 }}>
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Buscar por nombre o teléfono..."
                  value={busquedaClienteModal}
                  onChange={(e) => setBusquedaClienteModal(e.target.value)}
                  className="pos-search-input"
                  style={{ fontSize: 13 }}
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalSeleccionarCliente(false);
                  setModalNuevoCliente(true);
                }}
                style={{
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "0 14px",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                + Nuevo
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setClienteSeleccionadoId(null);
                setModalSeleccionarCliente(false);
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                border: !clienteSeleccionadoId ? "2px solid var(--primary)" : "1px solid var(--border)",
                background: !clienteSeleccionadoId ? "rgba(249, 115, 22, 0.1)" : "var(--bg-subtle)",
                color: "var(--text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                marginBottom: 10,
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>👤</span>
                <div>
                  <strong style={{ display: "block", fontSize: 13 }}>Cliente Mostrador / Casual</strong>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Venta rápida sin registrar cliente</span>
                </div>
              </div>
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {clientesFiltradosModal.map((c) => {
                const isSelected = clienteSeleccionadoId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClienteSeleccionadoId(c.id);
                      setModalSeleccionarCliente(false);
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                      background: isSelected ? "rgba(249, 115, 22, 0.1)" : "var(--surface)",
                      color: "var(--text)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <strong style={{ display: "block", fontSize: 13 }}>{c.nombre}</strong>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.telefono || "Sin teléfono"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {modalNuevoCliente && (
        <div className="modal-overlay" onClick={() => setModalNuevoCliente(false)}>
          <div className="modal-recipe-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-recipe-header">
              <h2 style={{ fontSize: 18, margin: 0 }}>Nuevo Cliente</h2>
              <button type="button" onClick={() => setModalNuevoCliente(false)} className="btn-modal-close">✕</button>
            </div>
            <form onSubmit={handleCrearClienteRapido} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Nombre y Apellido *</label>
                <input type="text" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required autoFocus className="pos-search-input" style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Teléfono (Opcional)</label>
                <input type="text" value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} className="pos-search-input" style={{ width: "100%" }} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setModalNuevoCliente(false)} className="btn-cancel" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={guardandoCliente || !nuevoNombre.trim()} className="btn-submit-recipe" style={{ flex: 1 }}>{guardandoCliente ? "Guardando..." : "Guardar Cliente"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
