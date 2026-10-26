import { existsSync } from "node:fs";

// Required environment variables
const REQUIRED = ["BOT_TOKEN", "CHAT_ID", "ADMIN_ID", "SHEET_ID"] as const;

type EnvName = (typeof REQUIRED)[number];

// Fallback key file (local runs / when the env variable is broken)
export const SERVICE_ACCOUNT_FILE = "service-account.json";

// Check all variables are set, report every missing one at once
function loadEnv(): Record<EnvName, string> {
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Не задано змінні середовища: ${missing.join(", ")}`);
  }
  return Object.fromEntries(
    REQUIRED.map((name) => [name, process.env[name]!.trim()]),
  ) as Record<EnvName, string>;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

// Parse service account JSON (single line) into an object
function parseServiceAccount(raw: string): ServiceAccount {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT має бути валідним JSON в один рядок");
  }

  const { client_email, private_key } = parsed;
  if (typeof client_email !== "string" || typeof private_key !== "string") {
    throw new Error(
      "У GOOGLE_SERVICE_ACCOUNT немає полів client_email або private_key",
    );
  }

  return {
    ...parsed,
    client_email,
    // Fix keys where newlines ended up as literal "\n" (common with .env / Secrets)
    private_key: private_key.replace(/\\n/g, "\n"),
  };
}

// Accept either a bare sheet ID or a full Google Sheets URL
function parseSheetId(raw: string): string {
  const match = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : raw;
}

const env = loadEnv();

// The env variable is optional if the key file exists; a broken value is not fatal either
const rawServiceAccount = process.env.GOOGLE_SERVICE_ACCOUNT?.trim();
let googleServiceAccount: ServiceAccount | null = null;
if (rawServiceAccount) {
  try {
    googleServiceAccount = parseServiceAccount(rawServiceAccount);
  } catch (e) {
    console.error(e);
  }
}

if (!googleServiceAccount && !existsSync(SERVICE_ACCOUNT_FILE)) {
  throw new Error(
    `Немає ключа сервісного акаунта: задайте GOOGLE_SERVICE_ACCOUNT або покладіть ${SERVICE_ACCOUNT_FILE}`,
  );
}

export const config = {
  botToken: env.BOT_TOKEN,
  chatId: env.CHAT_ID,
  // Comma-separated list: "123,456"
  adminIds: env.ADMIN_ID.split(",").map((s) => s.trim()).filter(Boolean),
  sheetId: parseSheetId(env.SHEET_ID),
  googleServiceAccount,
  // Skip the 09:00 check (manual and local runs)
  forceRun: process.env.FORCE_RUN === "true",
};