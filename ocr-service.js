(() => {
  'use strict';

  const button = document.querySelector('#recognizeRecipeImages');
  const fileInput = document.querySelector('#recipeImageFiles');
  const output = document.querySelector('#recognizedRecipeText');
  const status = document.querySelector('#ocrStatus');
  const cleanupToggle = document.querySelector('#ocrCleanupToggle');
  const fallbackActions = document.querySelector('#ocrFallbackActions');
  const copyAiPrompt = document.querySelector('#copyAiRecipePrompt');
  const openPaste = document.querySelector('#openPasteFromOcr');
  if (!button || !fileInput || !output || !status) return;

  let running = false, worker = null, libraryPromise = null, activePage = 0, pageCount = 0;
  const MAX_CANVAS_PIXELS = 18_000_000;
  const MAX_CANVAS_EDGE = 10_000;
  const MIN_RECIPE_SCORE = 150;
  const OCR_ASSET_ROOT = new URL('./Vendor/tesseract-7.0.0/', document.baseURI).href;
  const AI_PROMPT = `Convert the attached recipe screenshot(s) into clean plain text. Include the recipe title, yield, prep and cook times, ingredients, instructions, and notes. Remove advertisements, navigation, social buttons, photo credits, repeated headers or footers, and duplicated text caused by overlapping screenshots. Preserve fractions and quantities exactly. Do not invent missing ingredients, quantities, times, or steps. Format the result with clear Ingredients and Instructions headings.`;

  function setStatus(message, showFallback = false) { status.textContent = message; if (fallbackActions) fallbackActions.hidden = !showFallback; }
  function progressLabel(message) { const phase=String(message.status||'').replace(/_/g,' '); const percent=Number.isFinite(message.progress)?` ${Math.round(message.progress*100)}%`:''; setStatus(`${pageCount?`Image ${activePage} of ${pageCount}: `:''}${phase}${percent}`.trim()); }

  function loadOcrLibrary() {
    if (globalThis.Tesseract?.createWorker) return Promise.resolve(globalThis.Tesseract);
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = window.setTimeout(() => {
        script.remove();
        libraryPromise = null;
        reject(new Error('The local OCR engine took too long to load. Use Settings → Repair offline OCR, then try again.'));
      }, 30000);
      script.src = `${OCR_ASSET_ROOT}tesseract.min.js`;
      script.async = true;
      script.onload = () => {
        window.clearTimeout(timeout);
        if (globalThis.Tesseract?.createWorker) resolve(globalThis.Tesseract);
        else {
          libraryPromise = null;
          reject(new Error('The OCR library downloaded but could not start.'));
        }
      };
      script.onerror = () => {
        window.clearTimeout(timeout);
        libraryPromise = null;
        reject(new Error('The local OCR package is missing. Connect once, then use Settings → Repair offline OCR.'));
      };
      document.head.append(script);
    });
    return libraryPromise;
  }

  async function loadBitmap(file) {
    if ('createImageBitmap' in window) return createImageBitmap(file);
    const url=URL.createObjectURL(file); try { const img=new Image(); await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;}); return img; } finally { URL.revokeObjectURL(url); }
  }

  function findContentBounds(ctx, width, height) {
    const sampleWidth=Math.min(320,width), sampleHeight=Math.min(480,height);
    const sample=document.createElement('canvas'); sample.width=sampleWidth; sample.height=sampleHeight;
    const sctx=sample.getContext('2d',{willReadFrequently:true}); sctx.drawImage(ctx.canvas,0,0,sampleWidth,sampleHeight);
    const data=sctx.getImageData(0,0,sampleWidth,sampleHeight).data;
    const rowSignal=new Array(sampleHeight).fill(0), colSignal=new Array(sampleWidth).fill(0);
    for(let y=0;y<sampleHeight;y++)for(let x=0;x<sampleWidth;x++){
      const i=(y*sampleWidth+x)*4, light=(data[i]+data[i+1]+data[i+2])/3;
      if(light>32){rowSignal[y]++;colSignal[x]++;}
    }
    const rowThreshold=sampleWidth*.12, colThreshold=sampleHeight*.08;
    let top=rowSignal.findIndex(v=>v>rowThreshold), bottom=sampleHeight-1-[...rowSignal].reverse().findIndex(v=>v>rowThreshold);
    let left=colSignal.findIndex(v=>v>colThreshold), right=sampleWidth-1-[...colSignal].reverse().findIndex(v=>v>colThreshold);
    if(top<0||bottom<=top){top=0;bottom=sampleHeight-1;} if(left<0||right<=left){left=0;right=sampleWidth-1;}
    const pad=4;
    top=Math.max(0,top-pad);bottom=Math.min(sampleHeight-1,bottom+pad);left=Math.max(0,left-pad);right=Math.min(sampleWidth-1,right+pad);
    return {x:Math.floor(left/sampleWidth*width),y:Math.floor(top/sampleHeight*height),width:Math.ceil((right-left+1)/sampleWidth*width),height:Math.ceil((bottom-top+1)/sampleHeight*height)};
  }

  function applyTreatment(ctx, width, height, mode) {
    if(mode==='raw')return;
    const image=ctx.getImageData(0,0,width,height), d=image.data, gray=new Uint8Array(width*height);
    for(let p=0,i=0;i<d.length;i+=4,p++) gray[p]=Math.round(d[i]*.299+d[i+1]*.587+d[i+2]*.114);
    if(mode==='threshold'){
      const radius=Math.max(8,Math.round(Math.min(width,height)/120)), integral=new Float64Array((width+1)*(height+1));
      for(let y=1;y<=height;y++){let row=0;for(let x=1;x<=width;x++){row+=gray[(y-1)*width+x-1];integral[y*(width+1)+x]=integral[(y-1)*(width+1)+x]+row;}}
      for(let y=0,p=0;y<height;y++)for(let x=0;x<width;x++,p++){
        const x1=Math.max(0,x-radius),x2=Math.min(width-1,x+radius),y1=Math.max(0,y-radius),y2=Math.min(height-1,y+radius);
        const sum=integral[(y2+1)*(width+1)+x2+1]-integral[y1*(width+1)+x2+1]-integral[(y2+1)*(width+1)+x1]+integral[y1*(width+1)+x1];
        const mean=sum/((x2-x1+1)*(y2-y1+1)), value=gray[p] < mean-13 ? 0 : 255, i=p*4; d[i]=d[i+1]=d[i+2]=value;
      }
    } else {
      const contrast=mode==='detail'?1.38:1.22;
      for(let p=0;p<gray.length;p++){const value=Math.max(0,Math.min(255,((gray[p]-128)*contrast)+128)),i=p*4;d[i]=d[i+1]=d[i+2]=value;}
    }
    ctx.putImageData(image,0,0);
  }

  async function makeCanvas(file, mode='balanced', region=null, rotation=0) {
    const bitmap=await loadBitmap(file); const sourceWidth=bitmap.width||bitmap.naturalWidth; const sourceHeight=bitmap.height||bitmap.naturalHeight;
    const source=document.createElement('canvas');source.width=sourceWidth;source.height=sourceHeight;const sourceCtx=source.getContext('2d',{willReadFrequently:true});sourceCtx.drawImage(bitmap,0,0);bitmap.close?.();
    const autoBounds=findContentBounds(sourceCtx,sourceWidth,sourceHeight), base=region?{
      x:autoBounds.x+Math.round(autoBounds.width*region.x),y:autoBounds.y+Math.round(autoBounds.height*region.y),
      width:Math.round(autoBounds.width*region.width),height:Math.round(autoBounds.height*region.height)
    }:autoBounds;
    const targetMinWidth=mode==='detail'||mode==='threshold'||mode==='raw'?2400:1900;
    let scale=Math.min(4, Math.max(1, targetMinWidth/base.width));
    const edgeScale=Math.min(MAX_CANVAS_EDGE/base.width,MAX_CANVAS_EDGE/base.height);
    const pixelScale=Math.sqrt(MAX_CANVAS_PIXELS/(base.width*base.height));
    scale=Math.max(0.25,Math.min(scale,edgeScale,pixelScale));
    const drawWidth=Math.max(1,Math.round(base.width*scale)), drawHeight=Math.max(1,Math.round(base.height*scale)), radians=rotation*Math.PI/180;
    const width=rotation?Math.ceil(Math.abs(drawWidth*Math.cos(radians))+Math.abs(drawHeight*Math.sin(radians))):drawWidth;
    const height=rotation?Math.ceil(Math.abs(drawHeight*Math.cos(radians))+Math.abs(drawWidth*Math.sin(radians))):drawHeight;
    const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
    ctx.save();ctx.translate(width/2,height/2);ctx.rotate(radians);ctx.drawImage(source,base.x,base.y,base.width,base.height,-drawWidth/2,-drawHeight/2,drawWidth,drawHeight);ctx.restore();
    source.width=1;source.height=1;applyTreatment(ctx,width,height,mode); return canvas;
  }

  async function getWorker() {
    if(worker)return worker;
    await loadOcrLibrary();
    setStatus('Preparing the local OCR engine…');
    worker=await globalThis.Tesseract.createWorker('eng',globalThis.Tesseract.OEM?.LSTM_ONLY,{logger:progressLabel,workerPath:`${OCR_ASSET_ROOT}worker.min.js`,corePath:`${OCR_ASSET_ROOT}core`,langPath:`${OCR_ASSET_ROOT}lang`});
    await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300',tessedit_pageseg_mode:globalThis.Tesseract.PSM?.AUTO||'3'}); return worker;
  }

  const instructionStart=/^(?:preheat|mix|combine|stir|add|place|bake|cook|heat|whisk|beat|fold|pour|serve|remove|let|chill|refrigerate|slice|cut|turn|knead|pat|brush|spread|sprinkle|bring|reduce|cover|drain|store|take|melt|whip|grease|line|freeze|dip|unravel|roll)\b/i;
  const ingredientUnits=/\b(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|lbs|pounds?|grams?|kg|ml|cloves?|cans?|packages?|pinch|dash|eggs?|flour|sugar|butter|cream|chocolate|salt|vanilla|cocoa|coffee|oil)\b/i;

  function textEvidence(text) {
    const lines=String(text||'').split(/\r?\n/).map(normalizeLine).filter(Boolean);
    let ingredientLines=0,instructionLines=0,garbageLines=0,coherentWords=0;
    for(const line of lines){
      const plain=line.replace(/^[-•*▪◦]+\s*/,'').replace(/^\d+[.)]\s*/,'').trim();
      const words=plain.match(/[A-Za-z]{2,}/g)||[],letters=(plain.match(/[A-Za-z]/g)||[]).length,visible=(plain.match(/[A-Za-z0-9]/g)||[]).length;
      const ingredient=/^(?:\d+(?:\s+\d+\/\d+|[ ./-]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|one|two|three|four|five|six|a|an)\b/i.test(plain)&&ingredientUnits.test(plain);
      const instruction=instructionStart.test(plain);
      if(ingredient)ingredientLines++;if(instruction)instructionLines++;
      if((plain.length<=3&&!ingredient)||visible&&letters/visible<.42||(/[=}{<>|]/.test(plain)&&words.length<4))garbageLines++;
      else coherentWords+=words.length;
    }
    const markers=(text.match(/ingredients?|instructions?|directions?|method|prep time|cook time|servings?|yield/gi)||[]).length;
    const broken=(text.match(/\b[A-Za-z]\s+[A-Za-z]\b/g)||[]).length;
    return {lines,ingredientLines,instructionLines,garbageLines,coherentWords,markers,broken};
  }

  function scoreText(text, confidence=0) {
    const e=textEvidence(text);
    return e.coherentWords+(e.markers*24)+(e.ingredientLines*14)+(e.instructionLines*18)+(confidence*1.8)-(e.garbageLines*20)-(e.broken*7);
  }

  function normalizeLine(line) {
    return line
      .replace(/[ \t]+/g,' ')
      .replace(/^[-•*▪◦«»+]+\s*/,'')
      .replace(/^(?:e|¢|©)\s+(?=(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞]|small\b|salt\b|extra\b|fresh\b))/i,'')
      .replace(/^[.,]\s+(?=(?:preheat|mix|combine|stir|add|place|put|take|bake|cook|heat|whisk|whip|beat|fold|pour|serve|remove|let|chill|refrigerate|freeze|slice|cut|spread|sprinkle|bring|reduce|cover|drain|dust|flip|roll|unroll|unravel|melt|dip)\b)/i,'')
      .replace(/\s+([,.;:!?])/g,'$1')
      .replace(/\bI\s*\/\s*2\b/gi,'1/2')
      .replace(/\bI\s*\/\s*4\b/gi,'1/4')
      .replace(/(\d)\s*\/\s*(\d)/g,'$1/$2')
      .replace(/\b(\d{1,2})\s+(\d{1,2})\s*(?=(?:seconds?|secs?|minutes?|mins?|hours?|hrs?)\b)/gi,(match,start,end)=>Number(start)<Number(end)?`${start}–${end} `:match)
      .replace(/\b(\d{1,2})\s+(?:to|[-–])\s+(\d{1,2})\s+(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/gi,'$1–$2 $3')
      .replace(/^([e°o])\s+(?=\d|l?eggs?\b)/i,'')
      .replace(/\b(\d)([1-7])\/([2348])\s+(?=(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|pounds?)\b)/gi,'$1 $2/$3 ')
      .replace(/^1?l\s*eggs?\b/i,'1 egg')
      .replace(/^(\d+)[lI|]eggs?\b/i,'$1 egg')
      .replace(/^(\d+)\s+directions?\s*:?\s*$/i,'Directions')
      .replace(/\bIna\s+(?=(?:medium|large|small|another|the)\b)/g,'In a ')
      .replace(/\b([1-7])[.]?\s+([2348])\s*(?=(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|pounds?)\b)/gi,(match,numerator,denominator)=>Number(numerator)<Number(denominator)?`${numerator}/${denominator} `:match)
      .replace(/^(?:I|l|\[|\|)\s*2\s+(?=(?:cups?|tbsp|tablespoons?|tsp|teaspoons?)\b)/i,'1/2 ')
      .replace(/^(?:I|l|\[|\|)\s+(?=(?:cups?|tbsp|tablespoons?|tsp|teaspoons?)\b)/i,'1 ')
      .replace(/^[)}]\s*(?=(?:tbsp|tablespoons?)\s+sugar\b)/i,'3 ')
      .replace(/\b(?:cofice|coflee|coftee|collec|cotlee)\b/gi,'coffee')
      .replace(/\bjalapefio\b/gi,'jalapeño')
      .replace(/\bcgg\b/gi,'egg')
      .replace(/\bhalr\b/gi,'half')
      .replace(/\bdivided in hall\b/gi,'divided in half')
      .replace(/\bseparatec\b/gi,'separated')
      .replace(/\bfuf(?:iy|ly)\b/gi,'fluffy')
      .replace(/\bQuy\b/g,'fluffy')
      .replace(/\bvolks\b/gi,'yolks')
      .replace(/\bmin until\b/gi,'mix until')
      .replace(/\bpicee\b/gi,'piece')
      .replace(/\bponder\b(?=[.,]?\s+(?:Flip|the cake|onto))/gi,'powder')
      .replace(/\bsin rectangles\b/gi,'six rectangles')
      .replace(/\bCutin\b/g,'Cut in')
      .replace(/\bhalfwidth\b/gi,'half width')
      .replace(/\bMixin\b/g,'Mix in')
      .replace(/\bMixwell\b/g,'Mix well')
      .replace(/\balayer\b/gi,'a layer')
      .replace(/\balaver\b/gi,'a layer')
      .replace(/\broll up tights\b/gi,'roll up tightly')
      .replace(/\boff['’]the\b/gi,'off the')
      .replace(/\ba(\d)\s*x\s*(\d+)\s+pan\b/gi,'a $1 x $2 pan')
      .replace(/\b(\d+)\s+\1[–-](\d+)\s+(?=(?:seconds?|minutes?|hours?)\b)/gi,'$1–$2 ')
      .replace(/\bhalf["”]\s+of\b/gi,'half of')
      .replace(/\bPour the wet into the dry\b/gi,'Pour the wet ingredients into the dry ingredients')
      .replace(/\bFreeze\s*\(or\b/gi,'Freeze for')
      .replace(/\bvour\b/gi,'your')
      .replace(/\bofthen\b/gi,'off the')
      .replace(/\bofthe\b/gi,'off the')
      .replace(/\ba?\s*9\s*x\s*(?:D?B|1\)|B)\s+pan\b/gi,'9 x 13 pan')
      .replace(/^\\?dd\b/i,'Add')
      .replace(/\b350\s+[1I|]\s+(?=(?:Grease|and)\b)/i,'350°F. ')
      .replace(/\s+(?:Do not sell or share my personal information|Terms of Content Use)[\s\S]*$/i,'')
      .replace(/\s+[|)]\s*$/,'')
      .replace(/\s+-\s*$/,'')
      .trim();
  }
  function cleanRecipeText(text, removeClutter=true) {
    const junk=[
      /^(?:save|share|print|rate|review|jump to recipe|skip to content|advertisement|sponsored|cookie settings|accept cookies|sign up|log in|subscribe)$/i,
      /^(?:select all|deselect all|check all|uncheck all|copy ingredients?|add to (?:shopping )?list|cook mode|keep screen awake)$/i,
      /^(?:facebook|pinterest|instagram|youtube|tiktok|x|twitter)$/i,
      /^(?:©|all rights reserved|privacy policy|terms of use)/i,
      /^(?:home|recipes|about|contact|menu)$/i,
      /^(?:open in app|download app|view comments|read more|show less)$/i,
      /^(?:learn more|see the list|drveganblog[.]com)$/i,
      /^(?:how to reset your cortisol belly|eat these foods every day)$/i,
      /^(?:enjoy a lifetime of firsts|live connected[.]? live invested[.]?|discover a resident-owned community)/i,
      /^(?:do not sell or share my personal information|terms of content use)[.]?$/i,
      /^.*https?:\/\/\S+.*$/i,
      /^information from your device\b/i,
      /^a raptive partner site\b/i,
      /^hp\s*[—-]?$/i,
      /^\d{1,2}:\d{2}\b.*(?:wifi|5g|[0-9]{1,3})/i,
      /^(?:deck out your dorm|our best price on gig wifi is here)/i,
      /^(?:nexdoo|keystone|xfinity|amazon)\b/i,
      /^(?:recipe\s+)?courtesy\s+of\b/i,
      /^(?:photo|photograph|image)\s+(?:by|courtesy|credit)\b/i,
      /^(?:written|posted|updated|published|reviewed)\s+by\b/i
    ];
    const repairedHeadings=String(text||'')
      .replace(/^[ \t]*I[ \t]*N[ \t]*G[ \t]*R[ \t]*E[ \t]*D[ \t]*I[ \t]*E[ \t]*N[ \t]*T[ \t]*S[ \t]*[:.]?[ \t]*$/gim,'\nINGREDIENTS\n')
      .replace(/^[ \t]*I[ \t]*N[ \t]*S[ \t]*T[ \t]*R[ \t]*U[ \t]*C[ \t]*T[ \t]*I[ \t]*O[ \t]*N[ \t]*S[ \t]*[:.]?[ \t]*$/gim,'\nINSTRUCTIONS\n')
      .replace(/^[ \t]*F[ \t]*I[ \t]*L[ \t]*L[ \t]*I[ \t]*N[ \t]*G[ \t]*[:.]?[ \t]*$/gim,'\nFILLING:\n')
      .replace(/^[ \t]*F[I1][ \t]+in[ \t]+N(?:G|6)?[ \t]*[:.]?[ \t]*$/gim,'\nFILLING:\n')
      .replace(/^[ \t]*T[ \t]*O[ \t]*P[ \t]*P[ \t]*I[ \t]*N[ \t]*G[ \t]*[:.]?[ \t]*$/gim,'\nTOPPING:\n')
      .replace(/^[ \t]*1?0[ \t]+PPI[ \t]+N[ \t]*G5?[ \t]*[:.]?[ \t]*$/gim,'\nTOPPING:\n');
    let lines=repairedHeadings
      .split(/\r?\n/)
      .flatMap(raw=>raw.split(/\s+(?=(?:(?:prep(?:aration)?|active|cook(?:ing)?)(?:\s*time)?|total\s*time)\s*[:：-]|(?:yield|serves|servings|makes)\s*[:：-])/i).map(part=>({
        raw:part,
        line:normalizeLine(part),
        bullet:/^\s*(?:[-•*▪◦]|[e¢©]\s+(?=(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞]|small\b|salt\b|extra\b|fresh\b)))/i.test(part),
        numbered:/^\s*\d{1,2}[.)]\s*/.test(part)
      })))
      .filter(entry=>entry.line)
      .filter(entry=>!/^\d+[.)]?$/.test(entry.line));
    if(removeClutter){
      let dropAttributionContinuation=false;
      lines=lines.filter(entry=>{
        const line=entry.line;
        const isAttribution=junk.slice(-3).some(rx=>rx.test(line));
        if(isAttribution){dropAttributionContinuation=true;return false;}
        if(dropAttributionContinuation&&/^[A-Z][A-Z'’-]{2,24}$/.test(line)){dropAttributionContinuation=false;return false;}
        dropAttributionContinuation=false;
        return !junk.some(rx=>rx.test(line));
      });
    }
    let section='meta', dropEquipmentIngredientTail=false; const joined=[];
    const ingredientStart=/^(?:\d+(?:\s+\d+\/\d+|[ ./-]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|one|two|three|four|five|six|small\s+handful|salt\b|extra\b)/i;
    const sectionHeading=/^(?:ingredients?|instructions?|directions?|method|steps|notes?|for\s+.+|equipment|nutrition)\s*:?[.]?$/i;
    for(const entry of lines){
      const h=entry.line.toLowerCase().replace(/[:.]$/,'').trim();
      if(/^ingredients?$/.test(h)){section='ingredients';dropEquipmentIngredientTail=false;}
      else if(/^(?:instructions?|directions?|method|steps)$/.test(h))section='instructions';
      else if(/^(?:equipment|nutrition)$/.test(h))section=h;
      if(section==='equipment'&&entry.bullet&&ingredientStart.test(entry.line)){dropEquipmentIngredientTail=true;continue;}
      if(dropEquipmentIngredientTail&&section==='equipment')continue;
      const previous=joined[joined.length-1];
      const continuation=previous&&!sectionHeading.test(entry.line)&&(
        (section==='ingredients'&&!entry.bullet&&!ingredientStart.test(entry.line))
        ||(section==='instructions'&&!entry.bullet&&!entry.numbered)
      );
      if(continuation)previous.line=`${previous.line} ${entry.line}`.replace(/-\s+/,'');
      else joined.push({line:entry.line,bullet:entry.bullet,numbered:entry.numbered});
    }
    const dedup=[]; for(const entry of joined){ const line=entry.line,key=line.toLowerCase().replace(/[^a-z0-9]/g,''); if(!key)continue; const recent=dedup.slice(-12).some(x=>x.key===key); if(!recent)dedup.push({...entry,line,key}); }
    return dedup.map(x=>x.bullet?`- ${x.line}`:x.line).join('\n').replace(/([a-z])-\n([a-z])/g,'$1$2').replace(/\n(?=(?:ingredients?|instructions?|directions?|method|steps|notes?|equipment|nutrition)\b)/gi,'\n\n');
  }

  const nutritionLabels = /\b(?:Calories|Carbohydrates?|Protein|Fat|Saturated(?: Fat)?|Polyunsaturated(?: Fat)?|Monounsaturated(?: Fat)?|Trans(?: Fat)?|Cholesterol|Sodium|Potassium|Fiber|Sugar|Vitamin A|Vitamin C|Calcium|Iron)\b/gi;
  function extractNutritionText(text) {
    let value=String(text||'').replace(/\r/g,'').trim();
    const heading=value.search(/\bNutrition\b/i),calories=value.search(/\bCalories\b/i);
    const start=heading>=0?heading:calories;
    if(start<0)return '';
    value=value.slice(start)
      .replace(/^.*?\bNutrition\b\s*:?[ \t]*/i,'')
      .replace(/\s+(?:https?:\/\/|Information from your device|A Raptive Partner Site|Do not sell or share my personal information|Terms of Content Use)[\s\S]*$/i,'')
      .split(/\n/)
      .map(normalizeLine)
      .filter(line=>line&&!/^hp\s*[—-]?$/i.test(line))
      .join('\n')
      .trim();
    return value?`Nutrition\n${value}`:'';
  }
  function nutritionTextScore(text) {
    const value=extractNutritionText(text),labels=value.match(nutritionLabels)||[];
    return new Set(labels.map(label=>label.toLowerCase())).size*100+(value.match(/\b\d+(?:[.]\d+)?\s*(?:kcal|cal|g|mg|mcg|iu|%)?\b/gi)||[]).length;
  }
  function chooseNutritionText(candidates) {
    return (candidates||[]).map(extractNutritionText).filter(Boolean).sort((a,b)=>nutritionTextScore(b)-nutritionTextScore(a)||b.length-a.length)[0]||'';
  }
  const lowerNutritionLabels = /\b(?:Fiber|Sugar|Vitamin A|Vitamin C|Calcium|Iron)\b/gi;
  function normalizeNutritionTailOcr(text) {
    return String(text||'')
      .replace(/\bF[i1l|][\s._-]*b[e3]r\b/gi,'Fiber')
      .replace(/\bSug[\s._-]*ar\b/gi,'Sugar')
      .replace(/\bVitam[i1l|]n\b/gi,'Vitamin')
      .replace(/\bCalc[i1l|]um\b/gi,'Calcium')
      .replace(/\b[lI|]ron\b/g,'Iron')
      .replace(/\b9[O0]IU\b/gi,'90IU')
      .replace(/\b[I|l]mg\b/g,'1mg');
  }
  function extractNutritionTailText(text) {
    let value=normalizeNutritionTailOcr(String(text||'').replace(/\r/g,''))
      .replace(/\s+(?:https?:\/\/|httos?:\/\/|Information from your device|A Raptive Partner Site|Do not sell or share my personal information|Terms of Content Use)[\s\S]*$/i,'')
      .split(/\n/).map(normalizeLine).filter(Boolean).join('\n').trim();
    const marker=value.match(/(?:\b\d+(?:[.]\d+)?\s*(?:mg|g|mcg|iu)?\s*\|\s*)?\b(?:Fiber|Sugar|Vitamin A|Vitamin C|Calcium|Iron)\b/i);
    if(!marker)return '';
    value=value.slice(marker.index).trim();
    const labels=value.match(lowerNutritionLabels)||[];
    return new Set(labels.map(label=>label.toLowerCase())).size>=2?value:'';
  }
  function nutritionTailScore(text) {
    const value=extractNutritionTailText(text),labels=value.match(lowerNutritionLabels)||[];
    return new Set(labels.map(label=>label.toLowerCase())).size*100+value.length;
  }
  function chooseNutritionTailText(candidates) {
    return (candidates||[]).map(extractNutritionTailText).filter(Boolean).sort((a,b)=>nutritionTailScore(b)-nutritionTailScore(a)||b.length-a.length)[0]||'';
  }
  function mergeNutritionText(head,tail) {
    if(!head)return tail?`Nutrition\n${tail}`:'';
    if(!tail||/\bIron\b/i.test(head))return head;
    return `${head.trim()}\n${tail.trim()}`;
  }
  function nutritionLooksTruncated(text) {
    const value=extractNutritionText(text);
    return Boolean(value&&/\b(?:Potassium|Fiber|Sugar|Vitamin A|Vitamin C|Calcium|Iron)\s*:\s*(?=\n|$)/i.test(value));
  }
  function mergeRecoveredNutritionTail(text,tail) {
    if(!tail)return text;
    const value=String(text||'').trim();
    if(/\bIron\s*:/i.test(value))return value;
    const unfinished=/\b(?:Potassium|Fiber|Sugar|Vitamin A|Vitamin C|Calcium|Iron)\s*:\s*(?=\n|$)/i;
    if(unfinished.test(value))return value.replace(unfinished,match=>`${match.trim()}\n${tail.trim()}\n`);
    return `${value}\n${tail.trim()}`;
  }

  function trimAuxiliarySections(page) {
    return String(page||'').trim();
  }

  function pageShouldBeIgnored(page, allPages=[]) {
    const text=trimAuxiliarySections(page), hasCore=/^(?:ingredients?|instructions?|directions?|method|steps)\b/im.test(text), hasAuxiliary=/^(?:equipment|nutrition)\b/im.test(text);
    if(!text)return true;
    if(hasCore||hasAuxiliary)return false;
    const laterHasCore=allPages.some(candidate=>candidate!==page&&/^(?:ingredients?|instructions?|directions?|method|steps)\b/im.test(String(candidate||'')));
    if(!laterHasCore)return false;
    return /\b(?:privacy policy|terms of content use|do not sell|calories:.*carbohydrates:|learn more|sponsored)\b/i.test(text);
  }

  function combinePages(pages) {
    const retained=pages.filter(page=>!pageShouldBeIgnored(page,pages)).map(trimAuxiliarySections).filter(Boolean);
    const result=[]; for(const page of retained){ const lines=page.split('\n').filter(Boolean); for(const line of lines){ const key=line.toLowerCase().replace(/[^a-z0-9]/g,''); if(!key)continue;
      if(/^(?:ingredients?|instructions?|directions?|method|steps|notes?|equipment|nutrition)\s*:?[.]?$/i.test(line.trim())){result.push({line,key:`section-${key}-${result.length}`});continue;}
      const start=Math.max(0,result.length-20);
      const duplicateIndex=result.findIndex((x,index)=>index>=start&&(x.key===key||(Math.min(key.length,x.key.length)>24&&(x.key.includes(key)||key.includes(x.key)))));
      if(duplicateIndex<0) result.push({line,key});
      else if(key.length>result[duplicateIndex].key.length) result[duplicateIndex]={line,key};
    } result.push({line:'',key:`break-${result.length}`}); }
    return result.map(x=>x.line).join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }

  function qualityMessage(text, score=0) {
    const e=textEvidence(text),structured=e.ingredientLines>=3&&e.instructionLines>=2,headed=/ingredients?/i.test(text)&&/instructions?|directions?|method/i.test(text);
    const garbageRatio=e.garbageLines/Math.max(1,e.lines.length);
    const instructionText=String(text||'').split(/\n(?=(?:instructions?|directions?|method|steps)\b)/i).pop()||'';
    const meaningfulTail=instructionText.split(/\r?\n/).map(normalizeLine).filter(line=>(line.match(/[A-Za-z]{2,}/g)||[]).length).slice(-1)[0]||'';
    const truncatedEnding=!/[.!?]$/.test(meaningfulTail)
      && (/\b(?:extra|the|and|into|with|to|of|your|a|an|for|until)$/i.test(meaningfulTail)
        || (meaningfulTail===meaningfulTail.toLowerCase()&&(meaningfulTail.match(/[A-Za-z]{2,}/g)||[]).length<=3));
    if(truncatedEnding)return {low:true,reason:'truncated',message:'Kitchen Companion appears to have lost the end of this recipe. You can still choose Parse and review, but compare the editor closely with the image and add any missing text.'};
    if(e.coherentWords<35 || (!structured&&!headed) || garbageRatio>.22 || score<MIN_RECIPE_SCORE) return {low:true,reason:'unreliable',message:'Kitchen Companion could not read parts of this image reliably. You can still choose Parse and review, but compare every field closely with the image and make manual corrections.'};
    return {low:false,reason:'good',message:'Text recognition complete. Review the text, then choose Parse and review.'};
  }

  async function recognizeBest(ocrWorker,file) {
    const attempts=[],plans=[
      {mode:'balanced',psm:globalThis.Tesseract.PSM?.AUTO||'3'},
      {mode:'detail',psm:globalThis.Tesseract.PSM?.SINGLE_COLUMN||'4'},
      {mode:'detail',psm:globalThis.Tesseract.PSM?.SPARSE_TEXT||'11'}
    ];
    for(const plan of plans){const canvas=await makeCanvas(file,plan.mode);try{
      await ocrWorker.setParameters({tessedit_pageseg_mode:plan.psm});const result=await ocrWorker.recognize(canvas,{rotateAuto:true});
      const text=String(result.data?.text||'').trim(),confidence=Number(result.data?.confidence||0),cleaned=cleanRecipeText(text,cleanupToggle?.checked!==false);attempts.push({text,confidence,score:scoreText(cleaned,confidence)});
    }finally{canvas.width=1;canvas.height=1;}}
    const layoutHints=attempts.map(attempt=>attempt.text).join('\n');
    if(/\b(?:cake|filling|topping)\s*[:.]?/i.test(layoutHints)){
      const titleSources=attempts.flatMap(attempt=>attempt.text.split(/\r?\n/).slice(0,12));
      for(const angle of [-15,-10]){const titleCanvas=await makeCanvas(file,'threshold',{x:.14,y:0,width:.86,height:.22},angle);try{
          await ocrWorker.setParameters({tessedit_pageseg_mode:globalThis.Tesseract.PSM?.SPARSE_TEXT||'11'});
          const titleResult=await ocrWorker.recognize(titleCanvas,{rotateAuto:false});
          const titleLines=String(titleResult.data?.text||'').split(/\r?\n/).map(normalizeLine).filter(line=>/[A-Za-z]{4,}/.test(line));
          titleSources.unshift(titleLines.join(' '),...titleLines);
        }finally{titleCanvas.width=1;titleCanvas.height=1;}}
      const titleHint=titleSources
        .map(normalizeLine)
        .filter(line=>{
          const words=line.match(/[A-Za-z]{2,}/g)||[];
          return words.length>=2&&words.length<=10
            && !/^(?:ingredients?|instructions?|directions?|method|cake|filling|topping)\s*:?\s*$/i.test(line)
            && !/^(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])/.test(line)
            && !/[.!?]\s*(?:preheat|mix|stir|add|bake|whip|fold|freeze|slice|cut|melt|dip)\b/i.test(line)
            && !/\b\d+\s*(?:seconds?|minutes?|hours?)\b/i.test(line);
        })
        .map((line,index)=>({
          line,index,
          score:(/\b(?:recipe|cake|rolls?|bread|soup|salad|sauce|cookies?|pie|pies|chicken|beef|pork|pasta|cider)\b/i.test(line)?40:0)
            + (/^[^a-z]*[A-Z][A-Z '&-]+$/.test(line)?12:0)
        }))
        .filter(candidate=>candidate.score>=40)
        .sort((a,b)=>b.score-a.score||a.index-b.index)[0]?.line;
      const regions=[
        {x:0,y:.08,width:.58,height:.40},
        {x:.55,y:.08,width:.45,height:.40},
        {x:0,y:.45,width:1,height:.55}
      ],regionTexts=[],regionConfidences=[];
      let recoveredEnding=false;
      for(let regionIndex=0;regionIndex<regions.length;regionIndex++){const canvas=await makeCanvas(file,'detail',regions[regionIndex]);try{
        const modes=regionIndex===2
          ? [globalThis.Tesseract.PSM?.SINGLE_COLUMN||'4',globalThis.Tesseract.PSM?.SINGLE_BLOCK||'6']
          : [globalThis.Tesseract.PSM?.SINGLE_COLUMN||'4'];
        const candidates=[];
        for(const psm of modes){
          await ocrWorker.setParameters({tessedit_pageseg_mode:psm});
          const result=await ocrWorker.recognize(canvas,{rotateAuto:false}),text=String(result.data?.text||'').trim(),confidence=Number(result.data?.confidence||0);
          const endingBonus=regionIndex===2
            ? (/\bmelt\b[\s\S]*\bdip\b/i.test(text)?60:0)+(/\blet dry\b/i.test(text)?30:0)
            : 0;
          candidates.push({text,confidence,score:scoreText(text,confidence)+endingBonus});
        }
        candidates.sort((a,b)=>b.score-a.score);const best=candidates[0];
        let selectedText=best?.text||'';
        if(regionIndex===2&&!/\bmelt\b/i.test(selectedText)){
          const supplements=attempts.map(attempt=>{
            const match=attempt.text.match(/\bMelt\b[\s\S]*/i),text=match?.[0]?.trim()||'';
            return {text,score:(/\bdip\b/i.test(text)?40:0)+(/\blet dry\b/i.test(text)?30:0)+(text.match(/[A-Za-z]{2,}/g)||[]).length};
          }).filter(item=>item.text).sort((a,b)=>b.score-a.score);
          if(supplements[0]?.text)selectedText+=`\n${supplements[0].text}`;
        }
        if(regionIndex===2&&!/\bmelt\b/i.test(selectedText)){
          const endingCandidates=[];
          const endingPlans=[
            {style:'detail',region:{x:0,y:.68,width:1,height:.32},psm:globalThis.Tesseract.PSM?.SINGLE_COLUMN||'4',rotateAuto:false},
            {style:'threshold',region:{x:0,y:.68,width:1,height:.32},psm:globalThis.Tesseract.PSM?.SINGLE_BLOCK||'6',rotateAuto:false},
            {style:'balanced',region:{x:0,y:.74,width:1,height:.26},psm:globalThis.Tesseract.PSM?.SINGLE_COLUMN||'4',rotateAuto:true},
            {style:'detail',region:{x:0,y:.74,width:1,height:.26},psm:globalThis.Tesseract.PSM?.SPARSE_TEXT||'11',rotateAuto:false},
            {style:'detail',region:{x:.02,y:.82,width:.96,height:.18},psm:globalThis.Tesseract.PSM?.SINGLE_BLOCK||'6',rotateAuto:false},
            {style:'threshold',region:{x:.02,y:.82,width:.96,height:.18},psm:globalThis.Tesseract.PSM?.SPARSE_TEXT||'11',rotateAuto:false}
          ];
          for(const plan of endingPlans){
            const endingCanvas=await makeCanvas(file,plan.style,plan.region);try{
                await ocrWorker.setParameters({tessedit_pageseg_mode:plan.psm});
                const endingResult=await ocrWorker.recognize(endingCanvas,{rotateAuto:plan.rotateAuto});
                const endingLines=String(endingResult.data?.text||'').split(/\r?\n/).map(normalizeLine).filter(Boolean);
                const meltIndex=endingLines.findIndex(line=>
                  /\bmelt\b/i.test(line)
                  || /\b(?:your\s+)?chocolate\b.*\b(?:tallow|crisco)\b.*\buntil\b/i.test(line)
                );
                if(meltIndex<0)continue;
                const suffix=[];
                for(const [lineIndex,line] of endingLines.slice(meltIndex).entries()){
                  if(suffix.length&&(line.match(/[A-Za-z]{2,}/g)||[]).length===0)break;
                  const meltMatch=line.match(/\bmelt\b/i);
                  const evidenceMatch=line.match(/\b(?:your\s+)?chocolate\b.*\b(?:tallow|crisco)\b.*\buntil\b/i);
                  let cleaned=line.replace(/^[-•*▪◦]+\s*/,'').trim();
                  if(lineIndex===0&&meltMatch)cleaned=line.slice(meltMatch.index).trim();
                  else if(lineIndex===0&&evidenceMatch){
                    const phrase=line.slice(evidenceMatch.index).trim();
                    cleaned=`Melt ${/^your\b/i.test(phrase)?'':'your '}${phrase}`;
                  }
                  suffix.push(cleaned);
                }
                const text=suffix.join(' ').replace(/\s+/g,' ').trim(),words=(text.match(/[A-Za-z]{2,}/g)||[]).length;
                if(words<8||!/^melt\b/i.test(text)||!/\bchocolate\b/i.test(text)||!/\b(?:dip|tallow|crisco)\b/i.test(text))continue;
                endingCandidates.push({
                  text,
                  score:words+(/\bdip\b/i.test(text)?80:0)+(/\bchocolate\b/i.test(text)?50:0)+(/\blet dry\b/i.test(text)?50:0)
                });
            }finally{endingCanvas.width=1;endingCanvas.height=1;}
          }
          endingCandidates.sort((a,b)=>b.score-a.score);
          if(endingCandidates[0]?.text){
            selectedText+=`\n${endingCandidates[0].text}`;
            recoveredEnding=true;
          }
        }
        if(selectedText)regionTexts.push(selectedText);regionConfidences.push(best?.confidence||0);
      }finally{canvas.width=1;canvas.height=1;}}
      if(regionTexts.length>=2){
        const text=combinePages(titleHint?[titleHint,...regionTexts]:regionTexts),confidence=regionConfidences.reduce((sum,value)=>sum+value,0)/regionConfidences.length;
        attempts.push({text,confidence,score:scoreText(text,confidence)+(recoveredEnding?300:45)});
      }
    }
    let nutritionSupplement='';
    if(/\b(?:Nutrition|Calories|Carbohydrates)\b/i.test(layoutHints)){
      const candidates=[...attempts.map(attempt=>attempt.text)],tailCandidates=[],plans=[
        {mode:'raw',region:{x:.01,y:.37,width:.98,height:.32},psm:globalThis.Tesseract.PSM?.SINGLE_BLOCK||'6'},
        {mode:'detail',region:{x:.01,y:.39,width:.98,height:.27},psm:globalThis.Tesseract.PSM?.SINGLE_BLOCK||'6'},
        {mode:'threshold',region:{x:.01,y:.38,width:.98,height:.30},psm:globalThis.Tesseract.PSM?.SINGLE_BLOCK||'6'},
        {mode:'raw',region:{x:.01,y:.30,width:.98,height:.42},psm:globalThis.Tesseract.PSM?.SINGLE_COLUMN||'4'},
        {mode:'raw',region:{x:.01,y:.48,width:.98,height:.19},psm:globalThis.Tesseract.PSM?.SINGLE_BLOCK||'6',tail:true},
        {mode:'detail',region:{x:.01,y:.46,width:.98,height:.22},psm:globalThis.Tesseract.PSM?.SINGLE_BLOCK||'6',tail:true}
      ];
      for(const plan of plans){const canvas=await makeCanvas(file,plan.mode,plan.region);try{
        await ocrWorker.setParameters({tessedit_pageseg_mode:plan.psm});
        const result=await ocrWorker.recognize(canvas,{rotateAuto:false});
        const text=String(result.data?.text||''); candidates.push(text); if(plan.tail)tailCandidates.push(text);
      }finally{canvas.width=1;canvas.height=1;}}
      nutritionSupplement=mergeNutritionText(chooseNutritionText(candidates),chooseNutritionTailText(tailCandidates));
    }
    attempts.sort((a,b)=>b.score-a.score);
    const selected=attempts[0]||{text:'',confidence:0,score:0};
    if(nutritionSupplement){
      const prefix=selected.text.replace(/\n?\s*Nutrition\b[\s\S]*$/i,'').trim();
      selected.text=`${prefix}${prefix?'\n':''}${nutritionSupplement}`;
    }
    return selected;
  }

  async function readImages(event) {
    event.preventDefault(); event.stopImmediatePropagation(); if(running)return; const files=[...fileInput.files]; if(!files.length)return alert('Choose at least one recipe image first.');
    running=true; pageCount=files.length; button.disabled=true; button.textContent='Reading…'; setStatus('Starting OCR…'); const pages=[],failures=[];
    try { const ocrWorker=await getWorker(); for(let i=0;i<files.length;i++){ activePage=i+1; setStatus(`Preparing image ${activePage} of ${pageCount}…`); try { const result=await recognizeBest(ocrWorker,files[i]); result.text=cleanRecipeText(result.text,cleanupToggle?.checked!==false); if(result.text)pages.push(result);else failures.push(`${files[i].name}: no text found`); } catch(error){console.error(error);failures.push(`${files[i].name}: ${error.message}`);} }
      if(!pages.length)throw new Error(failures.join('; ')||'No readable text was found.');
      let combined=combinePages(pages.map(page=>page.text));
      if(nutritionLooksTruncated(combined)){
        setStatus('Recovering the bottom of the Nutrition panel…');
        const tailCandidates=[];
        const tailPlans=[
          {mode:'raw',region:{x:.01,y:.45,width:.98,height:.25},psm:globalThis.Tesseract.PSM?.SINGLE_BLOCK||'6'},
          {mode:'detail',region:{x:.01,y:.47,width:.98,height:.23},psm:globalThis.Tesseract.PSM?.SINGLE_BLOCK||'6'},
          {mode:'threshold',region:{x:.01,y:.46,width:.98,height:.24},psm:globalThis.Tesseract.PSM?.SINGLE_COLUMN||'4'},
          {mode:'raw',region:{x:.01,y:.50,width:.98,height:.18},psm:globalThis.Tesseract.PSM?.SPARSE_TEXT||'11'}
        ];
        for(const file of files){for(const plan of tailPlans){const canvas=await makeCanvas(file,plan.mode,plan.region);try{
          await ocrWorker.setParameters({tessedit_pageseg_mode:plan.psm});
          const result=await ocrWorker.recognize(canvas,{rotateAuto:false});
          tailCandidates.push(String(result.data?.text||''));
        }finally{canvas.width=1;canvas.height=1;}}}
        combined=mergeRecoveredNutritionTail(combined,chooseNutritionTailText(tailCandidates));
      }
      output.value=combined; output.focus(); const overallScore=Math.min(...pages.map(page=>page.score)); const quality=qualityMessage(combined,overallScore); output.dataset.ocrQuality=quality.low?'low':'good'; output.dataset.ocrWarning=quality.reason; setStatus(`${quality.message}${failures.length?` ${failures.length} image warning${failures.length===1?'':'s'}.`:''}`,quality.low); globalThis.KCImageImportUi?.setStage('ready');
    } catch(error){console.error(error); try{await worker?.terminate?.();}catch{} worker=null; globalThis.KCImageImportUi?.setStage('select'); setStatus(`Text recognition failed: ${error.message} You can retry, use tighter screenshots, or paste converted text instead.`,true);} finally {running=false;button.disabled=false;button.textContent='Read images';activePage=0;pageCount=0;}
  }

  copyAiPrompt?.addEventListener('click',async()=>{ try{await navigator.clipboard.writeText(AI_PROMPT);setStatus('AI conversion instructions copied. Upload the screenshots to an AI service, then paste its cleaned recipe into Kitchen Companion.',true);}catch{prompt('Copy these instructions:',AI_PROMPT);} });
  openPaste?.addEventListener('click',()=>{ document.querySelector('#imageRecipeDialog')?.close(); const paste=document.querySelector('#pasteRecipeDialog'); const textarea=document.querySelector('#pastedRecipeText'); if(output.value.trim())textarea.value=output.value; paste?.showModal(); textarea?.focus(); });
  output.addEventListener('input',event=>{if(event.isTrusted&&output.dataset.ocrQuality==='low')output.dataset.ocrQuality='edited';});
  button.addEventListener('click',readImages,{capture:true}); window.addEventListener('pagehide',()=>{worker?.terminate?.();worker=null;});
  globalThis.__KitchenCompanionOcrTest = { cleanRecipeText, combinePages, trimAuxiliarySections, pageShouldBeIgnored, qualityMessage, scoreText, extractNutritionText, nutritionTextScore, chooseNutritionText, extractNutritionTailText, chooseNutritionTailText, mergeNutritionText, nutritionLooksTruncated, mergeRecoveredNutritionTail };
})();
