"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-guard";
import type { Insumo, Proveedor } from "@/types/database";

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

  // Si indica empaque discreto -> siempre 'und' (evita que 'bulto' matchee 'l')
  if (/\b(bulto|paquete|pack|caja|docena|unidad|botella|pieza|lata|sobre|frasco|pote|saco)\b/i.test(u)) {
    return { unidad: "und", esKiloOLitro: false };
  }

  // Gramos / Kilos (ej: "2kg", "1 kilo", "0.5 kg", "500g", "250 gr", "100 gramos")
  if (/(^|\d|\s)(kg|kgs|kilo|kilos)($|\s)/i.test(u)) {
    return { unidad: "g", esKiloOLitro: true };
  }
  if (/(^|\d|\s)(g|gr|grs|gramo|gramos)($|\s)/i.test(u)) {
    return { unidad: "g", esKiloOLitro: false };
  }

  // Litros / Mililitros (ej: "1.5L", "2 litros", "1 lt", "750ml", "330 cc", "500 ml")
  if (/(^|\d|\s)(l|lt|lts|litro|litros)($|\s)/i.test(u)) {
    return { unidad: "ml", esKiloOLitro: true };
  }
  if (/(^|\d|\s)(ml|mililitro|mililitros|cc)($|\s)/i.test(u)) {
    return { unidad: "ml", esKiloOLitro: false };
  }

  return { unidad: "und", esKiloOLitro: false };
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

  // Si tasaBcv viene inválida o manipulada, obtener la última tasa activa oficial de la BD
  let tasaEfectiva = tasaBcv;
  if (!tasaEfectiva || tasaEfectiva <= 0) {
    const { data: tasaRow } = await supabase
      .from("tasas_cambio")
      .select("tasa_usd_bs, bcv_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();
    tasaEfectiva = Number(tasaRow?.tasa_usd_bs || tasaRow?.bcv_usd_bs) || 1;
  }

  // Obtener lista de insumos y proveedores con datos completos
  const [{ data: insumosData }, { data: proveedoresData }] = await Promise.all([
    supabase.from("insumos").select("*"),
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

  const prompt = `
Eres un asistente experto para un restaurante (La Parada del Sabor).
Se te proporcionará la imagen de una factura o nota de entrega de compras de insumos.
Tu tarea es extraer:
1. El emisor / distribuidor / proveedor de la compra (nombre, RIF, dirección física del local si figura, teléfono si figura y contacto/vendedor si figura).
2. El número de factura o número de control si aparece.
3. La moneda del ticket.
4. Los ítems comprados mapeados al catálogo del sistema. Si el ítem no existe en el catálogo, indica sus datos limpios para darlo de alta en el sistema.

Proveedores conocidos en el sistema:
${proveedores.map(p => `- ID: ${p.id} | Nombre: ${p.nombre} | RIF: ${p.rif || "N/A"}`).join('\n')}

Insumos conocidos en el sistema:
${insumos.map(i => `- ID: ${i.id} | Nombre: ${i.nombre} | Unidad Medida: ${i.unidad_medida}`).join('\n')}

Reglas:
1. Extrae los datos del proveedor/comercio emisor en "proveedor":
   - "nombre": Nombre comercial o razón social que encabeza el ticket (ej: "Super 900", "CORPORACION HERMANOS MONCADA, C.A.", etc.).
   - "rif": RIF o número fiscal si aparece (ej: "J-50091040-1").
   - "direccion": Dirección física completa del local/comercio si aparece en el encabezado. Si no aparece, pon "".
   - "telefono": Teléfono del proveedor si aparece. Si no, "".
   - "contacto": Persona de contacto o vendedor si figura en el ticket. Si no, "".
   - "id": Si coincide claramente con alguno de la lista de proveedores conocidos, pon su ID. Si no está en la lista o es nuevo, déjalo vacío "".
2. Extrae el número de factura o número de control en "numero_factura" (ej: "0277311", "FACT-00912"). Si no tiene, pon "".
3. Extrae cada ítem de la factura: nombre, cantidad real comprada, unidad y precio total pagado por el ítem. ¡ATENCIÓN A LOS EMPAQUES!:
   - Si el ítem dice "(250G)", la unidad base es "g" y la cantidad es 250 (o multiplicada por la cantidad de potes). NO pongas cantidad 1 y unidad "Kilo".
   - Si el ítem dice "(8 UND)" o es una caja de cubitos, y en el sistema está como "Caldo (8 und)", eso es 1 paquete completo. Entonces la cantidad es 1 y la unidad es "unidad". Observa el precio para deducir si cobran 1 caja o varios cubitos sueltos.
4. Mapea el ítem de la factura al insumo más parecido de la lista proporcionada prestando atención a la unidad en la que está el insumo en el sistema. Si no hay ninguno parecido, deja el "insumo_id" en blanco "" y sugiere "categoria_sugerida" ('Bebidas', 'Carnes & Proteínas', 'Lácteos & Huevos', 'Verduras & Vegetales', 'Abarrotes & Secos', 'Panadería', 'Desechables & Limpieza', 'Otros') y "unidad_base" ('und', 'kg', 'L', 'g', 'ml').
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
      "unidad": "gramo",
      "monto_extraido": 12.50,
      "categoria_sugerida": "Abarrotes & Secos",
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

    // Convertir a USD si la factura vino en Bolívares
    if (parsed.items && Array.isArray(parsed.items)) {
      parsed.items = parsed.items.map((it) => {
        const montoExtraidoNum = parseMonto(it.monto_extraido) || 0;
        return {
          ...it,
          monto_extraido: montoExtraidoNum,
          monto_usd: (esBs && tasaEfectiva > 0)
            ? Number((montoExtraidoNum / tasaEfectiva).toFixed(2))
            : Number(montoExtraidoNum.toFixed(2)),
        };
      });

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

    if (!proveedorFinal && parsed.proveedor?.nombre?.trim()) {
      const nombreNorm = parsed.proveedor.nombre.trim().toLowerCase();
      const found = proveedores.find(
        (p) =>
          p.nombre.toLowerCase().includes(nombreNorm) ||
          nombreNorm.includes(p.nombre.toLowerCase())
      );

      if (found) {
        proveedorFinal = found;
        // Solo enriquecer campos vacíos, nunca sobreescribir datos maestros ya existentes
        const updateCampos: { direccion?: string; telefono?: string } = {};
        if (!found.direccion && parsed.proveedor.direccion?.trim()) {
          updateCampos.direccion = parsed.proveedor.direccion.trim();
        }
        if (!found.telefono && parsed.proveedor.telefono?.trim()) {
          updateCampos.telefono = parsed.proveedor.telefono.trim();
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
            nombre: parsed.proveedor.nombre.trim(),
            rif: parsed.proveedor.rif?.trim() || null,
            direccion: parsed.proveedor.direccion?.trim() || null,
            telefono: parsed.proveedor.telefono?.trim() || null,
            contacto: parsed.proveedor.contacto?.trim() || null,
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
        if (!it.insumo_id && it.nombre_extraido?.trim()) {
          const nomLimpio = it.nombre_extraido.trim().toLowerCase();
          const matchExistente = insumosActualizados.find(
            (i) =>
              i.nombre.toLowerCase() === nomLimpio ||
              i.nombre.toLowerCase().includes(nomLimpio) ||
              nomLimpio.includes(i.nombre.toLowerCase())
          );

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
                categoria_insumo: it.categoria_sugerida || "Abarrotes & Secos",
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
