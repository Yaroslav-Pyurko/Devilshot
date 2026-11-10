// Start / pause / death screen.
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
    els.root.addEventListener('click', () => this.onActivate());
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
}
