"use client";

import { useState, useEffect, useId } from "react";
import Image from "next/image";
import ThemeToggle from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { loginWithRateLimit, registrarLoginExitoso } from "./actions";

export default function LoginPage() {
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [capsLockActivo, setCapsLockActivo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [segundosBloqueo, setSegundosBloqueo] = useState(0);
  const [sacudir, setSacudir] = useState(false);

  const emailId = useId();
  const passwordId = useId();

  // Ya no usamos el bloqueo de localStorage por seguridad, 
  // la base de datos es la fuente de la verdad para el Rate Limit.

  // Temporizador de cuenta regresiva de bloqueo visual
  useEffect(() => {
    if (segundosBloqueo <= 0) return;

    const interval = setInterval(() => {
      setSegundosBloqueo((prev) => {
        if (prev <= 1) {
          setIntentosFallidos(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [segundosBloqueo]);

  const handleKeyCheck = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActivo(e.getModifierState("CapsLock"));
    }
  };

  const estaBloqueado = segundosBloqueo > 0;
  const emailValido = emailInput.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (estaBloqueado || cargando || !emailInput || !passwordInput) return;

    setErrorMsg(null);
    setCargando(true);

    try {
      // 1. Validar Rate Limit de forma segura en el servidor
      const rateCheck = await loginWithRateLimit(emailInput, passwordInput);
      
      if (rateCheck.error) {
        setErrorMsg(rateCheck.error);
        setSacudir(true);
        setTimeout(() => setSacudir(false), 500);
        
        // Bloquear interfaz si la BD dice que estamos bloqueados
        if (rateCheck.error.includes("bloqueado")) {
          // Extraer minutos (simplificado, la DB es la que bloquea de todas formas)
          setSegundosBloqueo(15 * 60); 
        }
        setCargando(false);
        return;
      }

      // 2. Ejecutar Login Real
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim().toLowerCase(),
        password: passwordInput,
      });

      if (error) {
        setErrorMsg("Credenciales incorrectas. Verifica tu correo y contraseña.");
        setSacudir(true);
        setTimeout(() => setSacudir(false), 500);
        setCargando(false);
        return;
      }

      if (data?.session) {
        // Limpiar intentos en servidor
        if (rateCheck.rateLimitKey) {
          await registrarLoginExitoso(rateCheck.rateLimitKey);
        }
        window.location.href = "/";
      } else {
        setCargando(false);
      }
    } catch (err: unknown) {
      console.error("Error en autenticación:", err);
      setErrorMsg("Error de conexión al autenticar. Intenta nuevamente.");
      setCargando(false);
    }
  };

  return (
    <main className="login-main">
      <div className="login-backdrop-glow" />

      {/* Switch de Tema Claro / Oscuro */}
      <div className="login-theme-switch-container">
        <ThemeToggle />
      </div>

      {/* Widget Interactivo Inferior Izquierdo */}
      <aside className="login-floating-brand" title="La Parada del Sabor">
        <div className="floating-brand-logo">
          <Image src="/images/logo-badge.png" alt="Logo" width={26} height={26} />
        </div>
        <div className="floating-brand-text">
          <span className="brand-name-main">La Parada</span>
          <span className="brand-name-accent">del Sabor</span>
        </div>
      </aside>

      <div className={`login-card ${sacudir ? "login-shake" : ""}`}>
        {/* Cabecera */}
        <header className="login-header">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Image
              src="/images/logo-badge.png"
              alt="Logo La Parada del Sabor"
              width={88}
              height={88}
              className="login-logo-badge-img"
              priority
            />
          </div>

          <div className="login-status-row">
            <span className="login-status-pill">
              <span className="status-dot-pulse"></span>
              🟢 Cocina & POS Online
            </span>
          </div>

          <h1 className="login-brand-title">
            <span className="brand-name-main">La Parada </span>
            <span className="brand-name-accent">del Sabor</span>
          </h1>
          <p className="login-subtitle">
            Punto de Venta & Control Gastronómico por Gramos
          </p>
        </header>

        {/* Bloqueo y Alertas */}
        {estaBloqueado && (
          <div className="login-lockout-banner" role="alert" aria-live="assertive">
            <span className="lockout-icon">⏳</span>
            <div className="lockout-content">
              <strong>Acceso bloqueado temporalmente</strong>
              <span>
                Demasiados intentos fallidos. Espera{" "}
                <span className="lockout-countdown">{segundosBloqueo}s</span> para reintentar.
              </span>
            </div>
          </div>
        )}

        {!estaBloqueado && intentosFallidos >= 3 && (
          <div className="login-warning-banner" role="status" aria-live="polite">
            ⚠️ Atención: {intentosFallidos} de 5 intentos utilizados antes del bloqueo.
          </div>
        )}

        {errorMsg && !estaBloqueado && (
          <div className="login-error-box" role="alert" aria-live="assertive">
            <span className="login-error-icon">✕</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <div className="login-field-header">
              <label htmlFor={emailId}>Correo electrónico</label>
              {!emailValido && (
                <span className="field-hint-error">Formato inválido</span>
              )}
            </div>
            <div className="login-input-wrapper">
              <span className="input-prefix-icon">📧</span>
              <input
                id={emailId}
                name="email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="operador@laparadadelsabor.com"
                autoComplete="email"
                required
                disabled={estaBloqueado || cargando}
                className={`login-input ${!emailValido ? "input-invalid" : ""}`}
              />
            </div>
          </div>

          <div className="login-field">
            <div className="login-field-header">
              <label htmlFor={passwordId}>Contraseña de acceso</label>
              {capsLockActivo && (
                <span className="caps-lock-badge">⇪ Bloq Mayús activo</span>
              )}
            </div>
            <div className="login-input-wrapper">
              <span className="input-prefix-icon">🔒</span>
              <input
                id={passwordId}
                name="password"
                type={mostrarPassword ? "text" : "password"}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={handleKeyCheck}
                onKeyUp={handleKeyCheck}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
                disabled={estaBloqueado || cargando}
                className="login-input login-input-password"
              />
              <button
                type="button"
                className="btn-toggle-password"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                tabIndex={-1}
                title={mostrarPassword ? "Ocultar contraseña" : "Ver contraseña"}
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {mostrarPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={estaBloqueado || cargando || !emailValido || emailInput.length === 0 || passwordInput.length === 0}
            className="login-submit-btn"
          >
            {cargando ? (
              <span className="submit-loading-text">
                <span className="login-spinner"></span>
                Autenticando operador...
              </span>
            ) : estaBloqueado ? (
              `Bloqueado (${segundosBloqueo}s)`
            ) : (
              "Ingresar"
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="login-footer-security">
            🫓 Sistema Gourmet · Falcón, VE
          </p>
        </div>
      </div>
    </main>
  );
}
