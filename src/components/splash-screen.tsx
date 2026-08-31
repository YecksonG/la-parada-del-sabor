"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [animandoSalida, setAnimandoSalida] = useState(false);

  useEffect(() => {
    // Iniciar animación de salida a los 1.2 segundos
    const timerSalida = setTimeout(() => {
      setAnimandoSalida(true);
    }, 1200);

    // Desmontar completamente a los 1.7 segundos
    const timerDesmontar = setTimeout(() => {
      setVisible(false);
    }, 1700);

    return () => {
      clearTimeout(timerSalida);
      clearTimeout(timerDesmontar);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`splash-overlay ${animandoSalida ? "splash-exit" : ""}`}
      aria-hidden="true"
    >
      {/* Fondo con resplandor ambiental cálido */}
      <div className="splash-ambient-glow"></div>

      <div className="splash-content">
        <div className="splash-logo-wrap">
          {/* Anillos de pulsación dorada */}
          <div className="splash-pulse-ring splash-pulse-ring-1"></div>
          <div className="splash-pulse-ring splash-pulse-ring-2"></div>

          <Image
            src="/images/isotipo_arepa.png"
            alt="La Parada del Sabor"
            width={130}
            height={130}
            className="splash-arepa-img logo-light-only"
            loading="eager"
          />
          <Image
            src="/images/isotipo_arepa_dark.png"
            alt="La Parada del Sabor"
            width={130}
            height={130}
            className="splash-arepa-img logo-dark-only"
            loading="eager"
          />
        </div>

        <div className="splash-text-wrap">
          <span className="splash-brand-title">La Parada del Sabor</span>
          <div className="splash-brand-slogan">
            <span className="splash-slogan-dot"></span>
            <span>Tu antojo a 3 clics</span>
          </div>

          {/* Barra de progreso rápida estilo App Nativa */}
          <div className="splash-progress-track">
            <div className="splash-progress-fill"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
