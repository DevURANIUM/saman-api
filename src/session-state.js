'use strict';
function expiresAt(session) {
  if (Number.isFinite(session.expiresAt)) return session.expiresAt;
  try {
    const payload = JSON.parse(Buffer.from(session.accessToken.split('.')[1], 'base64url').toString());
    if (Number.isFinite(payload.exp)) return payload.exp * 1000;
  } catch {}
  return null;
}
module.exports = { expiresAt };
