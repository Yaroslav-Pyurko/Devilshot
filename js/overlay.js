// Start / pause / death screen, with language and mouse sensitivity settings.
import { settings, saveSettings } from './settings.js';
import { t, LANGUAGES, getLanguage, setLanguage, onLanguageChange } from './i18n.js';

const SCREENS = {
  start: { title: null, button: 'btnPlay' },   // title stays the game's name in every language
  pause: { title: 'titlePause', button: 'btnResume' },
  dead: { title: 'titleDead', button: 'btnRetry' }
};

export class Overlay {
  constructor(els) {
    this.els = els; // { root, title, text, button, sens, sensValue, lang }
    this.kind = 'start';
    this.kills = 0;
    this.onActivate = () => {};
    // clicking anywhere starts/resumes the game, except on the settings panel
    els.root.addEventListener('click', e => {
      if (e.target.closest('.settings')) return;
      if (document.activeElement) document.activeElement.blur(); // controls must not keep keyboard focus in game
      this.onActivate();
    });
    this._initSensitivity(els.sens, els.sensValue);
    this._initLanguage(els.lang);
    onLanguageChange(() => this._render());
    this._render();
  }

  show(kind, { kills = 0 } = {}) {
    this.kind = kind;
    this.kills = kills;
    this._render();
    this.els.root.hidden = false;
  }

  hide() { this.els.root.hidden = true; }

  _render() {
    const s = SCREENS[this.kind];
    this.els.title.textContent = s.title ? t(s.title) : 'DEVILSHOT';
    this.els.button.textContent = t(s.button);
    this.els.text.textContent = this.kind === 'dead' ? t('deathText', { kills: this.kills }) : t('intro');
  }

  _initLanguage(select) {
    for (const { code, name } of LANGUAGES) {
      const o = document.createElement('option');
      o.value = code;
      o.textContent = name; // each language is listed in its own name
      o.lang = code;
      select.append(o);
    }
    select.value = getLanguage();
    select.addEventListener('change', () => setLanguage(select.value));
  }

  _initSensitivity(input, output) {
    const show = v => { output.textContent = Number(v).toFixed(2); };
    input.value = settings.sensitivity;
    show(settings.sensitivity);
    input.addEventListener('input', () => {
      settings.sensitivity = Number(input.value);
      show(input.value);
    });
    input.addEventListener('change', saveSettings); // persist once the user lets go
  }
}
