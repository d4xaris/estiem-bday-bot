// Required environment variables
const REQUIRED = [
  "BOT_TOKEN",
  "CHAT_ID",
  "ADMIN_ID",
  "SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT",
] as const;

// Check all variables are set, report every missing one at once
function loadEnv(): Record<(typeof REQUIRED)[number], string> {
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Не задано змінні середовища: ${missing.join(", ")}`);
  }
  return Object.fromEntries(
    REQUIRED.map((name) => [name, process.env[name]!.trim()]),
  ) as Record<(typeof REQUIRED)[number], string>;
}

// Parse service account JSON (single line) into an object
function parseServiceAccount(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT має бути валідним JSON в один рядок");
  }
}

const env = loadEnv();

export const config = {
  botToken: env.BOT_TOKEN,
  chatId: env.CHAT_ID,
  // Comma-separated list: "123,456"
  adminIds: env.ADMIN_ID.split(",").map((s) => s.trim()).filter(Boolean),
  sheetId: env.SHEET_ID,
  googleServiceAccount: parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT),
  // Skip the 09:00 check (manual and local runs)
  forceRun: process.env.FORCE_RUN === "true",
};