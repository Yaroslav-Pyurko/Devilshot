// Keyboard, mouse and pointer lock. Game code asks `input.down('KeyW')` and subscribes to callbacks.
export class Input {
  constructor(lockTarget) {
    this.lockTarget = lockTarget;
    this.keys = Object.create(null);
    this.fireHeld = false;
    this.locked = false;
    this.fallback = false; // pointer lock refused: look with plain mouse movement
    this.enabled = false;  // set by the game while playing

    this.onLook = () => {};
    this.onFirePressed = () => {};
    this.onLockChange = () => {};
    this.onPauseRequested = () => {};

    addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'Space' && this.enabled) e.preventDefault();
      if (e.code === 'Escape' && this.fallback && this.enabled) this.onPauseRequested();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => this.releaseAll());

    addEventListener('mousemove', e => {
      if (this.enabled && (this.locked || this.fallback)) this.onLook(e.movementX, e.movementY);
    });
    addEventListener('mousedown', e => {
      if (this.enabled && e.button === 0) { this.fireHeld = true; this.onFirePressed(); }
    });
    addEventListener('mouseup', e => { if (e.button === 0) this.fireHeld = false; });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.lockTarget;
      if (this.locked) this.fallback = false;
      this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => this._enterFallback());
  }

  down(code) { return !!this.keys[code]; }

  releaseAll() {
    for (const k in this.keys) this.keys[k] = false;
    this.fireHeld = false;
  }

  requestLock() {
    const el = this.lockTarget;
    if (!el.requestPointerLock) { this._enterFallback(); return; }
    try {
      const p = el.requestPointerLock();
      if (p && p.catch) p.catch(() => this._enterFallback());
    } catch { this._enterFallback(); }
  }

  exitLock() {
    this.fallback = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _enterFallback() {
    if (this.locked) return;
    this.fallback = true;
    this.onLockChange(true);
  }
}
