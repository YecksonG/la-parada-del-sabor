# Reglas de Desarrollo y Colaboración — La Parada del Sabor

## 🚨 REGLA NO NEGOCIABLE: Auditoría Obligatoria con OpenCode

**Toda modificación de código, adición de componentes, refactorización o cambio en la web (`src/app/`, `src/lib/`, `src/components/`, `globals.css`, etc.) DEBE ser auditada exhaustivamente con OpenCode (`opencode run`) antes de darse por completada.**

### Protocolo de Validación en Cada Tarea:
1. **Implementación de Cambios:** Escribir el código TypeScript/React/CSS siguiendo las mejores prácticas y el design system del proyecto.
2. **Verificación de Tipos y Build:** Ejecutar `npx tsc --noEmit` y `npm run build` para asegurar 0 errores de compilación.
3. **Auditoría con OpenCode (OBLIGATORIA):**
   ```bash
   opencode run "Auditoría de código para [descripción de la tarea]. Revisar consistencia de tipos, edge cases, seguridad, SSR guards y performance."
   ```
4. **Subsanación Inmediata:** Si OpenCode encuentra cualquier error, inconsistencia o bug de UX, debe corregirse y re-auditarse de inmediato hasta obtener veredicto 100% limpio.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
