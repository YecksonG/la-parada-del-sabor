const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://cqnzcidqjotboylemhkr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbnpjaWRxam90Ym95bGVtaGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzc4NjIsImV4cCI6MjEwMjkxMzg2Mn0.a4-KUyWaaButOPzyrZ-hgmqhjsNJBRn77yZWfOlROLE'
);

async function run() {
  // We can query `productos` with `recetas_ingredientes` and `insumos`
  // But wait! ANON_KEY works for productos? Let's check.
  const { data: productos } = await supabase.from('productos').select('nombre, precio_usd, recetas_ingredientes(cantidad, insumo:insumos(nombre, costo_unitario_usd, unidad_medida))');
  
  const { data: extras } = await supabase.from('extras_modificadores').select('nombre, cantidad_descuento, insumo:insumos(nombre, costo_unitario_usd, unidad_medida)');
  
  console.log("=== RECETAS BASE ===");
  (productos || []).forEach(p => {
    if (p.recetas_ingredientes && p.recetas_ingredientes.length > 0) {
      console.log(`\nProducto: ${p.nombre} ($${p.precio_usd})`);
      p.recetas_ingredientes.forEach(r => {
        const ins = r.insumo;
        console.log(`  - ${ins?.nombre}: ${r.cantidad} ${ins?.unidad_medida} (Costo: $${((ins?.costo_unitario_usd || 0) * r.cantidad).toFixed(2)})`);
      });
    }
  });

  console.log("\n=== RELLENOS Y EXTRAS ===");
  (extras || []).forEach(e => {
    if (e.cantidad_descuento > 0 && e.insumo) {
      console.log(`Extra: ${e.nombre}`);
      console.log(`  - Descuenta: ${e.cantidad_descuento} ${e.insumo.unidad_medida} de ${e.insumo.nombre} (Costo: $${((e.insumo.costo_unitario_usd || 0) * e.cantidad_descuento).toFixed(2)})`);
    }
  });
}
run();
