const pages = ['Alerts', 'Chat', 'Goals', 'Commands', 'Lights', 'Voice', 'Overlays'];
let lightNote = '';
let state = null;
let page = 'Alerts';

const nav = document.getElementById('nav');
const main = document.getElementById('main');

function field(label, value, onInput, type = 'text') {
  const wrap = document.createElement('label');
  wrap.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.value = value ?? '';
  input.addEventListener('change', () => onInput(input.value));
  wrap.appendChild(input);
  return wrap;
}

async function persist() {
  state.settings = await window.madbot.save(state.settings);
}

function renderNav() {
  nav.innerHTML = '';
  pages.forEach((name) => {
    const button = document.createElement('button');
    button.textContent = name;
    button.className = name === page ? 'on' : '';
    button.onclick = () => { page = name; render(); };
    nav.appendChild(button);
  });
}

function card(title) {
  const el = document.createElement('section');
  el.className = 'card';
  const h = document.createElement('h2');
  h.textContent = title;
  el.appendChild(h);
  return el;
}

function renderAlerts() {
  const grid = document.createElement('div');
  grid.className = 'grid';
  const list = card('Alert box');
  Object.entries(state.settings.alerts).forEach(([kind, alert]) => {
    const block = document.createElement('div');
    block.appendChild(field(`${kind} title`, alert.title, async (value) => { alert.title = value; await persist(); }));
    block.appendChild(field('Detail', alert.detail, async (value) => { alert.detail = value; await persist(); }));
    const test = document.createElement('button');
    test.className = 'primary';
    test.textContent = `Test ${kind}`;
    test.onclick = () => window.madbot.testAlert(kind, { name: 'MaddogMetzy', viewers: 48, amount: '$10' });
    block.appendChild(test);
    list.appendChild(block);
  });
  const side = card('Latest');
  (state.settings.events || []).slice(0, 8).forEach((event) => {
    const row = document.createElement('div');
    row.className = 'event';
    row.textContent = event.text;
    side.appendChild(row);
  });
  grid.append(list, side);
  return grid;
}

function renderChat() {
  const box = card('Chat dock');
  const log = document.createElement('div');
  (state.settings.chat || []).slice(-12).forEach((line) => {
    const row = document.createElement('div');
    row.className = 'event';
    row.textContent = `${line.name}: ${line.text}`;
    log.appendChild(row);
  });
  const input = document.createElement('input');
  input.placeholder = 'Type !discord, !goal, or !so name';
  const send = document.createElement('button');
  send.className = 'primary';
  send.textContent = 'Send';
  send.onclick = async () => {
    state.settings.chat = await window.madbot.pushChat(input.value);
    input.value = '';
    render();
  };
  box.append(log, input, send);
  return box;
}

function renderGoals() {
  const box = card('Goal');
  const goal = state.settings.goal;
  box.append(
    field('Label', goal.label, async (value) => { goal.label = value; await persist(); }),
    field('Current', goal.current, async (value) => { goal.current = Number(value); await persist(); }, 'number'),
    field('Target', goal.target, async (value) => { goal.target = Number(value); await persist(); }, 'number')
  );
  return box;
}

function renderCommands() {
  const box = card('Chat commands');
  state.settings.commands.forEach((command) => {
    box.append(
      field(command.name, command.reply, async (value) => { command.reply = value; await persist(); })
    );
  });
  box.append(field('Discord link', state.settings.discord, async (value) => { state.settings.discord = value; await persist(); }));
  box.append(field('Kick channel', state.settings.kickChannel, async (value) => { state.settings.kickChannel = value; await persist(); }));
  return box;
}

function renderOverlays() {
  const box = card('OBS browser sources');
  const copy = document.createElement('p');
  copy.textContent = 'In OBS, add a Browser source and paste one of these. Width 1920, height 1080. Shut down this app and the overlays go dark.';
  box.appendChild(copy);
  Object.entries(state.urls).forEach(([name, url]) => {
    const row = document.createElement('div');
    row.className = 'event';
    const label = document.createElement('div');
    label.innerHTML = `<strong>${name}</strong><div class="url">${url}</div>`;
    const open = document.createElement('button');
    open.textContent = 'Preview';
    open.onclick = () => window.madbot.openOverlay(url);
    row.append(label, open);
    box.appendChild(row);
  });
  return box;
}

function renderLights() {
  const lights = state.settings.lights;
  const box = card('Smart lights');
  const provider = document.createElement('select');
  ['hue', 'govee', 'preview'].forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name === 'hue' ? 'Philips Hue' : name === 'govee' ? 'Govee' : 'Preview only';
    if (lights.provider === name) option.selected = true;
    provider.appendChild(option);
  });
  provider.onchange = async () => { lights.provider = provider.value; await persist(); render(); };
  box.appendChild(provider);
  box.append(field('Alert color', lights.color, async (value) => { lights.color = value; await persist(); }, 'color'));
  if (lights.provider === 'hue') {
    box.append(
      field('Bridge IP', lights.hue.bridge, async (value) => { lights.hue.bridge = value.trim(); await persist(); }),
      field('Light IDs, comma separated', lights.hue.lightIds, async (value) => { lights.hue.lightIds = value; await persist(); })
    );
  }
  if (lights.provider === 'govee') {
    box.append(
      field('Govee API key', lights.govee.apiKey, async (value) => { lights.govee.apiKey = value.trim(); await persist(); }),
      field('Device ID', lights.govee.device, async (value) => { lights.govee.device = value.trim(); await persist(); }),
      field('Model / SKU', lights.govee.sku, async (value) => { lights.govee.sku = value.trim(); await persist(); })
    );
  }
  const status = document.createElement('p');
  status.textContent = lightNote;
  const actions = document.createElement('div');
  actions.className = 'row';
  const scan = document.createElement('button');
  scan.textContent = 'Find lights';
  scan.onclick = async () => {
    const result = await window.madbot.scanLights();
    if (result.settings) state.settings = result.settings;
    const names = (result.devices || []).map((device) => device.name).join(', ');
    lightNote = result.ok ? `Found ${names || 'no lights'}.` : result.error;
    render();
  };
  const test = document.createElement('button');
  test.className = 'primary';
  test.textContent = 'Flash lights';
  test.onclick = async () => {
    const result = await window.madbot.testLights();
    status.textContent = result.ok ? 'Lights changed color.' : result.error;
  };
  actions.append(scan, test);
  box.append(actions, status);
  return box;
}

function renderVoice() {
  const voice = state.settings.voice;
  const box = card('AI voice');
  const provider = document.createElement('select');
  [['system', 'This PC'], ['elevenlabs', 'ElevenLabs']].forEach(([id, label]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = label;
    if (voice.provider === id) option.selected = true;
    provider.appendChild(option);
  });
  provider.onchange = async () => { voice.provider = provider.value; await persist(); render(); };
  box.appendChild(provider);
  if (voice.provider === 'system') {
    const select = document.createElement('select');
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = voices.length ? 'Default voice' : 'Loading voices…';
    select.appendChild(blank);
    voices.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.name;
      if (voice.systemVoice === item.name) option.selected = true;
      select.appendChild(option);
    });
    select.onchange = async () => { voice.systemVoice = select.value; await persist(); };
    box.appendChild(select);
  } else {
    box.append(
      field('ElevenLabs API key', voice.apiKey, async (value) => { voice.apiKey = value.trim(); await persist(); }),
      field('Voice ID', voice.voiceId, async (value) => { voice.voiceId = value.trim(); await persist(); })
    );
  }
  const line = document.createElement('input');
  line.value = 'Welcome to the kennel.';
  const status = document.createElement('p');
  const test = document.createElement('button');
  test.className = 'primary';
  test.textContent = 'Speak';
  test.onclick = async () => {
    const result = await window.madbot.testVoice(line.value);
    status.textContent = result.ok ? 'Playing.' : (result.error || 'Voice is off.');
  };
  box.append(line, test, status);
  return box;
}

function render() {
  renderNav();
  main.innerHTML = '';
  const title = document.createElement('h1');
  title.textContent = page;
  const lede = document.createElement('p');
  lede.textContent = 'Desktop control room for alerts, chat, goals, and OBS overlays.';
  main.append(title, lede);
  const view = { Alerts: renderAlerts, Chat: renderChat, Goals: renderGoals, Commands: renderCommands, Lights: renderLights, Voice: renderVoice, Overlays: renderOverlays }[page]();
  main.appendChild(view);
}

window.madbot.onSpeak((payload) => {
  if (payload.audio) {
    const audio = new Audio(payload.audio);
    audio.play();
    return;
  }
  const utter = new SpeechSynthesisUtterance(payload.text);
  const match = speechSynthesis.getVoices().find((item) => item.name === payload.voice);
  if (match) utter.voice = match;
  utter.rate = Number(payload.rate) || 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
});

window.madbot.boot().then((boot) => {
  state = boot;
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { if (page === 'Voice') render(); };
  render();
});
