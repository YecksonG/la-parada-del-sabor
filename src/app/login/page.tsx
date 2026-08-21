"use client";

import { useActionState, useState, useEffect, useId, useRef } from "react";
import { login, LoginState } from "./actions";
import ThemeToggle from "@/components/theme-toggle";

const initialState: LoginState = {
  error: null,
};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [capsLockActivo, setCapsLockActivo] = useState(false);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [segundosBloqueo, setSegundosBloqueo] = useState(0);
  const [sacudir, setSacudir] = useState(false);

  const emailId = useId();
  const passwordId = useId();
  const lastStateRef = useRef<LoginState>(initialState);

  // Cargar bloqueo guardado
  useEffect(() => {
    try {
      const savedBloqueo = localStorage.getItem("parada_login_lock");
      if (savedBloqueo) {
        const tiempoRestante = Math.ceil((parseInt(savedBloqueo, 10) - Date.now()) / 1000);
        if (tiempoRestante > 0) {
          setSegundosBloqueo(tiempoRestante);
          setIntentosFallidos(5);
        } else {
          localStorage.removeItem("parada_login_lock");
        }
      }
    } catch {}
  }, []);

  // Temporizador de cuenta regresiva
  useEffect(() => {
    if (segundosBloqueo <= 0) return;

    const interval = setInterval(() => {
      setSegundosBloqueo((prev) => {
        if (prev <= 1) {
          try {
            localStorage.removeItem("parada_login_lock");
          } catch {}
          setIntentosFallidos(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [segundosBloqueo]);

  // Manejar errores
  useEffect(() => {
    if (state !== lastStateRef.current && state?.error) {
      lastStateRef.current = state;
      setSacudir(true);
      const timerShake = setTimeout(() => setSacudir(false), 500);

      const nuevosIntentos = intentosFallidos + 1;
      setIntentosFallidos(nuevosIntentos);

      if (nuevosIntentos >= 5) {
        const lockUntil = Date.now() + 60 * 1000;
        try {
          localStorage.setItem("parada_login_lock", lockUntil.toString());
        } catch {}
        setSegundosBloqueo(60);
      }

      return () => clearTimeout(timerShake);
    }
  }, [state, intentosFallidos]);

  const handleKeyCheck = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActivo(e.getModifierState("CapsLock"));
    }
  };

  const estaBloqueado = segundosBloqueo > 0;
  const emailValido = emailInput.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput);

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
          <span style={{ fontSize: 24 }}>🫓</span>
        </div>
        <div className="floating-brand-text">
          <span className="brand-name-main">La Parada</span>
          <span className="brand-name-accent">del Sabor</span>
        </div>
      </aside>

      <div className={`login-card ${sacudir ? "login-shake" : ""}`}>
        {/* Cabecera */}
        <header className="login-header">
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

        {state?.error && !estaBloqueado && (
          <div className="login-error-box" role="alert" aria-live="assertive">
            <span className="login-error-icon">✕</span>
            <span>{state.error}</span>
          </div>
        )}

        {/* Formulario */}
        <form action={formAction} className="login-form">
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
                disabled={estaBloqueado || pending}
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
                disabled={estaBloqueado || pending}
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
            disabled={estaBloqueado || pending || !emailValido || emailInput.length === 0 || passwordInput.length === 0}
            className="login-submit-btn"
          >
            {pending ? (
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
