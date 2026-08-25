# Reglas de Desarrollo y Colaboración — La Parada del Sabor

## 🚨 REGLAS NO NEGOCIABLES:

### 1. Auditoría Obligatoria con OpenCode (`opencode run`)
**Toda modificación de código, adición de componentes, refactorización o cambio en la web (`src/app/`, `src/lib/`, `src/components/`, `globals.css`, etc.) DEBE ser auditada exhaustivamente con OpenCode antes de darse por completada.**
```bash
opencode run "Auditoría de código para [descripción]. Revisar consistencia de tipos, edge cases, seguridad, SSR guards y performance."
```

### 2. Commit en Git & Despliegue en Vivo a Vercel Obligatorio
**Al finalizar y validar cada tarea (auditoría limpia con OpenCode y build con 0 errores):**
1. Realizar commit en Git con mensaje descriptivo (`git add ... && git commit -m "..."`).
2. Desplegar de inmediato a producción en Vercel con `vercel --prod --yes` para que los cambios queden activos en vivo en la nube (`https://la-parada-del-sabor.vercel.app`).
