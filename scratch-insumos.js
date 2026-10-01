const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://cqnzcidqjotboylemhkr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbnpjaWRxam90Ym95bGVtaGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzc4NjIsImV4cCI6MjEwMjkxMzg2Mn0.a4-KUyWaaButOPzyrZ-hgmqhjsNJBRn77yZWfOlROLE'
);
async function run() {
  const { data } = await supabase.from('insumos').select('nombre, costo_unitario_usd, unidad_medida');
  console.log(data);
}
run();
