async function elevenAudio(voice, text) {
  if (!voice.apiKey || !voice.voiceId) return { error: 'Add an ElevenLabs API key and voice ID.' };
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': voice.apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return { error: 'ElevenLabs refused that voice.' };
  const audio = Buffer.from(await response.arrayBuffer()).toString('base64');
  return { audio: `data:audio/mpeg;base64,${audio}` };
}

async function speak(win, settings, text) {
  const voice = settings.voice || {};
  const line = String(text || '').trim();
  if (!voice.enabled || !line || !win || win.isDestroyed()) return { ok: false };
  try {
    if (voice.provider === 'elevenlabs') {
      const result = await elevenAudio(voice, line);
      if (result.error) return { ok: false, error: result.error };
      win.webContents.send('speak', { audio: result.audio });
      return { ok: true };
    }
    win.webContents.send('speak', { text: line, voice: voice.systemVoice || '', rate: voice.rate || 1 });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || 'The voice did not play.' };
  }
}

module.exports = { speak };
