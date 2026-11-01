'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { beginLogin, finishLogin, resumeLogin, withSession } = require('../src/auth-flow');
const { ApiError } = require('../src/errors');
const { run } = require('../cli');

function fake() {
  const c = { session: {}, calls: [], state: 'logged_out' };
  c.status = () => ({ state: c.state, hasToken: c.state !== 'logged_out', loggedIn: c.state === 'authenticated', trustedDevice: c.state === 'otp_required' ? false : true });
  c.login = async body => { c.calls.push('login'); c.state = 'otp_required'; delete c.session.loginOtp; return { ...c.status(), deviceVerificationRequired: true }; };
  c.requestOtp = async () => { c.calls.push('sms'); c.session.loginOtp = { sentAt: Date.now() }; return { expiration: 120 }; };
  c.verifyOtp = async code => { c.calls.push('verify'); assert.equal(code, '123456'); c.state = 'authenticated'; delete c.session.loginOtp; };
  c.checkSession = async () => { c.calls.push('check'); return { ...c.status(), bankVerified: true }; };
  return c;
}

test('login starts SMS automatically; verification finishes the same session', async () => {
  const c = fake();
  const result = await beginLogin(c, { username: 'user', password: 'secret' });
  assert.equal(result.ok, true); assert.equal(result.otpRequired, true);
  assert.equal(result.otpSent, true); assert.equal(result.nextAction, 'verify_otp');
  assert.equal(result.bankVerified, false); assert.deepEqual(c.calls, ['login','sms']);
  const complete = await finishLogin(c,'123456');
  assert.equal(complete.ok,true); assert.equal(complete.otpRequired,false); assert.equal(complete.bankVerified,true);
  assert.deepEqual(c.calls,['login','sms','verify','check']);
});

test('manual SMS mode remains available and resuming never resends an existing challenge',async()=>{
  const c=fake();const result=await beginLogin(c,{username:'user',password:'secret',requestOtp:false});
  assert.equal(result.nextAction,'otp_request');assert.deepEqual(c.calls,['login']);
  await resumeLogin(c);await resumeLogin(c);
  assert.deepEqual(c.calls,['login','sms']);
});

test('SMS failure preserves pending login; password change does not send SMS',async()=>{
  const c=fake();c.requestOtp=async()=>{throw new ApiError('bank unavailable',502);};
  const result=await beginLogin(c,{username:'user',password:'secret'});
  assert.equal(result.otpRequired,true);assert.equal(result.otpSent,false);assert.equal(result.otpError.status,502);
  assert.equal(c.state,'otp_required');
  c.login=async()=>({shouldChangePassword:true,deviceVerificationRequired:true});
  const blocked=await beginLogin(c,{username:'user',password:'secret'});
  assert.equal(blocked.nextAction,'change_password_in_bank_app');assert.equal(blocked.ok,false);
});

test('CLI login resumes the pending code prompt without asking for credentials or another SMS',async()=>{
  const c=fake();await beginLogin(c,{username:'user',password:'secret'});
  let prompts=0;
  await run(['login'],{client:c,env:{},out(){},note(){},prompt:async(label,hidden)=>{prompts++;assert.equal(hidden,true);return '123456';}});
  assert.equal(prompts,1);assert.deepEqual(c.calls,['login','sms','verify','check']);
});

test('read reauthenticates at most once; writes and transport errors never replay',async()=>{
  const c=fake();c.state='authenticated';let renewals=0,operations=0;
  c.ensureSession=async()=>{renewals++;return {loggedIn:true,bankVerified:true};};
  await assert.rejects(withSession(c,async()=>{operations++;throw new ApiError('expired',401);},{credentials:{username:'u',password:'p'},readOnly:true}),e=>e.status===401);
  assert.equal(renewals,1);assert.equal(operations,2);
  renewals=0;operations=0;
  await assert.rejects(withSession(c,async()=>{operations++;throw new ApiError('expired',401);},{credentials:{username:'u',password:'p'},readOnly:false}));
  assert.equal(renewals,0);assert.equal(operations,1);
  await assert.rejects(withSession(c,async()=>{throw new ApiError('timeout',502);},{credentials:{username:'u',password:'p'},readOnly:true}));
  assert.equal(renewals,0);
  c.state='expired';operations=0;
  await assert.rejects(withSession(c,async()=>{operations++;throw new ApiError('expired',401);},{credentials:{username:'u',password:'p'},readOnly:true}));
  assert.equal(renewals,1);assert.equal(operations,1);
});

test('data requests pause with explicit next action until code verification completes',async()=>{
  const c=fake();await beginLogin(c,{username:'user',password:'secret'});let calls=0;
  await assert.rejects(withSession(c,async()=>{calls++;},{credentials:null,readOnly:true}),error=>error.status===403&&error.auth.otpRequired&&error.nextAction==='verify_otp');
  assert.equal(calls,0);assert.deepEqual(c.calls,['login','sms']);
});

test('CLI can request another code inside the same login prompt',async()=>{
  const c=fake();const answers=['resend','123456'];await beginLogin(c,{username:'user',password:'secret'});
  await run(['login'],{client:c,env:{},out(){},note(){},prompt:async()=>answers.shift()});
  assert.deepEqual(c.calls,['login','sms','sms','verify','check']);
});

test('password-change state cannot be bypassed by an interactive continuation',async()=>{
  const c=fake();c.status=()=>({state:'password_change_required',shouldChangePassword:true,trustedDevice:false});let calls=0;
  await assert.rejects(withSession(c,async()=>{calls++;},{credentials:null,onPending:async()=>{calls++;return {loggedIn:true,bankVerified:true};}}),e=>e.status===403&&e.nextAction==='change_password_in_bank_app');
  assert.equal(calls,0);
});

test('automatic renewal cannot silently switch to another configured account',async()=>{
  const c=fake();c.state='expired';c.session.username='first-user';let logins=0;
  c.ensureSession=async()=>{logins++;return {loggedIn:true,bankVerified:true};};
  const operation=async()=>{throw new Error('must not execute');};
  await assert.rejects(withSession(c,operation,{credentials:{username:'second-user',password:'secret'},readOnly:true}),e=>e.code==='SESSION_ACCOUNT_MISMATCH');
  delete c.session.username;c.session.source='browser-har';
  await assert.rejects(withSession(c,operation,{credentials:{username:'second-user',password:'secret'},readOnly:true}),e=>e.code==='SESSION_ACCOUNT_MISMATCH');
  assert.equal(logins,0);
});

test('HTTP legacy login/otp aliases and manual SMS mode preserve the data contract',async t=>{
  const {createApp}=require('../server');const c=fake();let reads=0;c.cards=async()=>{reads++;return {cards:[]};};
  const server=createApp(c,'key',{credentials:null}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const request=async(route,body)=>{const r=await fetch('http://127.0.0.1:'+server.address().port+route,{method:body===undefined?'GET':'POST',headers:{'x-api-key':'key','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  const start=await request('/login',{username:'user',password:'secret',requestOtp:false});assert.equal(start.data.nextAction,'otp_request');assert.equal(c.calls.includes('sms'),false);
  await request('/otp/request',{});const blocked=await request('/cards');assert.equal(blocked.status,403);assert.equal(blocked.data.auth.otpRequired,true);assert.equal(blocked.data.nextAction,'verify_otp');assert.equal(reads,0);
  const complete=await request('/otp',{code:'123456'});assert.equal(complete.data.bankVerified,true);
  assert.deepEqual((await request('/cards')).data,{cards:[]});assert.equal(reads,1);
});

test('HTTP data operations can renew with configured credentials but never replay transfers',async t=>{
  const {createApp}=require('../server');const c=fake();c.state='authenticated';let renewals=0,reads=0,writes=0;
  c.ensureSession=async()=>{renewals++;c.state='authenticated';return {...c.status(),bankVerified:true};};
  c.cards=async()=>{reads++;if(reads===1){c.state='logged_out';throw new ApiError('revoked',401);}return {cards:[]};};
  c.transferCard=async()=>{writes++;c.state='logged_out';throw new ApiError('expired',401);};
  const server=createApp(c,'key',{credentials:{username:'user',password:'secret'}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const base='http://127.0.0.1:'+server.address().port;const headers={'x-api-key':'key','content-type':'application/json'};
  const r=await fetch(base+'/v1/cards',{headers});assert.equal(r.status,200);assert.deepEqual(await r.json(),{cards:[]});assert.equal(reads,2);assert.equal(renewals,1);
  const transfer=await fetch(base+'/v1/transfers/card',{method:'POST',headers,body:'{}'});assert.equal(transfer.status,401);assert.equal(writes,1);assert.equal(renewals,1);
});
