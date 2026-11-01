'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { importHar } = require('../src/import-har');

test('HAR import chooses successful bank session, does not replay or retain passwords', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saman-har-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const entry = (url, token, code = 0) => ({ request: { url, postData: { text: 'password-secret' }, headers: [
    { name: 'Authorization', value: 'Bearer ' + token }, { name: 'deviceUid', value: 'device' },
    { name: 'Cookie', value: 'sid=one=two' }, { name: 'appVersion', value: '5080200000' },
  ] }, response: { status: 200, content: { text: JSON.stringify({ status: { code } }) } } });
  const file = path.join(dir, 'capture.har');
  fs.writeFileSync(file, JSON.stringify({ log: { entries: [
    entry('https://mobillet.sb24.com/account/deposits', 'good'),
    entry('https://example.com/', 'foreign'),
    entry('https://mobillet.sb24.com/account/deposits', 'expired', -401),
  ] } }));
  const client = { save() { this.saved = true; } };
  const result = importHar(client, file);
  assert.equal(client.session.accessToken, 'good');
  assert.equal(client.cookies.get('sid'), 'one=two');
  assert.equal(client.saved, true);
  assert.equal(JSON.stringify(client.session).includes('password-secret'), false);
  assert.equal(JSON.stringify(result).includes('good'), false);
  assert.equal(result.liveVerified, false);
  const login = entry('https://mobillet.sb24.com/user/login', 'unused');
  login.request.headers = login.request.headers.filter(h => h.name !== 'Authorization');
  login.response.content.text = JSON.stringify({ status: { code: 0 }, accessToken: 'response-token' });
  fs.writeFileSync(file, JSON.stringify({ log: { entries: [login] } }));
  assert.equal(importHar(client, file).imported, true);
  assert.equal(client.session.accessToken, 'response-token');
  fs.writeFileSync(file, JSON.stringify({ log: { entries: [entry('https://example.com/', 'foreign')] } }));
  assert.throws(() => importHar(client, file), /No successful authenticated/);
});
