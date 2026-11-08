function hexToRgb(hex) {
  const value = String(hex || '#53fc18').replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16) || 0,
    g: parseInt(value.slice(2, 4), 16) || 0,
    b: parseInt(value.slice(4, 6), 16) || 0,
  };
}

function hueState(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === rn) hue = ((gn - bn) / delta) % 6;
    else if (max === gn) hue = (bn - rn) / delta + 2;
    else hue = (rn - gn) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const light = (max + min) / 2;
  const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  return {
    on: true,
    bri: Math.max(40, Math.round(Math.min(1, light + 0.35) * 254)),
    hue: Math.round((hue / 360) * 65535),
    sat: Math.round(sat * 254),
  };
}

async function hueRequest(bridge, user, path, options = {}) {
  const root = user ? `/api/${user}` : '/api';
  const response = await fetch(`http://${bridge}${root}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(5000),
  });
  return response.json();
}

async function setHue(lights, hex) {
  const ids = String(lights.hue.lightIds || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (!lights.hue.bridge || !lights.hue.user || !ids.length) {
    return { ok: false, error: 'Add the Hue bridge IP, link the bridge, and choose a light.' };
  }
  const body = JSON.stringify(hueState(hex));
  await Promise.all(ids.map((id) => hueRequest(lights.hue.bridge, lights.hue.user, `/lights/${id}/state`, { method: 'PUT', body })));
  return { ok: true };
}

async function setGovee(lights, hex) {
  const { apiKey, device, sku } = lights.govee;
  if (!apiKey || !device || !sku) return { ok: false, error: 'Add the Govee API key, device, and model.' };
  const { r, g, b } = hexToRgb(hex);
  const color = (r << 16) + (g << 8) + b;
  const headers = { 'Content-Type': 'application/json', 'Govee-API-Key': apiKey };
  const send = (capability) => fetch('https://openapi.api.govee.com/router/api/v1/device/control', {
    method: 'POST',
    headers,
    body: JSON.stringify({ requestId: `${Date.now()}`, payload: { sku, device, capability } }),
    signal: AbortSignal.timeout(8000),
  });
  await send({ type: 'devices.capabilities.on_off', instance: 'powerSwitch', value: 1 });
  const colorResponse = await send({ type: 'devices.capabilities.color_setting', instance: 'colorRgb', value: color });
  if (!colorResponse.ok) return { ok: false, error: 'Govee refused the color change.' };
  return { ok: true };
}

async function flashLights(settings) {
  const lights = settings.lights;
  if (!lights?.enabled || lights.provider === 'preview') return { ok: true, preview: true };
  try {
    if (lights.provider === 'hue') return await setHue(lights, lights.color);
    if (lights.provider === 'govee') return await setGovee(lights, lights.color);
    return { ok: false, error: 'Pick Hue or Govee.' };
  } catch (error) {
    return { ok: false, error: error.message || 'The lights did not respond.' };
  }
}

async function scanLights(settings) {
  const lights = settings.lights;
  try {
    if (lights.provider === 'hue') {
      if (!lights.hue.bridge) return { ok: false, error: 'Type the Hue bridge IP first.' };
      if (!lights.hue.user) {
        const linked = await hueRequest(lights.hue.bridge, '', '', {
          method: 'POST',
          body: JSON.stringify({ devicetype: 'madbot#desktop' }),
        });
        const username = linked?.[0]?.success?.username;
        if (!username) return { ok: false, error: 'Press the round button on the Hue bridge, then scan again.' };
        lights.hue.user = username;
      }
      const found = await hueRequest(lights.hue.bridge, lights.hue.user, '/lights');
      const devices = Object.entries(found || {}).map(([id, light]) => ({ id, name: light.name || `Light ${id}` }));
      if (!String(lights.hue.lightIds || '').trim() && devices[0]) lights.hue.lightIds = devices[0].id;
      return { ok: true, devices };
    }
    if (lights.provider === 'govee') {
      if (!lights.govee.apiKey) return { ok: false, error: 'Paste the Govee API key first.' };
      const response = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices', {
        headers: { 'Govee-API-Key': lights.govee.apiKey },
        signal: AbortSignal.timeout(8000),
      });
      const body = await response.json();
      const devices = (body?.data || body?.devices || []).map((device) => ({
        id: device.device,
        name: device.deviceName || device.sku,
        sku: device.sku,
      }));
      if (devices[0]) {
        lights.govee.device = lights.govee.device || devices[0].id;
        lights.govee.sku = lights.govee.sku || devices[0].sku;
      }
      return { ok: true, devices };
    }
    return { ok: true, devices: [{ id: 'preview', name: 'Preview only' }] };
  } catch (error) {
    return { ok: false, error: error.message || 'Could not reach the lights.' };
  }
}

module.exports = { flashLights, scanLights };
