const fs = require('fs');
const path = require('path');

async function postDiscord(webhook, file, text) {
  if (!webhook) return { ok: false, skipped: true };
  const form = new FormData();
  form.append('payload_json', JSON.stringify({ content: String(text || '').slice(0, 1800) }));
  const bytes = fs.readFileSync(file);
  form.append('files[0]', new Blob([bytes], { type: 'video/mp4' }), path.basename(file));
  const response = await fetch(webhook, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: body.message || `Discord refused the clip (${response.status}).` };
  const url = body.attachments?.[0]?.url || '';
  return { ok: true, url };
}

async function postX(keys, file, text) {
  const ready = keys && keys.appKey && keys.appSecret && keys.accessToken && keys.accessSecret;
  if (!ready) return { ok: false, skipped: true };
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

async function publishClip({ file, text, discordWebhook, x, onLog }) {
  const links = [];
  try {
    const discord = await postDiscord(discordWebhook, file, text);
    if (discord.skipped) onLog('Discord webhook is blank, so that post was skipped.');
    else if (!discord.ok) onLog(discord.error);
    else {
      onLog('Posted the clip to Discord.');
      if (discord.url) links.push(discord.url);
    }
  } catch (error) {
    onLog(error.message || 'Discord post failed.');
  }
  try {
    const tweet = await postX(x, file, text);
    if (tweet.skipped) onLog('X keys are blank, so that post was skipped.');
    else if (!tweet.ok) onLog(tweet.error || 'X post failed.');
    else {
      onLog('Posted the clip to X.');
      if (tweet.url) links.push(tweet.url);
    }
  } catch (error) {
    onLog(error.message || 'X post failed.');
  }
  return links;
}

module.exports = { publishClip };
