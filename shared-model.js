(() => {
  'use strict';
  const arrays = {'shopping-list':['shoppingList','regularItems','stores'],pantry:['pantryItems'],'meal-plans':['mealPlanHistory']};
  const maps = {'shopping-list':['learnedStorePreferences','learnedShoppingGroups','learnedAisles'],pantry:[],'meal-plans':[]};
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
  const stable = value => JSON.stringify(canonical(value));
  function legacyId(value) {
    let a=2166136261,b=5381;
    for(const ch of stable(value)){a=Math.imul(a^ch.charCodeAt(0),16777619);b=Math.imul(b,33)^ch.charCodeAt(0);}
    return `legacy-${(a>>>0).toString(16)}-${(b>>>0).toString(16)}`;
  }
  const identifier = path => JSON.stringify(path);
  const safe = value => typeof value==='string' && value.length>0 && value.length<=300 && !['__proto__','constructor','prototype'].includes(value);
  function normalize(snapshot) {
    const result=JSON.parse(JSON.stringify(snapshot));
    for(const collection of Object.keys(arrays))for(const field of arrays[collection]){
      const values=result[collection]?.[field];if(!Array.isArray(values)||field==='stores')continue;
      const identity=value=>safe(value.id)?value.id:legacyId(value);
      const counts=new Map();values.forEach(value=>counts.set(identity(value),(counts.get(identity(value))||0)+1));
      const used=new Map();
      result[collection][field]=values.map(value=>{
        const base=identity(value);
        if(value.id===base&&counts.get(base)===1)return value;
        const cleaned=Object.fromEntries(Object.entries(value).filter(([key])=>!['updatedAt','lastUsedAt','lastSavedAt'].includes(key)));
        const content=legacyId([collection,field,base,cleaned]),occurrence=used.get(content)||0;used.set(content,occurrence+1);
        const id=counts.get(base)>1?`${content}-${occurrence}`:base;
        return {...value,id,...(value.id?{legacySourceId:value.id}:{})};
      });
    }
    return result;
  }
  function flatten(snapshot) {
    snapshot=normalize(snapshot);
    const rows={};
    const put=(collection,path,value)=>{
      if(!path.every(safe))throw new Error('Saved data contains an unsupported item identity. Export it for review.');
      const id=identifier(path),key=identifier([collection,id]);
      if(rows[key]){if(stable(rows[key].value)===stable(value)&&path[0]==='stores')return;throw new Error('Duplicate item identity. Both source copies were kept; export them for review.');}
      rows[key]={collection,id,path,value:canonical(value)};
    };
    for(const collection of Object.keys(arrays)){
      const bucket=snapshot[collection]||{};
      for(const field of arrays[collection])for(const value of bucket[field]||[]){
        const id=field==='stores'?value:String(value.id||legacyId(value));
        put(collection,[field,id],value);
      }
      for(const field of maps[collection])for(const [id,value] of Object.entries(bucket[field]||{}))put(collection,[field,id],value);
      if(collection==='meal-plans'){
        for(const [week,value] of Object.entries(bucket.mealPlans||{})){
          const {slots,...meta}=value;put(collection,['mealPlans',week,'meta'],meta);
          for(const [slot,entry] of Object.entries(slots||{}))put(collection,['mealPlans',week,'slots',slot],entry);
        }
        for(const section of ['template','recipes'])for(const [id,value] of Object.entries(bucket.mealPlannerPreferences?.[section]||{}))put(collection,['mealPlannerPreferences',section,id],value);
      }
    }
    return rows;
  }
  function valid(row) {
    if(!row||!arrays[row.collection]||!Array.isArray(row.path)||!row.path.every(safe)||identifier(row.path)!==row.id)return false;
    const [field,a,b]=row.path;
    if(arrays[row.collection].includes(field))return row.path.length===2 && (field==='stores'?typeof row.value==='string'&&row.value===a:row.value&&typeof row.value==='object'&&!Array.isArray(row.value)&&String(row.value.id||legacyId(row.value))===a);
    if(maps[row.collection].includes(field))return row.path.length===2;
    if(row.collection==='meal-plans'&&field==='mealPlans')return (row.path.length===3&&b==='meta')||(row.path.length===4&&b==='slots');
    return row.collection==='meal-plans'&&field==='mealPlannerPreferences'&&row.path.length===3&&['template','recipes'].includes(a);
  }
  function inflate(rows) {
    const snapshot={};
    for(const collection of Object.keys(arrays)){
      snapshot[collection]={};
      for(const field of arrays[collection])snapshot[collection][field]=[];
      for(const field of maps[collection])snapshot[collection][field]={};
    }
    Object.assign(snapshot['meal-plans'],{mealPlans:{},mealPlannerPreferences:{template:{},recipes:{}}});
    for(const row of Object.values(rows)){
      if(row.deleted)continue;
      if(!valid(row))throw new Error('Shared item data failed validation. Existing local data was kept.');
      const bucket=snapshot[row.collection],[field,a,b,c]=row.path;
      if(arrays[row.collection].includes(field))bucket[field].push(row.value);
      else if(maps[row.collection].includes(field))bucket[field][a]=row.value;
      else if(field==='mealPlans'){
        bucket.mealPlans[a]||={weekStart:a,slots:{}};
        if(b==='meta')Object.assign(bucket.mealPlans[a],row.value);
        else bucket.mealPlans[a].slots[c]=row.value;
      }else bucket.mealPlannerPreferences[a][b]=row.value;
    }
    return snapshot;
  }
  const api={flatten,inflate,valid,stable,identifier,normalize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else window.SKSharedModel=api;
})();
