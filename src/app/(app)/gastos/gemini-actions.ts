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

export async function extraerInsumosFactura(base64Image: string, mimeType: string) {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: "Falta configurar GEMINI_API_KEY en el servidor (.env.local)." };
  }

  const supabase = await createClient();
  
  // Obtener lista de insumos para que la IA los mapee
  const { data: insumos } = await supabase.from("insumos").select("id, nombre, unidad_medida");
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
Eres un asistente experto para un restaurante (La Parada del Sabor).
Se te proporcionará la imagen de una factura o nota de entrega de compras de insumos.
Tu tarea es extraer los ítems comprados y mapearlos a la lista de insumos conocidos del sistema.

Insumos conocidos en el sistema:
${insumos?.map(i => `- ID: ${i.id} | Nombre: ${i.nombre} | Unidad Medida: ${i.unidad_medida}`).join('\n')}

Reglas:
1. Extrae cada ítem de la factura: nombre, cantidad, unidad (dedúcela: kilo, gramo, litro, mililitro, unidad, paquete, bulto, etc.) y precio total pagado en USD. Si el ticket está en Bs, asume que el monto extraído es en Bs y el usuario lo ajustará luego (pero ponlo en monto_usd de todos modos).
2. Mapea el ítem de la factura al insumo más parecido de la lista proporcionada. Si no hay ninguno parecido, deja el "insumo_id" en blanco "".
3. Las unidades válidas para "unidad" son: "kilo", "gramo", "litro", "mililitro", "unidad", "paquete", "bulto".
4. Responde ÚNICAMENTE en formato JSON válido, sin markdown, siguiendo esta estructura estricta:
{
  "items": [
    {
      "insumo_id": "UUID o vacío",
      "nombre_extraido": "Nombre en factura",
      "cantidad": 1.5,
      "unidad": "kilo",
      "monto_usd": 12.50
    }
  ]
}
  `;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);
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
    return { ok: true, data: parsed };
  } catch (err: any) {
    console.error("Error Gemini:", err);
    return { ok: false, error: err.message || "Error al procesar la factura con Inteligencia Artificial." };
  }
}
