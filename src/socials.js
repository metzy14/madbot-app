const fs = require('fs');
const http = require('http');
const { shell } = require('electron');

function skipped() {
  return { ok: false, skipped: true };
}

async function readError(response) {
  const body = await response.json().catch(() => ({}));
  return body.error?.message || body.error_description || body.error?.error_description || body.message || `Request failed (${response.status}).`;
}

async function youtubeAccess(yt) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: yt.clientId,
      client_secret: yt.clientSecret,
      refresh_token: yt.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!data.access_token) throw new Error(data.error_description || 'YouTube login expired.');
  return data.access_token;
}

async function postYouTube(yt, file, text) {
  if (!yt?.clientId || !yt?.clientSecret || !yt?.refreshToken) return skipped();
  const token = await youtubeAccess(yt);
  const size = fs.statSync(file).size;
  const caption = String(text || 'Live clip').trim();
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'video/mp4' },
    body: fs.readFileSync(file),
  });
  const data = await put.json().catch(() => ({}));
  if (!put.ok) throw new Error(data.error?.message || 'YouTube upload failed.');
  return { ok: true, url: data.id ? `https://youtube.com/shorts/${data.id}` : '' };
}

async function postX(keys, file, text) {
  if (!keys?.appKey || !keys?.appSecret || !keys?.accessToken || !keys?.accessSecret) return skipped();
  const { TwitterApi } = require('twitter-api-v2');
  const client = new TwitterApi({
    appKey: keys.appKey,
    appSecret: keys.appSecret,
    accessToken: keys.accessToken,
    accessSecret: keys.accessSecret,
  });
  const mediaId = await client.v1.uploadMedia(file, { mimeType: 'video/mp4' });
  const tweet = await client.v2.tweet({ text: String(text || '').slice(0, 280), media: { media_ids: [mediaId] } });
  const id = tweet?.data?.id;
  return { ok: true, url: id ? `https://x.com/i/status/${id}` : '' };
}

async function tiktokInit(token, file, text, privacy) {
  const size = fs.statSync(file).size;
  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: {
        title: String(text || 'Live clip').slice(0, 150),
        privacy_level: privacy,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error?.code) {
    const message = data.error?.message || `TikTok refused the clip (${response.status}).`;
    const err = new Error(message);
    err.code = data.error?.code || '';
    throw err;
  }
  return data.data;
}

async function postTikTok(tk, file, text) {
  if (!tk?.accessToken) return skipped();
  let data;
  try {
    data = await tiktokInit(tk.accessToken, file, text, 'PUBLIC_TO_EVERYONE');
  } catch (error) {
    if (!/privacy/i.test(error.message)) throw error;
    data = await tiktokInit(tk.accessToken, file, text, 'SELF_ONLY');
  }
  const size = fs.statSync(file).size;
  const upload = await fetch(data.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${size - 1}/${size}`,
    },
    body: fs.readFileSync(file),
  });
  if (!upload.ok) throw new Error(`TikTok upload failed (${upload.status}).`);
  return { ok: true, url: '' };
}

async function postInstagram(ig, file, text) {
  if (!ig?.accessToken || !ig?.userId) return skipped();
  const version = 'v21.0';
  const created = await fetch(`https://graph.facebook.com/${version}/${ig.userId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ig.accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ media_type: 'REELS', upload_type: 'resumable', caption: String(text || '').slice(0, 2200) }),
  });
  const container = await created.json();
  if (!container.id) throw new Error(container.error?.message || 'Instagram did not start the upload.');
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
    const status = await fetch(`https://graph.facebook.com/${version}/${container.id}?fields=status_code`, {
      headers: { Authorization: `Bearer ${ig.accessToken}` },
    });
    const body = await status.json();
    if (body.status_code === 'FINISHED') { finished = true; break; }
    if (body.status_code === 'ERROR' || body.status_code === 'EXPIRED') throw new Error(body.error?.message || 'Instagram could not process the video.');
  }
  if (!finished) throw new Error('Instagram took too long to process the video.');
  const published = await fetch(`https://graph.facebook.com/${version}/${ig.userId}/media_publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ig.accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: container.id }),
  });
  const result = await published.json();
  if (!result.id) throw new Error(result.error?.message || 'Instagram did not publish the Reel.');
  return { ok: true, url: '' };
}

async function publishClip({ file, text, youtube, x, tiktok, instagram, onLog }) {
  const jobs = [
    ['YouTube', () => postYouTube(youtube, file, text)],
    ['X', () => postX(x, file, text)],
    ['TikTok', () => postTikTok(tiktok, file, text)],
    ['Instagram', () => postInstagram(instagram, file, text)],
  ];
  const links = [];
  for (const [name, run] of jobs) {
    try {
      const result = await run();
      if (result.skipped) onLog(`${name} is not connected, so that post was skipped.`);
      else {
        onLog(result.url ? `Posted the clip to ${name}: ${result.url}` : `Posted the clip to ${name}.`);
        if (result.url) links.push(result.url);
      }
    } catch (error) {
      onLog(`${name}: ${error.message || 'post failed.'}`);
    }
  }
  return links;
}

function connectYouTube(yt) {
  if (!yt?.clientId || !yt?.clientSecret) throw new Error('Paste the YouTube client ID and secret first.');
  const port = 53682;
  const redirect = `http://127.0.0.1:${port}/callback`;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, token) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      if (error) reject(error);
      else resolve(token);
    };
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, redirect);
      const code = url.searchParams.get('code');
      res.end('YouTube is connected. You can close this tab.');
      if (!code) return finish(new Error('YouTube did not return a code.'));
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: yt.clientId,
          client_secret: yt.clientSecret,
          redirect_uri: redirect,
          grant_type: 'authorization_code',
        }),
      });
      const data = await response.json();
      if (!data.refresh_token) return finish(new Error(data.error_description || 'YouTube did not give a refresh token. Remove MadBot access in your Google account and try again.'));
      finish(null, data.refresh_token);
    });
    const timer = setTimeout(() => finish(new Error('YouTube connect timed out.')), 180000);
    server.listen(port, '127.0.0.1', () => {
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      auth.searchParams.set('client_id', yt.clientId);
      auth.searchParams.set('redirect_uri', redirect);
      auth.searchParams.set('response_type', 'code');
      auth.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.upload');
      auth.searchParams.set('access_type', 'offline');
      auth.searchParams.set('prompt', 'consent');
      shell.openExternal(auth.toString());
    });
    server.on('error', (error) => finish(error));
  });
}

module.exports = { publishClip, connectYouTube };
