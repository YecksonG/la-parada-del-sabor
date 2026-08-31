"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [animandoSalida, setAnimandoSalida] = useState(false);

  useEffect(() => {
    // Iniciar animación de salida cinematográfica a los 1.35 segundos
    const timerSalida = setTimeout(() => {
      setAnimandoSalida(true);
    }, 1350);

    // Desmontar completamente a los 1.85 segundos
    const timerDesmontar = setTimeout(() => {
      setVisible(false);
    }, 1850);

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
      {/* Fondo con resplandores ambientales y textura */}
      <div className="splash-ambient-glow-1"></div>
      <div className="splash-ambient-glow-2"></div>
      <div className="splash-ambient-pattern"></div>

      {/* Chispas flotantes animadas */}
      <div className="splash-sparks-wrap">
        <span className="splash-spark spark-1">✨</span>
        <span className="splash-spark spark-2">🌟</span>
        <span className="splash-spark spark-3">✨</span>
        <span className="splash-spark spark-4">🔥</span>
      </div>

      <div className="splash-content">
        <div className="splash-logo-wrap">
          {/* Ondas de choque expansivas */}
          <div className="splash-shockwave splash-shockwave-1"></div>
          <div className="splash-shockwave splash-shockwave-2"></div>
          <div className="splash-shockwave splash-shockwave-3"></div>

          {/* Contenedor de la Arepa con destello de luz sweep */}
          <div className="splash-image-box">
            <Image
              src="/images/isotipo_arepa.png"
              alt="La Parada del Sabor"
              width={145}
              height={145}
              className="splash-arepa-img logo-light-only"
              loading="eager"
            />
            <Image
              src="/images/isotipo_arepa_dark.png"
              alt="La Parada del Sabor"
              width={145}
              height={145}
              className="splash-arepa-img logo-dark-only"
              loading="eager"
            />
            <div className="splash-shine-sweep"></div>
          </div>
        </div>

        <div className="splash-text-wrap">
          <div className="splash-brand-title">
            <span>La Parada</span> <span className="splash-title-highlight">del Sabor</span>
          </div>

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
