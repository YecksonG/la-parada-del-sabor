"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import ThemeToggle from "@/components/theme-toggle";
import { cerrarSesion } from "@/app/login/actions";
import { sounds } from "@/lib/sound-effects";

interface TopbarNavProps {
  nombre: string;
  bcvTasa: number | null;
}

export default function TopbarNav({ nombre, bcvTasa }: TopbarNavProps) {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [dropdownUsuario, setDropdownUsuario] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const inicial = nombre.charAt(0).toUpperCase();

  const enlaces = [
    { href: "/", label: "POS", icon: "🛒" },
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/caja", label: "Caja & Arqueo", icon: "💰" },
    { href: "/recetas", label: "Recetas", icon: "🌾" },
    { href: "/insumos", label: "Despensa", icon: "📦" },
    { href: "/ventas", label: "Comandas", icon: "📋" },
    { href: "/compras", label: "Compras", icon: "🚚" },
    { href: "/clientes", label: "Clientes", icon: "👥" },
    { href: "/proveedores", label: "Proveedores", icon: "🏢" },
    { href: "/tasas", label: "Tasas", icon: "💵" },
  ];

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSoundEnabled(sounds.isEnabled());
    }
  }, []);

  const handleToggleSound = () => {
    const nextState = sounds.toggleSound();
    setSoundEnabled(nextState);
  };

  // Cerrar menú móvil y dropdown al navegar
  useEffect(() => {
    setMenuAbierto(false);
    setDropdownUsuario(false);
  }, [pathname]);

  // Click outside para cerrar dropdown de usuario
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setDropdownUsuario(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link href="/" className="topbar-brand" onClick={() => sounds.playPop()}>
          <Image
            src="/images/logo-badge.png"
            alt="Logo La Parada del Sabor"
            width={36}
            height={36}
            className="brand-logo-img"
            priority
          />
          <div className="brand-text">
            <span className="brand-name-main">La Parada </span>
            <span className="brand-name-accent">del Sabor</span>
          </div>
        </Link>
      </div>

      <nav className={`topbar-nav ${menuAbierto ? "nav-open" : ""}`}>
        {enlaces.map((enlace) => {
          const activo = pathname === enlace.href;
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              onClick={() => sounds.playPop()}
              className={`nav-link ${activo ? "nav-link-active" : ""}`}
            >
              <span className="nav-icon">{enlace.icon}</span>
              <span>{enlace.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="topbar-right">
        {/* Tasa BCV */}
        {bcvTasa && (
          <Link href="/tasas" className="bcv-pill" title="Tasa oficial BCV (clic para ver las 4 tasas)">
            <span className="bcv-dot"></span>
            <span className="bcv-label">BCV:</span>
            <span className="bcv-value">{bcvTasa.toFixed(2)} Bs</span>
          </Link>
        )}

        {/* Botón de Sonidos Lúdicos */}
        <button
          type="button"
          onClick={handleToggleSound}
          className="theme-toggle-btn"
          title={soundEnabled ? "Sonidos gourmet activados" : "Sonidos silenciados"}
          aria-label="Toggle sound"
        >
          {soundEnabled ? "🔔" : "🔕"}
        </button>

        <ThemeToggle />

        {/* Menú de Usuario */}
        <div className="user-menu-wrapper" ref={userMenuRef}>
          <button
            type="button"
            className="user-avatar-btn"
            onClick={() => setDropdownUsuario(!dropdownUsuario)}
            title={`Sesión iniciada como ${nombre}`}
            aria-expanded={dropdownUsuario}
          >
            <span className="user-avatar-initial">{inicial}</span>
          </button>

          {dropdownUsuario && (
            <div className="user-dropdown-menu">
              <div className="dropdown-header">
                <span className="dropdown-user-name">{nombre}</span>
                <span className="dropdown-user-role">Operador Gastronómico</span>
              </div>
              <div className="dropdown-divider"></div>
              <Link href="/dashboard" className="nav-link" style={{ padding: "6px 8px" }}>
                📊 Ver Métricas y Reportes
              </Link>
              <Link href="/caja" className="nav-link" style={{ padding: "6px 8px" }}>
                💰 Control de Caja & Arqueo
              </Link>
              <div className="dropdown-divider"></div>
              <form action={cerrarSesion}>
                <button type="submit" className="dropdown-logout-btn">
                  <span>🚪</span> Cerrar Sesión
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
