// Interface translations. To add a language: add it to LANGUAGES and give it a full STRINGS entry.
//
// Static text in index.html is marked with data-i18n="key"; dynamic text (overlay titles,
// AI status) calls t('key', { vars }). Hebrew switches the page to right-to-left.
import { settings, saveSettings } from './settings.js';

export const LANGUAGES = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'uk', name: 'Українська', dir: 'ltr' },
  { code: 'pl', name: 'Polski', dir: 'ltr' },
  { code: 'he', name: 'עברית', dir: 'rtl' }
];

const STRINGS = {
  en: {
    intro: 'Test spike: hilly terrain, walls, a hitscan shotgun and one imp with simple AI. It wanders, spots you, chases you, throws fireballs and searches the place it last saw you.',
    keyMouse: 'Mouse', keyLmb: 'LMB', keyShift: 'Shift', keySpace: 'Space', keyEsc: 'Esc',
    move: 'move', look: 'look', shoot: 'shoot (hold for auto fire)', run: 'run', jump: 'jump', pause: 'pause',
    sensitivity: 'Mouse sensitivity', language: 'Language',
    note: 'Needs a keyboard and mouse. Not playable on phones.',
    titlePause: 'PAUSED', titleDead: 'YOU DIED',
    btnPlay: 'CLICK TO PLAY', btnResume: 'RESUME', btnRetry: 'TRY AGAIN',
    deathText: 'The imp was faster. Frags: {kills}.',
    hudHealth: 'HEALTH', hudAmmo: 'AMMO', hudFrags: 'FRAGS', hudAi: 'AI', hudFps: 'FPS',
    aiWander: 'wandering', aiChase: 'chasing', aiAttack: 'attacking', aiSearch: 'searching',
    aiDead: 'dead, respawn in {s}s'
  },
  uk: {
    intro: 'Тестовий прототип: пагорби, стіни, дробовик і один біс із простим ШІ. Він блукає, помічає тебе, переслідує, кидає вогняні кулі й шукає там, де бачив тебе востаннє.',
    keyMouse: 'Миша', keyLmb: 'ЛКМ', keyShift: 'Shift', keySpace: 'Пробіл', keyEsc: 'Esc',
    move: 'рух', look: 'огляд', shoot: 'постріл (затисни для автовогню)', run: 'біг', jump: 'стрибок', pause: 'пауза',
    sensitivity: 'Чутливість миші', language: 'Мова',
    note: 'Потрібні клавіатура й миша. На телефоні не грається.',
    titlePause: 'ПАУЗА', titleDead: 'ТИ ЗАГИНУВ',
    btnPlay: 'КЛІКНИ, ЩОБ ГРАТИ', btnResume: 'ПРОДОВЖИТИ', btnRetry: 'ЩЕ РАЗ',
    deathText: 'Біс виявився спритнішим. Фрагів: {kills}.',
    hudHealth: "ЗДОРОВ'Я", hudAmmo: 'НАБОЇ', hudFrags: 'ФРАГИ', hudAi: 'ШІ', hudFps: 'FPS',
    aiWander: 'блукає', aiChase: 'переслідує', aiAttack: 'атакує', aiSearch: 'шукає',
    aiDead: 'мертвий, повернеться за {s} с'
  },
  pl: {
    intro: 'Prototyp testowy: pagórkowaty teren, mury, strzelba i jeden diablik z prostą SI. Krąży, zauważa cię, ściga, rzuca kulami ognia i przeszukuje miejsce, w którym widział cię ostatnio.',
    keyMouse: 'Mysz', keyLmb: 'LPM', keyShift: 'Shift', keySpace: 'Spacja', keyEsc: 'Esc',
    move: 'ruch', look: 'rozglądanie się', shoot: 'strzał (przytrzymaj, by strzelać seriami)', run: 'bieg', jump: 'skok', pause: 'pauza',
    sensitivity: 'Czułość myszy', language: 'Język',
    note: 'Wymaga klawiatury i myszy. Nie działa na telefonach.',
    titlePause: 'PAUZA', titleDead: 'ZGINĄŁEŚ',
    btnPlay: 'KLIKNIJ, ABY GRAĆ', btnResume: 'WZNÓW', btnRetry: 'JESZCZE RAZ',
    deathText: 'Diablik był szybszy. Fragi: {kills}.',
    hudHealth: 'ZDROWIE', hudAmmo: 'AMUNICJA', hudFrags: 'FRAGI', hudAi: 'SI', hudFps: 'FPS',
    aiWander: 'krąży', aiChase: 'ściga', aiAttack: 'atakuje', aiSearch: 'szuka',
    aiDead: 'martwy, wróci za {s} s'
  },
  he: {
    intro: 'אב־טיפוס לבדיקה: שטח גבעי, קירות, רובה ציד ושד אחד עם בינה מלאכותית פשוטה. הוא משוטט, מבחין בך, רודף אחריך, משליך כדורי אש ומחפש במקום שבו ראה אותך לאחרונה.',
    keyMouse: 'עכבר', keyLmb: 'לחצן שמאלי', keyShift: 'Shift', keySpace: 'רווח', keyEsc: 'Esc',
    move: 'תנועה', look: 'הסתכלות', shoot: 'ירי (החזק לירי רציף)', run: 'ריצה', jump: 'קפיצה', pause: 'השהיה',
    sensitivity: 'רגישות העכבר', language: 'שפה',
    note: 'נדרשים מקלדת ועכבר. לא ניתן לשחק בטלפון.',
    titlePause: 'מושהה', titleDead: 'מתת',
    btnPlay: 'לחץ כדי לשחק', btnResume: 'המשך', btnRetry: 'נסה שוב',
    deathText: 'השד היה מהיר יותר. הריגות: {kills}.',
    hudHealth: 'בריאות', hudAmmo: 'תחמושת', hudFrags: 'הריגות', hudAi: 'בינה', hudFps: 'FPS',
    aiWander: 'משוטט', aiChase: 'רודף', aiAttack: 'תוקף', aiSearch: 'מחפש',
    aiDead: 'מת, חוזר בעוד {s} שנ׳'
  }
};

const listeners = new Set();
let current = 'en';

// First run: follow the browser language if we support it, otherwise English.
function initialLanguage() {
  if (STRINGS[settings.lang]) return settings.lang;
  for (const l of navigator.languages || [navigator.language || 'en']) {
    const code = l.toLowerCase().split('-')[0];
    if (STRINGS[code]) return code;
  }
  return 'en';
}

export function t(key, vars = {}) {
  const s = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export function getLanguage() { return current; }

export function setLanguage(code, { save = true } = {}) {
  if (!STRINGS[code]) code = 'en';
  current = code;
  const lang = LANGUAGES.find(l => l.code === code);
  document.documentElement.lang = code;
  document.documentElement.dir = lang.dir;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  if (save) { settings.lang = code; saveSettings(); }
  for (const fn of listeners) fn(code);
}

// Components with text built in code re-render through this.
export function onLanguageChange(fn) { listeners.add(fn); }

setLanguage(initialLanguage(), { save: false });
