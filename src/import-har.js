'use strict';
const fs = require('node:fs');
const { ApiError } = require('./errors');

// Read only Mobillet's own successful authenticated requests. Never replay HAR
// requests: a capture may contain transfers, OTPs and other mutations.
function importHar(client, file) {
  let har;
  try { har = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch { throw new Error('Cannot read HAR JSON file'); }
  return importHarData(client, har);
}
function importHarData(client, har) {
  if (!Array.isArray(har?.log?.entries)) throw new ApiError('Invalid HAR: missing log.entries', 400);
  const candidates = [];
  const devices = new Map();
  for (const entry of har.log.entries) {
    let url;
    try { url = new URL(entry.request.url); } catch { continue; }
    if (url.origin !== 'https://mobillet.sb24.com') continue;
    if (!(entry.response?.status >= 200 && entry.response.status < 300)) continue;
    if (!Array.isArray(entry.request.headers)) continue;
    const headers = Object.fromEntries(entry.request.headers.filter(h => typeof h?.name === 'string' && typeof h.value === 'string').map(h => [h.name.toLowerCase(), h.value]));
    if (!headers.deviceuid) continue;
    if (url.pathname === '/user/login' && entry.request.method === 'POST') {
      try {
        const info = JSON.parse(entry.request.postData.text).deviceInfo;
        if (info && typeof info === 'object') {
          const saved = {};
          for (const k of ['brandModel', 'os', 'osVersion', 'brand'])
            if (typeof info[k] === 'string' && info[k].length <= 200) saved[k] = info[k];
          devices.set(headers.deviceuid, saved);
        }
      } catch {}
    }
    // Only accept responses that the bank itself marked successful.
    let body;
    try {
      const content = entry.response.content;
      body = JSON.parse(content.encoding === 'base64'
        ? Buffer.from(content.text, 'base64').toString('utf8') : content.text);
      if (body?.status?.code !== 0) continue;
    } catch { continue; }
    const token = /^Bearer \S+$/i.test(headers.authorization || '')
      ? headers.authorization.replace(/^Bearer /i, '')
      : url.pathname === '/user/login' && typeof body.accessToken === 'string' ? body.accessToken : null;
    if (!token || /\s/.test(token)) continue;
    candidates.push({ entry, headers, token, login: url.pathname === '/user/login' ? body : undefined });
  }
  const chosen = candidates.at(-1);
  if (!chosen) throw new ApiError('No successful authenticated Mobillet request found. Export HAR with sensitive data after opening accounts.', 400);
  const { entry, headers, token, login } = chosen;
  const cookies = new Map();
  for (const cookie of entry.request.cookies || []) if (cookie.name) cookies.set(cookie.name, cookie.value);
  for (const pair of (headers.cookie || '').split(';')) {
    const at = pair.indexOf('=');
    if (at > 0) cookies.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
  }
  client.session = { deviceUid: headers.deviceuid,
    accessToken: token,
    appVersion: /^\d+$/.test(headers.appversion || '') ? headers.appversion : '5080200000',
    deviceInfo: devices.get(headers.deviceuid),
    expiresAt: login?.tokenExpiration, trustedDevice: login?.trustedDevice,
    shouldChangePassword: login?.shouldChangePassword,
    source: 'browser-har', importedAt: new Date().toISOString() };
  client.cookies = cookies;
  client.secret = null; client.rsaPublicKey = null;
  client.save();
  return { imported: true, authenticatedRequestsObserved: candidates.length,
    cookieCount: cookies.size, liveVerified: false };
}
module.exports = { importHar, importHarData };
