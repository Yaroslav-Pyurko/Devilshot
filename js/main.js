import { Game } from './game.js';

const game = new Game();
game.start();

// Handy for debugging from the browser console: devilshot.player.hp = 999
window.devilshot = game;
