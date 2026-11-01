'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MobilletClient } = require('../src/client');
const { createApp } = require('../server');

function make(t, fetchImpl) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saman-test-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  return new MobilletClient({ dataDir, fetchImpl });
}
const response = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

test('P-384 config derives exactly the same shared secret as the server', async t => {
  const peer = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  let expected;
  const c = make(t, async (url, opts) => {
    assert.equal(url.pathname, '/config');
    assert.equal(opts.headers.appVersion, '5080200000');
    const publicKey = crypto.createPublicKey({ key: Buffer.from(opts.headers.ecPublicKey, 'base64'), type: 'spki', format: 'der' });
    expected = crypto.diffieHellman({ privateKey: peer.privateKey, publicKey }).toString('base64');
    return response({ status: { code: 0 }, publicKey: 'unused',
      ecPublicKey: peer.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') });
  });
  await c.configure();
  assert.equal(c.secret, expected);
});

test('login encrypts password + base64 secret using PKCS1, persists no password', async t => {
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const c = make(t, async (url, opts) => {
    const body = JSON.parse(opts.body);
    assert.equal(url.pathname, '/user/login');
    assert.equal(body.username, 'user1');
    const raw = crypto.privateDecrypt({ key: rsa.privateKey, padding: crypto.constants.RSA_NO_PADDING }, Buffer.from(body.password, 'base64'));
    assert.equal(raw[0], 0); assert.equal(raw[1], 2);
    assert.equal(raw.subarray(raw.indexOf(0, 2) + 1).toString(), 'pass1secret');
    return response({ status: { code: 0 }, accessToken: 'token', trustedDevice: false });
  });
  c.configure = async () => { c.secret = 'secret'; c.rsaPublicKey = rsa.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'); };
  const out = await c.login({ username: 'user۱', password: 'pass۱' });
  assert.equal(out.deviceVerificationRequired, true);
  assert.equal(fs.readFileSync(c.file, 'utf8').includes('pass'), false);
});

test('logical expired-session error invalidates token without retry', async t => {
  let count = 0;
  const c = make(t, async () => { count++; return response({ status: { code: -412 } }); });
  c.session.accessToken = 'expired';
  await assert.rejects(c.request('account/deposits'), e => e.status === 401);
  assert.equal(count, 1); assert.equal(c.status().loggedIn, false);
});

test('logical errors in HTTP 200 are not treated as success', async t => {
  const c = make(t, async () => response({ status: { code: 1006, message: 'invalid credentials' } }));
  await assert.rejects(c.request('user/login', { auth: false }), e => e.status === 422 && e.code === 1006);
});

test('cookies and stable device survive a new client; logout clears token and cookies', async t => {
  const c = make(t, async () => new Response('{"status":{"code":0}}', { headers: { 'set-cookie': 'sid=abc; Secure; HttpOnly' } }));
  await c.request('config', { auth: false }); c.session.accessToken = 'token'; c.save();
  const next = new MobilletClient({ dataDir: path.dirname(c.file) });
  assert.equal(next.session.deviceUid, c.session.deviceUid); assert.equal(next.cookies.get('sid'), 'abc');
  next.logout(); assert.equal(next.status().loggedIn, false); assert.equal(next.cookies.size, 0);
});

test('HTTP API requires API key and validates pagination before contacting bank', async t => {
  const c = make(t, async () => { throw new Error('unexpected upstream request'); });
  const server = createApp(c, 'test-key').listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(url + '/health')).status, 200);
  assert.equal((await fetch(url + '/status')).status, 401);
  assert.equal((await fetch(url + '/transactions?size=1000', { headers: { 'x-api-key': 'test-key' } })).status, 400);
});

test('untrusted-device errors retain the token needed to request and verify OTP after restart', async t => {
  const calls = [];
  const transport = async (url, opts) => {
    calls.push(url.pathname);
    assert.equal(opts.headers.authorization, 'Bearer pending-device-token');
    if (url.pathname === '/user/') return response({ status: { code: 1403 } });
    if (url.pathname === '/verification/generate-code') {
      assert.deepEqual(JSON.parse(opts.body), { reason: 'VERIFY_MOBILE_NUMBER' });
      return response({ status: { code: 0 }, expiration: 120 });
    }
    assert.equal(url.pathname, '/user/verify-mobile');
    assert.deepEqual(JSON.parse(opts.body), { verificationCode: '123456', reason: 'VERIFY_MOBILE_NUMBER' });
    return response({ status: { code: 0 } });
  };
  const c = make(t, transport);
  c.session.accessToken = 'pending-device-token'; c.save();
  await assert.rejects(c.checkSession(), e => e.code === 1403 && e.status === 403);
  assert.equal(c.status().loggedIn, false);
  assert.equal(c.status().hasToken, true);
  const resumed = new MobilletClient({ dataDir: path.dirname(c.file), fetchImpl: transport });
  await resumed.requestOtp();
  await resumed.verifyOtp('۱۲۳۴۵۶');
  assert.equal(resumed.status().loggedIn, true);
  assert.equal(resumed.status().trustedDevice, true);
  assert.deepEqual(calls, ['/user/', '/verification/generate-code', '/user/verify-mobile']);
});

test('direct login retains the captured device identity, even when credentials fail', async t => {
  let sent;
  const c = make(t, async (url, opts) => {
    sent = JSON.parse(opts.body);
    return response({ status: { code: 1006, message: 'invalid credentials' } });
  });
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  c.configure = async () => {
    c.secret = 'shared-secret';
    c.rsaPublicKey = rsa.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  };
  const identity = c.session.deviceUid;
  c.session.deviceInfo = { brandModel: 'Android Device', os: 'Android', osVersion: '14', brand: 'none' };
  await assert.rejects(c.login({ username: 'example', password: 'not-stored' }), e => e.code === 1006);
  assert.equal(sent.deviceInfo.deviceUid, identity);
  assert.equal(sent.deviceInfo.os, 'Android');
  assert.equal(sent.deviceInfo.osVersion, '14');
  const resumed = new MobilletClient({ dataDir: path.dirname(c.file) });
  assert.equal(resumed.session.deviceUid, identity);
  assert.equal(resumed.session.deviceInfo.os, 'Android');
  assert.equal(fs.readFileSync(c.file, 'utf8').includes('not-stored'), false);
});
