import { existsSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';
import { config, SERVICE_ACCOUNT_FILE } from './config';

export interface Member {
    name: string;
    username: string; // Без @
    birthday: string;
    status: string;   // Колонка C
}

export interface GreetingRow {
    text: string;
    imageUrl: string;
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

// Способи авторизації за пріоритетом: 1) змінна GOOGLE_SERVICE_ACCOUNT, 2) файл service-account.json
function createAuths(): { name: string; auth: GoogleAuth }[] {
    const auths: { name: string; auth: GoogleAuth }[] = [];

    const sa = config.googleServiceAccount;
    if (sa) {
        auths.push({
            name: 'GOOGLE_SERVICE_ACCOUNT',
            auth: new GoogleAuth({
                credentials: { client_email: sa.client_email, private_key: sa.private_key },
                scopes: SCOPES,
            }),
        });
    }

    if (existsSync(SERVICE_ACCOUNT_FILE)) {
        auths.push({
            name: SERVICE_ACCOUNT_FILE,
            auth: new GoogleAuth({ keyFile: SERVICE_ACCOUNT_FILE, scopes: SCOPES }),
        });
    }

    return auths;
}

// Токен для одного способу, з повторними спробами (Google інколи тимчасово відхиляє підпис)
async function getTokenWithRetry(auth: GoogleAuth, attempts = 2): Promise<string> {
    for (let i = 1; i <= attempts; i++) {
        try {
            const token = await auth.getAccessToken();
            if (token) return token;
        } catch (e) {
            if (i === attempts) throw e;
        }
        await new Promise((r) => setTimeout(r, 3000 * i));
    }
    throw new Error('Не вдалося отримати access token для сервісного акаунта');
}

// Пробуємо способи по черзі: не спрацював перший, беремо наступний
async function getAccessToken(): Promise<string> {
    let lastError: unknown = new Error('Немає жодного ключа сервісного акаунта');

    for (const { name, auth } of createAuths()) {
        try {
            return await getTokenWithRetry(auth);
        } catch (e) {
            console.error(`Авторизація через ${name} не вдалася:`, e);
            lastError = e;
        }
    }

    throw lastError;
}

export async function getMembers(): Promise<Member[]> {
    const members: Member[] = [];

    const accessToken = await getAccessToken();

    // A:E, щоб індекси збігалися з колонками:
    // row[1] = B (ім'я), row[2] = C (статус), row[3] = D (дата), row[4] = E (нікнейм)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/A:E`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Помилка отримання таблиці: ${response.status} ${body}`);
    }

    const data = await response.json();
    const rows: string[][] = data.values || [];

    for (const row of rows) {
        const rawName = row[1] || '';
        const rawStatus = row[2] || '';
        const rawBirthday = row[3] || '';
        const rawUsername = row[4] || '';

        if (rawName && rawBirthday) {
            members.push({
                name: rawName.trim(),
                username: rawUsername.trim().replace(/^@/, ''),
                birthday: rawBirthday.trim(),
                status: rawStatus.trim(),
            });
        }
    }

    return members;
}

// Повертає день і місяць народження або null, якщо формат невідомий
function parseBirthday(birthday: string): { day: number; month: number } | null {
    const value = birthday.trim();
    if (!value) return null;

    let day: number;
    let month: number;

    if (value.includes('-')) {
        // YYYY-MM-DD
        const parts = value.split('-');
        if (parts.length < 3) return null;
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
    } else if (value.includes('.')) {
        // DD.MM.YYYY або DD.MM
        const parts = value.split('.');
        if (parts.length < 2) return null;
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
    } else {
        return null;
    }

    if (isNaN(day) || isNaN(month)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return { day, month };
}

// Поточна дата за київським часом
function getKyivDateParts(): { day: number; month: number; year: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Kyiv',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(new Date());

    const get = (type: string) =>
        parseInt(parts.find((p) => p.type === type)!.value, 10);

    return { day: get('day'), month: get('month'), year: get('year') };
}

export function getTodaysBirthdays(members: Member[]): Member[] {
    const { day: currentDay, month: currentMonth, year: currentYear } = getKyivDateParts();

    const isLeapYear =
        (currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0;

    return members.filter((member) => {
        // Вітаємо лише Active та Alumni
        const status = member.status.toLowerCase();
        if (status !== 'active' && status !== 'alumni') return false;

        const parsed = parseBirthday(member.birthday);
        if (!parsed) return false;

        const { day: bDay, month: bMonth } = parsed;

        // 29 лютого (не високосний рік): вітаємо 1 березня
        if (!isLeapYear && currentMonth === 3 && currentDay === 1 && bMonth === 2 && bDay === 29) {
            return true;
        }

        return bDay === currentDay && bMonth === currentMonth;
    });
}

// Привітання з вкладки Greetings: A = текст з міткою [ім'я], B = URL картинки/гіфки (необов'язково).
// Заголовок необов'язковий: перший рядок пропускається, лише якщо в ньому немає мітки.
// Якщо вкладка недоступна або порожня, кидає помилку (index.ts її ловить і бере запасні фрази).
export async function getGreetingsFromSheet(): Promise<GreetingRow[]> {
    const accessToken = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/Greetings!A:B`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Вкладка Greetings недоступна: ${response.status} ${body}`);
    }

    const data = await response.json();
    let rows: string[][] = data.values || [];

    // Якщо перший рядок схожий на заголовок (немає мітки імені), пропускаємо його
    const looksLikeHeader = rows.length > 0 && !/\[[^\]]*(?:м['’ʼ`]?я|name)[^\]]*\]/i.test(rows[0][0] || '');
    if (looksLikeHeader) rows = rows.slice(1);

    const greetings = rows
        .map((row) => ({
            // Прибираємо зайву кому/пробіли в кінці тексту
            text: (row[0] || '').trim().replace(/[\s,]+$/, ''),
            imageUrl: (row[1] || '').trim(),
        }))
        .filter((g) => g.text);

    if (greetings.length === 0) {
        throw new Error('Вкладка Greetings порожня: додайте хоча б одне привітання');
    }

    return greetings;
}