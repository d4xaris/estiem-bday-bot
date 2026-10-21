import { escapeHtml } from './telegram';
import type { Member } from './sheets';

const PLACEHOLDER = '[імʼя]';

const GREETINGS = [
    "Настрою чумового, Свята тобі крутого, Любові до запаморочення, Вітаю [імʼя] з Днем Народження 🥂",
    "Усього келих за здоров'я [імʼя]! З днем народження 🍻",
    "До чого ж класний день сьогодні. День народження [імʼя] ☀️",
    "Немаленький знадобиться торт для такої кількості свічок, [імʼя]. З днем народження 🎂",
    "Розчехляйте ваші найкращі побажання, товариші. Пора вітати [імʼя] з днем народження 🎁",
    "У році цілих 365 або 366 днів, але тільки один із них такий знаменний — день народження [імʼя]. Happy birthday 👑",
    "[імʼя], нехай все що ще не збулося, збудеться! І ще бажаю здоров'я міцного, великого кохання, і удачі у всьому і завжди! З днем народження 🍀",
    "Давайте почнемо цей день із чогось хорошого - привітаємо [імʼя] з днем народження 🎉",
    "З Днем народження [імʼя]! Мрій, люби і живи на повну! Нехай удача тобі посміхається кожну секунду 🚀",
    "Приправимо цей день радістю з нагоди дня народження [імʼя]. Удачі у всьому ✨",
    "Цього дня світ поповнився новою зіркою — [імʼя]. Наші найкращі побажання 🌠",
    "[імʼя], сподіваюся, минулий рік був прекрасним, а майбутній буде тільки краще! Зі святом 🥳",
];

// "Прізвище Ім'я По батькові" -> "Ім'я Прізвище"
function displayName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    return parts.length >= 2 ? `${parts[1]} ${parts[0]}` : parts[0] ?? '';
}

// Ім'я жирним + @username для тегу (якщо нік є)
function formatMember(member: Member): string {
    const name = `<b>${escapeHtml(displayName(member.name))}</b>`;
    const username = member.username.trim().replace(/^@/, '');
    return username ? `${name} @${escapeHtml(username)}` : name;
}

// ["А"] -> "А"; ["А","Б"] -> "А та Б"; ["А","Б","В"] -> "А, Б та В"
function joinNames(items: string[]): string {
    if (items.length <= 1) return items[0] ?? '';
    return `${items.slice(0, -1).join(', ')} та ${items[items.length - 1]}`;
}

export function buildGreeting(members: Member[]): string {
    if (members.length === 0) return '';

    const names = joinNames(members.map(formatMember));
    const template = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

    // Буквальна заміна: без regex, а функція захищає від спецпослідовностей на кшталт $&
    return template.replaceAll(PLACEHOLDER, () => names);
}