const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { app } = require('electron');
const { routeClips } = require('./grokbot');
const { publishClip } = require('./socials');

const PYTHON_URL = 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-embed-amd64.zip';
const PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';
const FFMPEG_URL = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-win32-x64.gz';

let current = null;

function engineDir() {
  const packed = path.join(process.resourcesPath, 'engine');
  if (fs.existsSync(path.join(packed, 'run_job.py'))) return packed;
  return path.join(__dirname, '..', 'engine');
}

function cutterDir() {
  return path.join(app.getPath('userData'), 'cutter');
}

function outputDir() {
  return path.join(app.getPath('videos'), 'MadBot Shorts');
}

function pythonExe() {
  const embedded = path.join(cutterDir(), 'python', 'python.exe');
  if (fs.existsSync(embedded)) return embedded;
  const venv = path.join(cutterDir(), 'venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venv)) return venv;
  const unix = path.join(cutterDir(), 'venv', 'bin', 'python');
  if (fs.existsSync(unix)) return unix;
  return null;
}

function ffmpegExe() {
  const local = path.join(cutterDir(), 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(local)) return local;
  return 'ffmpeg';
}

function status() {
  return {
    ready: Boolean(pythonExe()),
    python: pythonExe(),
    ffmpeg: ffmpegExe(),
    output: outputDir(),
    running: Boolean(current),
  };
}

function run(cmd, args, onLog) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    current = child;
    const take = (buf) => String(buf).split(/\r?\n/).filter(Boolean).forEach((line) => onLog(line));
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', reject);
    child.on('close', (code) => {
      current = null;
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(cmd)} stopped (${code})`));
    });
  });
}

async function downloadFile(url, dest, onLog) {
  onLog(`Downloading ${path.basename(dest)}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const file = fs.createWriteStream(dest);
  const reader = response.body.getReader();
  await new Promise((resolve, reject) => {
    const pump = () => reader.read().then(({ done, value }) => {
      if (done) {
        file.end(resolve);
        return;
      }
      file.write(Buffer.from(value));
      pump();
    }).catch(reject);
    file.on('error', reject);
    pump();
  });
}

async function ensurePython(onLog) {
  if (pythonExe()) return pythonExe();
  if (process.platform !== 'win32') {
    const found = spawnSync('python3', ['-c', 'print(1)'], { encoding: 'utf8' });
    if (found.status !== 0) throw new Error('Python is not installed.');
    const dest = path.join(cutterDir(), 'venv');
    spawnSync('python3', ['-m', 'venv', dest], { stdio: 'inherit' });
    return pythonExe();
  }
  const zip = path.join(cutterDir(), 'python.zip');
  const dest = path.join(cutterDir(), 'python');
  await downloadFile(PYTHON_URL, zip, onLog);
  onLog('Unpacking Python...');
  fs.mkdirSync(dest, { recursive: true });
  await run('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -LiteralPath '${zip}' -DestinationPath '${dest}'`], onLog);
  const pth = fs.readdirSync(dest).find((name) => name.endsWith('._pth'));
  if (pth) {
    const file = path.join(dest, pth);
    const text = fs.readFileSync(file, 'utf8').replace('#import site', 'import site');
    fs.writeFileSync(file, `${text.trim()}\nLib\\site-packages\n`);
  }
  const getPip = path.join(dest, 'get-pip.py');
  await downloadFile(PIP_URL, getPip, onLog);
  await run(path.join(dest, 'python.exe'), [getPip], onLog);
  return path.join(dest, 'python.exe');
}

async function ensureFfmpeg(onLog) {
  const dest = path.join(cutterDir(), 'bin', 'ffmpeg.exe');
  if (process.platform !== 'win32' || fs.existsSync(dest)) return;
  const gz = path.join(cutterDir(), 'ffmpeg.gz');
  await downloadFile(FFMPEG_URL, gz, onLog);
  onLog('Unpacking ffmpeg...');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await new Promise((resolve, reject) => {
    fs.createReadStream(gz).pipe(zlib.createGunzip()).pipe(fs.createWriteStream(dest)).on('finish', resolve).on('error', reject);
  });
}

async function setup(onLog) {
  const python = await ensurePython(onLog);
  await ensureFfmpeg(onLog);
  onLog('Installing the cutter. This can take a few minutes.');
  await run(python, ['-m', 'pip', 'install', '-r', path.join(engineDir(), 'requirements.txt')], onLog);
  onLog('Cutter is ready.');
  return status();
}

async function startJob(job, onLog) {
  const python = pythonExe();
  if (!python) throw new Error('Click Set up cutter first.');
  if (current) throw new Error('A job is already running.');
  const output = outputDir();
  fs.mkdirSync(output, { recursive: true });
  const spec = path.join(cutterDir(), 'job.json');
  fs.mkdirSync(cutterDir(), { recursive: true });
  const grokbot = job.grokbot || {};
  const socials = job.socials || {};
  const clean = { ...job, output };
  delete clean.grokbot;
  delete clean.socials;
  fs.writeFileSync(spec, JSON.stringify(clean));
  const env = { ...process.env, PYTHONPATH: engineDir(), PYTHONUNBUFFERED: '1' };
  const bin = path.join(cutterDir(), 'bin');
  env.PATH = `${bin}${path.delimiter}${env.PATH || ''}`;
  const started = Date.now();
  onLog(`Saving shorts to ${output}`);
  await new Promise((resolve, reject) => {
    const child = spawn(python, [path.join(engineDir(), 'run_job.py'), spec], { env, windowsHide: true });
    current = child;
    const take = (buf) => String(buf).split(/\r?\n/).filter(Boolean).forEach((line) => onLog(line));
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', reject);
    child.on('close', (code) => {
      current = null;
      if (code === 0) resolve();
      else reject(new Error(`The cutter stopped (${code}).`));
    });
  });
  try {
    const routed = await routeClips({
      grokbot,
      output,
      since: started,
      topic: job.topic,
      game: job.game,
      source: job.input,
      onLog,
    });
    return { ok: true, output, routed };
  } catch (error) {
    onLog(error.message);
    return { ok: true, output, routed: { ok: false, error: error.message } };
  } finally {
    const fresh = fs.readdirSync(output)
      .filter((name) => name.endsWith('.mp4'))
      .map((name) => path.join(output, name))
      .filter((file) => fs.statSync(file).mtimeMs >= started - 2000);
    for (const file of fresh) {
      await publishClip({
        file,
        text: job.topic || 'New clip',
        youtube: socials.youtube,
        x: socials.x,
        tiktok: socials.tiktok,
        instagram: socials.instagram,
        onLog,
      });
    }
  }
}

function stop() {
  if (current) current.kill();
  current = null;
}

module.exports = { status, setup, startJob, stop, outputDir, ffmpegExe };
