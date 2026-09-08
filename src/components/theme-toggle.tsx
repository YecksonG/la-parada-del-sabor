"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [tema, setTema] = useState<"light" | "dark">("light");
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMontado(true);
    const guardado = localStorage.getItem("parada-theme");
    const temaInicial =
      guardado === "light" || guardado === "dark"
        ? guardado
        : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    setTema(temaInicial);
  }, []);

  const alternarTema = () => {
    const nuevoTema = tema === "light" ? "dark" : "light";
    setTema(nuevoTema);
    localStorage.setItem("parada-theme", nuevoTema);
    document.documentElement.setAttribute("data-theme", nuevoTema);
  };

  if (!montado) {
    return <div className="theme-toggle-btn" style={{ visibility: "hidden" }} aria-hidden="true" />;
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
