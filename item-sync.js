(() => {
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const uuid=()=>globalThis.crypto?.randomUUID?.()||`item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
 class SKItemSync {
  constructor(client){this.client=client;}
  load(){
   const c=this.client,key=`serenityKitchen.items.v1:${c.scopeKey()}`;
   if(key!==this.key){this.key=key;this.data=JSON.parse(c.storage.getItem(key)||'null')||{cursor:0,remote:{},observed:{},pending:{},conflicts:[]};}
   return this.data;
  }
  save(){this.client.storage.setItem(this.key,JSON.stringify(this.data));}
  model(){return window.SKSharedModel;}
  conflictedKeys(){return new Set(this.data.conflicts.flatMap(conflict=>conflict.changes.map(op=>this.model().identifier([op.collection,op.id]))));}
  stage(snapshot){
   const d=this.load(),rows=this.model().flatten(snapshot),stable=this.model().stable;
   const conflicted=this.conflictedKeys();
   for(const [key,row] of Object.entries(rows)){
    if(stable(d.observed[key])===stable(row))continue;
    const prior=d.pending[key];
    d.pending[key]={collection:row.collection,id:row.id,operation:'put',payload:row,mutationId:uuid(),baseVersion:prior?prior.baseVersion:d.remote[key]?.version||0};
   }
   for(const key of Object.keys(d.observed))if(!rows[key]){
    const old=d.observed[key],remote=d.remote[key];
    if(!remote&&!d.pending[key]&&!conflicted.has(key))continue;
    // A put may already be in flight. Keep the removal intent until its
    // acknowledgement or downloaded history proves whether the item exists.
    d.pending[key]={collection:old.collection,id:old.id,operation:'remove',payload:old,mutationId:uuid(),baseVersion:d.pending[key]?.baseVersion??remote?.version??0};
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
   const conflicted=this.conflictedKeys();
   for(const [key,op] of Object.entries(d.pending)){
    // A newer edit must continue to overlay the parked local conflict, even
    // when the household already has this edit's result (such as a removal).
    if(conflicted.has(key))continue;
    const remote=d.remote[key];
    if(op.operation==='remove'&&!remote){delete d.pending[key];continue;}
    if(remote&&(op.operation==='remove'?remote.deleted:!remote.deleted&&this.model().stable(remote.payload)===this.model().stable(op.payload)))delete d.pending[key];
   }
   while(!d.conflicts.length&&Object.keys(d.pending).length){
    // Keep an entire local transaction together, including pantry transfers.
    const changes=Object.values(d.pending);
    if(changes.length>2000)throw new Error('This change is too large to sync at once. Export a backup for support; your local data is saved.');
    this.save();await c.beforeSync();c.assertContext(context);
    let result;
    try{result=await c.request(route,{method:'POST',body:JSON.stringify({changes})});}
    catch(error){if(error.status===409&&error.body?.conflicts)result=error.body;else throw error;}
    c.assertContext(context);
    if(result.conflicts?.length){
     d.conflicts.push({id:uuid(),createdAt:new Date().toISOString(),changes:copy(changes),conflicts:copy(result.conflicts)});
     for(const op of changes){const key=this.model().identifier([op.collection,op.id]);if(d.pending[key]?.mutationId===op.mutationId)delete d.pending[key];}
     for(const conflict of result.conflicts)if(conflict.current){const key=this.model().identifier([conflict.collection,conflict.id]);d.remote[key]={...conflict.current,collection:conflict.collection,id:conflict.id};}
     this.save();await c.beforeSync();break;
    }
    for(const op of changes){
     const ack=result.applied?.find(a=>a.collection===op.collection&&a.id===op.id&&a.mutationId===op.mutationId);
     if(!ack)throw new Error('The server did not acknowledge an item operation. It is still saved for retry.');
     const key=this.model().identifier([op.collection,op.id]);
     d.remote[key]={...ack,payload:op.payload||d.remote[key]?.payload};
     if(d.pending[key]?.mutationId===op.mutationId)delete d.pending[key];
     else if(d.pending[key])d.pending[key].baseVersion=ack.version;
    }
    this.save();await c.beforeSync();
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
   if(choice==='local')for(const old of conflict.changes){
    const key=this.model().identifier([old.collection,old.id]);
    const op=d.pending[key]||old,remote=d.remote[key];
    if(op.operation==='remove'&&!remote)continue;
    d.pending[key]={...op,mutationId:uuid(),baseVersion:remote?.version||0};
   }
   else for(const op of conflict.changes)delete d.pending[this.model().identifier([op.collection,op.id])];
   d.conflicts=d.conflicts.filter(item=>item.id!==id);
   try{this.save();await c.beforeSync();await this.apply(provider,context);}
   catch(error){this.data=previous;this.save();throw error;}
  }
 }
 window.SKItemSync=SKItemSync;
})();
