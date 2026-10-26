import { afterEach, describe, expect, mock, test } from "bun:test";
import { escapeHtml, sendToAdmins, sendToChat } from "../src/telegram";

const originalFetch = globalThis.fetch;

interface Call {
  method: string;
  body: Record<string, unknown>;
}

type Reply = { ok: boolean; description?: string; status?: number; headers?: Record<string, string> };

// Підміняє fetch: записує виклики Bot API і відповідає за handler
function mockTelegram(handler: (call: Call) => Reply = () => ({ ok: true })) {
  const calls: Call[] = [];
  globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).split("/").pop() as string;
    const call: Call = { method, body: JSON.parse(String(init?.body)) };
    calls.push(call);
    const reply = handler(call);
    return new Response(JSON.stringify({ ok: reply.ok, description: reply.description }), {
      status: reply.status ?? 200,
      headers: reply.headers,
    });
  }) as unknown as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("escapeHtml", () => {
  test("екранує & < >", () => {
    expect(escapeHtml("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
  });

  test("не екранує двічі вже готові сутності при одному проході", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});

describe("sendToChat", () => {
  test("без картинки: звичайний sendMessage у основний чат", async () => {
    const calls = mockTelegram();
    await sendToChat("Привіт");

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("sendMessage");
    expect(calls[0].body.chat_id).toBe("-100111");
    expect(calls[0].body.text).toBe("Привіт");
    expect(calls[0].body.parse_mode).toBe("HTML");
  });

  test("з jpg/png: sendPhoto із підписом", async () => {
    const calls = mockTelegram();
    await sendToChat("Привіт", "https://i.imgur.com/a.jpeg");

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("sendPhoto");
    expect(calls[0].body.photo).toBe("https://i.imgur.com/a.jpeg");
    expect(calls[0].body.caption).toBe("Привіт");
    expect(calls[0].body.parse_mode).toBe("HTML");
  });

  test.each(["https://i.imgur.com/a.gif", "https://i.imgur.com/a.GIF?x=1", "https://i.imgur.com/a.mp4"])(
    "гіфка/відео %s іде через sendAnimation",
    async (url) => {
      const calls = mockTelegram();
      await sendToChat("Привіт", url);

      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("sendAnimation");
      expect(calls[0].body.animation).toBe(url);
      expect(calls[0].body.caption).toBe("Привіт");
    },
  );

  test("картинка не завантажилась: привітання все одно йде текстом", async () => {
    const calls = mockTelegram((call) =>
      call.method === "sendPhoto"
        ? { ok: false, description: "Bad Request: wrong file identifier/HTTP URL specified", status: 400 }
        : { ok: true },
    );
    await sendToChat("Привіт", "https://i.imgur.com/broken.jpeg");

    expect(calls.map((c) => c.method)).toEqual(["sendPhoto", "sendMessage"]);
    expect(calls[1].body.text).toBe("Привіт");
  });

  test("текст довший за 1024 символи: картинка без підпису + окреме повідомлення", async () => {
    const calls = mockTelegram();
    const longText = "а".repeat(1100);
    await sendToChat(longText, "https://i.imgur.com/a.jpeg");

    expect(calls.map((c) => c.method)).toEqual(["sendPhoto", "sendMessage"]);
    expect(calls[0].body.caption).toBeUndefined();
    expect(calls[1].body.text).toBe(longText);
  });

  test("текст рівно 1024 символи вміщується в підпис", async () => {
    const calls = mockTelegram();
    await sendToChat("а".repeat(1024), "https://i.imgur.com/a.jpeg");

    expect(calls).toHaveLength(1);
    expect(calls[0].body.caption).toBe("а".repeat(1024));
  });

  test("помилка sendMessage піднімається нагору", async () => {
    mockTelegram(() => ({ ok: false, description: "Forbidden: bot was kicked", status: 403 }));
    await expect(sendToChat("Привіт")).rejects.toThrow("bot was kicked");
  });

  test("один повтор після 429, далі успіх", async () => {
    let attempt = 0;
    const calls = mockTelegram(() => {
      attempt++;
      return attempt === 1
        ? { ok: false, status: 429, headers: { "retry-after": "1" } }
        : { ok: true };
    });
    await sendToChat("Привіт");

    expect(calls).toHaveLength(2);
  });
});

describe("sendToAdmins", () => {
  test("пише кожному адміну з ADMIN_ID", async () => {
    const calls = mockTelegram();
    await sendToAdmins("Звіт");

    expect(calls.map((c) => c.body.chat_id).sort()).toEqual(["1", "2"]);
  });

  test("silent вимикає звук", async () => {
    const calls = mockTelegram();
    await sendToAdmins("Звіт", { silent: true });

    expect(calls.every((c) => c.body.disable_notification === true)).toBe(true);
  });

  test("збій в одного адміна не кидає помилку і не блокує інших", async () => {
    const calls = mockTelegram((call) =>
      call.body.chat_id === "1" ? { ok: false, description: "chat not found", status: 400 } : { ok: true },
    );
    await expect(sendToAdmins("Звіт")).resolves.toBeUndefined();
    expect(calls).toHaveLength(2);
  });
});