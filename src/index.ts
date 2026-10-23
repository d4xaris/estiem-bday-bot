import { existsSync, writeFileSync } from "node:fs";
import { config } from "./config";
import { getMembers, getTodaysBirthdays } from "./sheets";
import { buildGreeting } from "./greeting";
import { sendToChat, sendToAdmins, escapeHtml } from "./telegram";

// Marker file restored from the Actions cache when today's run already succeeded
const SENT_MARKER = ".sent";

// Current hour in Kyiv (0-23)
function kyivHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Kyiv",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
}

// Current time in Kyiv as HH:MM (for admin reports)
function kyivTime(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

// Where this run came from (for logs and error reports)
function runSource(): string {
  return process.env.GITHUB_RUN_ID
    ? `GitHub Actions, подія: ${process.env.GITHUB_EVENT_NAME}, запуск: ${process.env.GITHUB_RUN_ID}`
    : "локальний запуск";
}

// Log to console and send a short status report to admins.
// A failed report must never break the run itself.
async function report(text: string, silent = false): Promise<void> {
  console.log(text);
  const event = process.env.GITHUB_EVENT_NAME ?? "local";
  await sendToAdmins(
    `${escapeHtml(text)}\n<i>Київ ${kyivTime()} · ${escapeHtml(event)}</i>`,
    { silent },
  ).catch(console.error);
}

// Check time -> find birthdays -> greet -> report to admins
async function main(): Promise<void> {
  const hour = kyivHour();
  console.log(`Подія: ${process.env.GITHUB_EVENT_NAME ?? "local"}, година в Києві: ${hour}`);

  if (!config.forceRun) {
    // GitHub cron can be delayed by hours, so run at any time from 09:00 on.
    // Before 09:00 (e.g. the winter cron firing at 08:07 in summer) we wait.
    if (hour < 9) {
      await report("⏭ Ще немає 09:00 за Києвом, пропускаю.", true);
      return;
    }

    // Today's run already succeeded (second cron or a delayed run)
    if (existsSync(SENT_MARKER)) {
      await report("⏭ Сьогодні вже оброблено, пропускаю.", true);
      return;
    }
  }

  const birthdays = getTodaysBirthdays(await getMembers());
  if (birthdays.length > 0) {
    await sendToChat(buildGreeting(birthdays));
    await sendToAdmins(
      `✅ Привітання надіслано: ${birthdays.map((m) => escapeHtml(m.name)).join(", ")}`,
    );
  } else {
    await report("🎂 Перевірку виконано: сьогодні немає днів народження.", true);
  }

  // Mark the day as done only after success (the cache step saves it at job end)
  if (!config.forceRun) writeFileSync(SENT_MARKER, new Date().toISOString());
}

// Report any failure to admins, then exit with an error
main().catch(async (e) => {
  console.error(e);
  const message = e instanceof Error ? e.message : String(e);
  await sendToAdmins(
    `❌ Помилка бота (${escapeHtml(runSource())}):\n<code>${escapeHtml(message)}</code>`,
  ).catch(console.error);
  process.exit(1);
});