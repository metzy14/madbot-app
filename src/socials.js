const fs = require('fs');
const http = require('http');
const { shell, clipboard } = require('electron');
const apps = require('./apps');

function skipped() {
  return { ok: false, skipped: true };
}

async function readError(response) {
  const body = await response.json().catch(() => ({}));
  return body.error?.message || body.error_description || body.message || `Request failed (${response.status}).`;
}

async function postYouTube(yt, file, text) {
  if (!yt?.refreshToken || !apps.youtube.clientId) return skipped();
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: apps.youtube.clientId,
      client_secret: apps.youtube.clientSecret,
      refresh_token: yt.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const token = await tokenResponse.json();
  if (!token.access_token) throw new Error('YouTube needs you to log in again.');
  const size = fs.statSync(file).size;
  const caption = String(text || 'Live clip').trim();
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify({
      snippet: { title: caption.slice(0, 100), description: caption, categoryId: '20' },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
    }),
  });
  const location = init.headers.get('location');
  if (!location) throw new Error(await readError(init));
  const put = await fetch(location, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'video/mp4' },
    body: fs.readFileSync(file),
  });
  const data = await put.json().catch(() => ({}));
  if (!put.ok) throw new Error(data.error?.message || 'YouTube did not take the video.');
  return { ok: true, url: data.id ? `https://youtube.com/shorts/${data.id}` : '' };
}

async function postX(x, file, text) {
  const { TwitterApi } = require('twitter-api-v2');
  const caption = String(text || '').slice(0, 280);
  if (x?.accessToken && apps.x.clientId) {
    const client = new TwitterApi(x.accessToken);
    const mediaId = await client.v2.uploadMedia(fs.readFileSync(file), { media_type: 'video/mp4', media_category: 'tweet_video' });
    const tweet = await client.v2.tweet({ text: caption, media: { media_ids: [mediaId] } });
    const id = tweet?.data?.id;
    return { ok: true, url: id ? `https://x.com/i/status/${id}` : '' };
  }
  if (x?.appKey && x?.appSecret && x?.accessToken && x?.accessSecret) {
    const client = new TwitterApi({ appKey: x.appKey, appSecret: x.appSecret, accessToken: x.accessToken, accessSecret: x.accessSecret });
    const mediaId = await client.v1.uploadMedia(file, { mimeType: 'video/mp4' });
    const tweet = await client.v2.tweet({ text: caption, media: { media_ids: [mediaId] } });
    const id = tweet?.data?.id;
    return { ok: true, url: id ? `https://x.com/i/status/${id}` : '' };
  }
  return skipped();
}

async function postInstagram(ig, file, text) {
  if (!ig?.accessToken || !ig?.userId) return skipped();
  const version = 'v21.0';
  const created = await fetch(`https://graph.instagram.com/${version}/${ig.userId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ig.accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ media_type: 'REELS', upload_type: 'resumable', caption: String(text || '').slice(0, 2200) }),
  });
  const container = await created.json();
  if (!container.id) throw new Error(container.error?.message || 'Instagram did not start.');
  const size = fs.statSync(file).size;
  const upload = await fetch(`https://rupload.facebook.com/ig-api-upload/${version}/${container.id}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${ig.accessToken}`,
      offset: '0',
      file_size: String(size),
      'Content-Type': 'application/octet-stream',
    },
    body: fs.readFileSync(file),
  });
  if (!upload.ok) throw new Error(await readError(upload));
  let finished = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const status = await fetch(`https://graph.instagram.com/${version}/${container.id}?fields=status_code`, {
      headers: { Authorization: `Bearer ${ig.accessToken}` },
    });
    const body = await status.json();
    if (body.status_code === 'FINISHED') { finished = true; break; }
    if (body.status_code === 'ERROR' || body.status_code === 'EXPIRED') throw new Error('Instagram could not use that video.');
  }
  if (!finished) throw new Error('Instagram took too long.');
  const published = await fetch(`https://graph.instagram.com/${version}/${ig.userId}/media_publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ig.accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: container.id }),
  });
  const result = await published.json();
  if (!result.id) throw new Error(result.error?.message || 'Instagram did not post it.');
  return { ok: true, url: '' };
}

const PAGES = {
  YouTube: 'https://www.youtube.com/upload',
  X: 'https://x.com/compose/post',
  Instagram: 'https://www.instagram.com/',
};

async function publishClip({ file, text, youtube, x, instagram, onLog }) {
  const jobs = [
    ['YouTube', () => postYouTube(youtube, file, text)],
    ['X', () => postX(x, file, text)],
    ['Instagram', () => postInstagram(instagram, file, text)],
  ];
  const links = [];
  const needsHand = [];
  for (const [name, run] of jobs) {
    try {
      const result = await run();
      if (result.skipped) needsHand.push(name);
      else {
        onLog(result.url ? `Posted to ${name}.` : `Posted to ${name}.`);
        if (result.url) links.push(result.url);
      }
    } catch (error) {
      onLog(`${name} did not post. The page will open so you can drop the video in.`);
      needsHand.push(name);
    }
  }
  if (needsHand.length) {
    clipboard.writeText(String(text || ''));
    shell.showItemInFolder(file);
    needsHand.forEach((name) => shell.openExternal(PAGES[name]));
    onLog(`The clip is selected, and the words are copied. Drop the video onto ${needsHand.join(', ')}.`);
  }
  return links;
}

function loginChoices() {
  return {
    youtube: Boolean(apps.youtube.clientId),
    x: Boolean(apps.x.clientId),
    instagram: Boolean(apps.instagram.clientId),
  };
}

function listenForCode(port, pathName) {
  const redirect = `http://127.0.0.1:${port}${pathName}`;
  let finish;
  const result = new Promise((resolve, reject) => {
    finish = (error, code) => {
      if (finish.settled) return;
      finish.settled = true;
      clearTimeout(timer);
      server.close();
      if (error) reject(error);
      else resolve(code);
    };
  });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, redirect);
    res.end('You are logged in. Go back to MadBot.');
    const code = url.searchParams.get('code');
    finish(code ? null : new Error('Login was cancelled.'), code);
  });
  const timer = setTimeout(() => finish(new Error('Login timed out. Try again.')), 180000);
  const ready = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { ready, result };
}

async function connectYouTube() {
  if (!apps.youtube.clientId) throw new Error('YouTube login is not turned on in this copy of MadBot.');
  const port = 53682;
  const redirect = `http://127.0.0.1:${port}/callback`;
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', apps.youtube.clientId);
  auth.searchParams.set('redirect_uri', redirect);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.upload');
  auth.searchParams.set('access_type', 'offline');
  auth.searchParams.set('prompt', 'consent');
  const login = listenForCode(port, '/callback');
  await login.ready;
  await shell.openExternal(auth.toString());
  const code = await login.result;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: apps.youtube.clientId,
      client_secret: apps.youtube.clientSecret,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json();
  if (!data.refresh_token) throw new Error('YouTube did not finish logging in. Try again.');
  return data.refresh_token;
}

async function connectX() {
  if (!apps.x.clientId) throw new Error('X login is not turned on in this copy of MadBot.');
  const { TwitterApi } = require('twitter-api-v2');
  const port = 53683;
  const redirect = `http://127.0.0.1:${port}/callback`;
  const client = new TwitterApi({ clientId: apps.x.clientId, clientSecret: apps.x.clientSecret });
  const link = client.generateOAuth2AuthLink(redirect, { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write'] });
  const login = listenForCode(port, '/callback');
  await login.ready;
  await shell.openExternal(link.url);
  const code = await login.result;
  const logged = await client.loginWithOAuth2({ code, codeVerifier: link.codeVerifier, redirectUri: redirect });
  return { accessToken: logged.accessToken, refreshToken: logged.refreshToken };
}

async function connectInstagram() {
  if (!apps.instagram.clientId) throw new Error('Instagram login is not turned on in this copy of MadBot.');
  const port = 53684;
  const redirect = `http://127.0.0.1:${port}/callback`;
  const auth = new URL('https://www.instagram.com/oauth/authorize');
  auth.searchParams.set('client_id', apps.instagram.clientId);
  auth.searchParams.set('redirect_uri', redirect);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'instagram_business_basic,instagram_business_content_publish');
  const login = listenForCode(port, '/callback');
  await login.ready;
  await shell.openExternal(auth.toString());
  const code = await login.result;
  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: apps.instagram.clientId,
      client_secret: apps.instagram.clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirect,
      code,
    }),
  });
  const data = await response.json();
  if (!data.access_token) throw new Error('Instagram did not finish logging in. Try again.');
  return { accessToken: data.access_token, userId: String(data.user_id || '') };
}

module.exports = { publishClip, loginChoices, connectYouTube, connectX, connectInstagram };
