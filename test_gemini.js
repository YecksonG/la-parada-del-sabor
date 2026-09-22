import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const base64Data = fs.readFileSync("/home/yg/Downloads/Factura 22-09.jpg").toString("base64");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using 1.5 flash since it's the fallback
  
  const prompt = `
  Eres un asistente experto para un restaurante (La Parada del Sabor).
  Se te proporcionará la imagen de una factura o nota de entrega de compras de insumos.
  Tu tarea es extraer:
  1. El emisor / distribuidor / proveedor de la compra.
  2. El número de factura o número de control si aparece.
  3. La moneda del ticket.
  4. Los ítems comprados mapeados al catálogo del sistema.
  
  Reglas:
  3. Extrae cada ítem de la factura: nombre, cantidad real comprada, unidad y precio total pagado por el ítem. ¡ATENCIÓN A LOS EMPAQUES!:
     - Si el ítem dice "(250G)", la unidad base es "g" y la cantidad es 250 (o multiplicada por la cantidad de potes). NO pongas cantidad 1 y unidad "Kilo".
     - Si el ítem dice "(8 UND)" o es una caja de cubitos, y en el sistema está como "Caldo (8 und)", eso es 1 paquete completo. Entonces la cantidad es 1 y la unidad es "unidad". Observa el precio para deducir si cobran 1 caja o varios cubitos sueltos.
  6. Determina si la factura está cobrada en Dólares (USD) o Bolívares (BS) y ponlo en "moneda_detectada".
  7. Extrae el monto total general del ticket o factura tal cual está impreso y ponlo en "total_factura_detectado".
  8. Responde ÚNICAMENTE en formato JSON válido, sin markdown, siguiendo esta estructura estricta:
  {
    "moneda_detectada": "USD" | "BS",
    "numero_factura": "00160244",
    "total_factura_detectado": 31589.99,
    "items": [
      {
        "nombre_extraido": "Nombre en factura",
        "cantidad": 250,
        "unidad": "gramo",
        "monto_extraido": 12.50
      }
    ]
  }
  `;
  
  try {
    const res = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType: "image/jpeg" } }]);
    console.log(res.response.text());
  } catch(e) {
    console.error(e);
  }
}
run();
