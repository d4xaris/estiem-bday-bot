export const ADMIN_IDS = (process.env.ADMIN_ID ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);