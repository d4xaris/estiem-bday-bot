import { config } from "./config";

const API = `https://api.telegram.org/bot${config.botToken}`;

// Escape special characters so names don't break HTML parse mode
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Send one message, retry once on 429 or 5xx
async function sendMessage(chatId: string, text: string, retry = true): Promise<void> {
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    }),
  });

  if (retry && (res.status === 429 || res.status >= 500)) {
    const retryAfter = Number(res.headers.get("retry-after")) || 3;
    await Bun.sleep(retryAfter * 1000);
    return sendMessage(chatId, text, false);
  }

  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`Telegram: ${data.description ?? res.status}`);
}

// Post to the main group chat
export function sendToChat(text: string): Promise<void> {
  return sendMessage(config.chatId, text);
}

// DM all admins in parallel, only log failures
export async function sendToAdmins(text: string): Promise<void> {
  const results = await Promise.allSettled(
    config.adminIds.map((id) => sendMessage(id, text)),
  );
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`Не вдалося написати адміну ${config.adminIds[i]}:`, r.reason);
    }
  });
}