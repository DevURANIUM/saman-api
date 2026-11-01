const $ = selector => document.querySelector(selector);
let stage = 'credentials', apiKey = '', busy = false;
function message(text, error = false) { $('#message').textContent = text; $('#message').classList.toggle('error',error); }
function changeStage(next) {
  stage = next;
  for (const id of ['credentials','verification','ready']) {
    const active = id === (next === 'otp' ? 'verification' : next);
    $('#'+id).hidden = !active;
    if ($('#'+id).tagName === 'FIELDSET') $('#'+id).disabled = !active;
  }
  $('#login-form').hidden = next === 'ready';
  $('#restart').hidden = next === 'credentials';
  $('#submit').textContent = next === 'otp' ? 'Verify code and sign in' : 'Sign in and continue';
  $('#resume').hidden = next !== 'credentials';
  document.querySelectorAll('.steps li').forEach(item => item.removeAttribute('aria-current'));
  $('#step-'+next).setAttribute('aria-current','step');
  if (next === 'otp') $('#otp-code').focus();
}
async function request(route, body = {}) {
  const response = await fetch('/v1'+route, { method:'POST', cache:'no-store', credentials:'same-origin',
    headers:{'Content-Type':'application/json',...(apiKey?{'x-api-key':apiKey}:{})},body:JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || 'The request failed.'); error.auth = result.auth; throw error; }
  return result;
}
async function action(fn) {
  if (busy) return;
  busy = true;document.querySelectorAll('button').forEach(button=>button.disabled=true);
  try { await fn(); }
  catch(error) {
    if (error.auth?.otpRequired) changeStage('otp');
    message(error.message || 'Could not connect to the service.',true);
  } finally { busy=false;document.querySelectorAll('button').forEach(button=>button.disabled=false); }
}
function handle(result) {
  if (result.shouldChangePassword) { message('Complete the required password change in the bank app.',true);return; }
  if (result.otpRequired) {
    changeStage('otp');
    message(result.otpSent ? 'A device verification code has been requested.' : 'Your credentials were accepted, but SMS delivery failed. Select Resend code.',!result.otpSent);
  } else if (result.bankVerified && result.loggedIn) { changeStage('ready');message('You are signed in.'); }
  else message('The session is not ready. Check your login status.',true);
}
$('#login-form').addEventListener('submit',event=>{
  event.preventDefault();
  if (!$('#login-form').reportValidity()) return;
  action(async()=>{
    if (stage === 'credentials') {
      apiKey=$('#api-key').value.trim();const body={username:$('#username').value.trim(),password:$('#password').value};
      $('#password').value='';
      handle(await request('/auth/login',body));
    } else {
      const code=$('#otp-code').value.trim();$('#otp-code').value='';handle(await request('/auth/otp',{code}));
    }
  });
});
$('#resend').addEventListener('click',()=>action(async()=>{await request('/auth/otp/request');message('A new verification code has been requested.');$('#otp-code').focus();}));
$('#resume').addEventListener('click',()=>action(async()=>{apiKey=$('#api-key').value.trim();const result=await request('/auth/session/ensure');if(result.credentialsRequired)message('Enter your username and password to start a session.');else handle(result);}));
$('#check').addEventListener('click',()=>action(async()=>handle(await request('/auth/session/check'))));
$('#logout').addEventListener('click',()=>action(async()=>{await request('/auth/logout');apiKey='';$('#login-form').reset();changeStage('credentials');message('You have signed out.');}));
$('#restart').addEventListener('click',()=>{if(busy)return;$('#password').value='';$('#otp-code').value='';changeStage('credentials');message('Enter your login credentials.');$('#username').focus();});
