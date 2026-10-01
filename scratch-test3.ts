import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://cqnzcidqjotboylemhkr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbnpjaWRxam90Ym95bGVtaGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzc4NjIsImV4cCI6MjEwMjkxMzg2Mn0.a4-KUyWaaButOPzyrZ-hgmqhjsNJBRn77yZWfOlROLE'
);

async function t() {
  const { data } = await supabase.from('gastos').select('*').ilike('descripcion', '%egda%');
  console.log("Gastos Egda:", data);
}
t();
