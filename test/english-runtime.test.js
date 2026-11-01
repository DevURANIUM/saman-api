'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {run}=require('../cli');

test('runtime source and sign-in UI contain no Persian or Arabic literals',()=>{
  const root=path.join(__dirname,'..');
  const files=[...fs.readdirSync(root).filter(name=>name.endsWith('.js')),
    ...fs.readdirSync(path.join(root,'src')).filter(name=>name.endsWith('.js')).map(name=>'src/'+name),
    ...fs.readdirSync(path.join(root,'src','auth-ui')).map(name=>'src/auth-ui/'+name)];
  for(const file of files)assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/\p{Script=Arabic}/u,file);
});

test('interactive login prompts and status messages are English',async()=>{
  const prompts=[],notes=[],answers=['example','secret','123456'];
  const client={login:async()=>({deviceVerificationRequired:true}),requestOtp:async()=>({}),verifyOtp:async()=>{},checkSession:async()=>({loggedIn:true,bankVerified:true})};
  await run(['login'],{client,env:{},prompt:async text=>{prompts.push(text);return answers.shift();},note:text=>notes.push(text),out(){}});
  assert.deepEqual(prompts,['Username: ','Password: ','SMS code (type resend for a new code): ']);
  for(const text of notes)assert.doesNotMatch(text,/\p{Script=Arabic}/u);
});
