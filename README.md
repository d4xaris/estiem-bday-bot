# ESTIEM LG Kyiv | B-day Bot
A Telegram bot that checks a Google Sheet every morning at 09:00 (Kyiv time) and congratulates members on their birthday in the group chat.

## How it works

1. GitHub Actions runs the bot on a schedule (`.github/workflows/daily.yml`).
2. The bot reads the member list from Google Sheets.
3. If someone has a birthday today, it posts a random greeting in the chat and tags them.
4. Admins get a private message about the result (✅ or ❌ on error).

## Setup

Requires [Bun](https://bun.sh).

```bash
bun install
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
| --- | --- |
| `BOT_TOKEN` | Bot token from @BotFather |
| `CHAT_ID` | Group chat ID (supergroups start with `-100`) |
| `ADMIN_ID` | Admin user IDs, comma-separated |
| `SHEET_ID` | Google Sheet ID |
| `GOOGLE_SERVICE_ACCOUNT` | Service account JSON in a single line |
| `FORCE_RUN` | Optional. `true` skips the 09:00 check (local and manual runs) |

Admins must press Start in a private chat with the bot, otherwise it can't message them.

## Run

```bash
bun run src/index.ts      # run the bot
bun run typecheck         # check types
```

For a local test use `FORCE_RUN=true`. In GitHub: Actions → Daily birthdays → Run workflow.

## License

[MIT](LICENSE)
