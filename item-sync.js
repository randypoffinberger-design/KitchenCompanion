(() => {
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const uuid=()=>globalThis.crypto?.randomUUID?.()||`item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
 const meaningful=value=>Array.isArray(value)?value.map(meaningful):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>key!=='updatedAt').map(key=>[key,meaningful(value[key])])):value;
 const equal=(a,b)=>JSON.stringify(meaningful(a))===JSON.stringify(meaningful(b));
 const clone=value=>value===undefined?undefined:copy(value);
 function merge(base,local,remote){
  if(equal(local,remote))return {ok:true,value:clone(remote)};
  if(equal(local,base))return {ok:true,value:clone(remote)};
  if(equal(remote,base))return {ok:true,value:clone(local)};
  if(!base||!local||!remote||[base,local,remote].some(value=>typeof value!=='object'||Array.isArray(value)))return {ok:false};
  if([base,local,remote].every(item=>Array.isArray(item.lots)&&Math.abs(item.lots.reduce((sum,lot)=>sum+Number(lot.quantity),0)-Number(item.quantity))<1e-8)){
   const maps=[base,local,remote].map(item=>new Map(item.lots.map(lot=>[lot.id,lot])));
   if([base,local,remote].some((item,index)=>item.lots.some(lot=>!lot.id)||maps[index].size!==item.lots.length))return {ok:false};
   const lots=[];
   for(const id of new Set(maps.flatMap(map=>[...map.keys()]))){const lot=merge(...maps.map(map=>map.get(id)));if(!lot.ok)return {ok:false};if(lot.value!==undefined)lots.push(lot.value);}
   const metadata=merge(...[base,local,remote].map(item=>Object.fromEntries(Object.entries(item).filter(([key])=>!['lots','quantity'].includes(key)))));
   return metadata.ok?{ok:true,value:{...metadata.value,lots,quantity:lots.reduce((sum,lot)=>sum+Number(lot.quantity),0)}}:{ok:false};
  }
  const value={};
  for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
   if(key==='updatedAt'){value[key]=remote[key]||local[key];continue;}
   const part=merge(base[key],local[key],remote[key]);if(!part.ok)return {ok:false};if(part.value!==undefined)value[key]=part.value;
  }
  return {ok:true,value};
 }
 class SKItemSync {
  static merge=merge;
  constructor(client){this.client=client;}
  load(){
   const c=this.client,key=`serenityKitchen.items.v1:${c.scopeKey()}`;
   if(key!==this.key){this.key=key;this.data=JSON.parse(c.storage.getItem(key)||'null')||{cursor:0,remote:{},observed:{},pending:{},conflicts:[]};this.migrateQueue();}
   return this.data;
  }
  save(){this.client.storage.setItem(this.key,JSON.stringify(this.data));}
  model(){return window.SKSharedModel;}
  migrateQueue(){
   const d=this.data;
   const assign=changes=>{
    // Old cross-collection removals may be a Pantry transfer. Preserve that
    // boundary; unrelated old puts can safely become independent operations.
    const linked=changes.some(op=>op.operation==='remove')&&new Set(changes.map(op=>op.collection)).size>1;
    const group=uuid();for(const op of changes)op.transactionId ||= linked?group:uuid();
   };
   assign(Object.values(d.pending));
   for(const conflict of d.conflicts)assign(conflict.changes);
  }
  conflictedKeys(){return new Set(this.data.conflicts.flatMap(conflict=>conflict.changes.map(op=>this.model().identifier([op.collection,op.id]))));}
  stage(snapshot){
   const d=this.load(),rows=this.model().flatten(snapshot);
   const conflicted=this.conflictedKeys();
   const changed=[];
   for(const [key,row] of Object.entries(rows)){
    if(equal(d.observed[key],row))continue;
    const prior=d.pending[key];
    changed.push(key);
    d.pending[key]={collection:row.collection,id:row.id,operation:'put',payload:row,mutationId:uuid(),baseVersion:prior?prior.baseVersion:d.remote[key]?.version||0,basePayload:prior?prior.basePayload:d.remote[key]?.payload,transactionId:prior?.transactionId||uuid()};
   }
   for(const key of Object.keys(d.observed))if(!rows[key]){
    const old=d.observed[key],remote=d.remote[key];
    if(!remote&&!d.pending[key]&&!conflicted.has(key))continue;
    // A put may already be in flight. Keep the removal intent until its
    // acknowledgement or downloaded history proves whether the item exists.
    changed.push(key);
    d.pending[key]={collection:old.collection,id:old.id,operation:'remove',payload:old,mutationId:uuid(),baseVersion:d.pending[key]?.baseVersion??remote?.version??0,basePayload:d.pending[key]?.basePayload||remote?.payload,transactionId:d.pending[key]?.transactionId||uuid()};
   }
   // A local action that removes shopping entries and changes Pantry is a
   // transfer. Union existing dependent groups when an action touches them.
   if(changed.some(key=>d.pending[key].collection==='shopping-list'&&d.pending[key].operation==='remove')&&changed.some(key=>d.pending[key].collection==='pantry')){
    const groups=new Set(changed.map(key=>d.pending[key].transactionId)),transactionId=uuid();
    for(const [key,op] of Object.entries(d.pending))if(groups.has(op.transactionId))d.pending[key]={...op,transactionId};
   }
   d.observed=copy(rows);this.save();return rows;
  }
  visible(){
   const d=this.data,rows={};
   for(const [key,item] of Object.entries(d.remote))if(!item.deleted)rows[key]=item.payload;
   const overlay=change=>{const key=this.model().identifier([change.collection,change.id]);if(change.operation==='remove')delete rows[key];else rows[key]=change.payload;};
   d.conflicts.forEach(conflict=>conflict.changes.forEach(overlay));
   Object.values(d.pending).forEach(overlay);
   return rows;
  }
  reconcile(){
   const d=this.data,parked=[];d.archivedConflicts ||= [];
   // Reconsider old batch conflicts individually. Keep genuine conflicts but
   // free operations that never conflicted or now match the household.
   for(const conflict of d.conflicts){
    const blocked=new Set();
    for(const old of conflict.changes){
     const key=this.model().identifier([old.collection,old.id]),op=d.pending[key]||old,remote=d.remote[key];
     const same=op.operation==='remove'?(!remote||remote.deleted):remote&&!remote.deleted&&equal(op.payload,remote.payload);
     const safe=same||(remote?.version||0)===op.baseVersion;
     const combined=!safe&&op.operation==='put'&&remote&&!remote.deleted&&op.basePayload?merge(op.basePayload,op.payload,remote.payload):{ok:false};
     if(!safe&&!combined.ok)blocked.add(old.transactionId);
    }
    const changes=conflict.changes.filter(op=>blocked.has(op.transactionId));
    const converged=conflict.changes.filter(op=>!blocked.has(op.transactionId));
    if(converged.length)d.archivedConflicts.push({...copy(conflict),changes:copy(converged),archivedAt:new Date().toISOString(),reason:'automatically-reconciled'});
    for(const old of conflict.changes)if(!blocked.has(old.transactionId)){
     const key=this.model().identifier([old.collection,old.id]);d.pending[key] ||= old;
    }
    if(changes.length)parked.push({...conflict,changes,conflicts:conflict.conflicts.filter(op=>changes.some(change=>change.collection===op.collection&&change.id===op.id))});
   }
   d.conflicts=parked;
   const blocked=this.conflictedKeys();
   for(const [key,op] of Object.entries(d.pending)){
    if(blocked.has(key))continue;
    const remote=d.remote[key];
    if(op.operation==='remove'?(!remote||remote.deleted):remote&&!remote.deleted&&equal(op.payload,remote.payload)){delete d.pending[key];continue;}
    if((remote?.version||0)!==op.baseVersion&&op.operation==='put'&&remote&&!remote.deleted&&op.basePayload){
     const combined=merge(op.basePayload,op.payload,remote.payload);
     if(combined.ok)d.pending[key]={...op,payload:combined.value,basePayload:remote.payload,baseVersion:remote.version,mutationId:uuid()};
    }
   }
  }
  async apply(provider,context){
   const c=this.client,generation=c.changeGeneration,visible=this.visible(),snapshot=this.model().inflate(visible);
   c.assertContext(context);
   if(this.model().stable(this.model().flatten(provider()))!==this.model().stable(visible))await c.onRemoteState(snapshot,{itemReconciled:true});
   c.assertContext(context);
   if (generation !== c.changeGeneration) return false;
   this.data.observed=copy(visible);this.save();await c.beforeSync();
  }
  async sync(provider){
   const c=this.client,context=c.context(),generation=c.changeGeneration;
   this.stage(provider());await c.beforeSync();c.assertContext(context);
   const d=this.data,route=`/api/v1/households/${encodeURIComponent(c.config.activeHouseholdId)}/item-sync`;
   let page,cursor=d.cursor;
   do{
    page=await c.request(`${route}?since=${cursor}`,{method:'GET'});c.assertContext(context);
    for(const event of page.events||[]){const key=this.model().identifier([event.collection,event.id]);d.remote[key]=event;}
    const next=Number(page.cursor||cursor);if(page.hasMore&&next<=cursor)throw new Error('Item history did not advance.');cursor=next;
   }while(page.hasMore);
   if(generation!==c.changeGeneration){this.save();return false;}
   if(!d.inflight?.length)this.reconcile();
   while(Object.keys(d.pending).length||d.inflight?.length){
    const blockedKeys=this.conflictedKeys(),blockedGroups=new Set(Object.entries(d.pending).filter(([key])=>blockedKeys.has(key)).map(([,op])=>op.transactionId));
    const groups=new Map();
    for(const [key,op] of Object.entries(d.pending))if(!blockedKeys.has(key)&&!blockedGroups.has(op.transactionId)){
     const group=groups.get(op.transactionId)||[];group.push(op);groups.set(op.transactionId,group);
    }
    const changes=d.inflight?.length?copy(d.inflight):[];
    if(!changes.length)for(const group of groups.values()){if(changes.length&&changes.length+group.length>2000)break;changes.push(...group);}
    if(!changes.length)break;
    if(changes.length>2000)throw new Error('This change is too large to sync at once. Export a backup for support; your local data is saved.');
    d.inflight=copy(changes);this.save();await c.beforeSync();c.assertContext(context);
    let result;
    try{result=await c.request(route,{method:'POST',body:JSON.stringify({changes:changes.map(({collection,id,operation,payload,mutationId,baseVersion})=>({collection,id,operation,payload,mutationId,baseVersion}))})});}
    catch(error){if(error.status===409&&error.body?.conflicts)result=error.body;else throw error;}
    c.assertContext(context);
    if(result.conflicts?.length){
     const rejected=new Set(result.conflicts.map(conflict=>changes.find(op=>op.collection===conflict.collection&&op.id===conflict.id)?.transactionId));
     const parked=changes.filter(op=>rejected.has(op.transactionId));
     d.conflicts.push({id:uuid(),createdAt:new Date().toISOString(),changes:copy(parked),conflicts:copy(result.conflicts)});
     for(const op of parked){const key=this.model().identifier([op.collection,op.id]);if(d.pending[key]?.mutationId===op.mutationId)delete d.pending[key];}
     for(const conflict of result.conflicts)if(conflict.current){const key=this.model().identifier([conflict.collection,conflict.id]);d.remote[key]={...conflict.current,collection:conflict.collection,id:conflict.id};}
     d.inflight=null;this.reconcile();
     this.save();await c.beforeSync();continue;
    }
    for(const op of changes){
     const ack=result.applied?.find(a=>a.collection===op.collection&&a.id===op.id&&a.mutationId===op.mutationId);
     if(!ack)throw new Error('The server did not acknowledge an item operation. It is still saved for retry.');
     const key=this.model().identifier([op.collection,op.id]);
     d.remote[key]={...ack,payload:op.payload||d.remote[key]?.payload};
     if(d.pending[key]?.mutationId===op.mutationId)delete d.pending[key];
     else if(d.pending[key]){d.pending[key].baseVersion=ack.version;d.pending[key].basePayload=op.payload;}
    }
    d.inflight=null;this.reconcile();this.save();await c.beforeSync();
    if(generation!==c.changeGeneration)return false;
   }
   if(generation!==c.changeGeneration)return false;
   if (await this.apply(provider,context) === false) return false;
   // Only consume downloaded history after the profile and observed state save.
   d.cursor=cursor;this.save();await c.beforeSync();
   return !Object.keys(d.pending).length&&!d.conflicts.length;
  }
  async resolve(id,choice,provider){
   const c=this.client,context=c.context(),d=this.load();
   const conflict=d.conflicts.find(item=>item.id===id);
   if(!conflict||!['local','shared'].includes(choice))throw new Error('Choose a saved conflict and version.');
   const previous=copy(d);
   const related=new Set(conflict.changes.map(op=>d.pending[this.model().identifier([op.collection,op.id])]?.transactionId||op.transactionId));
   d.archivedConflicts ||= [];d.archivedConflicts.push({...copy(conflict),reason:`explicit-${choice}`,archivedAt:new Date().toISOString(),newerChanges:copy(Object.values(d.pending).filter(op=>related.has(op.transactionId)))});
   if(choice==='local')for(const old of conflict.changes){
    const key=this.model().identifier([old.collection,old.id]);
    const op=d.pending[key]||old,remote=d.remote[key];
    if(op.operation==='remove'&&!remote)continue;
    d.pending[key]={...op,mutationId:uuid(),baseVersion:remote?.version||0};
   }
   else for(const [key,op] of Object.entries(d.pending))if(related.has(op.transactionId))delete d.pending[key];
   d.conflicts=d.conflicts.filter(item=>item.id!==id);
   try{this.save();await c.beforeSync();await this.apply(provider,context);}
   catch(error){this.data=previous;this.save();throw error;}
  }
 }
 window.SKItemSync=SKItemSync;
})();
