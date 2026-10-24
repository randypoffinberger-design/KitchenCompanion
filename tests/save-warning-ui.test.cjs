const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const {loadFunctions}=require('./helpers/app-functions.cjs');
const root=path.resolve(__dirname,'..');

test('save warning is dismissible, stays in page flow, and does not cover navigation or backup controls',()=>{
  const dom=new JSDOM('<body><header><button id="menuBtn">Menu</button></header><main class="main"><button id="backup">Backup</button></main></body>');
  const context={document:dom.window.document,dismissedDurableError:'',householdSync:{stop(){}}};
  const {showDurableSaveError}=loadFunctions(['showDurableSaveError'],context);
  const error=Object.assign(new Error("Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing."),{name:'InvalidStateError'});
  showDurableSaveError(error);
  const notice=context.document.querySelector('#durableSaveNotice');
  assert.ok(notice);
  assert.equal(notice.parentElement.className,'main');
  assert.equal(notice.classList.contains('startup-recovery-notice'),false);
  assert.equal(context.document.querySelector('#menuBtn').disabled,false);
  assert.equal(context.document.querySelector('#backup').disabled,false);
  const dismiss=notice.querySelector('button');
  assert.equal(dismiss.textContent,'Dismiss');
  dismiss.click();
  assert.equal(context.document.querySelector('#durableSaveNotice'),null);
  showDurableSaveError(error);
  assert.equal(context.document.querySelector('#durableSaveNotice'),null,'the dismissed error must not immediately cover the app again');
  dom.window.close();
});

test('save warning styling is non-fixed so the hamburger and backup remain reachable',()=>{
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  const rule=css.match(/[.]durable-save-notice\{([^}]*)\}/)?.[1] || '';
  assert.match(rule,/position:relative/);
  assert.doesNotMatch(rule,/position:fixed/);
});

test('iPhone IndexedDB server warning offers reload and remains dismissible',()=>{
  const dom=new JSDOM('<body><header><button id="menuBtn">Menu</button></header><main class="main"><button id="backup">Backup</button></main></body>');
  let reloads=0;
  const context={document:dom.window.document,location:{reload(){reloads++;}},dismissedDurableError:'',householdSync:{stop(){}}};
  const {showDurableSaveError}=loadFunctions(['showDurableSaveError'],context);
  const error=Object.assign(new Error('An internal error was encountered in the Indexed Database server'),{name:'IndexedDBServerError',reloadRequired:true});
  showDurableSaveError(error);
  const notice=context.document.querySelector('#durableSaveNotice'),buttons=[...notice.querySelectorAll('button')];
  assert.match(notice.textContent,/not clearing stored data|without clearing stored data/i);
  assert.deepEqual(buttons.map(button=>button.textContent),['Reload SK','Dismiss']);
  assert.equal(context.document.querySelector('#menuBtn').disabled,false);assert.equal(context.document.querySelector('#backup').disabled,false);
  buttons[0].click();assert.equal(reloads,1);buttons[1].click();assert.equal(context.document.querySelector('#durableSaveNotice'),null);
  dom.window.close();
});
