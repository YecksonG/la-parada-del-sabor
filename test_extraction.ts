import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

async function run() {
  const env = fs.readFileSync(".env.local", "utf-8");
  const key = env.split("\n").find(l => l.startsWith("GEMINI_API_KEY"))?.split("=")[1];
  const genAI = new GoogleGenerativeAI(key || "");
  const base64Data = fs.readFileSync("/home/yg/Downloads/Factura 22-09.jpg").toString("base64");
  
  const prompt = `
Eres un asistente experto para un restaurante (La Parada del Sabor).
Se te proporcionará la imagen de una factura o nota de entrega de compras de insumos.
Tu tarea es extraer:
1. El emisor / distribuidor / proveedor de la compra.
2. El número de factura o número de control si aparece.
3. La moneda del ticket.
4. Los ítems comprados mapeados al catálogo del sistema.

Reglas:
1. Extrae los datos del proveedor/comercio emisor en "proveedor".
2. Extrae el número de factura o número de control en "numero_factura".
3. Extrae cada ítem de la factura: nombre, cantidad real comprada, unidad y precio total pagado por el ítem. ¡ATENCIÓN A LOS EMPAQUES!:
   - Si el ítem dice "(250G)", la unidad base es "g" y la cantidad es 250.
   - Si el ítem dice "(8 UND)" o es una caja de cubitos, eso es 1 paquete completo. Entonces la cantidad es 1 y la unidad es "unidad".
6. Determina si la factura está cobrada en Dólares (USD) o Bolívares (BS) y ponlo en "moneda_detectada".
7. Extrae el monto total general del ticket o factura tal cual está impreso y ponlo en "total_factura_detectado".
8. Responde ÚNICAMENTE en formato JSON válido, sin markdown, siguiendo esta estructura estricta:
{
  "moneda_detectada": "USD" | "BS",
  "numero_factura": "00160244",
  "total_factura_detectado": 31589.99,
  "proveedor": {
    "nombre": "Nombre",
    "rif": "J-0000"
  },
  "items": []
}
`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Use the fallback working model
  try {
    const result = await model.generateContent([{text: prompt}, {inlineData: {data: base64Data, mimeType: "image/jpeg"}}]);
    console.log(result.response.text());
  } catch(e) {
    console.error(e);
  }
}
run();
