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

type NavCategory = {
  id: string;
  label: string;
  icon: string;
  items: {
    href: string;
    label: string;
    icon: string;
    desc: string;
  }[];
};

export default function TopbarNav({ nombre, bcvTasa }: TopbarNavProps) {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [dropdownUsuario, setDropdownUsuario] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const inicial = nombre.charAt(0).toUpperCase();

  // Enlaces de Acción Rápida (Operativos del Día a Día)
  const enlacesDirectos = [
    { href: "/", label: "POS", icon: "🛒" },
    { href: "/ventas", label: "Comandas", icon: "📋" },
    { href: "/caja", label: "Caja", icon: "💰" },
  ];

  // Categorías de Gestión Agrupadas
  const categoriasNav: NavCategory[] = [
    {
      id: "cocina",
      label: "Cocina & Stock",
      icon: "🌾",
      items: [
        {
          href: "/recetas",
          label: "Recetas & Escandallo",
          icon: "🌾",
          desc: "Fórmulas exactas y costos por ración",
        },
        {
          href: "/insumos",
          label: "Despensa & Stock",
          icon: "📦",
          desc: "Stock, inventario y alertas mínimas",
        },
      ],
    },
    {
      id: "directorio",
      label: "Directorio",
      icon: "👥",
      items: [
        {
          href: "/proveedores",
          label: "Proveedores",
          icon: "🏢",
          desc: "Directorio e insumos suministrados",
        },
        {
          href: "/clientes",
          label: "Clientes",
          icon: "👥",
          desc: "Historial, fidelidad y cuentas",
        },
      ],
    },
    {
      id: "gestion",
      label: "Gestión",
      icon: "📊",
      items: [
        {
          href: "/dashboard",
          label: "Dashboard",
          icon: "📊",
          desc: "Métricas, ventas y finanzas en vivo",
        },
        {
          href: "/gastos",
          label: "Compras & Gastos",
          icon: "💼",
          desc: "Entrada de stock, servicios, nómina y cuentas",
        },
        {
          href: "/tasas",
          label: "Tasas Cambiarias",
          icon: "💵",
          desc: "BCV, Paralelo y calculadora dual",
        },
      ],
    },
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

  // Cerrar menús al cambiar de ruta
  useEffect(() => {
    setMenuAbierto(false);
    setDropdownUsuario(false);
    setActiveDropdown(null);
  }, [pathname]);

  // Click outside y Escape para cerrar dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setDropdownUsuario(false);
      }
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdownUsuario(false);
        setActiveDropdown(null);
        setMenuAbierto(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleDropdown = (id: string) => {
    sounds.playPop();
    setActiveDropdown((prev) => (prev === id ? null : id));
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Botón Móvil Hamburguesa */}
        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={() => {
            sounds.playPop();
            setMenuAbierto(!menuAbierto);
          }}
          aria-label="Abrir menú de navegación"
          aria-expanded={menuAbierto}
        >
          {menuAbierto ? "✕" : "☰"}
        </button>

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

      {/* Navegación Principal Categorizada */}
      <nav ref={navRef} className={`topbar-nav ${menuAbierto ? "nav-open" : ""}`}>
        {/* Grupo Móvil: Operaciones */}
        <div className="mobile-nav-group-title">
          ⚡ Operaciones
        </div>

        {/* Enlaces directos (POS, Comandas, Caja) */}
        {enlacesDirectos.map((enlace) => {
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

        {/* Categorías con Desplegable */}
        {categoriasNav.map((cat) => {
          const isCategoryActive = cat.items.some((item) => pathname === item.href);
          const isOpen = activeDropdown === cat.id;

          return (
            <div key={cat.id} className="nav-dropdown-wrapper">
              {/* En Móvil: Título del grupo */}
              <div className="mobile-nav-group-title">
                {cat.icon} {cat.label}
              </div>

              {/* Botón Trigger en Desktop */}
              <button
                type="button"
                className={`nav-dropdown-trigger ${isCategoryActive ? "active" : ""}`}
                onClick={() => toggleDropdown(cat.id)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className={`nav-dropdown-chevron ${isOpen ? "open" : ""}`}>▼</span>
              </button>

              {/* Menú Desplegable en Desktop */}
              {isOpen && (
                <div className="nav-dropdown-menu" role="menu">
                  {cat.items.map((item) => {
                    const isItemActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          sounds.playPop();
                          setActiveDropdown(null);
                        }}
                        className={`nav-dropdown-item ${isItemActive ? "active" : ""}`}
                        role="menuitem"
                      >
                        <span className="nav-dropdown-item-icon">{item.icon}</span>
                        <div className="nav-dropdown-item-info">
                          <span className="nav-dropdown-item-title">{item.label}</span>
                          <span className="nav-dropdown-item-desc">{item.desc}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* En Móvil: Mostrar items directamente */}
              <div className="mobile-nav-subitems">
                {cat.items.map((item) => {
                  const isItemActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => sounds.playPop()}
                      className={`nav-link ${isItemActive ? "nav-link-active" : ""}`}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
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
          aria-label={soundEnabled ? "Silenciar sonidos gourmet" : "Activar sonidos gourmet"}
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
