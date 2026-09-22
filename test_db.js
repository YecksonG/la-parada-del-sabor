const url = "https://cqnzcidqjotboylemhkr.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbnpjaWRxam90Ym95bGVtaGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzc4NjIsImV4cCI6MjEwMjkxMzg2Mn0.a4-KUyWaaButOPzyrZ-hgmqhjsNJBRn77yZWfOlROLE";

async function run() {
  const resRecetas = await fetch(`${url}recetas_ingredientes?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const data = await resRecetas.json();
  console.log(`Recetas ingredientes count: ${data.length}`);
}
run();
