// 작은 DOM 헬퍼 + 공용 UI 컴포넌트
export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) e.style.setProperty(sk, sv);
        else e.style[sk] = sv;
      }
    }
    else e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) e.append(c);
  return e;
}

/** 캐릭터 GLB 모델 초상화 (로드되면 모든 아바타 자동 갱신) */
export const Portraits = {
  urls: {},
  waiting: new Map(), // id → Set<element>
  set(id, url) {
    this.urls[id] = url;
    for (const node of this.waiting.get(id) || []) applyPortrait(node, url);
    this.waiting.delete(id);
  },
};

function applyPortrait(node, url) {
  node.classList.add('has-portrait');
  node.style.backgroundImage = `url("${url}"), radial-gradient(circle at 50% 35%, #ffffff, color-mix(in srgb, var(--c) 40%, white))`;
}

/** 캐릭터 얼굴 아바타 */
export function avatar(def, size = 40) {
  const node = el('div', {
    class: `avatar avatar-${def.style}`,
    style: { '--c': def.css, width: `${size}px`, height: `${size}px` },
  }, [el('span', { class: 'avatar-eyes' })]);
  const url = Portraits.urls[def.id];
  if (url) applyPortrait(node, url);
  else {
    if (!Portraits.waiting.has(def.id)) Portraits.waiting.set(def.id, new Set());
    Portraits.waiting.get(def.id).add(node);
  }
  return node;
}

/** 사운드 설정 (시작 화면/일시정지 공용) */
export function soundControls(audio, onClick) {
  const toggle = el('button', { class: 'chip-toggle' });
  const music = el('button', { class: 'chip-toggle' });
  const slider = el('input', { type: 'range', min: '0', max: '1', step: '0.05', class: 'vol', 'aria-label': '볼륨' });
  const sync = () => {
    toggle.textContent = audio.enabled ? '🔊 효과음 ON' : '🔇 효과음 OFF';
    toggle.classList.toggle('off', !audio.enabled);
    music.textContent = audio.musicOn ? '🎵 음악 ON' : '🎵 음악 OFF';
    music.classList.toggle('off', !audio.musicOn);
    slider.value = String(audio.volume);
    slider.disabled = !audio.enabled;
  };
  toggle.addEventListener('click', () => {
    audio.unlock();
    audio.setEnabled(!audio.enabled);
    onClick?.();
  });
  music.addEventListener('click', () => {
    audio.unlock();
    audio.setMusic(!audio.musicOn);
    onClick?.();
  });
  slider.addEventListener('input', () => {
    audio.unlock();
    audio.setVolume(parseFloat(slider.value));
  });
  slider.addEventListener('change', () => onClick?.());
  audio.onChange(sync);
  sync();
  return el('div', { class: 'sound-controls' }, [
    el('div', { class: 'sound-row' }, [toggle, music]),
    el('label', { class: 'vol-row' }, [el('span', { text: '볼륨' }), slider]),
  ]);
}
