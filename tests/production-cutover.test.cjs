const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/../sync-client.js','utf8');
function harness(url){
 let saved={serverUrl:url,token:'preserved',recipeOwnershipVersion:2,recipeOwnershipMigrationComplete:true,cursors:{a:12},households:[]};
 const requests=[];
 const context={URL,window:{},localStorage:{getItem:()=>JSON.stringify(saved),setItem:(k,v)=>{saved=JSON.parse(v)}},fetch:async(url)=>{requests.push(url);return {ok:true,json:async()=>({ok:true})}}};
 vm.runInNewContext(source,context);
 const sync=new context.window.SKHouseholdSync();
 return {sync,requests,saved:()=>saved};
}
test('legacy production URLs migrate persistently, retaining account state',async()=>{
 for(const url of ['https://pj.tail96598f.ts.net','https://randys.tail96598f.ts.net/']){
  const h=harness(url);
  assert.equal(h.saved().serverUrl,'https://api.serenityvalleyworks.com/sk');
  assert.equal(h.saved().token,'preserved');assert.equal(h.saved().cursors.a,12);
  await h.sync.health();assert.equal(h.requests[0],'https://api.serenityvalleyworks.com/sk/health');
 }
});
test('custom and test URLs stay intact',()=>{
 for(const url of ['https://custom.example/path','https://randys.tail96598f.ts.net/sk-test-api']){
  assert.equal(harness(url).sync.serverUrl(),url);
 }
});
test('server setter retains cloud base path for API calls',async()=>{
 const h=harness('https://custom.example');
 h.sync.setServerUrl('https://api.serenityvalleyworks.com/sk/');
 await h.sync.request('/api/v1/me');
 assert.equal(h.requests[0],'https://api.serenityvalleyworks.com/sk/api/v1/me');
});

