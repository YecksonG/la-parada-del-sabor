"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

export type InsumoExtraido = {
  insumo_id: string;
  nombre_extraido: string;
  cantidad: number;
  unidad: string;
  monto_usd: number;
};

export async function extraerInsumosFactura(base64Image: string, mimeType: string, tasaBcv: number = 1) {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: "Falta configurar GEMINI_API_KEY en el servidor (.env.local)." };
  }

  const supabase = await createClient();
  
  // Obtener lista de insumos y proveedores para que la IA los mapee
  const [{ data: insumos }, { data: proveedores }] = await Promise.all([
    supabase.from("insumos").select("id, nombre, unidad_medida"),
    supabase.from("proveedores").select("id, nombre, rif"),
  ]);
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelos = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"];

  const prompt = `
Eres un asistente experto para un restaurante (La Parada del Sabor).
Se te proporcionará la imagen de una factura o nota de entrega de compras de insumos.
Tu tarea es extraer:
1. El emisor / distribuidor / proveedor de la compra.
2. El número de factura o número de control si aparece.
3. La moneda del ticket.
4. Los ítems comprados mapeados al catálogo del sistema.

Proveedores conocidos en el sistema:
${proveedores?.map(p => `- ID: ${p.id} | Nombre: ${p.nombre} | RIF: ${p.rif || "N/A"}`).join('\n')}

Insumos conocidos en el sistema:
${insumos?.map(i => `- ID: ${i.id} | Nombre: ${i.nombre} | Unidad Medida: ${i.unidad_medida}`).join('\n')}

Reglas:
1. Extrae los datos del proveedor/comercio emisor en "proveedor":
   - "nombre": Nombre comercial o razón social que encabeza el ticket (ej: "Super 900", "Inversiones El Páramo", "Distribuidora Los Andes", etc.).
   - "rif": RIF o número fiscal si aparece (ej: "J-12345678-0").
   - "id": Si coincide claramente con alguno de la lista de proveedores conocidos, pon su ID. Si no está en la lista o es nuevo, déjalo vacío "".
2. Extrae el número de factura o número de control en "numero_factura" (ej: "FACT-00912", "00160244"). Si no tiene, pon "".
3. Extrae cada ítem de la factura: nombre, cantidad, unidad (dedúcela: kilo, gramo, litro, mililitro, unidad, paquete, bulto, etc.) y precio total pagado por el ítem.
4. Mapea el ítem de la factura al insumo más parecido de la lista proporcionada. Si no hay ninguno parecido, deja el "insumo_id" en blanco "".
5. Para refrescos o bebidas (como Pepsi 1.5L, Coca-Cola, maltas, etc.): si la factura indica bulto (por ejemplo "1 x 6 und", "Bulto", "Pack x 6"), indica unidad: "bulto_refresco_6u" o si viene en unidades pon la cantidad en botellas con unidad: "unidad". NUNCA asignes kilos ni bultos de peso a bebidas.
6. Determina si la factura está cobrada en Dólares (USD) o Bolívares (BS) y ponlo en "moneda_detectada".
7. Responde ÚNICAMENTE en formato JSON válido, sin markdown, siguiendo esta estructura estricta:
{
  "moneda_detectada": "USD" | "BS",
  "numero_factura": "00160244",
  "proveedor": {
    "id": "UUID o vacío",
    "nombre": "Nombre del Comercio / Distribuidor",
    "rif": "RIF si aparece o vacío"
  },
  "items": [
    {
      "insumo_id": "UUID o vacío",
      "nombre_extraido": "Nombre en factura",
      "cantidad": 1.5,
      "unidad": "kilo",
      "monto_extraido": 12.50
    }
  ]
}
  `;

  let result = null;
  let lastError = null;

  for (const m of modelos) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType
          }
        }
      ]);
      break; // Salir del bucle si fue exitoso
    } catch (e: any) {
      console.warn(`Fallback: ${m} falló - ${e.message}`);
      lastError = e;
    }
  }

  if (!result) {
    console.error("Error Gemini:", lastError);
    return { ok: false, error: lastError?.message || "Todos los servidores de IA están ocupados. Intenta en unos minutos." };
  }

  try {
    const response = await result.response;
    let text = response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Si la respuesta empieza con un corchete, extraer el JSON
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace >= 0) {
      text = text.slice(firstBrace, lastBrace + 1);
    }
    
    const parsed = JSON.parse(text);
    
    // Convertir a USD si la factura vino en Bolívares
    if (parsed.items && Array.isArray(parsed.items)) {
      parsed.items = parsed.items.map((it: any) => ({
        ...it,
        monto_usd: (parsed.moneda_detectada === "BS" && tasaBcv > 0)
          ? Number((it.monto_extraido / tasaBcv).toFixed(2))
          : Number(it.monto_extraido)
      }));
    }

    // Resolver proveedor: si existe o crear uno nuevo si no existe
    let proveedorFinal = null;
    if (parsed.proveedor?.id) {
      const found = proveedores?.find(p => p.id === parsed.proveedor.id);
      if (found) proveedorFinal = found;
    }
    
    if (!proveedorFinal && parsed.proveedor?.nombre?.trim()) {
      const nombreNorm = parsed.proveedor.nombre.trim().toLowerCase();
      const found = proveedores?.find(p => 
        p.nombre.toLowerCase().includes(nombreNorm) || 
        nombreNorm.includes(p.nombre.toLowerCase())
      );

      if (found) {
        proveedorFinal = found;
      } else {
        // Auto-crear proveedor nuevo
        const { data: nuevoProv } = await supabase
          .from("proveedores")
          .insert({
            nombre: parsed.proveedor.nombre.trim(),
            rif: parsed.proveedor.rif?.trim() || null,
            activo: true,
          })
          .select("*")
          .single();

        if (nuevoProv) {
          proveedorFinal = nuevoProv;
        }
      }
    }

    parsed.proveedor_final = proveedorFinal;

    return { ok: true, data: parsed };
  } catch (err: any) {
    console.error("Error Gemini:", err);
    return { ok: false, error: err.message || "Error al procesar la factura con Inteligencia Artificial." };
  }
}
