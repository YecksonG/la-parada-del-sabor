const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://cqnzcidqjotboylemhkr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbnpjaWRxam90Ym95bGVtaGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzc4NjIsImV4cCI6MjEwMjkxMzg2Mn0.a4-KUyWaaButOPzyrZ-hgmqhjsNJBRn77yZWfOlROLE'
);

async function run() {
  const { data: productos, error } = await supabase.from('productos').select('nombre, recetas_ingredientes(cantidad, insumo:insumos(nombre))');
  console.log(error || productos);
}
run();
