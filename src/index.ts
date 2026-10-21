import { config } from "./config";
import { getMembers, getTodaysBirthdays } from "./sheets";
import { buildGreeting } from "./greeting";
import { sendToChat, sendToAdmins, escapeHtml } from "./telegram";

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

// Check time -> find birthdays -> greet -> report to admins
async function main(): Promise<void> {
  // Two crons cover DST, so only run at 09:00 Kyiv time
  if (!config.forceRun && kyivHour() !== 9) {
    console.log("Зараз не 09:00 за Києвом, нічого не робимо.");
    return;
  }

  const birthdays = getTodaysBirthdays(await getMembers());
  if (birthdays.length === 0) {
    console.log("Сьогодні немає днів народження.");
    return;
  }

  await sendToChat(buildGreeting(birthdays));
  await sendToAdmins(
    `✅ Привітання надіслано: ${birthdays.map((m) => escapeHtml(m.name)).join(", ")}`,
  );
}

// Report any failure to admins, then exit with an error
main().catch(async (e) => {
  console.error(e);
  const message = e instanceof Error ? e.message : String(e);
  await sendToAdmins(`❌ Помилка бота:\n<code>${escapeHtml(message)}</code>`);
  process.exit(1);
});