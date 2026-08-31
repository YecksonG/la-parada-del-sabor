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
      <div className="splash-content">
        <div className="splash-logo-wrap">
          <Image
            src="/images/isotipo_arepa.png"
            alt="La Parada del Sabor"
            width={120}
            height={120}
            className="splash-arepa-img"
            priority
          />
          <div className="splash-glow-ring"></div>
        </div>

        <div className="splash-text-wrap">
          <span className="splash-brand-title">La Parada del Sabor</span>
          <span className="splash-brand-slogan">Tu antojo a 3 clics</span>
        </div>
      </div>
    </div>
  );
}
