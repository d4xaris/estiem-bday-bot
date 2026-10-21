import { escapeHtml } from './telegram';
import type { Member } from './sheets';

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
    "[імʼя], сподіваюся, минулий рік був прекрасним, а майбутній буде тільки краще! Зі святом 🥳"
];

export function buildGreeting(members: Member[]): string {
    if (members.length === 0) {
        return '';
    }

    // Підстановка імені та @username (або тільки ПІБ)
    const memberTags = members.map(member => {
        const safeName = escapeHtml(member.name);
        if (member.username) {
            const safeUsername = escapeHtml(member.username);
            return `<b>${safeName}</b> @${safeUsername}`;
        } else {
            return `<b>${safeName}</b>`;
        }
    });

    // Спільний пост: об'єднуємо всіх іменинників через кому
    const namesString = memberTags.join(', ');

    // Вибір шаблону через Math.random
    const randomIndex = Math.floor(Math.random() * GREETINGS.length);
    const randomGreeting = GREETINGS[randomIndex];

    return randomGreeting.replace(/[імʼя]/g, namesString);
}