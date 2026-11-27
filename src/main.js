import './styles/main.css';
import './styles/ui.css';
import './styles/ui-lobby.css';
import './styles/ui-hud.css';
import './styles/mobile.css';
import './core/Device.js';
import { Game } from './core/Game.js';

const game = new Game(document.getElementById('game-canvas'), document.getElementById('ui-root'));

// 개발 모드에서만 디버깅용으로 노출
if (import.meta.env.DEV) window.__game = game;
