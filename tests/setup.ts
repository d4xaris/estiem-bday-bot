// Підставні змінні середовища: тести ніколи не торкаються справжнього чату чи таблиці.
// Файл підключається через bunfig.toml ще до імпорту src/config.ts.
process.env.BOT_TOKEN = "123456:TEST_TOKEN";
process.env.CHAT_ID = "-100111";
process.env.ADMIN_ID = "1,2";
process.env.SHEET_ID = "https://docs.google.com/spreadsheets/d/test_sheet_id/edit";
process.env.GOOGLE_SERVICE_ACCOUNT = JSON.stringify({
  client_email: "test@test.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
});
process.env.FORCE_RUN = "true";