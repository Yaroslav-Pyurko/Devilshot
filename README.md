# Devilshot

DOOM-style 3D shooter spike in the browser. Three.js r128, plain ES modules, no build step.

## Run

ES modules don't load from `file://`, so the game must be served over http:

- **Windows:** double-click `start.cmd`. It starts a tiny PowerShell server on http://localhost:8080 (or the next free port if 8080 is busy) and opens the browser. Close the window to stop it.
- **Alternatives:** VS Code "Live Server", `npx serve .`, or `python -m http.server 8080`.

Everything (Three.js, fonts) is in the repo, so it works offline.

## Controls

WASD move, mouse look, LMB shoot (hold for auto fire), Shift run, Space jump, Esc pause.

## Structure

```
index.html          page shell, HUD and overlay markup
css/style.css       UI styles, local @font-face
js/main.js          entry point
js/game.js          wires the systems, owns renderer/scene/camera and the main loop
js/config.js        all tunable numbers and the wall layout
js/world.js         terrain height field, sky, walls, collision, line of sight
js/player.js        movement, gravity, jumping, health
js/weapon.js        hitscan shotgun, ammo, muzzle flash, recoil
js/enemy.js         Imp sprite and its AI state machine (wander, chase, search)
js/projectiles.js   enemy fireballs
js/particles.js     hit puffs, blood, explosion sparks
js/hud.js           pixel weapon + crosshair canvas, status bar
js/input.js         keyboard, mouse, pointer lock
js/overlay.js       start / pause / death screen
js/textures.js      procedural pixel-art textures
js/audio.js         synthesized WebAudio sound effects
js/utils.js         small helpers
lib/three.module.js Three.js r128 (MIT, see lib/three.LICENSE.txt)
assets/fonts/       Silkscreen and IBM Plex Sans (OFL)
```

## Where to extend

- Gameplay tuning: `js/config.js`.
- More enemies: create more `Imp` instances in `Game` and push them to `this.enemies`.
- Level layout: `WALLS` in `js/config.js`, terrain shape in `heightAt()` in `js/world.js`.
- Better pathfinding: replace `Imp._move()` steering with A* over a grid built from `world.blocked()`.
