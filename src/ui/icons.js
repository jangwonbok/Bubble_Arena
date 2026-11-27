// 인라인 SVG 아이콘 (currentColor 사용 → CSS 색 그대로 적용)
const svg = (body, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICON = {
  gear: svg('<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3.6" stroke-dasharray="3.4 2.88"/><circle cx="12" cy="12" r="6.4" fill="currentColor"/><circle cx="12" cy="12" r="2.6" fill="#fff"/>'),
  sound: svg('<path fill="currentColor" d="M3 9.5h4l5-4.2v13.4l-5-4.2H3z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.4a8 8 0 0 1 0 11.2"/>'),
  mute: svg('<path fill="currentColor" d="M3 9.5h4l5-4.2v13.4l-5-4.2H3z"/><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="m16 9.5 5 5m0-5-5 5"/>'),
  help: svg('<rect x="3.5" y="2.5" width="17" height="19" rx="4" fill="currentColor"/><path fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" d="M9.5 9.3a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1.9-1.1 1.8"/><circle cx="12" cy="16.9" r="1.3" fill="#fff"/>'),
  exit: svg('<path fill="currentColor" d="M4 3.5h9.5v17H4z" opacity=".9"/><path fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" d="M16 8l4 4-4 4M20 12h-9"/>'),
  back: svg('<path fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" d="M14.5 5.5 8 12l6.5 6.5"/>'),
  home: svg('<path fill="currentColor" d="M12 3.2 2.8 11h2.7v9h5v-5.5h3V20h5v-9h2.7z"/>'),
  check: svg('<path fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" d="m5 12.5 4.4 4.3L19 7.5"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="2.2"/><path fill="none" stroke="currentColor" stroke-width="2.2" d="M16 5.5V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h.5"/>'),
  link: svg('<path fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1.2-1.2"/>'),
  userPlus: svg('<circle cx="9.5" cy="8" r="4" fill="currentColor"/><path fill="currentColor" d="M2 20c.5-4 3.6-6.2 7.5-6.2S16.5 16 17 20z"/><path fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" d="M19.5 7v6M16.5 10h6"/>'),
  trophy: svg('<path fill="#ffc531" d="M7 3h10v6a5 5 0 0 1-10 0z"/><path fill="none" stroke="#ffc531" stroke-width="2" d="M7 5H4v1.5A3.5 3.5 0 0 0 7.5 10M17 5h3v1.5a3.5 3.5 0 0 1-3.5 3.5"/><path fill="#f0a000" d="M10.5 13.5h3V17h-3z"/><rect x="7.5" y="17" width="9" height="3.6" rx="1.3" fill="#e08a00"/><path fill="#fff" opacity=".55" d="M9 4.5h2v5.5a2 2 0 0 1-2-2z"/>'),
  shield: svg('<path fill="#2fc46b" d="M12 2.5 20 5.5v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10v-6z"/><path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m8.2 12 2.7 2.7 5-5.2"/>'),
  stopwatch: svg('<circle cx="12" cy="13.5" r="8" fill="#fff" stroke="currentColor" stroke-width="2.4"/><path fill="currentColor" d="M9.5 2.5h5v2.4h-5z"/><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 13.5V9.2M18.6 6.3l1.4-1.4"/>'),
  people: svg('<circle cx="8.5" cy="8" r="3.4" fill="currentColor"/><circle cx="16.5" cy="9" r="2.8" fill="currentColor" opacity=".7"/><path fill="currentColor" d="M2.5 19c.4-3.4 2.8-5.4 6-5.4s5.6 2 6 5.4z"/><path fill="currentColor" opacity=".7" d="M15.6 13.8c2.9 0 5.1 1.8 5.4 5.2h-4.6c-.2-2-.5-3.4-1.6-4.9z"/>'),
  keyboard: svg('<rect x="2" y="6" width="20" height="12.5" rx="3" fill="currentColor"/><g fill="#fff"><rect x="5" y="9" width="2.4" height="2.2" rx=".6"/><rect x="8.8" y="9" width="2.4" height="2.2" rx=".6"/><rect x="12.6" y="9" width="2.4" height="2.2" rx=".6"/><rect x="16.4" y="9" width="2.4" height="2.2" rx=".6"/><rect x="7" y="13.3" width="10" height="2.2" rx=".6"/></g>'),
  globe: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z"/>'),
  mail: svg('<rect x="2.5" y="5" width="19" height="14" rx="3" fill="currentColor"/><path fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" d="m3.5 6.5 8.5 6.5 8.5-6.5"/>'),
  gamepad: svg('<path fill="currentColor" d="M7 6.5h10a5 5 0 0 1 4.9 4l.9 5a2.6 2.6 0 0 1-4.6 2l-2.4-2.9H8.2L5.8 17.5a2.6 2.6 0 0 1-4.6-2l.9-5A5 5 0 0 1 7 6.5Z"/><g fill="#fff"><rect x="5.2" y="9.6" width="1.8" height="5" rx=".6"/><rect x="3.6" y="11.2" width="5" height="1.8" rx=".6"/><circle cx="16.2" cy="10.8" r="1.2"/><circle cx="18.4" cy="13" r="1.2"/></g>'),
  target: svg('<circle cx="11" cy="13" r="8.5" fill="#ff5a6a"/><circle cx="11" cy="13" r="5.8" fill="#fff"/><circle cx="11" cy="13" r="3.2" fill="#ff5a6a"/><path fill="none" stroke="#3a4a70" stroke-width="2" stroke-linecap="round" d="M11 13 20 4"/><path fill="#ffb020" d="m19 2.5 2.6 2.6-2.4.7-.9-.9z"/>'),
  robot: svg('<rect x="4" y="7" width="16" height="12" rx="4" fill="currentColor"/><circle cx="9" cy="12.5" r="1.8" fill="#fff"/><circle cx="15" cy="12.5" r="1.8" fill="#fff"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 7V4"/><circle cx="12" cy="3.4" r="1.6" fill="currentColor"/>'),
  sparkle: svg('<path fill="currentColor" d="M12 2c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z"/>'),
  pin: svg('<path fill="currentColor" d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 4.6 6.5 12.5 6.5 12.5S18.5 13.6 18.5 9A6.5 6.5 0 0 0 12 2.5Zm0 9a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"/>'),
  crown: svg('<path fill="#ffc531" d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 10H5z"/><rect x="5" y="18" width="14" height="2.6" rx="1" fill="#e89a00"/>'),
  vote: svg('<rect x="3" y="11" width="18" height="10" rx="2.5" fill="currentColor"/><path fill="#fff" stroke="currentColor" stroke-width="1.6" d="M7 4h10v9H7z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m9.5 8.5 1.8 1.8 3.4-3.6"/>'),
  map: svg('<path fill="currentColor" d="M2.5 5.5 8.5 3l7 2.5 6-2.5v15.5l-6 2.5-7-2.5-6 2.5z" opacity=".25"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M2.5 5.5 8.5 3l7 2.5 6-2.5v15.5l-6 2.5-7-2.5-6 2.5zM8.5 3v15.5M15.5 5.5V21"/>'),
  zoom: svg('<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6"/>'),
  user: svg('<circle cx="12" cy="8" r="4.2" fill="currentColor"/><path fill="currentColor" d="M3.5 21c.6-4.6 4-7.2 8.5-7.2s7.9 2.6 8.5 7.2z"/>'),
};

/** <span class="ico">svg</span> 노드 */
export function icon(name, cls = '') {
  const s = document.createElement('span');
  s.className = `ico${cls ? ` ${cls}` : ''}`;
  s.innerHTML = ICON[name] || '';
  return s;
}
