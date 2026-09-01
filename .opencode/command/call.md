---
description: Lanza el pipeline agéntico completo de La Parada del Sabor (orquestador → investigador → coder → auditor → ejecutor) para implementar una tarea. Uso: /call <descripción de la tarea>
agent: orquestador
---

Activa el **pipeline agéntico completo** de La Parada del Sabor para la siguiente tarea:

**TAREA:** $ARGUMENTS

Ejecuta el flujo disciplinado del orquestador, delegando en cada subagente según tu protocolo:

1. **ANALIZAR y PLANIFICAR** (tú, orquestador): interpreta la tarea, desglósala, consulta el Segundo Cerebro (`/home/yg/ObsidianVault/`) para decisiones de arquitectura/aprendizajes previos, y define la estructura de trabajo. Respeta `/home/yg/Documents/Desarrollo/la-parada-del-sabor/AGENTS.md`.
2. **INVESTIGAR** → delegar en `investigador`: reúne la información necesaria en archivos del proyecto, referencias/web y el Segundo Cerebro.
3. **INSTruir al CODER** → delegar en `coder`: con el informe del investigador, da instrucciones precisas de implementación (contexto completo e autocontenido).
4. **AUDITAR** → delegar en `auditor`: envía el set de cambios del coder + el plan original. Si dictamina RECHAZADO (GRAVEs/MEDIós), vuelvo al `coder` a corregir y re-audito (máximo ~3 ciclos; si persiste, escala al usuario).
5. **EJECUTAR** → delegar en `ejecutor`: con código APROBADO, haz build/deploy a Vercel (`vercel --prod --yes`) / scripts SQL aprobados.
6. **INFORMAR** (tú): consolida el resultado y entrégaselo al usuario de forma clara.

**Objetivos de calidad (no negociables):**
- No declares la tarea completa sin pasar el bucle Auditor (APROBADO).
- Cada resultado (tsc, lint, build, deploy, SQL) debe llevar salida real y exit code, nunca opinión.
- Cada `task` a un subagente incluye TODA la información que necesita (los subagentes no comparten tu contexto).
- Si hay SQL para Supabase, destácalo con `🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10` + el script listo para pegar.

**Notificación:** al finalizar, envía el dictamen final por Telegram (`~/.local/bin/notify-telegram`) con el formato del AGENTS.md:
```
🔔 TAREA: <nombre>
• Verificación: <tsc/lint/build — salidas reales>
• Hallazgos: [estado bucle auditor]
• Ejecución: <build/deploy/SQL — resultado real>
• Estado: ✅ LIMPIO / ⚠️ CON INCIDENCIAS
```
