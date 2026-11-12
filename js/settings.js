// Player settings that should survive a page reload (stored in this browser only).
const STORAGE_KEY = 'devilshot.settings';

const DEFAULTS = {
  sensitivity: 1 // multiplier on PLAYER.mouseSensitivity
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS }; // storage blocked (private mode, file://): just use defaults
  }
}

export const settings = load();

export function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* not persisted, still works this session */ }
}
