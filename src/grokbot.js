const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function signature(secret, id, timestamp, body) {
  const raw = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const key = Buffer.from(raw, 'base64');
  const digest = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return `v1,${digest}`;
}

function newClips(folder, since) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder)
    .filter((name) => /\.(mp4|mov|webm|json)$/i.test(name))
    .map((name) => {
      const full = path.join(folder, name);
      const stat = fs.statSync(full);
      return { name, path: full, bytes: stat.size, mtime: stat.mtimeMs };
    })
    .filter((file) => file.mtime >= since - 2000);
}

async function routeClips({ grokbot, output, since, topic, game, source, onLog }) {
  const url = String(grokbot?.url || '').trim();
  const key = String(grokbot?.key || '').trim();
  if (!url) {
    onLog('Grok Bot webhook is blank. Clips stayed on this PC.');
    return { ok: false, skipped: true };
  }
  const clips = newClips(output, since).map(({ mtime, ...file }) => file);
  if (!clips.length) {
    onLog('No new clip files to send.');
    return { ok: false, error: 'No new clips.' };
  }
  const payload = {
    event: 'clips.ready',
    source: 'MadBot',
    topic: topic || 'highlights',
    game: game || 'generic',
    vod: source || '',
    instruction: grokbot.instruction || 'These shorts were just cut for YouTube, X, TikTok, and Instagram. Do not post them to Discord.',
    links: grokbot.links || [],
    clips,
  };
  const body = JSON.stringify(payload);
  const headers = { 'content-type': 'application/json' };
  if (key.startsWith('whsec_')) {
    const id = `madbot_${Date.now()}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    headers['webhook-id'] = id;
    headers['webhook-timestamp'] = timestamp;
    headers['webhook-signature'] = signature(key, id, timestamp, body);
  } else if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  const response = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Grok Bot refused the clips (${response.status}). ${text.slice(0, 180)}`);
  }
  onLog(`Sent ${clips.length} clip${clips.length === 1 ? '' : 's'} to Grok Bot.`);
  return { ok: true, count: clips.length };
}

module.exports = { routeClips };
