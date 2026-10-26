import { describe, expect, test } from "bun:test";
import { buildGreeting } from "../src/greeting";
import type { Member, GreetingRow } from "../src/sheets";

const ivan: Member = {
  name: "Іваненко Іван Петрович",
  username: "ivan",
  birthday: "26.10.2000",
  status: "Active",
};
const olga: Member = {
  name: "Петренко Ольга Іванівна",
  username: "",
  birthday: "26.10.1999",
  status: "Active",
};
const max: Member = {
  name: "Сидоренко Максим",
  username: "@max",
  birthday: "26.10.1998",
  status: "Alumni",
};

const row = (text: string, imageUrl = ""): GreetingRow => ({ text, imageUrl });

describe("buildGreeting", () => {
  test("повертає null, якщо іменинників немає", () => {
    expect(buildGreeting([], [row("Привіт, [імʼя]")])).toBeNull();
  });

  test("міняє мітку на 'Ім'я Прізвище' жирним + @username", () => {
    const result = buildGreeting([ivan], [row("Вітаємо, [імʼя]!")]);
    expect(result?.text).toBe("Вітаємо, <b>Іван Іваненко</b> @ivan!");
  });

  test("без username тегу немає", () => {
    const result = buildGreeting([olga], [row("[імʼя], вітаємо")]);
    expect(result?.text).toBe("<b>Ольга Петренко</b>, вітаємо");
  });

  test("@ на початку username не дублюється", () => {
    const result = buildGreeting([max], [row("[імʼя]")]);
    expect(result?.text).toBe("<b>Максим Сидоренко</b> @max");
  });

  test.each(["[імʼя]", "[ім'я]", "[ім’я]", "[имя]", "[name]", "[ІМ'Я]", "[ ім'я ]"])(
    "розпізнає мітку %s",
    (placeholder) => {
      const result = buildGreeting([ivan], [row(`Hi ${placeholder}!`)]);
      expect(result?.text).toBe("Hi <b>Іван Іваненко</b> @ivan!");
    },
  );

  test("міняє кілька міток в одному тексті", () => {
    const result = buildGreeting([ivan], [row("[імʼя], ми вітаємо [імʼя]")]);
    expect(result?.text.match(/Іван Іваненко/g)?.length).toBe(2);
  });

  test("двоє іменинників: 'А та Б'", () => {
    const result = buildGreeting([ivan, olga], [row("[імʼя]")]);
    expect(result?.text).toBe("<b>Іван Іваненко</b> @ivan та <b>Ольга Петренко</b>");
  });

  test("троє іменинників: 'А, Б та В'", () => {
    const result = buildGreeting([ivan, olga, max], [row("[імʼя]")]);
    expect(result?.text).toBe(
      "<b>Іван Іваненко</b> @ivan, <b>Ольга Петренко</b> та <b>Максим Сидоренко</b> @max",
    );
  });

  test("якщо мітки в тексті немає, імена ставляться на початок", () => {
    const result = buildGreeting([ivan], [row("Супер день!")]);
    expect(result?.text).toBe("<b>Іван Іваненко</b> @ivan\n\nСупер день!");
  });

  test("екранує HTML у тексті з таблиці", () => {
    const result = buildGreeting([ivan], [row("a < b & c > d, [імʼя]")]);
    expect(result?.text).toBe("a &lt; b &amp; c &gt; d, <b>Іван Іваненко</b> @ivan");
  });

  test("спецпослідовності на кшталт $& в імені не ламають заміну", () => {
    const weird: Member = { ...ivan, name: "Test$& User", username: "" };
    const result = buildGreeting([weird], [row("[імʼя]")]);
    expect(result?.text).toBe("<b>User Test$&amp;</b>");
  });

  test("повертає картинку з рядка таблиці", () => {
    const result = buildGreeting([ivan], [row("[імʼя]", "https://i.imgur.com/a.jpeg")]);
    expect(result?.imageUrl).toBe("https://i.imgur.com/a.jpeg");
  });

  test("порожня колонка B: imageUrl відсутній", () => {
    const result = buildGreeting([ivan], [row("[імʼя]", "")]);
    expect(result?.imageUrl).toBeUndefined();
  });

  test("завжди обирає один із рядків таблиці", () => {
    const greetings = [row("Перше [імʼя]"), row("Друге [імʼя]")];
    for (let i = 0; i < 50; i++) {
      const result = buildGreeting([ivan], greetings);
      expect(result?.text.startsWith("Перше") || result?.text.startsWith("Друге")).toBe(true);
    }
  });

  test("таблиця порожня: береться запасний масив із коду", () => {
    const result = buildGreeting([ivan], []);
    expect(result).not.toBeNull();
    expect(result?.text).toContain("<b>Іван Іваненко</b> @ivan");
    expect(result?.text).not.toMatch(/\[\s*(імʼя|ім'я)\s*\]/i);
    expect(result?.imageUrl).toBeUndefined();
  });

  test("greetings не передано: теж запасний масив", () => {
    const result = buildGreeting([ivan]);
    expect(result?.text).toContain("Іван Іваненко");
  });
});