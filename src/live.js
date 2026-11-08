const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { ffmpegExe, outputDir } = require('./shorts');
const { publishClip } = require('./socials');
const { routeClips } = require('./grokbot');

let recorder = null;
let liveDir = null;
let channelName = '';

function status() {
  return { listening: Boolean(recorder), channel: channelName };
}

async function playbackUrl(channel) {
  const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(channel)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Kick did not answer.');
  const data = await response.json();
  if (!data.livestream) throw new Error(`${channel} is not live right now.`);
  const url = data.playback_url || data.livestream.source;
  if (!url) throw new Error('Kick did not give a live video URL.');
  return url;
}

function start(channel, onLog) {
  return playbackUrl(channel).then((url) => {
    const ffmpeg = ffmpegExe();
    if (ffmpeg === 'ffmpeg') {
      throw new Error('Click Set up cutter on the Shorts page first. That installs ffmpeg.');
    }
    if (recorder) stop();
    liveDir = path.join(app.getPath('userData'), 'live');
    fs.rmSync(liveDir, { recursive: true, force: true });
    fs.mkdirSync(liveDir, { recursive: true });
    channelName = channel;
    const args = [
      '-hide_banner', '-loglevel', 'warning',
      '-user_agent', 'Mozilla/5.0',
      '-headers', 'Referer: https://kick.com/\r\n',
      '-i', url,
      '-c', 'copy',
      '-f', 'segment',
      '-segment_time', '6',
      '-segment_wrap', '30',
      '-reset_timestamps', '1',
      path.join(liveDir, 'part%02d.ts'),
    ];
    recorder = spawn(ffmpeg, args, { windowsHide: true });
    recorder.stderr.on('data', (buf) => {
      const line = String(buf).trim();
      if (line) onLog(line);
    });
    recorder.on('close', () => {
      recorder = null;
      onLog('Stopped listening to the live stream.');
    });
    onLog(`Listening to kick.com/${channel}. Wait about 20 seconds, then clip.`);
    return status();
  });
}

function stop() {
  if (recorder) recorder.kill();
  recorder = null;
  channelName = '';
  return status();
}

function newestParts(seconds) {
  const files = fs.readdirSync(liveDir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, full: path.join(liveDir, name), mtime: fs.statSync(path.join(liveDir, name)).mtimeMs, size: fs.statSync(path.join(liveDir, name)).size }))
    .filter((file) => file.size > 0)
    .sort((a, b) => a.mtime - b.mtime);
  const count = Math.max(2, Math.ceil(Number(seconds || 45) / 6));
  return files.slice(-count);
}

function runFfmpeg(args) {
  const ffmpeg = ffmpegExe();
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true });
    let error = '';
    child.stderr.on('data', (buf) => { error += buf; });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(error.split('\n').filter(Boolean).slice(-3).join(' ') || `ffmpeg stopped (${code})`))));
  });
}

async function clipNow({ seconds, caption, discordWebhook, x, grokbot, onLog }) {
  if (!recorder || !liveDir) throw new Error('Start listening before you clip.');
  const parts = newestParts(seconds);
  if (parts.length < 2) throw new Error('Not enough live video yet. Wait a few more seconds.');
  const list = path.join(liveDir, 'concat.txt');
  fs.writeFileSync(list, parts.map((part) => `file '${part.full.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const folder = outputDir();
  fs.mkdirSync(folder, { recursive: true });
  const started = Date.now();
  const file = path.join(folder, `live-${started}.mp4`);
  onLog('Cutting the last moments into a vertical clip...');
  await runFfmpeg([
    '-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '1000k', '-maxrate', '1200k',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-t', String(seconds || 45),
    file,
  ]);
  onLog(`Saved ${file}`);
  const text = caption || `Live from kick.com/${channelName}`;
  const links = await publishClip({ file, text, discordWebhook, x, onLog });
  const routed = await routeClips({
    grokbot: {
      ...(grokbot || {}),
      links,
      instruction: 'A live clip is ready. Post it to TikTok, YouTube Shorts, Instagram Reels, and X. Use the watch link if one is included. The caption is already written.',
    },
    output: folder,
    since: started,
    topic: text,
    game: 'live',
    source: `https://kick.com/${channelName}`,
    onLog,
  });
  return { ok: true, file, links, routed };
}

module.exports = { start, stop, clipNow, status };
