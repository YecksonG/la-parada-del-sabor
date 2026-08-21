"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [tema, setTema] = useState<"light" | "dark">("light");
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    const guardado = localStorage.getItem("parada-theme") as "light" | "dark" | null;
    const prefieroOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const temaInicial = guardado || (prefieroOscuro ? "dark" : "light");
    setTema(temaInicial);
    document.documentElement.setAttribute("data-theme", temaInicial);
  }, []);

  const alternarTema = () => {
    const nuevoTema = tema === "light" ? "dark" : "light";
    setTema(nuevoTema);
    localStorage.setItem("parada-theme", nuevoTema);
    document.documentElement.setAttribute("data-theme", nuevoTema);
  };

  if (!montado) {
    return <div style={{ width: 36, height: 36 }} />;
  }

  return (
    <button
      type="button"
      onClick={alternarTema}
      className="theme-toggle-btn"
      title={`Cambiar a modo ${tema === "light" ? "oscuro" : "claro"}`}
      aria-label="Cambiar tema de color"
    >
      {tema === "light" ? "🌙" : "☀️"}
    </button>
  );
}
