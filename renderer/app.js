/* MadBot control room renderer. */

// ---------- Icons ----------
const ICONS = {
  dashboard: ['r:3,3,7,9,1.5', 'r:14,3,7,5,1.5', 'r:14,12,7,9,1.5', 'r:3,16,7,5,1.5'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  target: ['c:12,12,10', 'c:12,12,6', 'c:12,12,2'],
  terminal: ['m4 17 6-6-6-6', 'M12 19h8'],
  scene: ['r:2,3,20,14,2', 'M8 21h8', 'M12 17v4'],
  radio: ['c:12,12,2', 'M16.24 7.76a6 6 0 0 1 0 8.49', 'M7.76 16.24a6 6 0 0 1 0-8.49', 'M19.07 4.93a10 10 0 0 1 0 14.14', 'M4.93 19.07a10 10 0 0 1 0-14.14'],
  scissors: ['c:6,6,3', 'c:6,18,3', 'M20 4 8.12 15.88', 'M14.47 14.48 20 20', 'M8.12 8.12 12 12'],
  bulb: ['M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5', 'M9 18h6', 'M10 22h4'],
  mic: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
  layers: ['m12 2 10 5-10 5L2 7z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
  play: ['M6 3l14 9-14 9z'],
  stop: ['r:6,6,12,12,2'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  copy: ['r:8,8,14,14,2', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  external: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  plus: ['M12 5v14', 'M5 12h14'],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  follow: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'c:9,7,4', 'M19 8v6', 'M22 11h-6'],
  sub: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'],
  raid: ['M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z', 'm12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z', 'M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0', 'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5'],
  host: ['r:2,7,20,15,2', 'm17 2-5 5-5-5'],
  kick: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  tip: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  clock: ['c:12,12,10', 'M12 6v6l4 2'],
  search: ['c:11,11,8', 'm21 21-4.3-4.3'],
  eye: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z', 'c:12,12,3'],
  folder: ['M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  replay: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
  volume: ['M11 5 6 9H2v6h4l5 4V5z', 'M15.54 8.46a5 5 0 0 1 0 7.07', 'M19.07 4.93a10 10 0 0 1 0 14.14'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'c:9,7,4', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  info: ['c:12,12,10', 'M12 16v-4', 'M12 8h.01'],
  wand: ['m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z', 'm14 7 3 3', 'M5 6v4', 'M19 14v4', 'M10 2v2', 'M7 8H3', 'M21 16h-4', 'M11 3H9'],
};

const SVG_NS = 'http://www.w3.org/2000/svg';
function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  (ICONS[name] || ICONS.info).forEach((spec) => {
    let el;
    if (spec.startsWith('c:')) {
      const [cx, cy, r] = spec.slice(2).split(',');
      el = document.createElementNS(SVG_NS, 'circle');
      el.setAttribute('cx', cx); el.setAttribute('cy', cy); el.setAttribute('r', r);
    } else if (spec.startsWith('r:')) {
      const [x, y, w, hh, rx] = spec.slice(2).split(',');
      el = document.createElementNS(SVG_NS, 'rect');
      el.setAttribute('x', x); el.setAttribute('y', y); el.setAttribute('width', w); el.setAttribute('height', hh); el.setAttribute('rx', rx || 0);
    } else {
      el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('d', spec);
    }
    svg.appendChild(el);
  });
  return svg;
}

// ---------- DOM helper ----------
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    Object.entries(props).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === 'class') el.className = value;
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
      else if (key === 'vars') Object.entries(value).forEach(([k, v]) => el.style.setProperty(k, v));
      else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key in el && key !== 'list') el[key] = value;
      else el.setAttribute(key, value === true ? '' : value);
    });
  }
  kids.flat(Infinity).forEach((kid) => {
    if (kid == null || kid === false) return;
    el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  });
  return el;
}

function card(title, iconName, ...kids) {
  const actions = kids.length && kids[0] && kids[0].__actions ? kids.shift() : null;
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', null, iconName && icon(iconName), title), actions),
    kids);
}
function actions(...kids) {
  const el = h('div', { class: 'row' }, kids);
  el.__actions = true;
  return el;
}

function btn(label, opts = {}) {
  const el = h('button', { class: opts.class || '', title: opts.title || null, type: 'button' }, opts.icon && icon(opts.icon), label);
  if (opts.onClick) {
    el.addEventListener('click', async (event) => {
      if (!opts.async) return opts.onClick(event);
      el.classList.add('busy');
      el.disabled = true;
      try { await opts.onClick(event); } finally { el.classList.remove('busy'); el.disabled = false; }
    });
  }
  return el;
}

function field(label, value, onSave, opts = {}) {
  const input = h(opts.textarea ? 'textarea' : 'input', {
    type: opts.textarea ? null : (opts.type || 'text'),
    placeholder: opts.placeholder || '',
    rows: opts.rows || null,
    min: opts.min ?? null,
    max: opts.max ?? null,
    step: opts.step ?? null,
  });
  input.value = value ?? '';
  if (onSave) input.addEventListener(opts.live ? 'input' : 'change', () => onSave(opts.type === 'number' ? Number(input.value) : input.value, input));
  if (!label) return input;
  return h('label', { class: 'field' }, h('span', null, label), input);
}

function selectEl(options, value, onChange) {
  const el = h('select', null, options.map(([id, label]) => h('option', { value: id, selected: id === value }, label)));
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

function seg(options, value, onChange) {
  const wrap = h('div', { class: 'seg' });
  options.forEach(([id, label]) => {
    wrap.appendChild(h('button', { type: 'button', class: id === value ? 'on' : '', onClick: () => onChange(id) }, label));
  });
  return wrap;
}

function toggle(checked, onChange, title) {
  const input = h('input', { type: 'checkbox', checked: Boolean(checked) });
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'switch', title: title || null }, input, h('i'));
}

function range(value, min, max, step, onChange) {
  const input = h('input', { type: 'range', min, max, step });
  input.value = value;
  const paint = () => input.style.setProperty('--p', `${((input.value - min) / (max - min)) * 100}%`);
  paint();
  input.addEventListener('input', () => { paint(); onChange(Number(input.value), false); });
  input.addEventListener('change', () => onChange(Number(input.value), true));
  return input;
}

function terminal(id, lines) {
  const el = h('div', { class: 'terminal', id });
  lines.forEach((line) => el.appendChild(logLine(line)));
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  return el;
}
function logLine(line) {
  const cls = /error|fail|refus|not |cannot|did not/i.test(line) ? 'err' : /saved|done|ready|posted|finished|listening/i.test(line) ? 'good' : '';
  return h('div', { class: `ln ${cls}` }, line);
}

// ---------- Utilities ----------
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ago(at) {
  if (!at) return '';
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
function hhmm(at) { return at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''; }
function nameColor(name) {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 85% 68%)`;
}
function duration(ms) {
  const s = Math.floor(ms / 1000);
  const hrs = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return hrs ? `${hrs}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

// ---------- Toasts ----------
const toastsEl = document.getElementById('toasts');
function toast(title, detail = '', kind = 'info', color) {
  const iconName = kind === 'ok' ? 'check' : kind === 'bad' ? 'x' : kind === 'alert' ? 'bell' : 'info';
  const el = h('div', { class: `toast ${kind}`, vars: color ? { '--c': color } : null },
    h('div', { class: 'ti' }, icon(iconName)),
    h('div', null, h('b', null, title), detail && h('span', null, detail)));
  toastsEl.appendChild(el);
  while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, kind === 'bad' ? 6000 : 3600);
}
function report(result, okTitle, okDetail) {
  if (result && result.ok) toast(okTitle, okDetail || '', 'ok');
  else toast('Something went wrong', (result && result.error) || 'No details.', 'bad');
  return result;
}

// ---------- State ----------
const ALERT_META = {
  follow: { icon: 'follow', label: 'Follow' },
  sub: { icon: 'sub', label: 'Sub' },
  raid: { icon: 'raid', label: 'Raid' },
  host: { icon: 'host', label: 'Host' },
  kick: { icon: 'kick', label: 'Kicks' },
  tip: { icon: 'tip', label: 'Tip' },
};
const SAMPLE = { name: 'MaddogMetzy', viewers: 48, amount: '$10' };

const PAGES = [
  { group: 'Broadcast', name: 'Dashboard', icon: 'dashboard', eyebrow: 'Control room', render: renderDashboard },
  { group: 'Broadcast', name: 'Alerts', icon: 'bell', eyebrow: 'On-screen alerts', render: renderAlerts },
  { group: 'Broadcast', name: 'Chat', icon: 'chat', eyebrow: 'Chat dock', render: renderChat },
  { group: 'Broadcast', name: 'Goals', icon: 'target', eyebrow: 'Stream goal', render: renderGoals },
  { group: 'Broadcast', name: 'Scenes', icon: 'scene', eyebrow: 'Starting · BRB · Ending', render: renderScenes },
  { group: 'Bot', name: 'Commands', icon: 'terminal', eyebrow: 'Chat commands', render: renderCommands },
  { group: 'Bot', name: 'Voice', icon: 'mic', eyebrow: 'Text to speech', render: renderVoice },
  { group: 'Bot', name: 'Lights', icon: 'bulb', eyebrow: 'Hue and Govee', render: renderLights },
  { group: 'Content', name: 'Live', icon: 'radio', eyebrow: 'Clip the live stream', render: renderLive },
  { group: 'Content', name: 'Shorts', icon: 'scissors', eyebrow: 'VOD to vertical shorts', render: renderShorts },
  { group: 'Setup', name: 'Overlays', icon: 'layers', eyebrow: 'OBS browser sources', render: renderOverlays },
];

let state = null;
let status = { overlays: 0, live: { listening: false }, queue: 0, uptime: 0, eventsToday: 0 };
let page = 'Dashboard';
let shortsLog = ['The first time, click Set up cutter. Then pick a VOD or paste a Kick link.'];
let liveLog = ['Go live, click Listen, then Clip now. The clip goes to YouTube, X, and Instagram.'];
let lightNote = '';
let syncers = [];
let statusSyncers = [];
let cleanups = [];

const S = () => state.settings;
async function persist() {
  state.settings = { ...state.settings, ...(await window.madbot.save(state.settings)) };
}

// ---------- Shell ----------
const navEl = document.getElementById('nav');
const viewEl = document.getElementById('view');

function renderNav() {
  navEl.innerHTML = '';
  let group = '';
  PAGES.forEach((p, index) => {
    if (p.group !== group) {
      group = p.group;
      navEl.appendChild(h('div', { class: 'nav-group' }, group));
    }
    const key = index < 9 ? `^${index + 1}` : index === 9 ? '^0' : '';
    const item = h('button', { class: `nav-item${p.name === page ? ' on' : ''}`, onClick: () => go(p.name) },
      icon(p.icon), p.name,
      p.name === 'Live' && status.live.listening ? h('span', { class: 'badge' }, 'REC') : h('span', { class: 'key' }, key));
    navEl.appendChild(item);
  });
}

function renderRail() {
  const foot = document.getElementById('rail-status');
  foot.innerHTML = '';
  foot.append(
    h('div', { class: 'stat-line' }, h('span', { class: 'dot ok' }), 'Overlay server', h('b', null, `:${state.port}`)),
    h('div', { class: 'stat-line' }, h('span', { class: `dot ${status.overlays ? 'ok' : 'warn'}` }), 'OBS sources', h('b', null, status.overlays)),
    h('div', { class: 'stat-line' }, h('span', { class: `dot ${status.live.listening ? 'live' : ''}` }), 'Live capture', h('b', null, status.live.listening ? 'ON' : 'OFF')),
    h('div', { class: 'stat-line' }, h('span', { class: 'dot' }), 'Uptime', h('b', null, duration(status.uptime))),
  );
}

function go(name) {
  if (!PAGES.find((p) => p.name === name)) return;
  page = name;
  render();
}

function render() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
  syncers = [];
  statusSyncers = [];
  renderNav();
  const p = PAGES.find((item) => item.name === page);
  document.getElementById('eyebrow').textContent = p.eyebrow;
  document.getElementById('title').textContent = p.name;
  viewEl.innerHTML = '';
  viewEl.style.animation = 'none';
  void viewEl.offsetWidth;
  viewEl.style.animation = '';
  viewEl.appendChild(p.render());
}

function onSync(fn) { syncers.push(fn); fn(); }
function onStatus(fn) { statusSyncers.push(fn); fn(); }

// Scaled live preview of an overlay page.
function stage(url, label, ratio, size = [1920, 1080]) {
  const [w, hh] = size;
  const frame = h('iframe', { src: `${url}?preview=1`, tabindex: -1, style: { width: `${w}px`, height: `${hh}px` } });
  const wrap = h('div', { class: 'stage', style: ratio ? { aspectRatio: ratio } : null }, frame, label && h('div', { class: 'stage-label' }, label));
  const fit = () => {
    const scale = Math.min(wrap.clientWidth / w, wrap.clientHeight / hh);
    const x = (wrap.clientWidth - w * scale) / 2;
    const y = (wrap.clientHeight - hh * scale) / 2;
    frame.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(wrap);
  cleanups.push(() => observer.disconnect());
  return wrap;
}

// ---------- Dashboard ----------
function goalPct() {
  const goal = S().goal;
  return Math.max(0, Math.min(100, Math.round((goal.current / (goal.target || 1)) * 100)));
}

function ring(size = 168) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const wrap = h('div', { class: 'ring', style: { width: `${size}px`, height: `${size}px` } });
  wrap.innerHTML = `<svg viewBox="0 0 168 168"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0a526"/><stop offset="1" stop-color="#2f9bff"/></linearGradient></defs>
    <circle class="track" cx="84" cy="84" r="${r}" fill="none" stroke-width="14"/>
    <circle class="bar" cx="84" cy="84" r="${r}" fill="none" stroke-width="14" stroke-dasharray="${c}" stroke-dashoffset="${c}"/></svg>
    <div class="center"><div class="pct">0%</div><div class="of"></div></div>`;
  const bar = wrap.querySelector('.bar');
  const update = () => {
    const goal = S().goal;
    const pct = goalPct();
    requestAnimationFrame(() => { bar.style.strokeDashoffset = c * (1 - pct / 100); });
    wrap.querySelector('.pct').textContent = `${pct}%`;
    wrap.querySelector('.of').textContent = `${goal.current} / ${goal.target}`;
  };
  wrap.__update = update;
  setTimeout(update, 30);
  return wrap;
}

function sparkline(events) {
  const now = Date.now();
  const buckets = Array.from({ length: 12 }, () => 0);
  events.forEach((item) => {
    const hoursAgo = Math.floor((now - (item.at || 0)) / 3600000);
    if (hoursAgo >= 0 && hoursAgo < 12) buckets[11 - hoursAgo] += 1;
  });
  const max = Math.max(1, ...buckets);
  const bars = buckets.map((v, i) => `<rect x="${i * 7.5}" y="${34 - (v / max) * 30 - 2}" width="5" height="${(v / max) * 30 + 2}" rx="1.5" fill="${i === 11 ? '#2f9bff' : 'rgba(224,165,38,.55)'}"/>`).join('');
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('class', 'spark');
  el.setAttribute('viewBox', '0 0 90 34');
  el.innerHTML = bars;
  return el;
}

function feedItem(item, index, opts = {}) {
  const meta = ALERT_META[item.kind] || { icon: 'activity' };
  return h('div', { class: 'feed-item', vars: { '--c': item.color || '#2f9bff' } },
    h('div', { class: 'feed-ico' }, icon(meta.icon)),
    h('div', null, h('div', { class: 't' }, item.text), h('div', { class: 'when' }, `${ago(item.at)} · ${hhmm(item.at)}`)),
    h('div', { class: 'acts' }, opts.replay !== false && item.kind && btn('', {
      class: 'ghost icon', icon: 'replay', title: 'Replay this alert',
      onClick: async () => report(await window.madbot.replayEvent(index), 'Replaying', item.text),
    })));
}

function feedList(limit) {
  const list = h('div', { class: 'feed' });
  onSync(() => {
    list.innerHTML = '';
    const events = (S().events || []).slice(0, limit);
    if (!events.length) list.appendChild(h('div', { class: 'empty' }, icon('activity'), 'No events yet. Fire a test alert to see it here.'));
    events.forEach((item, i) => list.appendChild(feedItem(item, i)));
  });
  return list;
}

function fireGrid() {
  return h('div', { class: 'fire-grid' }, Object.entries(S().alerts).map(([kind, alert]) => {
    const meta = ALERT_META[kind] || { label: kind };
    return h('button', {
      type: 'button', class: 'fire', vars: { '--c': alert.color || '#2f9bff' },
      onClick: async () => { const r = await window.madbot.testAlert(kind, SAMPLE); if (!r.ok) report(r); },
    }, h('b', null, meta.label), h('small', null, alert.enabled === false ? 'Off' : 'Fire a test'));
  }));
}

function kpi(label, iconName, valueFn, subFn, extra) {
  const value = h('div', { class: 'value' });
  const sub = h('div', { class: 'sub' });
  const el = h('section', { class: 'card kpi' }, h('div', { class: 'label' }, icon(iconName), label), value, sub, extra);
  const update = () => { value.textContent = valueFn(); sub.textContent = subFn(); };
  return { el, update };
}

function renderDashboard() {
  const settings = S();
  const onair = h('div', { class: 'onair' }, h('span', { class: 'dot' }), 'ON AIR');
  const chips = h('div', { class: 'row' });
  onStatus(() => {
    onair.classList.toggle('on', status.live.listening);
    onair.querySelector('.dot').className = `dot ${status.live.listening ? 'live' : ''}`;
    chips.innerHTML = '';
    chips.append(
      h('span', { class: 'chip ok' }, icon('check'), `Overlays on :${state.port}`),
      h('span', { class: `chip ${status.overlays ? 'ok' : ''}` }, icon('layers'), `${status.overlays} OBS source${status.overlays === 1 ? '' : 's'}`),
      h('span', { class: `chip ${status.live.listening ? 'bad' : ''}` }, icon('radio'), status.live.listening ? `Capturing kick.com/${status.live.channel}` : 'Live capture off'),
    );
  });
  const hero = h('div', { class: 'hero' },
    h('img', { class: 'hero-logo', src: '../assets/logo.png', alt: '' }),
    h('div', null,
      h('h3', null, 'Welcome back to the ', h('em', null, 'kennel')),
      h('p', { style: { margin: 0 } }, `kick.com/${settings.kickChannel} · Everything runs on this PC.`),
      chips),
    onair);

  const k1 = kpi('Events today', 'activity', () => status.eventsToday, () => 'Bars show the last 12 hours', null);
  const sparkHolder = h('div');
  k1.el.appendChild(sparkHolder);
  const k2 = kpi('Goal', 'target', () => `${goalPct()}%`, () => `${S().goal.current} / ${S().goal.target} · ${S().goal.label}`);
  const k3 = kpi('OBS sources', 'layers', () => status.overlays, () => (status.overlays ? 'Overlays are connected' : 'Add a browser source in OBS'));
  const k4 = kpi('Chat lines', 'chat', () => (S().chat || []).length, () => `${S().commands.filter((c) => c.enabled !== false).length} commands active`);
  onStatus(() => [k1, k2, k3, k4].forEach((k) => k.update()));
  onSync(() => {
    [k1, k2, k4].forEach((k) => k.update());
    sparkHolder.innerHTML = '';
    sparkHolder.appendChild(sparkline(S().events || []));
  });

  const goalRing = ring(150);
  onSync(() => goalRing.__update());

  const speakLine = field(null, 'Welcome to the kennel.', null, { placeholder: 'Say something on stream' });
  const quick = card('Quick actions', 'zap',
    h('div', { class: 'grid g2' },
      btn('Clip now', { class: 'primary', icon: 'scissors', async: true, onClick: clipNow }),
      btn('Flash lights', { icon: 'bulb', async: true, onClick: async () => report(await window.madbot.testLights(), 'Lights flashed') }),
      btn('Be right back', { icon: 'scene', async: true, onClick: async () => { await setScene('brb'); toast('BRB scene is up', 'Hide it from Scenes or Ctrl+K.', 'ok'); } }),
      btn('Shorts folder', { icon: 'folder', onClick: () => window.madbot.shortsOpen() })),
    h('div', { class: 'composer', style: { marginTop: '12px' } }, speakLine,
      btn('Speak', { class: 'gold', icon: 'volume', async: true, onClick: async () => { const r = await window.madbot.testVoice(speakLine.value); if (!r.ok) report(r); } })));

  return h('div', null,
    hero,
    h('div', { class: 'grid g4' }, k1.el, k2.el, k3.el, k4.el),
    h('div', { class: 'grid split', style: { marginTop: '16px' } },
      h('div', null,
        card('Fire an alert', 'bell', fireGrid()),
        card('Activity', 'activity', actions(btn('Clear', { class: 'ghost', icon: 'trash', onClick: clearEvents })), feedList(12))),
      h('div', null,
        card('Goal', 'target', actions(btn('Edit', { class: 'ghost', onClick: () => go('Goals') })),
          h('div', { class: 'row', style: { gap: '20px' } }, goalRing,
            h('div', { class: 'grow stack' },
              h('div', { style: { fontWeight: 700, fontSize: '16px' } }, settings.goal.label),
              h('div', { class: 'row' }, [1, 5, 10].map((n) => btn(`+${n}`, { onClick: () => bumpGoal(n) })))))),
        quick)));
}

async function clearEvents() {
  state.settings = { ...state.settings, ...(await window.madbot.clearEvents()) };
  syncers.forEach((fn) => fn());
  toast('Activity cleared', '', 'ok');
}

async function bumpGoal(n) {
  const goal = S().goal;
  const before = goal.current;
  goal.current = Math.max(0, Number(goal.current || 0) + n);
  await persist();
  syncers.forEach((fn) => fn());
  if (before < goal.target && goal.current >= goal.target) toast('Goal reached!', `${goal.label}: ${goal.current} / ${goal.target}`, 'ok');
}

async function clipNow() {
  toast('Clipping…', `Cutting the last ${S().live.seconds || 45} seconds.`);
  const result = await window.madbot.liveClip({ live: S().live, socials: S().socials, grokbot: S().grokbot });
  report(result, 'Clip is ready', result && result.file ? result.file.split(/[\\/]/).pop() : '');
}

// ---------- Alerts ----------
function renderAlerts() {
  const settings = S();
  const preview = stage(state.urls.alert, 'Live preview · alert.html');
  const list = h('div', { class: 'grid g2' });
  Object.entries(settings.alerts).forEach(([kind, alert]) => {
    const meta = ALERT_META[kind] || { icon: 'bell', label: kind };
    const cardEl = h('section', { class: `card alert-card${alert.enabled === false ? ' off' : ''}`, vars: { '--c': alert.color } });
    const durLabel = h('span', { class: 'mono muted' }, `${(alert.duration / 1000).toFixed(1)}s`);
    cardEl.append(
      h('div', { class: 'bar' }),
      h('div', { class: 'body' },
        h('div', { class: 'row between' },
          h('div', { class: 'kind' }, meta.label),
          h('div', { class: 'row' },
            toggle(alert.enabled !== false, async (on) => { alert.enabled = on; cardEl.classList.toggle('off', !on); await persist(); }, 'Enabled'))),
        field('Title', alert.title, async (v) => { alert.title = v; await persist(); }),
        field('Detail', alert.detail, async (v) => { alert.detail = v; await persist(); }),
        h('div', { class: 'row' },
          h('label', { class: 'field', style: { width: '64px' } }, h('span', null, 'Color'),
            field(null, alert.color, async (v) => { alert.color = v; cardEl.style.setProperty('--c', v); await persist(); }, { type: 'color', live: false })),
          h('label', { class: 'field grow' }, h('span', null, h('span', null, 'Duration '), durLabel),
            range(alert.duration || 6000, 2000, 15000, 500, async (v, done) => { alert.duration = v; durLabel.textContent = `${(v / 1000).toFixed(1)}s`; if (done) await persist(); })),
          btn('Test', { class: 'primary', icon: 'play', onClick: async () => { const r = await window.madbot.testAlert(kind, SAMPLE); if (!r.ok) report(r); } }))));
    list.appendChild(cardEl);
  });

  return h('div', null,
    h('div', { class: 'grid split' },
      card('Preview', 'eye', preview,
        h('p', { class: 'small', style: { marginTop: '12px' } }, 'This is the real overlay. Test buttons play here and in OBS at the same time.')),
      card('Recent', 'activity', actions(btn('Clear', { class: 'ghost', icon: 'trash', onClick: clearEvents })), feedList(8))),
    h('div', { class: 'row', style: { margin: '20px 0 12px' } },
      h('span', { class: 'muted small' }, 'Variables:'),
      ['{name}', '{viewers}', '{amount}'].map((v) => h('span', { class: 'chip click', onClick: () => { window.madbot.copy(v); toast(`Copied ${v}`); } }, v))),
    list);
}

// ---------- Chat ----------
function renderChat() {
  const log = h('div', { class: 'chatlog' });
  onSync(() => {
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.innerHTML = '';
    const lines = (S().chat || []).slice(-60);
    if (!lines.length) log.appendChild(h('div', { class: 'empty' }, icon('chat'), 'Chat is quiet. Try !discord or !goal.'));
    lines.forEach((line) => {
      const bot = line.name === 'MadBot';
      log.appendChild(h('div', { class: `msg${bot ? ' bot' : ''}`, vars: { '--c': bot ? '#2f9bff' : nameColor(line.name) } },
        h('span', { class: 'time' }, hhmm(line.at)),
        h('div', null, h('span', { class: 'who' }, line.name), ' ', h('span', null, line.text))));
    });
    if (atBottom || !log.dataset.seen) { log.scrollTop = log.scrollHeight; log.dataset.seen = '1'; }
  });
  const input = h('input', { placeholder: 'Type a message or a command like !so maddogmetzy' });
  const send = async () => {
    if (!input.value.trim()) return;
    S().chat = await window.madbot.pushChat(input.value);
    input.value = '';
    syncers.forEach((fn) => fn());
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  setTimeout(() => input.focus(), 50);
  const cmds = h('div', { class: 'vars' }, S().commands.filter((c) => c.enabled !== false).map((c) =>
    h('span', { class: 'chip click', onClick: () => { input.value = `${c.name} `; input.focus(); } }, c.name)));

  return h('div', { class: 'grid split' },
    card('Chat dock', 'chat', actions(btn('Clear', { class: 'ghost', icon: 'trash', onClick: async () => { state.settings = { ...state.settings, ...(await window.madbot.clearChat()) }; syncers.forEach((fn) => fn()); } })),
      log,
      h('div', { class: 'composer' }, input, btn('Send', { class: 'primary', icon: 'send', onClick: send })),
      h('div', { class: 'row', style: { marginTop: '12px' } }, h('span', { class: 'muted small' }, 'Commands:'), cmds)),
    card('Overlay preview', 'eye', stage(state.urls.chat, 'chat.html', '4 / 3', [600, 800]),
      h('p', { class: 'small', style: { marginTop: '12px' } }, 'Font size and fade-out live under Overlays → Look.')));
}

// ---------- Goals ----------
function renderGoals() {
  const goal = S().goal;
  const bigRing = ring(220);
  onSync(() => bigRing.__update());
  const save = async () => { await persist(); syncers.forEach((fn) => fn()); };
  return h('div', { class: 'grid split' },
    h('div', null,
      card('Progress', 'target',
        h('div', { class: 'row', style: { gap: '28px', alignItems: 'center' } },
          bigRing,
          h('div', { class: 'grow stack' },
            h('div', { class: 'row' }, [-1, 1, 5, 10, 25].map((n) => btn(n > 0 ? `+${n}` : `${n}`, { class: n > 0 ? '' : 'ghost', onClick: () => bumpGoal(n) }))),
            h('div', { class: 'row' },
              btn('Reset to 0', { class: 'danger', icon: 'replay', onClick: async () => { goal.current = 0; await save(); render(); } }),
              btn('Mark complete', { class: 'gold', icon: 'check', onClick: async () => { goal.current = goal.target; await save(); render(); toast('Goal reached!', goal.label, 'ok'); } }))))),
      card('Settings', 'wand',
        h('div', { class: 'stack' },
          field('Label', goal.label, async (v) => { goal.label = v; await save(); }),
          h('div', { class: 'grid g2' },
            field('Current', goal.current, async (v) => { goal.current = v; await save(); }, { type: 'number', min: 0 }),
            field('Target', goal.target, async (v) => { goal.target = Math.max(1, v); await save(); }, { type: 'number', min: 1 }))))),
    card('Overlay preview', 'eye', stage(state.urls.goal, 'goal.html', '16 / 5', [800, 200]),
      h('p', { class: 'small', style: { marginTop: '12px' } }, 'The bar fills as you bump the count and celebrates when you hit the target. Chat !goal reads it out.')));
}

// ---------- Scenes ----------
const SCENE_PRESETS = {
  starting: { label: 'Starting soon', title: 'Starting soon', subtitle: 'Grab a drink. The kennel opens shortly.' },
  brb: { label: 'Be right back', title: 'Be right back', subtitle: 'Stretch your legs. Back in a minute.' },
  ending: { label: 'Ending', title: 'Thanks for hanging out', subtitle: 'Follow so you catch the next one.' },
};
async function setScene(mode) {
  const preset = SCENE_PRESETS[mode];
  const next = preset ? { mode, title: preset.title, subtitle: preset.subtitle } : { mode: 'off' };
  state.settings = { ...state.settings, ...(await window.madbot.scene(next)) };
}

function renderScenes() {
  const scene = S().scene;
  const pick = h('div', { class: 'scene-pick' },
    [['off', 'Hidden', 'Scene overlay is clear'], ...Object.entries(SCENE_PRESETS).map(([id, p]) => [id, p.label, p.subtitle])].map(([id, label, sub]) =>
      h('button', { type: 'button', class: `scene-opt${scene.mode === id ? ' on' : ''}`, onClick: async () => { await setScene(id); render(); } },
        h('b', null, label), h('small', null, sub))));
  const apply = async (patch) => { state.settings = { ...state.settings, ...(await window.madbot.scene(patch)) }; };
  return h('div', null,
    card('Scene', 'scene', pick),
    h('div', { class: 'grid split', style: { marginTop: '16px' } },
      card('Preview', 'eye', stage(state.urls.scene, 'scene.html')),
      card('Words and timer', 'clock',
        h('div', { class: 'stack' },
          field('Title', scene.title, (v) => apply({ title: v })),
          field('Subtitle', scene.subtitle, (v) => apply({ subtitle: v }), { textarea: true, rows: 2 }),
          field('Countdown minutes (0 for none)', scene.minutes, (v) => apply({ minutes: Math.max(0, v) }), { type: 'number', min: 0 }),
          h('div', { class: 'row' },
            btn('Restart timer', { class: 'primary', icon: 'clock', onClick: async () => { if (scene.mode === 'off') return toast('Pick a scene first'); await apply({ mode: S().scene.mode }); toast('Timer restarted', '', 'ok'); } }),
            btn('Hide', { icon: 'x', onClick: async () => { await setScene('off'); render(); } })),
          h('p', { class: 'small' }, 'Add scene.html as a full-screen browser source in your Starting, BRB, and Ending scenes. It stays transparent while hidden.')))));
}

// ---------- Commands ----------
function renderCommands() {
  const settings = S();
  const list = h('div');
  const draw = () => {
    list.innerHTML = '';
    if (!settings.commands.length) list.appendChild(h('div', { class: 'empty' }, icon('terminal'), 'No commands yet.'));
    settings.commands.forEach((command, index) => {
      list.appendChild(h('div', { class: 'cmd' },
        toggle(command.enabled !== false, async (on) => { command.enabled = on; await persist(); }, 'Enabled'),
        (() => { const el = field(null, command.name, async (v) => { command.name = v.startsWith('!') ? v.trim() : `!${v.trim()}`; el.value = command.name; await persist(); }); el.classList.add('name'); return el; })(),
        field(null, command.reply, async (v) => { command.reply = v; await persist(); }, { placeholder: 'What MadBot says' }),
        btn('', { class: 'ghost icon danger', icon: 'trash', title: 'Delete', onClick: async () => { settings.commands.splice(index, 1); await persist(); draw(); } })));
    });
  };
  draw();
  const tester = h('input', { placeholder: 'Try one: !so maddogmetzy' });
  const out = h('div', { class: 'muted', style: { minHeight: '20px' } });
  const run = async () => {
    const chat = await window.madbot.pushChat(tester.value);
    S().chat = chat;
    const last = chat[chat.length - 1];
    out.textContent = last && last.name === 'MadBot' ? `MadBot: ${last.text}` : 'No command matched.';
    tester.value = '';
  };
  tester.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  return h('div', { class: 'grid split' },
    card('Commands', 'terminal', actions(btn('Add command', { class: 'primary', icon: 'plus', onClick: async () => { settings.commands.push({ name: '!new', reply: 'Edit me.', enabled: true }); await persist(); draw(); list.querySelector('.cmd:last-child input.name').select(); } })), list),
    h('div', null,
      card('Test a command', 'play', h('div', { class: 'composer' }, tester, btn('Run', { class: 'primary', onClick: run })), h('div', { style: { marginTop: '12px' } }, out)),
      card('Variables', 'info',
        h('div', { class: 'vars' }, ['{name}', '{discord}', '{current}', '{target}'].map((v) => h('span', { class: 'chip click', onClick: () => { window.madbot.copy(v); toast(`Copied ${v}`); } }, v))),
        h('p', { class: 'small', style: { marginTop: '12px' } }, '{name} is whatever follows the command. Click a chip to copy it.')),
      card('Links', 'external', h('div', { class: 'stack' },
        field('Discord invite', settings.discord, async (v) => { settings.discord = v.trim(); await persist(); }),
        field('Kick channel', settings.kickChannel, async (v) => { settings.kickChannel = v.trim(); await persist(); })))));
}

// ---------- Voice ----------
function renderVoice() {
  const voice = S().voice;
  const body = h('div', { class: 'stack' });
  if (voice.provider === 'system') {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    body.append(h('label', { class: 'field' }, h('span', null, 'Voice'),
      selectEl([['', voices.length ? 'Default voice' : 'Loading voices…'], ...voices.map((v) => [v.name, `${v.name} · ${v.lang}`])], voice.systemVoice, async (v) => { voice.systemVoice = v; await persist(); })));
    const rateLabel = h('span', { class: 'mono muted' }, `${Number(voice.rate || 1).toFixed(1)}×`);
    body.append(h('label', { class: 'field' }, h('span', null, 'Speed ', rateLabel),
      range(voice.rate || 1, 0.5, 2, 0.1, async (v, done) => { voice.rate = v; rateLabel.textContent = `${v.toFixed(1)}×`; if (done) await persist(); })));
  } else {
    body.append(
      field('ElevenLabs API key', voice.apiKey, async (v) => { voice.apiKey = v.trim(); await persist(); }, { type: 'password' }),
      field('Voice ID', voice.voiceId, async (v) => { voice.voiceId = v.trim(); await persist(); }));
  }
  const line = field(null, 'Welcome to the kennel.', null);
  line.addEventListener('keydown', (e) => { if (e.key === 'Enter') speakBtn.click(); });
  const speakBtn = btn('Speak', { class: 'primary', icon: 'volume', async: true, onClick: async () => { const r = await window.madbot.testVoice(line.value); if (!r.ok) report(r); } });
  const presets = ['Welcome to the kennel.', 'Thanks for the follow!', 'Raid incoming. Say hi!', 'Hydrate. That is an order.'];
  return h('div', { class: 'grid split' },
    card('Voice engine', 'mic', actions(h('span', { class: 'muted small' }, 'Read alerts aloud'), toggle(voice.enabled, async (on) => { voice.enabled = on; await persist(); })),
      h('div', { style: { marginBottom: '14px' } }, seg([['system', 'This PC'], ['elevenlabs', 'ElevenLabs']], voice.provider, async (v) => { voice.provider = v; await persist(); render(); })),
      body),
    card('Try it', 'volume',
      h('div', { class: 'composer' }, line, speakBtn),
      h('div', { class: 'vars', style: { marginTop: '12px' } }, presets.map((p) => h('span', { class: 'chip click', onClick: () => { line.value = p; speakBtn.click(); } }, p))),
      h('p', { class: 'small', style: { marginTop: '12px' } }, 'Alerts and command replies are spoken with this voice while the switch is on.')));
}

// ---------- Lights ----------
function renderLights() {
  const lights = S().lights;
  const bulb = h('div', { class: 'bulb', vars: { '--c': lights.color } }, h('div', { class: 'orb' }));
  const colorInput = field(null, lights.color, async (v) => { setColor(v); }, { type: 'color' });
  const swatchRow = h('div', { class: 'swatches' });
  const SW = ['#2f9bff', '#e0a526', '#53fc18', '#ff3b3b', '#b14dff', '#ff7ad9', '#00e5ff', '#ffffff'];
  const drawSwatches = () => {
    swatchRow.innerHTML = '';
    SW.forEach((c) => swatchRow.appendChild(h('button', { type: 'button', class: `swatch${c.toLowerCase() === String(lights.color).toLowerCase() ? ' on' : ''}`, style: { background: c }, vars: { '--c': c }, onClick: () => setColor(c) })));
  };
  async function setColor(c) {
    lights.color = c;
    colorInput.value = c;
    bulb.style.setProperty('--c', c);
    drawSwatches();
    await persist();
  }
  drawSwatches();
  const fields = h('div', { class: 'stack' });
  if (lights.provider === 'hue') {
    fields.append(
      field('Bridge IP', lights.hue.bridge, async (v) => { lights.hue.bridge = v.trim(); await persist(); }, { placeholder: '192.168.1.20, then click Find lights' }),
      field('Light IDs, comma separated', lights.hue.lightIds, async (v) => { lights.hue.lightIds = v; await persist(); }, { placeholder: '1, 2, 5' }));
  } else if (lights.provider === 'govee') {
    fields.append(
      field('Govee API key', lights.govee.apiKey, async (v) => { lights.govee.apiKey = v.trim(); await persist(); }, { type: 'password' }),
      h('div', { class: 'grid g2' },
        field('Device ID', lights.govee.device, async (v) => { lights.govee.device = v.trim(); await persist(); }),
        field('Model / SKU', lights.govee.sku, async (v) => { lights.govee.sku = v.trim(); await persist(); })));
  } else {
    fields.append(h('p', null, 'Preview only. No real lights change. Use it to try colors.'));
  }
  const note = h('p', { class: 'small', style: { marginTop: '12px' } }, lightNote);
  return h('div', { class: 'grid split' },
    card('Bridge', 'bulb', actions(h('span', { class: 'muted small' }, 'Flash on alerts'), toggle(lights.enabled !== false, async (on) => { lights.enabled = on; await persist(); })),
      h('div', { style: { marginBottom: '14px' } }, seg([['hue', 'Philips Hue'], ['govee', 'Govee'], ['preview', 'Preview only']], lights.provider, async (v) => { lights.provider = v; await persist(); render(); })),
      fields,
      h('div', { class: 'row', style: { marginTop: '14px' } },
        btn('Find lights', { icon: 'search', async: true, onClick: async () => {
          const result = await window.madbot.scanLights();
          if (result.settings) state.settings = result.settings;
          const names = (result.devices || []).map((d) => d.name).join(', ');
          lightNote = result.ok ? `Found ${names || 'no lights'}.` : result.error;
          render();
        } })),
      note),
    card('Alert color', 'zap',
      bulb,
      h('div', { class: 'row', style: { marginTop: '14px' } }, swatchRow, h('div', { style: { width: '56px' } }, colorInput)),
      h('div', { class: 'row', style: { marginTop: '14px' } },
        btn('Flash lights', { class: 'primary', icon: 'zap', async: true, onClick: async () => {
          bulb.classList.remove('flash'); void bulb.offsetWidth; bulb.classList.add('flash');
          report(await window.madbot.testLights(), 'Lights changed color');
        } }))));
}

// ---------- Live ----------
function renderLive() {
  const settings = S();
  settings.live = settings.live || { seconds: 45, caption: 'Live from the kennel.' };
  settings.socials = settings.socials || { x: {}, youtube: {}, instagram: {} };
  const clipBtn = h('button', { type: 'button', class: 'clip-btn' }, 'CLIP NOW', h('small', null, 'CTRL + SHIFT + C'));
  clipBtn.addEventListener('click', async () => { clipBtn.disabled = true; try { await clipNow(); } finally { clipBtn.disabled = !status.live.listening; } });
  const listenBtn = h('div');
  onStatus(() => {
    clipBtn.disabled = !status.live.listening;
    listenBtn.innerHTML = '';
    listenBtn.appendChild(status.live.listening
      ? btn('Stop listening', { class: 'danger', icon: 'stop', async: true, onClick: async () => { await window.madbot.liveStop(); await refreshStatus(); toast('Stopped listening'); } })
      : btn('Listen', { class: 'primary', icon: 'radio', async: true, onClick: async () => { const r = await window.madbot.liveStart(); report(r, 'Listening', 'Wait about 20 seconds, then clip.'); await refreshStatus(); } }));
  });
  const secLabel = h('span', { class: 'mono muted' }, `${settings.live.seconds || 45}s`);
  const accounts = h('div', { class: 'stack' });
  const SOCIAL = { youtube: ['YouTube', '#ff0033', 'YT'], x: ['X', '#111', 'X'], instagram: ['Instagram', 'linear-gradient(135deg,#feda75,#d62976,#4f5bd5)', 'IG'] };
  window.madbot.loginReady().then((ready) => {
    const connectors = { youtube: () => window.madbot.youtubeConnect(), x: () => window.madbot.xConnect(), instagram: () => window.madbot.instagramConnect() };
    Object.entries(SOCIAL).forEach(([key, [label, bg, mark]]) => {
      const on = ready[`${key}On`];
      accounts.appendChild(h('div', { class: 'social' },
        h('div', { class: 'logo', style: { background: bg, border: key === 'x' ? '1px solid #333' : null } }, mark),
        h('div', { class: 'grow' }, h('b', null, label), h('span', { class: 'small muted' }, !ready[key] ? 'Not available in this build' : on ? 'Connected. Clips post here.' : 'Not connected')),
        ready[key] && (on ? h('span', { class: 'chip ok' }, icon('check'), 'On') : btn('Log in', { class: 'primary', async: true, onClick: async () => {
          toast(`${label} is opening`, 'Log in, click Allow, then come back.');
          report(await connectors[key](), `${label} is ready`);
          render();
        } }))));
    });
  });
  return h('div', { class: 'grid split' },
    h('div', null,
      card('Capture', 'radio', actions(listenBtn),
        clipBtn,
        h('div', { class: 'grid g2', style: { marginTop: '16px' } },
          field('Kick channel', settings.kickChannel, async (v) => { settings.kickChannel = v.trim(); await persist(); }),
          h('label', { class: 'field' }, h('span', null, 'Clip length ', secLabel),
            h('div', { style: { paddingTop: '16px' } }, range(settings.live.seconds || 45, 15, 150, 5, async (v, done) => { settings.live.seconds = v; secLabel.textContent = `${v}s`; if (done) await persist(); })))),
        h('div', { style: { marginTop: '12px' } }, field('Caption', settings.live.caption, async (v) => { settings.live.caption = v; await persist(); }, { placeholder: 'Words that go with the clip' }))),
      card('Log', 'terminal', terminal('live-log', liveLog))),
    card('Post to', 'send', accounts,
      h('p', { class: 'small', style: { marginTop: '12px' } }, 'Clips are cut vertical (1080×1920) and saved to Videos/MadBot Shorts before posting.')));
}

// ---------- Shorts ----------
function renderShorts() {
  const statusChip = h('span', { class: 'chip' }, 'Checking…');
  const file = h('input', { placeholder: 'Pick a video file, or paste a link below' });
  const link = h('input', { placeholder: 'https://kick.com/maddogmetzy/videos/…' });
  const topic = h('input', { placeholder: 'Labs raid, last lap…' });
  const game = selectEl([['tarkov', 'Escape from Tarkov'], ['iracing', 'iRacing'], ['fps', 'Competitive FPS'], ['battle_royale', 'Battle Royale'], ['mmo_rpg', 'MMO / RPG'], ['sports', 'Sports'], ['generic', 'Generic']], 'tarkov', () => {});
  let job = 'shorts';
  let quality = 'medium';
  const jobSeg = h('div');
  const drawJob = () => {
    jobSeg.innerHTML = '';
    jobSeg.appendChild(seg([['shorts', 'Best moments'], ['clip', 'Last N seconds'], ['long', 'Highlight reel'], ['analyze', 'Find only']], job, (v) => { job = v; drawJob(); }));
  };
  drawJob();
  const qualSeg = h('div');
  const drawQual = () => { qualSeg.innerHTML = ''; qualSeg.appendChild(seg([['draft', 'Draft'], ['medium', 'Medium'], ['high', 'High']], quality, (v) => { quality = v; drawQual(); })); };
  drawQual();
  const count = h('input', { type: 'number', min: 1 }); count.value = '6';
  const seconds = h('input', { type: 'number', min: 5 }); seconds.value = '60';
  S().grokbot = S().grokbot || { url: '', key: '' };
  window.madbot.shortsStatus().then((info) => {
    statusChip.className = `chip ${info.ready ? 'ok' : 'bad'}`;
    statusChip.textContent = info.ready ? 'Cutter ready' : 'Cutter not set up';
  });
  const lab = (text, el) => h('label', { class: 'field' }, h('span', null, text), el);
  return h('div', { class: 'grid split' },
    h('div', null,
      card('Source', 'download', actions(statusChip),
        h('div', { class: 'stack' },
          h('div', { class: 'row' }, h('div', { class: 'grow' }, file), btn('Browse', { icon: 'folder', onClick: async () => { file.value = await window.madbot.shortsPick(); } })),
          link,
          h('div', { class: 'grid g2' }, lab('Game', game), lab('Topic', topic)))),
      card('Job', 'scissors',
        h('div', { class: 'stack' },
          jobSeg,
          h('div', { class: 'grid g3' }, lab('Clips', count), lab('Seconds', seconds), lab('Quality', qualSeg)),
          h('div', { class: 'row' },
            btn('Make shorts', { class: 'primary', icon: 'wand', async: true, onClick: async () => {
              const input = file.value.trim() || link.value.trim();
              if (!input) return toast('Pick a video or paste a link first', '', 'bad');
              toast('Working', 'A long VOD can take a while.');
              const result = await window.madbot.shortsRun({
                input, command: job, game: game.value, topic: topic.value,
                count: Number(count.value), seconds: Number(seconds.value), quality,
                grokbot: S().grokbot, socials: S().socials,
              });
              report(result, 'Shorts are done', 'They are in your Videos folder.');
            } }),
            btn('Open folder', { icon: 'folder', onClick: () => window.madbot.shortsOpen() }),
            h('div', { class: 'grow' }),
            btn('Set up cutter', { class: 'ghost', icon: 'download', async: true, onClick: async () => {
              toast('Setting up the cutter', 'Leave this window open.');
              report(await window.madbot.shortsSetup(), 'Cutter is ready');
              render();
            } }))))),
    card('Log', 'terminal', terminal('shorts-log', shortsLog)));
}

// ---------- Overlays ----------
function renderOverlays() {
  const theme = S().theme;
  const saveTheme = async () => { await persist(); };
  const sizeLabel = h('span', { class: 'mono muted' }, `${theme.chatSize}px`);
  const fadeLabel = h('span', { class: 'mono muted' }, theme.chatFade ? `${theme.chatFade}s` : 'never');
  const META = {
    alert: ['Alert box', [1920, 1080], 'Full-screen. Plays follows, subs, raids, tips.'],
    chat: ['Chat', [600, 800], 'Chat with name colors and bot replies.'],
    goal: ['Goal bar', [800, 200], 'Animated progress bar with a finish burst.'],
    events: ['Recent events', [500, 600], 'Stack of the latest alerts.'],
    ticker: ['Ticker', [1920, 80], 'Scrolling bottom bar of recent supporters.'],
    scene: ['Scene', [1920, 1080], 'Starting soon, BRB, and Ending screens.'],
  };
  const grid = h('div', { class: 'grid g2' }, Object.entries(state.urls).map(([key, url]) => {
    const [title, size, desc] = META[key] || [key, [1920, 1080], ''];
    return h('section', { class: 'card ov-card' },
      h('div', { class: 'card-head' }, h('h2', null, icon('layers'), title), h('span', { class: 'chip' }, `${size[0]} × ${size[1]}`)),
      stage(url, null, null, size),
      h('p', { class: 'small' }, desc),
      h('div', { class: 'row' },
        h('div', { class: 'url grow', title: url }, url),
        btn('', { class: 'icon', icon: 'copy', title: 'Copy URL', onClick: () => { window.madbot.copy(url); toast('URL copied', 'Paste it into an OBS Browser source.', 'ok'); } }),
        btn('', { class: 'icon', icon: 'external', title: 'Open in browser', onClick: () => window.madbot.openOverlay(url) })));
  }));
  return h('div', null,
    card('Look', 'wand',
      h('div', { class: 'grid g4' },
        h('label', { class: 'field' }, h('span', null, 'Accent'), field(null, theme.accent, async (v) => { theme.accent = v; await saveTheme(); }, { type: 'color' })),
        h('label', { class: 'field' }, h('span', null, 'Second accent'), field(null, theme.accent2, async (v) => { theme.accent2 = v; await saveTheme(); }, { type: 'color' })),
        h('label', { class: 'field' }, h('span', null, 'Chat text ', sizeLabel), h('div', { style: { paddingTop: '16px' } }, range(theme.chatSize, 14, 40, 1, async (v, done) => { theme.chatSize = v; sizeLabel.textContent = `${v}px`; if (done) await saveTheme(); }))),
        h('label', { class: 'field' }, h('span', null, 'Chat fades after ', fadeLabel), h('div', { style: { paddingTop: '16px' } }, range(theme.chatFade || 0, 0, 120, 5, async (v, done) => { theme.chatFade = v; fadeLabel.textContent = v ? `${v}s` : 'never'; if (done) await saveTheme(); })))),
      h('div', { class: 'row', style: { marginTop: '14px' } }, h('span', { class: 'muted small' }, 'Alert sound in OBS'), toggle(theme.alertSound !== false, async (on) => { theme.alertSound = on; await saveTheme(); })),
      h('p', { class: 'small', style: { marginTop: '12px' } }, 'Changes reach OBS right away. Close this app and the overlays go dark.')),
    h('div', { style: { marginTop: '16px' } }, grid));
}

// ---------- Command palette ----------
const paletteEl = document.getElementById('palette');
const paletteInput = document.getElementById('palette-input');
const paletteList = document.getElementById('palette-list');
let paletteIndex = 0;

function paletteActions() {
  const list = PAGES.map((p) => ({ label: `Go to ${p.name}`, icon: p.icon, hint: p.eyebrow, run: () => go(p.name) }));
  Object.keys(S().alerts).forEach((kind) => list.push({ label: `Test ${ALERT_META[kind]?.label || kind} alert`, icon: ALERT_META[kind]?.icon || 'bell', hint: 'Alert', run: () => window.madbot.testAlert(kind, SAMPLE) }));
  list.push(
    { label: 'Clip now', icon: 'scissors', hint: 'Live', run: clipNow },
    { label: status.live.listening ? 'Stop listening' : 'Start listening', icon: 'radio', hint: 'Live', run: async () => { if (status.live.listening) await window.madbot.liveStop(); else report(await window.madbot.liveStart(), 'Listening'); refreshStatus(); } },
    { label: 'Flash lights', icon: 'bulb', hint: 'Lights', run: async () => report(await window.madbot.testLights(), 'Lights flashed') },
    ...Object.entries(SCENE_PRESETS).map(([id, p]) => ({ label: `Show ${p.label} scene`, icon: 'scene', hint: 'Scene', run: async () => { await setScene(id); if (page === 'Scenes') render(); toast(`${p.label} is up`, '', 'ok'); } })),
    { label: 'Hide scene', icon: 'x', hint: 'Scene', run: async () => { await setScene('off'); if (page === 'Scenes') render(); } },
    { label: 'Goal +1', icon: 'target', hint: 'Goal', run: () => bumpGoal(1) },
    { label: 'Clear activity', icon: 'trash', hint: 'Events', run: clearEvents },
    { label: 'Open shorts folder', icon: 'folder', hint: 'Shorts', run: () => window.madbot.shortsOpen() },
  );
  return list;
}

function drawPalette() {
  const q = paletteInput.value.trim().toLowerCase();
  const items = paletteActions().filter((a) => !q || q.split(/\s+/).every((w) => a.label.toLowerCase().includes(w) || a.hint.toLowerCase().includes(w)));
  paletteIndex = Math.max(0, Math.min(paletteIndex, items.length - 1));
  paletteList.innerHTML = '';
  items.forEach((item, i) => {
    const el = h('div', { class: `pal-item${i === paletteIndex ? ' on' : ''}`, onMousemove: () => { if (paletteIndex !== i) { paletteIndex = i; drawPalette(); } }, onClick: () => runPalette(item) },
      icon(item.icon), item.label, h('small', null, item.hint));
    paletteList.appendChild(el);
  });
  if (!items.length) paletteList.appendChild(h('div', { class: 'empty' }, 'Nothing matches.'));
  paletteList.__items = items;
  const on = paletteList.querySelector('.on');
  if (on) on.scrollIntoView({ block: 'nearest' });
}
function openPalette() { paletteEl.hidden = false; paletteInput.value = ''; paletteIndex = 0; drawPalette(); paletteInput.focus(); }
function closePalette() { paletteEl.hidden = true; }
function runPalette(item) { closePalette(); Promise.resolve(item.run()).catch((e) => toast('Action failed', e.message, 'bad')); }
paletteInput.addEventListener('input', () => { paletteIndex = 0; drawPalette(); });
paletteInput.addEventListener('keydown', (e) => {
  const items = paletteList.__items || [];
  if (e.key === 'ArrowDown') { paletteIndex = (paletteIndex + 1) % Math.max(1, items.length); drawPalette(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { paletteIndex = (paletteIndex - 1 + items.length) % Math.max(1, items.length); drawPalette(); e.preventDefault(); }
  if (e.key === 'Enter' && items[paletteIndex]) runPalette(items[paletteIndex]);
});
paletteEl.addEventListener('mousedown', (e) => { if (e.target === paletteEl) closePalette(); });
document.getElementById('palette-open').addEventListener('click', openPalette);

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); paletteEl.hidden ? openPalette() : closePalette(); return; }
  if (e.key === 'Escape' && !paletteEl.hidden) { closePalette(); return; }
  if (mod && /^[0-9]$/.test(e.key)) {
    const index = e.key === '0' ? 9 : Number(e.key) - 1;
    if (PAGES[index]) { e.preventDefault(); go(PAGES[index].name); }
  }
});

// ---------- Live wiring ----------
async function refreshStatus() {
  try { status = await window.madbot.status(); } catch { return; }
  renderRail();
  const navOn = navEl.querySelector('.badge');
  if (Boolean(navOn) !== status.live.listening) renderNav();
  statusSyncers.forEach((fn) => fn());
}

function tickClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

window.madbot.onState((snap) => {
  if (!state) return;
  state.settings.goal = snap.goal;
  state.settings.chat = snap.chat;
  // Keep any older events the snapshot does not carry.
  const older = (state.settings.events || []).slice(snap.events.length);
  state.settings.events = snap.events.length ? [...snap.events, ...older].slice(0, 40) : [];
  state.settings.scene = snap.scene;
  syncers.forEach((fn) => fn());
});

window.madbot.onAlert((alert) => {
  toast(alert.title, alert.detail, 'alert', alert.color);
  refreshStatus();
});

window.madbot.onSpeak((payload) => {
  if (payload.audio) {
    new Audio(payload.audio).play();
    return;
  }
  const utter = new SpeechSynthesisUtterance(payload.text);
  const match = speechSynthesis.getVoices().find((item) => item.name === payload.voice);
  if (match) utter.voice = match;
  utter.rate = Number(payload.rate) || 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
});

function appendLog(lines, id, line) {
  lines.push(line);
  if (lines.length > 400) lines.splice(0, lines.length - 400);
  const box = document.getElementById(id);
  if (box) {
    box.appendChild(logLine(line));
    box.scrollTop = box.scrollHeight;
  }
}
window.madbot.onLiveLog((line) => appendLog(liveLog, 'live-log', line));
window.madbot.onShortsLog((line) => appendLog(shortsLog, 'shorts-log', line));

window.madbot.boot().then(async (boot) => {
  state = boot;
  state.settings.theme = state.settings.theme || { accent: '#2f9bff', accent2: '#e0a526', chatSize: 22, chatFade: 0 };
  state.settings.scene = state.settings.scene || { mode: 'off', title: '', subtitle: '', minutes: 5 };
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { if (page === 'Voice') render(); };
  tickClock();
  setInterval(tickClock, 1000);
  render();
  renderRail();
  await refreshStatus();
  setInterval(refreshStatus, 2000);
});
