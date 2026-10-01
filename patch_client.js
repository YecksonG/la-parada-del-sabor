const fs = require('fs');
const path = './src/app/(app)/tetas/client.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update Props
content = content.replace(
  /metricas: \{\s*ventasMesUsd: number;\s*costoMesUsd: number;\s*utilidadMesUsd: number;\s*unidadesMes: number;\s*\};\s*/,
  'ventasMetricas: any[];\n  '
);

content = content.replace(
  /metricas,/,
  'ventasMetricas,'
);

// 2. Add State and useMemo
const stateInject = `  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [periodoMetricas, setPeriodoMetricas] = useState<"semana" | "mes" | "historico">("mes");

  const metricasCalculadas = useMemo(() => {
    const ahora = new Date();
    let fechaFiltro: Date | null = null;
    if (periodoMetricas === "mes") {
      fechaFiltro = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    } else if (periodoMetricas === "semana") {
      const day = ahora.getDay() || 7;
      fechaFiltro = new Date(ahora);
      fechaFiltro.setDate(ahora.getDate() - day + 1);
      fechaFiltro.setHours(0, 0, 0, 0);
    }
    const ventasFiltradas = ventasMetricas.filter(v => {
      if (!fechaFiltro) return true;
      return new Date(v.fecha) >= fechaFiltro;
    });
    const ventasUsd = ventasFiltradas.reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0);
    const costoUsd = ventasFiltradas.reduce((acc, v) => acc + (Number(v.costo_unitario_usd || 0) * Number(v.cantidad || 0)), 0);
    const unidades = ventasFiltradas.reduce((acc, v) => acc + (Number(v.cantidad) || 0), 0);
    return { ventasUsd, costoUsd, utilidadUsd: ventasUsd - costoUsd, unidades };
  }, [ventasMetricas, periodoMetricas]);`;

content = content.replace(
  /const \[categoriaFiltro, setCategoriaFiltro\] = useState<string>\("todas"\);/,
  stateInject
);

// 3. Add Import for useMemo if not exists
if (!content.includes('useMemo')) {
  content = content.replace(/useState,/, 'useState, useMemo,');
}

// 4. Update the metrics UI and add filter buttons
const metricsUIOld = `      {/* TARJETAS DE MÉTRICAS */}
      <div
        style={{
          marginTop: 20,
          display: "grid",`;

const metricsUINew = `      {/* TARJETAS DE MÉTRICAS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>Rendimiento</h3>
        <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <button 
            onClick={() => setPeriodoMetricas("semana")} 
            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, border: "none", background: periodoMetricas === "semana" ? "var(--primary)" : "transparent", color: periodoMetricas === "semana" ? "#fff" : "var(--text-muted)", cursor: "pointer" }}
          >SEMANA</button>
          <button 
            onClick={() => setPeriodoMetricas("mes")} 
            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, border: "none", borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)", background: periodoMetricas === "mes" ? "var(--primary)" : "transparent", color: periodoMetricas === "mes" ? "#fff" : "var(--text-muted)", cursor: "pointer" }}
          >MES</button>
          <button 
            onClick={() => setPeriodoMetricas("historico")} 
            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, border: "none", background: periodoMetricas === "historico" ? "var(--primary)" : "transparent", color: periodoMetricas === "historico" ? "#fff" : "var(--text-muted)", cursor: "pointer" }}
          >HISTÓRICO</button>
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          display: "grid",`;

content = content.replace(metricsUIOld, metricsUINew);

// Replace metric values
content = content.replace(/Tetas Despachadas \(Mes\)/g, 'Tetas Despachadas');
content = content.replace(/metricas\.unidadesMes/g, 'metricasCalculadas.unidades');
content = content.replace(/metricas\.ventasMesUsd/g, 'metricasCalculadas.ventasUsd');
content = content.replace(/metricas\.costoMesUsd/g, 'metricasCalculadas.costoUsd');
content = content.replace(/metricas\.utilidadMesUsd/g, 'metricasCalculadas.utilidadUsd');

fs.writeFileSync(path, content);
console.log("Patched client.tsx successfully!");
