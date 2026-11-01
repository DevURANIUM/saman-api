'use strict';
// Offline integration fixture. No bank client is constructed or contacted.
const { createApp } = require('../../server');
const client = { session: {}, state: 'logged_out' };
client.status = () => ({ state: client.state, loggedIn: client.state === 'authenticated', trustedDevice: client.state !== 'otp_required' });
client.login = async () => { client.state = 'otp_required'; return { ...client.status(), deviceVerificationRequired: true }; };
client.requestOtp = async () => { client.session.loginOtp = { sentAt: Date.now() }; return { expiration: 120 }; };
client.verifyOtp = async code => { if (code !== '000001') throw new Error('Unexpected test OTP'); client.state = 'authenticated'; delete client.session.loginOtp; };
client.checkSession = async () => ({ ...client.status(), bankVerified: true });
client.ensureSession = async () => ({ ...client.status(), bankVerified: client.state === 'authenticated' });
client.deposits = async () => ({ elements: [{ depositNumber: '000123', unknownBankField: { kept: true } }] });
client.accounts = client.deposits;
client.transactions = async query => ({ elements: [{ id: '000001', referenceNumber: '000000002', depositorName: 'Example', additional: { kept: true } }], hasNext: false, depositNumber: query.depositNumber });
const server = createApp(client, 'offline-test-key', { credentials: null }).listen(0, '127.0.0.1', () => console.log(server.address().port));
process.stdin.resume();
process.stdin.on('end', () => server.close());
