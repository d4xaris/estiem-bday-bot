import { config } from './config';
import { GoogleAuth } from 'google-auth-library';

export interface Member {
    name: string;
    username: string; // Без @
    birthday: string;
    status: string;   // Колонка C
}

export async function getMembers(): Promise<Member[]> {
    const members: Member[] = [];

    // Авторизація через сервісний акаунт
    const auth = new GoogleAuth({
        credentials: config.googleServiceAccount,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
        throw new Error('Не вдалося отримати access token для сервісного акаунта');
    }

    // Діапазон A:E, щоб індекси відповідали колонкам:
    // row[0] = A (порожня), row[1] = B (ім'я), row[2] = C (статус),
    // row[3] = D (дата народження), row[4] = E (нікнейм)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/A:E`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Помилка отримання таблиці: ${response.status} ${body}`);
    }

    const data = await response.json();
    const rows: string[][] = data.values || [];

    // Заголовок окремо не пропускаємо: якщо він є, його відсіє
    // перевірка формату дати (parseBirthday поверне null)
    for (const row of rows) {
        const rawName = row[1] || '';       // Ім'я
        const rawStatus = row[2] || '';     // Статус
        const rawBirthday = row[3] || '';   // День народження
        const rawUsername = row[4] || '';   // Нікнейм
        const cleanUsername = rawUsername.trim().replace(/^@/, '');

        if (rawName.trim() && parseBirthday(rawBirthday)) {
            members.push({
                name: rawName.trim(),
                username: cleanUsername,
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
        // Формат YYYY-MM-DD
        const parts = value.split('-');
        if (parts.length < 3) return null;
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
    } else if (value.includes('.')) {
        // Формат DD.MM.YYYY або DD.MM
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

// Поточна дата за київським часом (незалежно від часового поясу сервера)
function getKyivDateParts(): { day: number; month: number; year: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Kyiv',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(new Date());

    const get = (type: string) =>
        parseInt(parts.find(p => p.type === type)!.value, 10);

    return { day: get('day'), month: get('month'), year: get('year') };
}

export function getTodaysBirthdays(members: Member[]): Member[] {
    const { day: currentDay, month: currentMonth, year: currentYear } = getKyivDateParts();

    const isLeapYear =
        (currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0;

    return members.filter(member => {
        // Фільтр за статусом: вітаємо Active та Alumni
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