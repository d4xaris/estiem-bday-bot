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

    // Завантаження даних із діапазону A:E
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/A:E`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Помилка отримання таблиці: ${response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    // Обробка рядків
    for (const row of rows.slice(1)) {
        for (const row of rows.slice(1)) {
            const rawName = row[1] || '';       // Ім'я
            const rawStatus = row[2] || '';     // Статус
            const rawBirthday = row[3] || '';   // День народження
            const rawUsername = row[4] || '';
        const cleanUsername = rawUsername.trim().replace(/^@/, '');

            if (rawName && rawBirthday) {
                members.push({
                    name: rawName.trim(),
                    username: cleanUsername,
                    birthday: rawBirthday.trim(),
                    status: rawStatus.trim()
                });
            }
        }

        return members;
    }

    return members;
}

export function getTodaysBirthdays(members: Member[]): Member[] {
    const kyivDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
    const currentMonth = kyivDate.getMonth() + 1;
    const currentDay = kyivDate.getDate();
    const currentYear = kyivDate.getFullYear();

    const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);

    return members.filter(member => {
        if (!member.birthday) return false;

        // Фільтр за статусом: вітаємо Active та Alumni
        const status = member.status.toLowerCase();
        if (status !== 'active' && status !== 'alumni') return false;

        let bDay: number;
        let bMonth: number;

        // Перевіряємо, в якому форматі записана дата
        if (member.birthday.includes('-')) {
            // Формат YYYY-MM-DD
            const parts = member.birthday.split('-');
            if (parts.length < 3) return false;
            bMonth = parseInt(parts[1], 10);
            bDay = parseInt(parts[2], 10);
        } else if (member.birthday.includes('.')) {
            // Формат DD.MM.YYYY або DD.MM
            const parts = member.birthday.split('.');
            if (parts.length < 2) return false;
            bDay = parseInt(parts[0], 10);
            bMonth = parseInt(parts[1], 10);
        } else {
            return false;
        }
        // 29 лютого (не високосний рік) привітання 1 березня
        if (!isLeapYear && currentMonth === 3 && currentDay === 1 && bMonth === 2 && bDay === 29) {
            return true;
        }

        return bDay === currentDay && bMonth === currentMonth;
    });
}
