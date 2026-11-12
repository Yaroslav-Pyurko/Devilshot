// Start / pause / death screen, with the mouse sensitivity slider.
import { settings, saveSettings } from './settings.js';

const SCREENS = {
  start: { title: 'DEVILSHOT', button: 'CLICK TO PLAY' },
  pause: { title: 'PAUSED', button: 'RESUME' },
  dead: { title: 'YOU DIED', button: 'TRY AGAIN' }
};

export class Overlay {
  constructor(els) {
    this.els = els; // { root, title, text, button }
    this.introText = els.text.textContent;
    this.onActivate = () => {};
    // clicking anywhere starts/resumes the game, except on the settings panel
    els.root.addEventListener('click', e => {
      if (e.target.closest('.settings')) return;
      if (document.activeElement) document.activeElement.blur(); // slider must not keep keyboard focus in game
      this.onActivate();
    });
    this._initSensitivity(els.sens, els.sensValue);
  }

  show(kind, { kills = 0 } = {}) {
    const s = SCREENS[kind];
    this.els.title.textContent = s.title;
    this.els.button.textContent = s.button;
    this.els.text.textContent = kind === 'dead'
      ? `The imp was faster. Frags: ${kills}.`
      : this.introText;
    this.els.root.hidden = false;
  }

  hide() { this.els.root.hidden = true; }

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
