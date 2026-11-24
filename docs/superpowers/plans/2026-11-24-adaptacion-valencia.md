# Adaptación de Sede Valencia — La Parada del Sabor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaptar el ecosistema completo de La Parada del Sabor (código web Next.js, escandallo/gramajes y canal de ventas de WhatsApp) para el inicio inmediato de operaciones en Valencia, Estado Carabobo.

**Architecture:** Estrategia multi-frente modular dividida en 3 áreas independientes (Código, Costeo/Operación, Comercial/WhatsApp) sincronizadas a través del Obsidian Vault como Blackboard central (`~/ObsidianVault/02-Proyectos/La-Parada-del-Sabor-Valencia-Sincronizacion.md`), garantizando cero colisiones y avance simultáneo.

**Tech Stack:** Next.js 16.3 (Turbopack, App Router), React 19, Supabase (PostgreSQL 15, RLS), TypeScript, Tailwind CSS, Obsidian Second Brain, WhatsApp Business.

**Spec:** `~/ObsidianVault/02-Proyectos/PLAN_ORGANIZACION_PERSONAL_Y_FAMILIAR_VALENCIA.md` y `~/ObsidianVault/02-Proyectos/La-Parada-del-Sabor-Contexto-Esencial.md`

## Global Constraints

- Sincronización estricta: Todo parámetro de negocio (zonas, precios, teléfono) se registra en `La-Parada-del-Sabor-Valencia-Sincronizacion.md` antes de reflejarse en código o copys.
- Preservar endpoint dinámico de Tasa BCV (`/api/bcv`) sin romper el cálculo automático en Bolívares.
- Canales de contacto: Actualizar enlaces `wa.me` al número activo de recepción de pedidos operado por Grecia.
- Gramaje estandarizado inamovible: 70g de proteína cocida por arepa para evitar el sobre-porcionamiento de Punto Fijo.
- Cero alteración destructiva de datos históricos de Falcón en Supabase.

## Review Focus

1. **Enlaces WhatsApp en `/pedir` y `/recibo/[id]`:** No deben conservar números obsoletos; deben abrir el chat de Grecia con mensaje pre-cargado.
2. **Fallback de Delivery en código:** Si Supabase no responde o está vacío, `zonasDelivery` debe desplegar zonas de Valencia y no de Paraguaná.
3. **Cálculo de Tasa BCV en checkout:** La conversión de combos y delivery de USD a Bs debe ser exacta con la tasa en vivo.
4. **Coherencia Menú Web vs WhatsApp:** Los precios y nombres de combos en el catálogo de WhatsApp deben coincidir con la web.
5. **Ergonomía Operativa de Grecia:** Todo el flujo comercial debe ser accionable en 2 toques desde el teléfono.

---

### Task 1: Crear el Hub Central de Sincronización en Obsidian

**Files:**
- Create: `/home/yg/ObsidianVault/02-Proyectos/La-Parada-del-Sabor-Valencia-Sincronizacion.md`

**Interfaces:**
- Consumes: Especificación del Plan Valencia (`PLAN_ORGANIZACION_PERSONAL_Y_FAMILIAR_VALENCIA.md`).
- Produces: Fuente única de verdad leída por los 3 chats paralelos (Zonas, Precios, Teléfonos, Horarios).

- [ ] **Step 1: Crear nota maestra de sincronización**
Crear `/home/yg/ObsidianVault/02-Proyectos/La-Parada-del-Sabor-Valencia-Sincronizacion.md` con tablas de:
- Teléfono receptor de WhatsApp oficial.
- Tabla de Zonas de Valencia y tarifas de delivery estimadas.
- Lista de Precios oficiales de Combos y Arepas.
- Horarios de venta (Almuerzos 11:30 - 13:30 / Cenas 19:00 - 21:00).
- Estado de cada frente (Chat A, Chat B, Chat C).

- [ ] **Step 2: Verificar renderizado y enlaces de Obsidian**
Comprobar con `lint-vault.sh` o lectura local que la nota está enlazada al MOC y al Contexto Esencial.

- [ ] **Step 3: Commit inicial en Vault**
Registrar la nota en el git del Vault.

---

### Task 2: Frente A (Código) — Actualización de Zonas de Delivery de Valencia

**Files:**
- Modify: `src/app/pedir/page.tsx:65-76`
- Modify: `src/components/modal-seleccionar-zona-delivery.tsx`
- Read: `src/types/database.ts`

**Interfaces:**
- Consumes: Zonas y tarifas definidas en `La-Parada-del-Sabor-Valencia-Sincronizacion.md`.
- Produces: `zonasDelivery` actualizadas en el servidor y renderizadas en el selector móvil de `/pedir`.

- [ ] **Step 1: Reemplazar el array de fallback de zonas en `src/app/pedir/page.tsx`**
Sustituir los 9 niveles de Punto Fijo por las zonas de Valencia acordadas (ej. Zona 1: Sector Local / Alrededores $1.50; Zona 2: Prebo, Trigaleña, Mañongo $2.50; Zona 3: El Viñedo, San José, El Recreo $3.00; Zona 4: San Diego, Los Guayos, Naguanagua $4.00, etc.).

- [ ] **Step 2: Verificar selector modal `ModalSeleccionarZonaDelivery`**
Asegurar que el buscador filtra correctamente por los nuevos nombres de urbanizaciones de Valencia.

- [ ] **Step 3: Ejecutar build de prueba**
Run: `cd ~/Documents/Desarrollo/la-parada-del-sabor && npm run build`
Expected: PASS (sin errores de compilación ni tipos).

- [ ] **Step 4: Commit en repositorio**
```bash
git add src/app/pedir/page.tsx
git commit -m "feat(pedir): actualizar zonas y niveles de delivery para sede Valencia"
```

---

### Task 3: Frente A (Código) — Actualización de Enlaces WhatsApp y Recibo Digital

**Files:**
- Modify: `src/app/pedir/client.tsx:2280-2305`
- Modify: `src/app/recibo/[id]/client.tsx:360-370, 915-920, 1060-1070`

**Interfaces:**
- Consumes: Teléfono activo de Grecia registrado en el Hub de Sincronización.
- Produces: Botones flotantes y de confirmación que disparan WhatsApp directo al número correcto.

- [ ] **Step 1: Actualizar número de WhatsApp en `/pedir`**
Reemplazar `584122595386` por el número comercial activo acordado para Grecia en los enlaces `wa.me`.

- [ ] **Step 2: Actualizar número de WhatsApp y datos de pago en `/recibo/[id]`**
Actualizar el enlace de confirmación directa de comanda en el recibo digital para que el cliente envíe el comprobante a Grecia con un solo clic.

- [ ] **Step 3: Verificar build completo**
Run: `npm run build`
Expected: PASS limpio.

- [ ] **Step 4: Commit en repositorio**
```bash
git add src/app/pedir/client.tsx src/app/recibo/[id]/client.tsx
git commit -m "fix(whatsapp): actualizar canal de recepcion y confirmacion de pedidos"
```

---

### Task 4: Frente B (Costeo & Operación) — Estandarización de Gramajes y Margen

**Files:**
- Modify: `/home/yg/ObsidianVault/02-Proyectos/La-Parada-del-Sabor-Contexto-Esencial.md`
- Modify: `/home/yg/ObsidianVault/02-Proyectos/PlaybookLaParadaDelSabor.md`

**Interfaces:**
- Consumes: Precios de compra en Valencia (carnicería, charcutería, harina).
- Produces: Tabla de escandallo estandarizado (70g carne/pollo cocido por arepa) y confirmación de margen >50% en combos ($5, $8, $15).

- [ ] **Step 1: Documentar escandallo de protección de margen**
Fijar en el Contexto Esencial el gramaje de 70g por porción cocida y el cálculo de rendimiento por kilo de carne y pechuga.

- [ ] **Step 2: Actualizar reglas de compras mayoristas**
Establecer puntos de compra eficientes en Valencia y el stock mínimo para no interrumpir el despacho diario.

- [ ] **Step 3: Actualizar Hub de Sincronización**
Reflejar la tabla final en `La-Parada-del-Sabor-Valencia-Sincronizacion.md`.

---

### Task 5: Frente C (Comercial) — Catálogo WhatsApp, Copys y Protocolo para Grecia

**Files:**
- Create: `/home/yg/ObsidianVault/02-Proyectos/La-Parada-del-Sabor-Comercial-WhatsApp-Valencia.md`

**Interfaces:**
- Consumes: Precios, combos y zonas validadas de Tasks 2 y 4.
- Produces: Kit listo para copiar y pegar en WhatsApp Business (Catálogo, Estados de Almuerzo y Cenas, Mensajes Rápidos).

- [ ] **Step 1: Redactar plantilla de lanzamiento "¡Llegamos a Valencia!"**
Textos directos para estados de WhatsApp y difusión rápida a contactos locales.

- [ ] **Step 2: Redactar menú diario simplificado y respuestas rápidas**
Plantilla para que Grecia responda en 1 segundo:
- Menú y combos disponibles hoy.
- Datos de Pago Móvil con consulta de tasa BCV del día.
- Confirmación de orden y tiempo de entrega.

- [ ] **Step 3: Vincular en el Vault y registrar avance en Hub**

---

### Task 6: Integración Final y Despliegue a Producción

**Files:**
- Repository: `la-parada-del-sabor`

- [ ] **Step 1: Validar build de producción local**
Run: `npm run build`

- [ ] **Step 2: Desplegar cambios a producción (Vercel)**
Run: `git push origin master`

- [ ] **Step 3: Prueba de fuego en teléfono real**
Abrir `https://la-parada-del-sabor.vercel.app/pedir` en el móvil, seleccionar una zona de Valencia, armar un pedido y verificar que el botón de WhatsApp abra el chat con Grecia.
