import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TopbarNav from "@/components/topbar-nav";
import PageTransition from "@/components/page-transition";
import AutoTasas from "@/components/auto-tasas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const nombre = user.email?.split("@")[0] ?? "operador";

  // Obtener última tasa BCV
  const { data: tasaReciente } = await supabase
    .from("tasas_cambio")
    .select("bcv_usd_bs, tasa_usd_bs")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  const bcvTasa = Number(tasaReciente?.bcv_usd_bs || tasaReciente?.tasa_usd_bs) || null;

  return (
    <div className="app-shell">
      <AutoTasas />
      <TopbarNav nombre={nombre} bcvTasa={bcvTasa} />
      <PageTransition>{children}</PageTransition>
    </div>
  );
}
