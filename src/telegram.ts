import { config } from "./config";

const API = `https://api.telegram.org/bot${config.botToken}`;

// Telegram limit for photo/animation captions
const CAPTION_LIMIT = 1024;

// Escape special characters so names don't break HTML parse mode
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface SendOptions {
  // Deliver without sound/vibration
  silent?: boolean;
}

// Call any Bot API method, retry once on 429 or 5xx
async function callApi(
  method: string,
  payload: Record<string, unknown>,
  retry = true,
): Promise<void> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify(payload),
  });

  if (retry && (res.status === 429 || res.status >= 500)) {
    const retryAfter = Number(res.headers.get("retry-after")) || 3;
    await Bun.sleep(retryAfter * 1000);
    return callApi(method, payload, false);
  }

  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? res.status}`);
}

// Send one text message
async function sendMessage(
  chatId: string,
  text: string,
  options: SendOptions = {},
): Promise<void> {
  await callApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    disable_notification: options.silent ?? false,
  });
}

// Send a picture with a caption. GIF/MP4 links go through sendAnimation,
// because sendPhoto shows GIFs as a static image or rejects them.
export async function sendPhoto(
  chatId: string,
  photoUrl: string,
  caption: string,
  options: SendOptions = {},
): Promise<void> {
  const isAnimation = /\.(gif|mp4)(\?.*)?$/i.test(photoUrl);
  await callApi(isAnimation ? "sendAnimation" : "sendPhoto", {
    chat_id: chatId,
    [isAnimation ? "animation" : "photo"]: photoUrl,
    ...(caption ? { caption, parse_mode: "HTML" } : {}),
    disable_notification: options.silent ?? false,
  });
}

// Post to the main group chat. With an image: photo + caption.
// If the image is broken/unreachable, fall back to plain text so the greeting is never lost.
export async function sendToChat(text: string, imageUrl?: string): Promise<void> {
  if (!imageUrl) return sendMessage(config.chatId, text);

  const fitsCaption = text.length <= CAPTION_LIMIT;
  try {
    await sendPhoto(config.chatId, imageUrl, fitsCaption ? text : "");
  } catch (e) {
    console.error(`Не вдалося надіслати картинку ${imageUrl}, шлю лише текст:`, e);
    return sendMessage(config.chatId, text);
  }
  // Text too long for a caption: it goes right after the picture
  if (!fitsCaption) await sendMessage(config.chatId, text);
}

// DM all admins in parallel, only log failures
export async function sendToAdmins(
  text: string,
  options: SendOptions = {},
): Promise<void> {
  const results = await Promise.allSettled(
    config.adminIds.map((id) => sendMessage(id, text, options)),
  );
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`Не вдалося написати адміну ${config.adminIds[i]}:`, r.reason);
    }
  });
}