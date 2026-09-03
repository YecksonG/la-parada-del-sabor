/**
 * Servicio de Notificaciones a Telegram para La Parada del Sabor
 * Notifica al dueño/operador en tiempo real cada vez que entra un pedido web o comanda
 *
 * ⚠️ SEGURIDAD: Las credenciales de Telegram SIEMPRE deben ir en las variables
 * de entorno (`.env.local` en desarrollo o Variables de Entorno en Vercel).
 * JAMÁS hardcodear el token del bot o el chat_id en este archivo, ya que el
 * repositorio es público y quedarían expuestos (robo del bot / spam).
 */

// Flag module-level para advertir UNA sola vez sobre credenciales faltantes.
let warnedSinCredenciales = false;

export interface ComandaTelegramPayload {
  numero_comanda: number | string;
  origen: "web" | "pos";
  nombre_cliente: string;
  telefono?: string | null;
  tipo_entrega: string;
  delivery_zona?: string | null;
  direccion?: string | null;
  total_usd: number;
  total_bs?: number | null;
  metodo_pago?: string | null;
  items?: Array<{
    cantidad: number;
    nombre: string;
    notas?: string | null;
  }>;
}

/** Escapa caracteres reservados de HTML para evitar romper el render / inyección. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function notificarComandaTelegram(payload: ComandaTelegramPayload): Promise<boolean> {
  // Credenciales SOLO desde variables de entorno (Vercel / .env.local).
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    if (!warnedSinCredenciales) {
      warnedSinCredenciales = true;
      console.warn(
        "Notificación a Telegram deshabilitada: faltan las variables de entorno " +
          "TELEGRAM_BOT_TOKEN y/o TELEGRAM_CHAT_ID (defínelas en .env.local o Vercel)."
      );
    }
    return false;
  }

  const itemsList = (payload.items || [])
    .map(
      (it) =>
        `  • ${it.cantidad}x ${escapeHtml(it.nombre)}${it.notas ? ` <i>(${escapeHtml(it.notas)})</i>` : ""}`
    )
    .join("\n");

  const origenEmoji = payload.origen === "web" ? "🌐 PEDIDO WEB" : "⚡ POS SALÓN";
  const entregaEmoji =
    payload.tipo_entrega === "delivery"
      ? `🛵 Delivery (${escapeHtml(payload.delivery_zona || "A Domicilio")})`
      : "🛍️ Para Llevar / Retiro";

  const mensaje = `🔔 <b>¡NUEVA COMANDA #${escapeHtml(String(payload.numero_comanda))}!</b>
<b>Origen:</b> ${origenEmoji}
<b>Modalidad:</b> ${entregaEmoji}

👤 <b>Cliente:</b> ${escapeHtml(payload.nombre_cliente)}
📞 <b>Teléfono:</b> ${escapeHtml(payload.telefono || "No registrado")}
${payload.direccion ? `📍 <b>Dirección:</b> ${escapeHtml(payload.direccion)}\n` : ""}
💵 <b>Total:</b> $${payload.total_usd.toFixed(2)} USD${payload.total_bs ? ` / Bs. ${payload.total_bs.toFixed(2)}` : ""}
💳 <b>Método:</b> ${escapeHtml(payload.metodo_pago || "Pendiente")}

📋 <b>Detalle del Pedido:</b>
${itemsList || "  • Sin detalles especificados"}`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensaje,
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(6000),
    });

    return res.ok;
  } catch (err) {
    console.error("Error enviando notificación a Telegram:", err);
    return false;
  }
}
