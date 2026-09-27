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
  icon: string | React.ReactNode;
  items: {
    href: string;
    label: string;
    icon: string | React.ReactNode;
    desc: string;
  }[];
};

function IconPlancha() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function IconCash() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <line x1="9" y1="22" x2="9" y2="22.01" />
      <line x1="15" y1="22" x2="15" y2="22.01" />
      <line x1="9" y1="6" x2="9" y2="6.01" />
      <line x1="15" y1="6" x2="15" y2="6.01" />
      <line x1="9" y1="10" x2="9" y2="10.01" />
      <line x1="15" y1="10" x2="15" y2="10.01" />
      <line x1="9" y1="14" x2="9" y2="14.01" />
      <line x1="15" y1="14" x2="15" y2="14.01" />
      <line x1="9" y1="18" x2="9" y2="18.01" />
      <line x1="15" y1="18" x2="15" y2="18.01" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function IconCurrency() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconBellOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle" }} aria-hidden="true">
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

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
  const enlacesDirectos: { href: string; label: string; icon: React.ReactNode }[] = [
    { href: "/", label: "POS", icon: <IconCart /> },
    { href: "/ventas", label: "Comandas", icon: <IconClipboard /> },
    { href: "/cocina", label: "Cocina KDS", icon: <IconPlancha /> },
    { href: "/caja", label: "Caja", icon: <IconCash /> },
  ];

  // Categorías de Gestión Agrupadas
  const categoriasNav: NavCategory[] = [
    {
      id: "web",
      label: "Canal Digital",
      icon: <IconGlobe />,
      items: [
        {
          href: "/pedir",
          label: "Menú Online de Clientes",
          icon: <IconGlobe />,
          desc: "Portal de autoservicio para pedidos web",
        },
      ],
    },
    {
      id: "cocina",
      label: "Cocina & Stock",
      icon: <IconBook />,
      items: [
        {
          href: "/recetas",
          label: "Recetas & Escandallo",
          icon: <IconBook />,
          desc: "Fórmulas exactas y costos por ración",
        },
        {
          href: "/insumos",
          label: "Despensa & Stock",
          icon: <IconBox />,
          desc: "Stock, inventario y alertas mínimas",
        },
      ],
    },
    {
      id: "directorio",
      label: "Directorio",
      icon: <IconUsers />,
      items: [
        {
          href: "/proveedores",
          label: "Proveedores",
          icon: <IconBuilding />,
          desc: "Directorio e insumos suministrados",
        },
        {
          href: "/clientes",
          label: "Clientes",
          icon: <IconUsers />,
          desc: "Historial, fidelidad y cuentas",
        },
      ],
    },
    {
      id: "gestion",
      label: "Gestión",
      icon: <IconChart />,
      items: [
        {
          href: "/dashboard",
          label: "Dashboard",
          icon: <IconChart />,
          desc: "Métricas, ventas y finanzas en vivo",
        },
        {
          href: "/gastos",
          label: "Compras & Gastos",
          icon: <IconBriefcase />,
          desc: "Entrada de stock, servicios, nómina y cuentas",
        },
        {
          href: "/tasas",
          label: "Tasas Cambiarias",
          icon: <IconCurrency />,
          desc: "BCV, Paralelo y calculadora dual",
        },
      ],
    },
  ];

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSoundEnabled(sounds.isEnabled());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleToggleSound = () => {
    const nextState = sounds.toggleSound();
    setSoundEnabled(nextState);
  };

  // Cerrar menús al cambiar de ruta ajustando estado en render (patrón recomendado por React)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMenuAbierto(false);
    setDropdownUsuario(false);
    setActiveDropdown(null);
  }

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

  // Bloquear scroll de la página cuando el menú móvil está abierto
  useEffect(() => {
    if (menuAbierto) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuAbierto]);

  return (
    <>
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
            {menuAbierto ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>

          <Link href="/" className="topbar-brand" onClick={() => sounds.playPop()}>
            <Image
              src="/images/logo-horizontal.png"
              alt="La Parada del Sabor"
              width={150}
              height={44}
              className="topbar-horizontal-logo logo-light-only"
              style={{ objectFit: "contain", height: "36px", width: "auto" }}
            />
            <Image
              src="/images/logo-horizontal-dark.png"
              alt="La Parada del Sabor"
              width={150}
              height={44}
              className="topbar-horizontal-logo logo-dark-only"
              style={{ objectFit: "contain", height: "36px", width: "auto" }}
            />
          </Link>
        </div>

        {/* Navegación Desktop Categorizada */}
        <nav ref={navRef} className="topbar-nav desktop-nav-only">
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
                <button
                  type="button"
                  className={`nav-dropdown-trigger ${isCategoryActive ? "active" : ""}`}
                  onClick={() => toggleDropdown(cat.id)}
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`nav-dropdown-chevron ${isOpen ? "open" : ""}`} aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

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
              </div>
            );
          })}
        </nav>

        <div className="topbar-right">
          {/* Tasa BCV */}
          {bcvTasa && (
            <Link href="/tasas" className="bcv-pill" title="Tasa oficial BCV (clic para ver tasas)">
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
            {soundEnabled ? <IconBell /> : <IconBellOff />}
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
                <Link href="/dashboard" className="nav-link" style={{ padding: "8px 10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <IconChart /> Ver Dashboard
                </Link>
                <Link href="/caja" className="nav-link" style={{ padding: "8px 10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <IconCash /> Control de Caja
                </Link>
                <div className="dropdown-divider"></div>
                <form action={cerrarSesion}>
                  <button type="submit" className="dropdown-logout-btn">
                    Cerrar Sesión
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* DRAWER MÓVIL SLIDE-OVER CON BACKDROP COMPLETO */}
      {menuAbierto && (
        <div className="mobile-drawer-overlay" onClick={() => setMenuAbierto(false)}>
          <aside
            className="mobile-drawer-panel"
            onClick={(e) => e.stopPropagation()}
            aria-label="Menú principal de navegación"
          >
            {/* Header del Drawer Móvil */}
            <div className="mobile-drawer-header">
              <div className="mobile-drawer-brand">
                <Image
                  src="/images/logo-horizontal.png"
                  alt="La Parada del Sabor"
                  width={160}
                  height={50}
                  className="logo-light-only"
                  style={{ objectFit: "contain", height: "42px", width: "auto" }}
                />
                <Image
                  src="/images/logo-horizontal-dark.png"
                  alt="La Parada del Sabor"
                  width={160}
                  height={50}
                  className="logo-dark-only"
                  style={{ objectFit: "contain", height: "42px", width: "auto" }}
                />
              </div>
              <button
                type="button"
                className="mobile-drawer-close-btn"
                onClick={() => setMenuAbierto(false)}
                aria-label="Cerrar menú"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Contenido de Enlaces Agrupados */}
            <div className="mobile-drawer-body">
              {/* Sección 1: Operaciones */}
              <div className="mobile-drawer-group">
                <div className="mobile-drawer-group-label">Operaciones</div>
                {enlacesDirectos.map((enlace) => {
                  const activo = pathname === enlace.href;
                  return (
                    <Link
                      key={enlace.href}
                      href={enlace.href}
                      onClick={() => {
                        sounds.playPop();
                        setMenuAbierto(false);
                      }}
                      className={`mobile-drawer-link ${activo ? "active" : ""}`}
                    >
                      <span className="mobile-drawer-link-icon">{enlace.icon}</span>
                      <span className="mobile-drawer-link-text">{enlace.label}</span>
                      {activo && <span className="mobile-drawer-link-active-dot">●</span>}
                    </Link>
                  );
                })}
              </div>

              {/* Secciones Categorizadas */}
              {categoriasNav.map((cat) => (
                <div key={cat.id} className="mobile-drawer-group">
                  <div className="mobile-drawer-group-label">
                    {cat.icon} {cat.label}
                  </div>
                  {cat.items.map((item) => {
                    const activo = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          sounds.playPop();
                          setMenuAbierto(false);
                        }}
                        className={`mobile-drawer-link ${activo ? "active" : ""}`}
                      >
                        <span className="mobile-drawer-link-icon">{item.icon}</span>
                        <div className="mobile-drawer-link-content">
                          <span className="mobile-drawer-link-text">{item.label}</span>
                          <span className="mobile-drawer-link-desc">{item.desc}</span>
                        </div>
                        {activo && <span className="mobile-drawer-link-active-dot">●</span>}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer del Drawer Móvil */}
            <div className="mobile-drawer-footer">
              <div className="mobile-drawer-user-info">
                <div className="mobile-drawer-user-avatar">{inicial}</div>
                <div className="mobile-drawer-user-details">
                  <span className="mobile-drawer-user-name">{nombre}</span>
                  <span className="mobile-drawer-user-badge">Operador Activo</span>
                </div>
              </div>
              <form action={cerrarSesion} style={{ width: "100%" }}>
                <button type="submit" className="mobile-drawer-logout-btn">
                  Cerrar Sesión
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
