import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://cqnzcidqjotboylemhkr.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbnpjaWRxam90Ym95bGVtaGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzc4NjIsImV4cCI6MjEwMjkxMzg2Mn0.a4-KUyWaaButOPzyrZ-hgmqhjsNJBRn77yZWfOlROLE";

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("🌽 Iniciando siembra de datos de La Parada del Sabor...");

  // 1. Categorías
  const categorias = [
    { nombre: "Arepas Rellenas", icono: "🫓", orden: 1 },
    { nombre: "Empanadas", icono: "🥟", orden: 2 },
    { nombre: "Bebidas & Jugos", icono: "🥤", orden: 3 },
    { nombre: "Extras & Raciones", icono: "🧀", orden: 4 },
  ];

  const { data: catData, error: catError } = await supabase
    .from('categorias')
    .upsert(categorias, { onConflict: 'nombre' })
    .select();

  if (catError) {
    console.error("Error categorías:", catError.message);
  } else {
    console.log(`✅ ${catData.length} Categorías insertadas.`);
  }

  // 2. Insumos (Materia Prima en g, ml y und)
  const insumos = [
    { nombre: "Masa de Maíz / Harina", unidad_medida: "g", stock_actual: 50000, stock_minimo: 5000, costo_unitario_usd: 0.0018, categoria_insumo: "Masas" },
    { nombre: "Carne Mechada Guisada", unidad_medida: "g", stock_actual: 15000, stock_minimo: 2000, costo_unitario_usd: 0.0075, categoria_insumo: "Carnes" },
    { nombre: "Pollo Desmechado", unidad_medida: "g", stock_actual: 12000, stock_minimo: 2000, costo_unitario_usd: 0.0055, categoria_insumo: "Carnes" },
    { nombre: "Queso Amarillo Rallado", unidad_medida: "g", stock_actual: 10000, stock_minimo: 1500, costo_unitario_usd: 0.0085, categoria_insumo: "Lácteos" },
    { nombre: "Queso Blanco Llanero", unidad_medida: "g", stock_actual: 10000, stock_minimo: 1500, costo_unitario_usd: 0.0060, categoria_insumo: "Lácteos" },
    { nombre: "Aguacate Fresco", unidad_medida: "g", stock_actual: 8000, stock_minimo: 1000, costo_unitario_usd: 0.0035, categoria_insumo: "Vegetales" },
    { nombre: "Mayonesa Casera", unidad_medida: "g", stock_actual: 5000, stock_minimo: 800, costo_unitario_usd: 0.0030, categoria_insumo: "Salsas" },
    { nombre: "Papel Envoltorio / Servilleta", unidad_medida: "und", stock_actual: 500, stock_minimo: 100, costo_unitario_usd: 0.02, categoria_insumo: "Empaque" },
    { nombre: "Vaso y Pitillo 16oz", unidad_medida: "und", stock_actual: 300, stock_minimo: 50, costo_unitario_usd: 0.05, categoria_insumo: "Empaque" },
  ];

  const { data: insData, error: insError } = await supabase
    .from('insumos')
    .upsert(insumos, { onConflict: 'nombre' })
    .select();

  if (insError) {
    console.error("Error insumos:", insError.message);
  } else {
    console.log(`✅ ${insData.length} Insumos registrados.`);
  }

  // 3. Tasa de Cambio Inicial
  await supabase.from('tasas_cambio').upsert([
    { fecha: new Date().toISOString().split('T')[0], bcv_usd_bs: 65.50, tasa_usd_bs: 65.50, cop_usd: 4100 }
  ]);
  console.log("✅ Tasa BCV inicial establecida.");

  console.log("🎉 Siembra inicial completada exitosamente.");
}

seed();
