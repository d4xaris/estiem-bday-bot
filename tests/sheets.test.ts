import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";

// Google-авторизацію підміняємо, щоб тести не ходили в мережу
mock.module("google-auth-library", () => ({
  GoogleAuth: class {
    async getAccessToken() {
      return "test-token";
    }
  },
}));

const { getTodaysBirthdays, getGreetingsFromSheet, getMembers } = await import("../src/sheets");
type Member = import("../src/sheets").Member;

const member = (birthday: string, status = "Active"): Member => ({
  name: "Іваненко Іван",
  username: "ivan",
  birthday,
  status,
});

const originalFetch = globalThis.fetch;

function mockSheet(values: string[][] | undefined, status = 200) {
  const fn = mock(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(values ? { values } : {}), { status }),
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  setSystemTime(); // повертає справжній час
});

describe("getTodaysBirthdays", () => {
  beforeEach(() => {
    setSystemTime(new Date("2026-10-26T08:00:00Z")); // 26 жовтня за Києвом
  });

  test.each(["26.10.2000", "2000-10-26", "26.10", "  26.10.2000  "])(
    "впізнає формат дати %s",
    (birthday) => {
      expect(getTodaysBirthdays([member(birthday)])).toHaveLength(1);
    },
  );

  test("інша дата не підходить", () => {
    expect(getTodaysBirthdays([member("27.10.2000"), member("26.11.2000")])).toHaveLength(0);
  });

  test("вітає Active та Alumni (регістр неважливий)", () => {
    const result = getTodaysBirthdays([
      member("26.10.2000", "Active"),
      member("26.10.2000", "alumni"),
      member("26.10.2000", "ACTIVE"),
    ]);
    expect(result).toHaveLength(3);
  });

  test("інші статуси не вітає", () => {
    const result = getTodaysBirthdays([
      member("26.10.2000", "Inactive"),
      member("26.10.2000", ""),
      member("26.10.2000", "Candidate"),
    ]);
    expect(result).toHaveLength(0);
  });

  test("некоректні дати ігноруються без помилок", () => {
    const result = getTodaysBirthdays([
      member("abc"),
      member(""),
      member("32.13.2000"),
      member("2000-10"),
      member("26/10/2000"),
    ]);
    expect(result).toHaveLength(0);
  });

  test("не високосний рік: 29 лютого вітаємо 1 березня", () => {
    setSystemTime(new Date("2027-03-01T08:00:00Z"));
    expect(getTodaysBirthdays([member("29.02.2000")])).toHaveLength(1);
  });

  test("не високосний рік: 28 лютого 29-го не вітаємо", () => {
    setSystemTime(new Date("2027-02-28T08:00:00Z"));
    expect(getTodaysBirthdays([member("29.02.2000")])).toHaveLength(0);
  });

  test("високосний рік: 29 лютого вітаємо в той самий день, 1 березня вже ні", () => {
    setSystemTime(new Date("2028-02-29T08:00:00Z"));
    expect(getTodaysBirthdays([member("29.02.2000")])).toHaveLength(1);

    setSystemTime(new Date("2028-03-01T08:00:00Z"));
    expect(getTodaysBirthdays([member("29.02.2000")])).toHaveLength(0);
  });

  test("дата береться за Києвом, а не за UTC", () => {
    // 25 жовтня 22:30 UTC = 26 жовтня 00:30 у Києві
    setSystemTime(new Date("2026-10-25T22:30:00Z"));
    expect(getTodaysBirthdays([member("26.10.2000")])).toHaveLength(1);
  });
});

describe("getMembers", () => {
  test("читає колонки B, C, D, E і чистить @ та пробіли", async () => {
    mockSheet([
      ["1", " Іваненко Іван ", " Active ", " 26.10.2000 ", " @ivan "],
      ["2", "Без дати", "Active", "", ""],
      ["3", "", "Active", "26.10.2000", ""],
    ]);

    const members = await getMembers();
    expect(members).toEqual([
      { name: "Іваненко Іван", username: "ivan", birthday: "26.10.2000", status: "Active" },
    ]);
  });

  test("кидає помилку, якщо Google відповів не 200", async () => {
    mockSheet(undefined, 403);
    await expect(getMembers()).rejects.toThrow("403");
  });
});

describe("getGreetingsFromSheet", () => {
  test("звертається до вкладки Greetings та передає токен", async () => {
    const fetchMock = mockSheet([["Привіт, [імʼя]", ""]]);
    await getGreetingsFromSheet();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/test_sheet_id/values/Greetings!A:B");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });

  test("перший рядок без мітки вважається заголовком і пропускається", async () => {
    mockSheet([
      ["Text", "Image"],
      ["Привіт, [імʼя]", "https://i.imgur.com/a.jpeg"],
    ]);
    const result = await getGreetingsFromSheet();
    expect(result).toEqual([{ text: "Привіт, [імʼя]", imageUrl: "https://i.imgur.com/a.jpeg" }]);
  });

  test("перший рядок із міткою НЕ пропускається (заголовка в таблиці немає)", async () => {
    mockSheet([
      ["Перше [ім'я]", "https://i.imgur.com/a.png"],
      ["Друге [ім'я]", ""],
    ]);
    const result = await getGreetingsFromSheet();
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Перше [ім'я]");
  });

  test("прибирає зайву кому та пробіли в кінці тексту", async () => {
    mockSheet([["Вітаю [імʼя] 🥂 ,", ""]]);
    const result = await getGreetingsFromSheet();
    expect(result[0].text).toBe("Вітаю [імʼя] 🥂");
  });

  test("пропускає порожні рядки і рядки без тексту", async () => {
    mockSheet([["Один [імʼя]", ""], [""], ["", "https://i.imgur.com/x.png"], ["   ", ""], ["Два [імʼя]"]]);
    const result = await getGreetingsFromSheet();
    expect(result.map((g) => g.text)).toEqual(["Один [імʼя]", "Два [імʼя]"]);
  });

  test("колонка B відсутня: imageUrl порожній рядок", async () => {
    mockSheet([["Тільки текст [імʼя]"]]);
    const result = await getGreetingsFromSheet();
    expect(result[0].imageUrl).toBe("");
  });

  test("кидає помилку, якщо вкладки немає (400)", async () => {
    mockSheet(undefined, 400);
    await expect(getGreetingsFromSheet()).rejects.toThrow("Greetings");
  });

  test("кидає помилку, якщо вкладка порожня", async () => {
    mockSheet(undefined);
    await expect(getGreetingsFromSheet()).rejects.toThrow("порожня");
  });

  test("кидає помилку, якщо є лише заголовок", async () => {
    mockSheet([["Text", "Image"]]);
    await expect(getGreetingsFromSheet()).rejects.toThrow("порожня");
  });
});