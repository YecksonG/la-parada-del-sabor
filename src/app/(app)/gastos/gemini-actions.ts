"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-guard";
import type { Insumo, Proveedor } from "@/types/database";
import { CATEGORIAS_INSUMO, normalizarCategoriaInsumo } from "@/lib/categoria-insumo";

export type InsumoExtraido = {
  insumo_id: string;
  nombre_extraido: string;
  cantidad: number;
  unidad: string;
  monto_usd: number;
  categoria_sugerida?: string;
  unidad_base?: string;
};

interface FacturaParsedItem {
  insumo_id: string;
  nombre_extraido: string;
  cantidad: number;
  unidad: string;
  precio_unitario?: number | null;
  monto_extraido: number;
  monto_usd?: number;
  categoria_sugerida?: string;
  unidad_base?: string;
  insumo_nuevo_creado?: boolean;
}

interface FacturaParsedResponse {
  moneda_detectada: string;
  numero_factura: string;
  total_factura_detectado: number | null;
  proveedor?: {
    id?: string;
    nombre?: string;
    rif?: string | null;
    direccion?: string | null;
    telefono?: string | null;
    contacto?: string | null;
  };
  proveedor_final?: Proveedor | null;
  items: FacturaParsedItem[];
  insumos_creados: Insumo[];
}

function parseMonto(val: unknown): number | null {
  if (typeof val === "number") return isNaN(val) ? null : val;
  if (typeof val !== "string") return null;
  const s = val.replace(/[^0-9,.-]/g, "").trim();
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized = s;
  if (lastDot > -1 && lastComma > -1) {
    if (lastComma > lastDot) {
      // Formato venezolano/europeo: 1.234,56
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato estándar: 1,234.56
      normalized = s.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    normalized = s.replace(",", ".");
  }
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

function safeTrim(val: unknown): string {
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" && !isNaN(val)) return String(val).trim();
  return "";
}

function esBolivares(moneda: string | null | undefined): boolean {
  if (!moneda) return false;
  const norm = moneda
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
  return norm.includes("BS") || norm.includes("BOLIVAR") || norm.includes("VES");
}

function deducirUnidadMedida(unidadStr: string | null | undefined): { unidad: "und" | "g" | "ml"; esKiloOLitro: boolean } {
  const u = (unidadStr || "").toLowerCase().trim();

  // 1. Gramos / Kilos (ej: "Saco 50kg", "caja de 25kg", "2kg", "1 kilo", "0.5 kg", "500g", "250 gr", "100 gramos", "20kg.", "kilogramos")
  if (/(^|\d|\s)(kg|kgs|kilo|kilos|kilogramos?)($|\s|\.)/i.test(u)) {
    return { unidad: "g", esKiloOLitro: true };
  }
  if (/(^|\d|\s)(g|gr|grs|gramo|gramos)($|\s|\.)/i.test(u)) {
    return { unidad: "g", esKiloOLitro: false };
  }

  // 2. Litros / Mililitros (ej: "1.5L", "2 litros", "1 lt", "botella 750ml", "330 cc", "500 ml")
  if (/(^|\d|\s)(l|lt|lts|litro|litros)($|\s|\.)/i.test(u)) {
    return { unidad: "ml", esKiloOLitro: true };
  }
  if (/(^|\d|\s)(ml|mililitro|mililitros|cc)($|\s|\.)/i.test(u)) {
    return { unidad: "ml", esKiloOLitro: false };
  }

  // 3. Empaques discretos (solo si no se especificó peso ni volumen) -> 'und'
  if (/\b(bulto|paquete|pack|caja|docena|unidad|botella|pieza|lata|sobre|frasco|pote|saco)\b/i.test(u)) {
    return { unidad: "und", esKiloOLitro: false };
  }

  return { unidad: "und", esKiloOLitro: false };
}

function limpiarNombreFiscal(nombre: string): string {
  if (!nombre) return "";
  let limpio = nombre.trim();
  // Quitar prefijo fiscal (UND), (KG), UND, KG al inicio si está presente
  limpio = limpio.replace(/^(\(UND\)|\(KG\)|UND|KG)\s+/i, "");
  // Quitar sufijo fiscal de exención (E) al final
  limpio = limpio.replace(/\s+\([Ee]\)$/i, "");
  return limpio.replace(/\s+/g, " ").trim();
}

function parseDecimal(s: string): number {
  return parseFloat(s.trim().replace(",", "."));
}

function parseEnteroOMiles(s: string): number {
  const norm = s.trim();
  // Solo enteros >= 1 con separador de miles y 3 dígitos finales (ej: 1.000 o 2,000)
  if (/^[1-9]\d*[.,]\d{3}$/.test(norm)) {
    return parseFloat(norm.replace(/[.,]/g, ""));
  }
  return parseFloat(norm.replace(",", "."));
}

interface EspecificacionTamano {
  valorNormalizado: number;
  tipo: "peso" | "volumen" | "unidades" | "numero";
}

function extraerEspecificacionesTamano(texto: string): EspecificacionTamano[] {
  if (!texto) return [];
  const t = texto.toLowerCase();
  const resultados: EspecificacionTamano[] = [];

  // Kilos (ej: 0.450kg, 1kg, 1.5kg, 10kg, 20kg, kilogramos) -> gramos
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|kilo|kilos|kilogramos?)\b/g)) {
    const num = parseDecimal(m[1]);
    if (!isNaN(num)) resultados.push({ valorNormalizado: Math.round(num * 1000), tipo: "peso" });
  }

  // Gramos (ej: 450g, 50g, 250gr, 500 gramos, 1.000 g)
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|grs|gramos?)\b/g)) {
    const num = parseEnteroOMiles(m[1]);
    if (!isNaN(num)) resultados.push({ valorNormalizado: Math.round(num), tipo: "peso" });
  }

  // Litros (ej: 1.5l, 1l, 2 litros) -> mililitros
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:l|lt|lts|litros?)\b/g)) {
    const num = parseDecimal(m[1]);
    if (!isNaN(num)) resultados.push({ valorNormalizado: Math.round(num * 1000), tipo: "volumen" });
  }

  // Mililitros / CC (ej: 900ml, 300cc)
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:ml|cc|centimetros?)\b/g)) {
    const num = parseEnteroOMiles(m[1]);
    if (!isNaN(num)) resultados.push({ valorNormalizado: Math.round(num), tipo: "volumen" });
  }

  // Unidades en empaque (ej: 8 und, 100 und, 160 und, 100 unds, 1.000 und)
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:unds?|unidades?|u)\b/g)) {
    const num = parseEnteroOMiles(m[1]);
    if (!isNaN(num)) resultados.push({ valorNormalizado: num, tipo: "unidades" });
  }

  // Números puros entre paréntesis si no se extrajo nada más (ej: "(300)", "(450)")
  if (resultados.length === 0) {
    for (const m of t.matchAll(/\((\d+)\)/g)) {
      const num = parseInt(m[1], 10);
      if (!isNaN(num)) resultados.push({ valorNormalizado: num, tipo: "numero" });
    }
  }

  return resultados;
}

function tienenDiscrepanciaTamano(textoA: string, textoB: string): boolean {
  const listaA = extraerEspecificacionesTamano(textoA);
  const listaB = extraerEspecificacionesTamano(textoB);
  if (listaA.length === 0 || listaB.length === 0) return false;

  // Si B (ej: catálogo multi-presentación "Bolsas 10kg / 20kg") contiene el tamaño de A, no hay discrepancia
  for (const a of listaA) {
    const tieneCoincidencia = listaB.some(
      (b) =>
        (a.tipo === b.tipo || a.tipo === "numero" || b.tipo === "numero") &&
        a.valorNormalizado === b.valorNormalizado
    );
    if (tieneCoincidencia) return false;
  }

  // Si ambos tienen tamaños especificados comparables pero ninguno coincide -> Discrepancia real
  const tiposComparables = listaA.some((a) =>
    listaB.some((b) => a.tipo === b.tipo || a.tipo === "numero" || b.tipo === "numero")
  );

  return tiposComparables;
}

function reconciliarDesfaseFacturaFiscal(items: FacturaParsedItem[]): FacturaParsedItem[] {
  if (!items || items.length < 3) return items;

  // 1. Detectar si existe desfase por impresoras fiscales que imprimen la línea de multiplicación ARRIBA del nombre:
  // En un ticket fiscal con formato "[CANTIDAD]x[PRECIO_UNITARIO]" arriba del ítem, si el OCR leyó la cantidad del ítem i
  // como perteneciente al ítem i (en vez de al ítem i+1 que está debajo), entonces se cumplirá sistemáticamente:
  // - items[i].cantidad * items[i].precio_unitario ≈ items[i+1].monto_extraido
  // - PERO items[i].cantidad * items[i].precio_unitario NO coincide con items[i].monto_extraido (evita falsos positivos en ítems con precio igual)
  // - Y items[i].monto_extraido es significativamente distinto de items[i+1].monto_extraido
  let shiftMatches = 0;
  for (let i = 0; i < items.length - 1; i++) {
    const curr = items[i];
    const next = items[i + 1];
    if (
      curr.cantidad > 0 &&
      curr.precio_unitario &&
      curr.precio_unitario > 0 &&
      curr.monto_extraido > 0 &&
      next.monto_extraido > 0
    ) {
      const currCalc = curr.cantidad * curr.precio_unitario;
      const matchesOwn = Math.abs(currCalc - curr.monto_extraido) / curr.monto_extraido < 0.03;
      const matchesNext = Math.abs(currCalc - next.monto_extraido) / next.monto_extraido < 0.03;
      const amountsDifferent = Math.abs(curr.monto_extraido - next.monto_extraido) / curr.monto_extraido > 0.05;

      if (!matchesOwn && matchesNext && amountsDifferent) {
        shiftMatches++;
      }
    }
  }

  // Requiere al menos 2 pares consistentes para confirmar el desfase sistemático
  if (shiftMatches >= 2) {
    const shiftData = items.map((it) => ({
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      unidad: it.unidad,
      unidad_base: it.unidad_base,
    }));

    for (let i = items.length - 1; i >= 1; i--) {
      items[i].cantidad = shiftData[i - 1].cantidad;
      items[i].precio_unitario = shiftData[i - 1].precio_unitario;
      items[i].unidad = shiftData[i - 1].unidad;
      items[i].unidad_base = shiftData[i - 1].unidad_base;
    }

    // Para items[0]: su multiplicador original quedó fuera del inicio del ticket.
    // Deducir su unidad de forma segura desde su propio nombre, NUNCA heredar la unidad ajena de items[1].
    const deduction = deducirUnidadMedida(items[0].nombre_extraido);
    items[0].unidad = deduction.esKiloOLitro ? (deduction.unidad === "g" ? "kg" : "L") : deduction.unidad;
    items[0].unidad_base = deduction.unidad;
    items[0].cantidad = 1;
    items[0].precio_unitario = items[0].monto_extraido;
  }

  return items;
}

export async function extraerInsumosFactura(base64Image: string, mimeType: string, tasaBcv: number = 1) {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!base64Image || typeof base64Image !== "string" || base64Image.length < 50) {
    return { ok: false, error: "La imagen de la factura es inválida o está vacía." };
  }

  const mimeClean = (mimeType || "").toLowerCase().trim();
  if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(mimeClean)) {
    return { ok: false, error: "Formato de imagen no soportado. Usa JPEG, PNG o WEBP." };
  }

  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: "Falta configurar GEMINI_API_KEY en el servidor (.env.local)." };
  }

  const supabase = await createClient();

  // Obtener la tasa activa oficial de la BD como verdad única
  const { data: tasaRow } = await supabase
    .from("tasas_cambio")
    .select("tasa_usd_bs, bcv_usd_bs")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  const tasaEfectiva = Number(tasaRow?.tasa_usd_bs || tasaRow?.bcv_usd_bs) || (tasaBcv > 0 ? tasaBcv : 1);

  // Obtener lista de insumos y proveedores con datos completos
  const [{ data: insumosData }, { data: proveedoresData }] = await Promise.all([
    supabase.from("insumos").select("*").eq("activo", true).order("nombre", { ascending: true }),
    supabase.from("proveedores").select("*"),
  ]);

  const insumos = (insumosData || []) as Insumo[];
  const proveedores = (proveedoresData || []) as Proveedor[];

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Lista priorizada de modelos activos en Google AI Studio (eliminados modelos deprecados 1.5 y 2.5 que daban 404)
  const modelos = [
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
  ];

  const cleanPromptText = (s: string) => (s || "").replace(/[`${}\n\r]/g, " ").replace(/\s+/g, " ").trim();

  const prompt = `
Eres un asistente experto para un restaurante (La Parada del Sabor).
Se te proporcionará la imagen de una factura o nota de entrega de compras de insumos.
Tu tarea es extraer:
1. El emisor / distribuidor / proveedor de la compra (nombre, RIF, dirección física del local si figura, teléfono si figura y contacto/vendedor si figura).
2. El número de factura o número de control si aparece.
3. La moneda del ticket.
4. Los ítems comprados mapeados al catálogo del sistema. Si el ítem no existe en el catálogo, indica sus datos limpios para darlo de alta en el sistema.

Proveedores conocidos en el sistema:
${proveedores.map(p => `- ID: ${p.id} | Nombre: ${cleanPromptText(p.nombre)} | RIF: ${cleanPromptText(p.rif || "N/A")}`).join('\n')}

Insumos conocidos en el sistema:
${insumos.map(i => `- ID: ${i.id} | Nombre: ${cleanPromptText(i.nombre)} | Unidad Medida: ${cleanPromptText(i.unidad_medida)}`).join('\n')}

Reglas:
1. Extrae los datos del proveedor/comercio emisor en "proveedor":
   - "nombre": Nombre comercial o razón social que encabeza el ticket (ej: "Super 900", "CORPORACION HERMANOS MONCADA, C.A.", etc.).
   - "rif": RIF o número fiscal si aparece (ej: "J-50091040-1").
   - "direccion": Dirección física completa del local/comercio si aparece en el encabezado. Si no aparece, pon "".
   - "telefono": Teléfono del proveedor si aparece. Si no, "".
   - "contacto": Persona de contacto o vendedor si figura en el ticket. Si no, "".
   - "id": Si coincide claramente con alguno de la lista de proveedores conocidos, pon su ID. Si no está en la lista o es nuevo, déjalo vacío "".
2. Extrae el número de factura o número de control en "numero_factura" (ej: "0277311", "FACT-00912"). Si no tiene, pon "".
3. ¡REGLA CRÍTICA DE ASOCIACIÓN DE CANTIDAD / PESO EN FACTURAS FISCALES Y SUPERMERCADOS!:
   - En formatos de factura fiscal de supermercados y cajas registradoras (como "999 Super", The Factory HKA, Bixolon, Epson, BMC, etc.), la línea con la cantidad/peso y precio unitario como:
     "0,68xBs 6.065,99" o "4x Bs 43,33" o "1,155xBs 7.781,80" o "2x Bs 1.074,55"
     se imprime **DIRECTAMENTE ARRIBA (ENCIMA)** del nombre del producto y su total a pagar, ¡NUNCA ABAJO!
   - COMPROBACIÓN MATEMÁTICA OBLIGATORIA:
     Siempre verifica la multiplicación matemática antes de asignar la cantidad a un ítem:
     CANTIDAD * PRECIO_UNITARIO = MONTO_TOTAL_DEL_ITEM.
     Ejemplo: si un ítem cuesta 4.124,87 y la línea arriba dice "0,68xBs 6.065,99", esa cantidad (0.68 kg) y precio unitario pertenecen a ESE ítem (0.68 * 6065.99 = 4124.87). ¡NUNCA asocies el multiplicador al ítem anterior!
   - Si un ítem NO tiene ninguna línea de cantidad arriba de él (ej: "(UND) PAMPERO KETCHUP (397G) Bs 1.577,15"), su cantidad es exactamente 1 y su precio_unitario es igual a su monto_extraido.
   - Extrae siempre el campo numérico "precio_unitario" de cada ítem.
   - ¡ATENCIÓN A LOS EMPAQUES!:
     * Si el ítem dice "(250G)", la unidad base es "g" y la cantidad es 250 (o multiplicada por la cantidad de potes). NO pongas cantidad 1 y unidad "Kilo".
     * Si el ítem dice "(8 UND)" o es una caja de cubitos, y en el sistema está como "Caldo (8 und)", eso es 1 paquete completo. Entonces la cantidad es 1 y la unidad es "unidad". Observa el precio para deducir si cobran 1 caja o varios cubitos sueltos.
4. Mapea el ítem de la factura al insumo de la lista proporcionada ÚNICAMENTE si es el mismo producto Y la misma presentación/tamaño:
   ¡REGLA OBLIGATORIA DE PRESENTACIÓN, PESO Y GRAMAJE (PROHIBIDO FUSIONAR PRESENTACIONES DIFERENTES)!:
   - Si el ítem de la factura tiene un gramaje, volumen o presentación específica (ej: 450G, 50G, 1KG, 500G, 900ML, 1L, 1.5L, 300CC, 300G, etc.) y en la lista de insumos conocidos existe un insumo con nombre similar PERO CON GRAMAJE O TAMAÑO DIFERENTE (por ejemplo: la factura dice "LA ECONOMICA ALIÑO FRASCO (450G)" y en el catálogo hay "LA ECONOMICA ALIÑO (50G)" o "MANANTIAL ALIÑO PREPARADO (300)"):
     ESTÁ TERMINANTEMENTE PROHIBIDO ASOCIARLOS. DEBES DEJAR "insumo_id": "" (vacío).
     Son presentaciones comerciales distintas con costos unitarios diferentes. Si los asocias erróneamente, corrompes los costos promedio y el stock del inventario.
     Al dejar "insumo_id": "", el sistema dará de alta de inmediato el nuevo insumo con su presentación específica (ej: "LA ECONOMICA ALIÑO FRASCO (450G)").
   - Solo debes asignar un "insumo_id" existente si:
     a) El tamaño/gramaje coincide plenamente (ej: "PAMPERO KETCHUP (397G)" coincide con "Pampero Ketchup 397g"), O
     b) El insumo del catálogo es materia prima a granel sin presentación fija de envase (ej: carnes, vegetales o quesos pesados en kg/g).
   ¡REGLAS CRÍTICAS DE MAPEO PARA EMPAQUES Y DESECHABLES (EVITAR DUPLICADOS)!:
   - Vasos plásticos / descartables de cualquier marca o código (ej: 'VASOS HENCA', 'VASOS #77', 'VASOS DESECHABLES', etc.): Asignar OBLIGATORIAMENTE al insumo 'Vaso Plástico Desechable'. NUNCA crees un insumo nuevo si es un vaso descartable.
   - Tapas plásticas descartables: Asignar OBLIGATORIAMENTE al insumo 'Tapas Desechables'.
   - Servilletas de cualquier marca (Bamboo, Europapel, etc.): Asignar a 'Servilletas (160 und)' o al insumo de servilletas existente.
   - Bolsas plásticas: Asignar a 'Bolsas Plásticas 10kg / 20kg'.
   - Papel antigraso / envoltorio: Asignar a 'Papel Antigraso Breakfast 50 und'.
   - Guantes: Asignar a 'Guantes de Nitrilo Negro L (100 und)'.
   Si no hay ninguno que coincida en nombre y presentación, deja el "insumo_id": "" en blanco y sugiere "categoria_sugerida" (${CATEGORIAS_INSUMO.map((c) => `'${c}'`).join(", ")}) y "unidad_base" ('und', 'kg', 'L', 'g', 'ml').
5. Para refrescos o bebidas (como Pepsi 1.5L, Pepsi 1L, Coca-Cola, maltas, etc.): si la factura indica bulto (por ejemplo "1 x 6 und", "Bulto", "Pack x 6"), indica unidad: "bulto_refresco_6u" o si viene en unidades pon la cantidad en botellas con unidad: "unidad". NUNCA asignes kilos ni bultos de peso a bebidas.
6. Determina si la factura está cobrada en Dólares (USD) o Bolívares (BS) y ponlo en "moneda_detectada".
7. Extrae el monto total general del ticket o factura tal cual está impreso y ponlo en "total_factura_detectado".
8. Responde ÚNICAMENTE en formato JSON válido, sin markdown, siguiendo esta estructura estricta:
{
  "moneda_detectada": "USD" | "BS",
  "numero_factura": "00160244",
  "total_factura_detectado": 31589.99,
  "proveedor": {
    "id": "UUID o vacío",
    "nombre": "Nombre del Comercio / Distribuidor",
    "rif": "RIF si aparece o vacío",
    "direccion": "Dirección completa si aparece o vacío",
    "telefono": "Teléfono si aparece o vacío",
    "contacto": "Contacto si aparece o vacío"
  },
  "items": [
    {
      "insumo_id": "UUID o vacío",
      "nombre_extraido": "Nombre en factura",
      "cantidad": 250,
      "unidad": "g",
      "precio_unitario": 0.05,
      "monto_extraido": 12.50,
      "categoria_sugerida": "Condimentos",
      "unidad_base": "g"
    }
  ]
}
  `;

  let parsed: FacturaParsedResponse | null = null;
  let lastError: Error | null = null;

  for (const m of modelos) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeClean,
          },
        },
      ]);

      const response = await result.response;
      let text = response.text();
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();

      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace >= 0) {
        text = text.slice(firstBrace, lastBrace + 1);
      }

      const candidate = JSON.parse(text) as FacturaParsedResponse;
      if (candidate && typeof candidate === "object") {
        parsed = candidate;
        break; // Éxito con este modelo
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.warn(`Fallback: ${m} falló - ${err.message}`);
      lastError = err;
    }
  }

  if (!parsed) {
    console.error("Error Gemini:", lastError);
    return { ok: false, error: lastError?.message || "Todos los servidores de IA están ocupados. Intenta en unos minutos." };
  }

  try {
    parsed.total_factura_detectado = parseMonto(parsed.total_factura_detectado);

    const esBs = esBolivares(parsed.moneda_detectada);

    // Normalizar números y reconciliar posible desfase fiscal
    if (parsed.items && Array.isArray(parsed.items)) {
      parsed.items = parsed.items.map((it) => {
        const montoExtraidoNum = parseMonto(it.monto_extraido) || 0;
        const puNum = parseMonto(it.precio_unitario);
        const cantNum = typeof it.cantidad === "number" && !isNaN(it.cantidad)
          ? it.cantidad
          : (parseMonto(it.cantidad) || 1);
        const nomRaw = typeof it.nombre_extraido === "string"
          ? it.nombre_extraido.trim()
          : String(it.nombre_extraido || "").trim();
        const nomLimpio = limpiarNombreFiscal(nomRaw);
        return {
          ...it,
          nombre_extraido: nomLimpio,
          cantidad: cantNum,
          precio_unitario: puNum,
          monto_extraido: montoExtraidoNum,
        };
      });

      // Reconciliación matemática determinista para tickets fiscales (corrige desfases de multiplicadores)
      parsed.items = reconciliarDesfaseFacturaFiscal(parsed.items);

      // Convertir a USD si la factura vino en Bolívares
      parsed.items = parsed.items.map((it) => ({
        ...it,
        monto_usd: (esBs && tasaEfectiva > 0)
          ? Number((it.monto_extraido / tasaEfectiva).toFixed(2))
          : Number(it.monto_extraido.toFixed(2)),
      }));

      // Ajuste automático de centavos por errores de redondeo individual
      if (parsed.total_factura_detectado && esBs && tasaEfectiva > 0) {
        const totalUsdReal = Number((parsed.total_factura_detectado / tasaEfectiva).toFixed(2));
        const sumaItemsUsd = Number(parsed.items.reduce((acc, it) => acc + (it.monto_usd || 0), 0).toFixed(2));
        const diferencia = Number((totalUsdReal - sumaItemsUsd).toFixed(2));

        if (Math.abs(diferencia) > 0 && Math.abs(diferencia) <= 0.05 && parsed.items.length > 0) {
          const maxItem = parsed.items.reduce((prev, curr) => ((prev.monto_usd || 0) > (curr.monto_usd || 0)) ? prev : curr);
          maxItem.monto_usd = Number(((maxItem.monto_usd || 0) + diferencia).toFixed(2));
        }
      }
    }

    // Resolver proveedor: si existe o crear uno nuevo si no existe
    let proveedorFinal: Proveedor | null = null;
    if (parsed.proveedor?.id) {
      const found = proveedores.find((p) => p.id === parsed.proveedor?.id);
      if (found) proveedorFinal = found;
    }

    const provNombre = safeTrim(parsed.proveedor?.nombre);
    const provRif = safeTrim(parsed.proveedor?.rif) || null;
    const provDir = safeTrim(parsed.proveedor?.direccion) || null;
    const provTel = safeTrim(parsed.proveedor?.telefono) || null;
    const provContacto = safeTrim(parsed.proveedor?.contacto) || null;

    if (!proveedorFinal && provNombre && provNombre.length >= 2) {
      const nombreNorm = provNombre.toLowerCase();
      const found = proveedores.find(
        (p) =>
          (nombreNorm.length >= 2 && p.nombre.toLowerCase().includes(nombreNorm)) ||
          (p.nombre.length >= 2 && nombreNorm.includes(p.nombre.toLowerCase()))
      );

      if (found) {
        proveedorFinal = found;
        // Solo enriquecer campos vacíos, nunca sobreescribir datos maestros ya existentes
        const updateCampos: { direccion?: string; telefono?: string } = {};
        if (!found.direccion && provDir) {
          updateCampos.direccion = provDir;
        }
        if (!found.telefono && provTel) {
          updateCampos.telefono = provTel;
        }
        if (Object.keys(updateCampos).length > 0) {
          await supabase.from("proveedores").update(updateCampos).eq("id", found.id);
          Object.assign(proveedorFinal, updateCampos);
        }
      } else {
        // Auto-crear proveedor nuevo con dirección y datos fiscales completos
        const { data: nuevoProv } = await supabase
          .from("proveedores")
          .insert({
            nombre: provNombre,
            rif: provRif,
            direccion: provDir,
            telefono: provTel,
            contacto: provContacto,
            activo: true,
          })
          .select("*")
          .single();

        if (nuevoProv) {
          proveedorFinal = nuevoProv as Proveedor;
        }
      }
    }

    parsed.proveedor_final = proveedorFinal;

    // Resolver insumos: si el ítem no existe en el catálogo, auto-crearlo de inmediato en la despensa
    const insumosActualizados = [...insumos];
    const nuevosInsumosCreados: Insumo[] = [];

    if (parsed.items && Array.isArray(parsed.items)) {
      for (const it of parsed.items) {
        // Validación de consistencia: si Gemini asignó un insumo que no existe o tiene discrepancia de tamaño/gramaje, invalidar el mapeo
        if (it.insumo_id) {
          const insumoAsignado = insumosActualizados.find((i) => i.id === it.insumo_id);
          if (!insumoAsignado || tienenDiscrepanciaTamano(it.nombre_extraido, insumoAsignado.nombre)) {
            it.insumo_id = "";
          }
        }

        if (!it.insumo_id && it.nombre_extraido?.trim()) {
          const nomLimpio = it.nombre_extraido.trim().toLowerCase();
          const nomSinSignos = nomLimpio.replace(/[()#]/g, " ").replace(/\s+/g, " ").trim();
          let matchExistente: Insumo | undefined;

          // 1. Mapeo canónico inteligente por sinónimos de empaques y desechables (prioritario, evita duplicados)
          if (/\b(tapa|tapas)\b/i.test(nomSinSignos)) {
            // Tapas evaluadas antes de vasos para que "tapas para vaso" mapee a tapas
            matchExistente = insumosActualizados.find((i) => i.nombre.toLowerCase().includes("tapa"));
          } else if (/\b(vaso|vasos)\b/i.test(nomSinSignos)) {
            matchExistente =
              insumosActualizados.find((i) => i.nombre.toLowerCase().includes("vaso plástico") || i.nombre.toLowerCase().includes("vaso desechable")) ||
              insumosActualizados.find((i) => i.nombre.toLowerCase().includes("vaso"));
          } else if (/\b(kraft|caja kraft)\b/i.test(nomSinSignos)) {
            if (/(\b6\b|familiar|grande)/i.test(nomSinSignos)) {
              matchExistente = insumosActualizados.find((i) => i.nombre.toLowerCase().includes("kraft 6"));
            } else if (/(\b3\b|mediana|personal|pequeña)/i.test(nomSinSignos)) {
              matchExistente = insumosActualizados.find((i) => i.nombre.toLowerCase().includes("kraft 3"));
            }
          } else if (/\b(servilleta|servilletas)\b/i.test(nomSinSignos)) {
            matchExistente = insumosActualizados.find((i) => i.nombre.toLowerCase().includes("servilleta"));
          } else if (/\b(bolsa|bolsas)\b/i.test(nomSinSignos)) {
            matchExistente = insumosActualizados.find((i) => i.nombre.toLowerCase().includes("bolsa"));
          } else if (/\b(guante|guantes|nitrilo)\b/i.test(nomSinSignos)) {
            matchExistente = insumosActualizados.find((i) => i.nombre.toLowerCase().includes("guante"));
          } else if (/\b(antigraso|antigrasos|papel envoltorio)\b/i.test(nomSinSignos)) {
            matchExistente = insumosActualizados.find((i) => i.nombre.toLowerCase().includes("antigraso"));
          }

          // 2. Coincidencia directa o por inclusión segura (rechazando siempre discrepancias de tamaño/gramaje)
          if (!matchExistente) {
            matchExistente = insumosActualizados.find(
              (i) => {
                if (tienenDiscrepanciaTamano(it.nombre_extraido, i.nombre)) {
                  return false;
                }
                return (
                  i.nombre.toLowerCase() === nomLimpio ||
                  (nomLimpio.length >= 4 && i.nombre.toLowerCase().includes(nomLimpio)) ||
                  (nomLimpio.length >= 4 && nomLimpio.includes(i.nombre.toLowerCase()))
                );
              }
            );
          }

          if (matchExistente) {
            it.insumo_id = matchExistente.id;
          } else {
            // Deducir unidad de medida compatible con la base de datos ('und' | 'g' | 'ml')
            const deduction = deducirUnidadMedida(it.unidad || it.unidad_base);
            const uMedida = deduction.unidad;
            const esKiloOLitro = deduction.esKiloOLitro;

            const cantBase = esKiloOLitro
              ? (Number(it.cantidad) || 1) * 1000
              : (Number(it.cantidad) || 1);

            const montoUsdItem = it.monto_usd || 0;
            const costoUnitario = cantBase > 0 && montoUsdItem > 0
              ? Number((montoUsdItem / cantBase).toFixed(4))
              : 0;

            const { data: insumoNuevo } = await supabase
              .from("insumos")
              .insert({
                nombre: it.nombre_extraido.trim(),
                unidad_medida: uMedida,
                stock_actual: 0,
                stock_minimo: uMedida === "und" ? 5 : 1000,
                costo_unitario_usd: costoUnitario,
                categoria_insumo: normalizarCategoriaInsumo(it.categoria_sugerida),
                activo: true,
              })
              .select("*")
              .single();

            if (insumoNuevo) {
              const insumoTyped = insumoNuevo as Insumo;
              it.insumo_id = insumoTyped.id;
              it.insumo_nuevo_creado = true;
              insumosActualizados.push(insumoTyped);
              nuevosInsumosCreados.push(insumoTyped);
            }
          }
        }
      }
    }

    parsed.insumos_creados = nuevosInsumosCreados;

    return { ok: true, data: parsed };
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    console.error("Error Gemini:", errorObj);
    return { ok: false, error: errorObj.message || "Error al procesar la factura con Inteligencia Artificial." };
  }
}

interface RpcEliminarInsumoResponse {
  ok: boolean;
  error?: string;
}

export async function eliminarInsumoSiVacio(insumoId: string) {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };
  const supabase = await createClient();
  const { data: ins } = await supabase
    .from("insumos")
    .select("stock_actual")
    .eq("id", insumoId)
    .maybeSingle();

  if (ins && Number(ins.stock_actual) === 0) {
    const { data, error } = await supabase.rpc("fn_eliminar_insumo_seguro", {
      p_insumo_id: insumoId,
    });
    if (error) {
      console.warn("Aviso eliminando insumo temporal:", error.message);
      return { ok: false, error: error.message };
    }
    const rpcRes = data as unknown as RpcEliminarInsumoResponse | null;
    if (rpcRes && rpcRes.ok === false) {
      console.warn("Aviso fn_eliminar_insumo_seguro:", rpcRes.error);
      return { ok: false, error: rpcRes.error };
    }
  }
  return { ok: true };
}
