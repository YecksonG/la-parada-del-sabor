"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import ThemeToggle from "@/components/theme-toggle";
import { cerrarSesion } from "@/app/login/actions";

interface TopbarNavProps {
  nombre: string;
  bcvTasa: number | null;
}

export default function TopbarNav({ nombre, bcvTasa }: TopbarNavProps) {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [dropdownUsuario, setDropdownUsuario] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const inicial = nombre.charAt(0).toUpperCase();

  const enlaces = [
    { href: "/", label: "POS Comandas", icon: "🛒" },
    { href: "/recetas", label: "Recetas & Gramos", icon: "🌾" },
    { href: "/insumos", label: "Despensa", icon: "📦" },
    { href: "/ventas", label: "Ventas", icon: "📋" },
    { href: "/compras", label: "Compras", icon: "🚚" },
    { href: "/clientes", label: "Clientes", icon: "👥" },
    { href: "/tasas", label: "Tasas", icon: "💵" },
  ];

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
        <Link href="/" className="topbar-brand">
          <span className="brand-icon">🫓</span>
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
          <div className="bcv-pill" title="Tasa oficial BCV">
            <span className="bcv-dot"></span>
            <span className="bcv-label">BCV:</span>
            <span className="bcv-value">{bcvTasa.toFixed(2)} Bs</span>
          </div>
        )}

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
              <div className="dropdown-user-header">
                <span className="dropdown-user-name">👤 {nombre}</span>
                <span className="dropdown-user-role">Operador de Cocina / Caja</span>
              </div>
              <div className="dropdown-divider" />
              <form action={cerrarSesion}>
                <button type="submit" className="dropdown-logout-btn">
                  <span>🚪</span> Cerrar sesión
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Botón menú móvil */}
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setMenuAbierto(!menuAbierto)}
          aria-label="Abrir menú"
        >
          {menuAbierto ? "✕" : "☰"}
        </button>
      </div>
    </header>
  );
}
