"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-guard";

export type InsumoExtraido = {
  insumo_id: string;
  nombre_extraido: string;
  cantidad: number;
  unidad: string;
  monto_usd: number;
};

export async function extraerInsumosFactura(base64Image: string, mimeType: string, tasaBcv: number = 1) {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

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
1. El emisor / distribuidor / proveedor de la compra (nombre, RIF, dirección física del local si figura, teléfono si figura y contacto/vendedor si figura).
2. El número de factura o número de control si aparece.
3. La moneda del ticket.
4. Los ítems comprados mapeados al catálogo del sistema. Si el ítem no existe en el catálogo, indica sus datos limpios para darlo de alta en el sistema.

Proveedores conocidos en el sistema:
${proveedores?.map(p => `- ID: ${p.id} | Nombre: ${p.nombre} | RIF: ${p.rif || "N/A"}`).join('\n')}

Insumos conocidos en el sistema:
${insumos?.map(i => `- ID: ${i.id} | Nombre: ${i.nombre} | Unidad Medida: ${i.unidad_medida}`).join('\n')}

Reglas:
1. Extrae los datos del proveedor/comercio emisor en "proveedor":
   - "nombre": Nombre comercial o razón social que encabeza el ticket (ej: "Super 900", "CORPORACION HERMANOS MONCADA, C.A.", etc.).
   - "rif": RIF o número fiscal si aparece (ej: "J-50091040-1").
   - "direccion": Dirección física completa del local/comercio si aparece en el encabezado (ej: "Av. Ollarvides esquina Maracas, Sector Puerta Maraven, Punto Fijo"). Si no aparece, pon "".
   - "telefono": Teléfono del proveedor si aparece. Si no, "".
   - "contacto": Persona de contacto o vendedor si figura en el ticket. Si no, "".
   - "id": Si coincide claramente con alguno de la lista de proveedores conocidos, pon su ID. Si no está en la lista o es nuevo, déjalo vacío "".
2. Extrae el número de factura o número de control en "numero_factura" (ej: "0277311", "FACT-00912"). Si no tiene, pon "".
3. Extrae cada ítem de la factura: nombre, cantidad, unidad (dedúcela: kilo, gramo, litro, mililitro, unidad, paquete, bulto, etc.) y precio total pagado por el ítem.
4. Mapea el ítem de la factura al insumo más parecido de la lista proporcionada. Si no hay ninguno parecido, deja el "insumo_id" en blanco "" y sugiere "categoria_sugerida" ('Bebidas', 'Carnes & Proteínas', 'Lácteos & Huevos', 'Verduras & Vegetales', 'Abarrotes & Secos', 'Panadería', 'Desechables & Limpieza', 'Otros') y "unidad_base" ('und', 'kg', 'L', 'g', 'ml').
5. Para refrescos o bebidas (como Pepsi 1.5L, Pepsi 1L, Coca-Cola, maltas, etc.): si la factura indica bulto (por ejemplo "1 x 6 und", "Bulto", "Pack x 6"), indica unidad: "bulto_refresco_6u" o si viene en unidades pon la cantidad en botellas con unidad: "unidad". NUNCA asignes kilos ni bultos de peso a bebidas.
6. Determina si la factura está cobrada en Dólares (USD) o Bolívares (BS) y ponlo en "moneda_detectada".
7. Responde ÚNICAMENTE en formato JSON válido, sin markdown, siguiendo esta estructura estricta:
{
  "moneda_detectada": "USD" | "BS",
  "numero_factura": "00160244",
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
      "cantidad": 1.5,
      "unidad": "kilo",
      "monto_extraido": 12.50,
      "categoria_sugerida": "Abarrotes & Secos",
      "unidad_base": "kg"
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
        // Si el proveedor existe pero le faltaba dirección o teléfono y la factura los trae, enriquecerlo
        const updateCampos: any = {};
        if (!(found as any).direccion && parsed.proveedor.direccion?.trim()) {
          updateCampos.direccion = parsed.proveedor.direccion.trim();
        }
        if (!(found as any).telefono && parsed.proveedor.telefono?.trim()) {
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
          proveedorFinal = nuevoProv;
        }
      }
    }

    parsed.proveedor_final = proveedorFinal;

    // Resolver insumos: si el ítem no existe en el catálogo, auto-crearlo de inmediato en la despensa
    const insumosActualizados = [...(insumos || [])];
    const nuevosInsumosCreados: any[] = [];

    if (parsed.items && Array.isArray(parsed.items)) {
      for (const it of parsed.items) {
        if (!it.insumo_id && it.nombre_extraido?.trim()) {
          const nomLimpio = it.nombre_extraido.trim().toLowerCase();
          const matchExistente = insumosActualizados.find(i => 
            i.nombre.toLowerCase() === nomLimpio ||
            i.nombre.toLowerCase().includes(nomLimpio) ||
            nomLimpio.includes(i.nombre.toLowerCase())
          );

          if (matchExistente) {
            it.insumo_id = matchExistente.id;
          } else {
            // Deducir unidad de medida compatible con la base de datos ('und' | 'g' | 'ml')
            let uMedida: "und" | "g" | "ml" = "und";
            const uLower = (it.unidad || it.unidad_base || "").toLowerCase();
            if (uLower.includes("kilo") || uLower.includes("kg") || uLower.includes("gramo") || uLower.includes("g")) {
              uMedida = "g";
            } else if (uLower.includes("litro") || uLower.includes("l") || uLower.includes("ml")) {
              uMedida = "ml";
            }

            const cantBase = (uMedida === "g" || uMedida === "ml") && (uLower.includes("kilo") || uLower.includes("litro"))
              ? (Number(it.cantidad) || 1) * 1000
              : (Number(it.cantidad) || 1);

            const costoUnitario = cantBase > 0 && it.monto_usd > 0
              ? Number((it.monto_usd / cantBase).toFixed(4))
              : 0;

            const { data: insumoNuevo } = await supabase
              .from("insumos")
              .insert({
                nombre: it.nombre_extraido.trim(),
                unidad_medida: uMedida,
                stock_actual: 0, // Se sumará automáticamente cuando se confirme el ingreso de la compra
                stock_minimo: uMedida === "und" ? 5 : 1000,
                costo_unitario_usd: costoUnitario,
                categoria_insumo: it.categoria_sugerida || "Abarrotes & Secos",
                activo: true,
              })
              .select("id, nombre, unidad_medida")
              .single();

            if (insumoNuevo) {
              it.insumo_id = insumoNuevo.id;
              it.insumo_nuevo_creado = true;
              insumosActualizados.push(insumoNuevo);
              nuevosInsumosCreados.push(insumoNuevo);
            }
          }
        }
      }
    }

    parsed.insumos_creados = nuevosInsumosCreados;

    return { ok: true, data: parsed };
  } catch (err: any) {
    console.error("Error Gemini:", err);
    return { ok: false, error: err.message || "Error al procesar la factura con Inteligencia Artificial." };
  }
}
