# Lanzamiento San Diego (Pie de Monte / La Cumaca) — La Parada del Sabor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestructurar la Web App (/pedir y /recibo) de La Parada del Sabor para el relanzamiento en San Diego (Carabobo), adaptándola al nuevo menú en Euros (€5/€6), modalidad 100% delivery (con retiro en Villa 82), promoción de Delivery GRATIS en San Diego y selector de cocción con notas.

**Architecture:** Modificación focalizada de la capa cliente y servidor en Next.js 16.3 (`src/app/pedir/`, `src/components/modal-coccion-arepa.tsx` y `src/app/recibo/`). Se depuran las categorías obsoletas en el SSR de `page.tsx`, se unifica el símbolo de moneda a Euros (€) con tasa BCV EUR en vivo, y se conecta la promoción geográfica de San Diego desde la base operativa en Pie de Monte Chale.

**Tech Stack:** Next.js 16.3 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS, Supabase (PostgreSQL 15), API BCV (`bcv.today` EUR).

**Spec:** Especificación de investigación de Grecia, ubicación GPS Pie de Monte Chale (`10.2913187, -67.9434221`) y menú oficial Noviembre 2026.

## Global Constraints

- **Moneda Base:** Precios y visualización en Euros (€) con conversión automática a Bolívares (Bs.) según la tasa oficial BCV EUR del día.
- **Canal WhatsApp:** Mantener inmutable el teléfono `+58 412-2595386`.
- **Ubicación Base Pública:** Urbanización Pie de Monte Chale, La Cumaca, Municipio San Diego. (Nota: "Villa 82, Calle Torino" queda reservada estrictamente para publicidad interna entre vecinos de la misma residencia; para la web pública y clientes generales es solo "Urbanización Pie de Monte Chale, La Cumaca, San Diego").
- **Zonas y Promoción:** Delivery en San Diego = **0.00 € (¡GRATIS por Lanzamiento!)**.
- **Categorías fijas en UI:** `Todas` | `Tradicionales (€5)` | `Especiales (€6)` | `Especial de la Semana` | `Bebidas`. Se eliminan permanentemente de la vista "Combos", "Empanadas" y "Tetas Cream".
- **Cero rotura en POS/Caja:** Las ventas seguirán guardándose con su equivalente matemático en BD sin alterar triggers existentes.

## Review Focus

1. **Símbolo de Moneda:** En `/pedir`, modales, resumen de comanda y `/recibo/[id]` debe figurar `€` en lugar de `$`, calculando Bolívares contra la tasa EUR del BCV.
2. **Promoción Delivery Gratis en San Diego:** Al seleccionar la zona de San Diego / La Cumaca / Pie de Monte, el recargo de delivery debe ser exactamente `0.00 €`.
3. **Notas de Cocción:** El modal de cocción debe permitir ingresar texto libre ("sin cebolla", "extra salsa") y persistirlo en la comanda.
4. **Modos de Entrega:** Ocultar o desactivar "Mesa" y "Puerta Cerrada", dejando `Delivery` como opción principal y `Retiro en Villa 82 (Calle Torino)` como alternativa.
5. **Compilación Limpia:** `npm run build` debe compilar al 100% sin discrepancias de tipos TypeScript.

---

### Task 1: Actualizar Tasas y Símbolo de Moneda EUR en el Servidor (`/pedir`)

**Files:**
- Modify: `src/lib/tasas-api.ts`
- Modify: `src/app/pedir/page.tsx:15-85`

**Interfaces:**
- Consumes: `bcvToday.EUR` desde `https://bcv.today/api/v1/rate.json`.
- Produces: `tasaBcv` basada en Euro oficial y catálogo depurado sin combos ni tetas cream.

- [ ] **Step 1: Adaptar filtrado y categorías en `src/app/pedir/page.tsx`**
Excluir de la vista pública las categorías obsoletas:
```typescript
const categoriasExcluidas = new Set(
  (catRes.data || [])
    .filter((c) => {
      const nom = c.nombre.toLowerCase();
      return nom.includes("empanada") || nom.includes("raciones") || nom.includes("extras") || nom.includes("combo") || nom.includes("teta");
    })
    .map((c) => c.id)
);
```
Inyectar las categorías oficiales del nuevo menú:
- `Tradicionales (€5)`
- `Especiales (€6)`
- `Especial de la Semana`
- `Bebidas`

- [ ] **Step 2: Configurar las Zonas de Delivery de San Diego / Valencia**
Sustituir el array `zonasDelivery` con la base en Pie de Monte Chale:
```typescript
const zonasDelivery = [
  { id: "zona-sandiego", nombre: "San Diego (La Cumaca / Pie de Monte)", descripcion: "Toda la zona de San Diego, La Cumaca, El Remanso, Valle Verde", precio_usd: 0.00, tiempo_estimado_min: 25, orden: 1, activo: true },
  { id: "zona-sandiego-sur", nombre: "San Diego Sur / Los Jarales / El Morro", descripcion: "Los Jarales, El Morro, Metro Plaza", precio_usd: 1.50, tiempo_estimado_min: 30, orden: 2, activo: true },
  { id: "zona-valencia-norte", nombre: "Valencia Norte (Trigaleña, Mañongo, Prebo)", descripcion: "Trigal, Las Chimeneas, La Viña, El Viñedo", precio_usd: 3.00, tiempo_estimado_min: 45, orden: 3, activo: true },
  { id: "zona-naguanagua", nombre: "Naguanagua", descripcion: "La Granja, Tazajal, Casco Central", precio_usd: 3.50, tiempo_estimado_min: 50, orden: 4, activo: true },
];
```

- [ ] **Step 3: Obtener tasa oficial EUR del BCV**
Extraer `bcv_eur_bs` o calcular la tasa Euro de `bcv.today` para la conversión exacta en `/pedir`.

- [ ] **Step 4: Verificar compilación de la página**
Run: `npm run build`
Expected: PASS en `/pedir`.

---

### Task 2: Selector de Cocción con Campo de Notas en `modal-coccion-arepa.tsx`

**Files:**
- Modify: `src/components/modal-coccion-arepa.tsx`
- Modify: `src/app/pedir/client.tsx`

**Interfaces:**
- Consumes: Producto arepa individual seleccionado.
- Produces: `onConfirmar(coccion: "Frita" | "Asada", cantidad: number, notas?: string)`.

- [ ] **Step 1: Agregar estado `notas` en `modal-coccion-arepa.tsx`**
```typescript
const [notas, setNotas] = useState("");
```
Agregar campo textarea o input elegante:
```tsx
<div className="coccion-notas-box" style={{ marginTop: 12 }}>
  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
    Instrucciones especiales (opcional):
  </label>
  <input
    type="text"
    placeholder="Ej: sin cebolla, salsa tártara aparte..."
    value={notas}
    onChange={(e) => setNotas(e.target.value)}
    className="pedir-search-input"
    style={{ marginTop: 6, fontSize: 13 }}
  />
</div>
```

- [ ] **Step 2: Actualizar `handleElegirCoccion` para enviar notas**
Pasar `notas.trim()` al callback `onConfirmar`.

- [ ] **Step 3: Recibir y guardar notas en `src/app/pedir/client.tsx`**
Asignar la nota de cocción al ítem del carrito para que viaje a la comanda y a la cocina KDS.

- [ ] **Step 4: Actualizar visualización de precios en modal**
Cambiar `$` por `€` en los textos del modal de cocción.

---

### Task 3: Adecuación de Moneda (€), Modos de Entrega y Textos en `src/app/pedir/client.tsx`

**Files:**
- Modify: `src/app/pedir/client.tsx`

**Interfaces:**
- Consumes: Menú depurado, zonas con promo gratis y moneda Euro.
- Produces: Carrito y checkout 100% adaptado a San Diego.

- [ ] **Step 1: Símbolo visual de Euro (€)**
Reemplazar el símbolo `$` por `€` en:
- Precios de tarjetas de arepas (€5.00 / €6.00).
- Precios de bebidas (€1.50 / €2.50).
- Subtotal, delivery y total del Drawer de checkout.
- Badge flotante de tasa BCV: `Tasa BCV: [EUR] Bs.`

- [ ] **Step 2: Modo de Entrega Predeterminado y Restringido**
Fijar `tipoEntrega` predeterminado en `"delivery"`:
- Opción A: `🛵 Delivery a Domicilio (San Diego / Carabobo)`.
- Opción B: `🛍️ Retiro Rápido en Villa 82 (Calle Torino, Pie de Monte)`.
- Eliminar selectores o referencias a "Comer en Mesa" o "Puerta Cerrada".

- [ ] **Step 3: Placeholder de Dirección Local**
Ajustar el campo de dirección de entrega:
`"Ej: Pie de Monte Chale, Villa 82 / La Cumaca / Nombre de Residencia o Casa en San Diego"`

- [ ] **Step 4: Botones y Enlaces de WhatsApp**
Verificar que los enlaces `wa.me/584122595386` incluyan el texto actualizado para San Diego.

---

### Task 4: Adecuación de Recibo Digital en `src/app/recibo/[id]/client.tsx`

**Files:**
- Modify: `src/app/recibo/[id]/client.tsx`

**Interfaces:**
- Consumes: Comanda generada en Euros.
- Produces: Recibo digital en vivo con formato €, datos de pago móvil y contacto de Villa 82.

- [ ] **Step 1: Ajustar símbolo € y desglose en recibo**
Cambiar `$ ` por `€ ` en subtotales, costo de delivery y total.

- [ ] **Step 2: Actualizar dirección de retiro si el cliente eligió pickup**
Mostrar: `📍 Retiro: Urbanización Pie de Monte Chale, Villa 82 (Calle Torino), La Cumaca, San Diego`.

- [ ] **Step 3: Comprobar botón de confirmación por WhatsApp**
Asegurar que el cliente pueda notificar su pago a Grecia (`584122595386`) con un solo toque.

---

### Task 5: Sincronización en Obsidian Vault & Playbook Oficial

**Files:**
- Modify: `/home/yg/ObsidianVault/02-Proyectos/La-Parada-del-Sabor-Valencia-Sincronizacion.md`
- Modify: `/home/yg/ObsidianVault/02-Proyectos/PlaybookLaParadaDelSabor.md`

- [ ] **Step 1: Asentar menú oficial en Euros en el Blackboard**
Actualizar tablas con Pelúa, Catira, Reina Pepiada, Sencilla (€5) y Especial de la Casa (€6), bebidas (€1.5–€2.5) y delivery gratis en San Diego.

- [ ] **Step 2: Asentar ubicación exacta GPS y Villa 82**

---

### Task 6: Validación de Build y Despliegue a Producción

**Files:**
- Repository: `~/Documents/Desarrollo/la-parada-del-sabor`

- [ ] **Step 1: Compilar proyecto Next.js en local**
Run: `cd ~/Documents/Desarrollo/la-parada-del-sabor && npm run build`
Expected: Build exitoso sin errores de TypeScript ni ESLint.

- [ ] **Step 2: Commit y Push a Vercel**
```bash
git add .
git commit -m "feat(san-diego): relanzamiento en San Diego con menu en Euros, delivery gratis y retiro en Villa 82"
git push origin master
```

- [ ] **Step 3: Verificación visual en teléfono real**
Acceder a `https://la-parada-del-sabor.vercel.app/pedir`, comprobar que el menú en Euros cargue de inmediato, el selector de Frita/Asada admita notas y el delivery en San Diego marque €0.00.
