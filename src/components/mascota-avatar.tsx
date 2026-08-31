"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface MascotaAvatarProps {
  size?: number;
  className?: string;
  autoWink?: boolean;
  priority?: boolean;
}

export function MascotaAvatar({
  size = 36,
  className = "brand-logo-img",
  autoWink = true,
  priority = false,
}: MascotaAvatarProps) {
  const [isWinking, setIsWinking] = useState(false);
  const winkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!autoWink) return;

    // Guiño simpático cada 8 segundos durante 850ms
    const interval = setInterval(() => {
      setIsWinking(true);
      if (winkTimeoutRef.current) clearTimeout(winkTimeoutRef.current);
      winkTimeoutRef.current = setTimeout(() => {
        setIsWinking(false);
      }, 850);
    }, 8000);

    return () => {
      clearInterval(interval);
      if (winkTimeoutRef.current) clearTimeout(winkTimeoutRef.current);
    };
  }, [autoWink]);

  const handleMouseEnter = () => {
    if (winkTimeoutRef.current) clearTimeout(winkTimeoutRef.current);
    setIsWinking(true);
  };

  const handleMouseLeave = () => {
    if (winkTimeoutRef.current) clearTimeout(winkTimeoutRef.current);
    setIsWinking(false);
  };

  return (
    <div
      className={`mascota-avatar-container ${className || ""}`}
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title="¡Hola! Soy la Mascota de La Parada del Sabor 😉"
    >
      {/* Avatar Normal */}
      <Image
        src="/mascota/avatar_normal.webp"
        alt="Mascota La Parada del Sabor"
        width={size}
        height={size}
        priority={priority}
        aria-hidden={isWinking}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transition: "opacity 0.2s ease-in-out",
          opacity: isWinking ? 0 : 1,
        }}
      />
      {/* Avatar Guiñando el Ojo */}
      <Image
        src="/mascota/avatar_wink.webp"
        alt=""
        width={size}
        height={size}
        priority={false}
        aria-hidden={!isWinking}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transition: "opacity 0.2s ease-in-out",
          opacity: isWinking ? 1 : 0,
        }}
      />
    </div>
  );
}
