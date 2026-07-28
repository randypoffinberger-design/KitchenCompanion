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
        reject(new Error('OCR download timed out. The rest of Kitchen Companion remains available offline.'));
      }, 30000);
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
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
        reject(new Error('Connect to the internet for the first OCR use, then try again.'));
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
    const targetMinWidth=mode==='detail'||mode==='threshold'?2400:1900;
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
    setStatus('Preparing the OCR engine. First use can take a minute…');
    worker=await globalThis.Tesseract.createWorker('eng',globalThis.Tesseract.OEM?.LSTM_ONLY,{logger:progressLabel,workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'});
    await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300',tessedit_pageseg_mode:globalThis.Tesseract.PSM?.AUTO||'3'}); return worker;
  }

  const instructionStart=/^(?:preheat|mix|combine|stir|add|place|bake|cook|heat|whisk|beat|fold|pour|serve|remove|let|chill|refrigerate|slice|cut|spread|sprinkle|bring|reduce|cover|drain|store|take|melt|whip|grease|line|freeze|dip|unravel|roll)\b/i;
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
      .replace(/\balayer\b/gi,'a layer')
      .replace(/\bFreeze\s*\(or\b/gi,'Freeze for')
      .replace(/\bvour\b/gi,'your')
      .replace(/\bofthen\b/gi,'off the')
      .replace(/\bofthe\b/gi,'off the')
      .replace(/\ba?\s*9\s*x\s*(?:D?B|1\)|B)\s+pan\b/gi,'9 x 13 pan')
      .replace(/^\\?dd\b/i,'Add')
      .replace(/\b350\s+[1I|]\s+(?=(?:Grease|and)\b)/i,'350°F. ')
      .replace(/\s+[|)]\s*$/,'')
      .replace(/\s+-\s*$/,'')
      .trim();
  }
  function cleanRecipeText(text) {
    const junk=[/^(save|share|print|rate|review|jump to recipe|skip to content|advertisement|sponsored|cookie settings|accept cookies|sign up|log in|subscribe)$/i,/^(facebook|pinterest|instagram|youtube|tiktok|x|twitter)$/i,/^©|all rights reserved|privacy policy|terms of use/i,/^(home|recipes|about|contact|menu)$/i,/^(open in app|download app|view comments)$/i];
    const repairedHeadings=String(text||'')
      .replace(/\bI\s*N\s*G\s*R\s*E\s*D\s*I\s*E\s*N\s*T\s*S\s*[:.]?/gi,'\nINGREDIENTS\n')
      .replace(/\bI\s*N\s*S\s*T\s*R\s*U\s*C\s*T\s*I\s*O\s*N\s*S\s*[:.]?/gi,'\nINSTRUCTIONS\n')
      .replace(/\bF\s*I\s*L\s*L\s*I\s*N\s*G\s*[:.]?/gi,'\nFILLING:\n')
      .replace(/\bF[I1]\s+in\s+N(?:G|6)?\s*[:.]?/gi,'\nFILLING:\n')
      .replace(/\bT\s*O\s*P\s*P\s*I\s*N\s*G\s*[:.]?/gi,'\nTOPPING:\n')
      .replace(/\b1?0\s+PPI\s*N\s*G5?\s*[:.]?/gi,'\nTOPPING:\n');
    let lines=repairedHeadings.split(/\r?\n/).map(normalizeLine).filter(Boolean).filter(line=>!junk.some(rx=>rx.test(line)));
    const dedup=[]; for(const line of lines){ const key=line.toLowerCase().replace(/[^a-z0-9]/g,''); if(!key)continue; const recent=dedup.slice(-12).some(x=>x.key===key); if(!recent)dedup.push({line,key}); }
    return dedup.map(x=>x.line).join('\n').replace(/([a-z])-\n([a-z])/g,'$1$2').replace(/\n(?=(?:ingredients?|instructions?|directions?|method|steps|notes?)\b)/gi,'\n\n');
  }

  function combinePages(pages) {
    const result=[]; for(const page of pages){ const lines=page.split('\n').filter(Boolean); for(const line of lines){ const key=line.toLowerCase().replace(/[^a-z0-9]/g,''); if(!key)continue; const duplicate=result.slice(-20).some(x=>x.key===key || (key.length>24 && (x.key.includes(key)||key.includes(x.key)))); if(!duplicate) result.push({line,key}); } result.push({line:'',key:`break-${result.length}`}); }
    return result.map(x=>x.line).join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }

  function qualityMessage(text, score=0) {
    const e=textEvidence(text),structured=e.ingredientLines>=3&&e.instructionLines>=2,headed=/ingredients?/i.test(text)&&/instructions?|directions?|method/i.test(text);
    const garbageRatio=e.garbageLines/Math.max(1,e.lines.length);
    if(e.coherentWords<35 || (!structured&&!headed) || garbageRatio>.22 || score<MIN_RECIPE_SCORE) return {low:true,message:'Kitchen Companion could not read this image reliably, so it will not send the result into the recipe editor. Try the original full-resolution photo, crop closer to the page, or use the AI conversion instructions.'};
    return {low:false,message:'Text recognition complete. Review the text, then choose Parse and review.'};
  }

  async function recognizeBest(ocrWorker,file) {
    const attempts=[],plans=[
      {mode:'balanced',psm:globalThis.Tesseract.PSM?.AUTO||'3'},
      {mode:'detail',psm:globalThis.Tesseract.PSM?.SINGLE_COLUMN||'4'},
      {mode:'detail',psm:globalThis.Tesseract.PSM?.SPARSE_TEXT||'11'}
    ];
    for(const plan of plans){const canvas=await makeCanvas(file,plan.mode);try{
      await ocrWorker.setParameters({tessedit_pageseg_mode:plan.psm});const result=await ocrWorker.recognize(canvas,{rotateAuto:true});
      const text=String(result.data?.text||'').trim(),confidence=Number(result.data?.confidence||0);attempts.push({text,confidence,score:scoreText(text,confidence)});
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
        if(regionIndex===2){
          attempts.forEach(attempt=>{
            const lines=attempt.text.split(/\r?\n/),start=lines.findIndex(line=>instructionStart.test(line.replace(/^[^A-Za-z]*\d+[.),]?\s*/,'').replace(/^[-•*▪◦]+\s*/,'').trim()));
            if(start<0)return;
            const text=lines.slice(start).join('\n').trim(),endingBonus=(/\bmelt\b[\s\S]*\bdip\b/i.test(text)?60:0)+(/\blet dry\b/i.test(text)?30:0);
            candidates.push({text,confidence:attempt.confidence,score:scoreText(text,attempt.confidence)+endingBonus});
          });
        }
        candidates.sort((a,b)=>b.score-a.score);const best=candidates[0];
        if(best?.text)regionTexts.push(best.text);regionConfidences.push(best?.confidence||0);
      }finally{canvas.width=1;canvas.height=1;}}
      if(regionTexts.length>=2){
        const text=combinePages(titleHint?[titleHint,...regionTexts]:regionTexts),confidence=regionConfidences.reduce((sum,value)=>sum+value,0)/regionConfidences.length;
        attempts.push({text,confidence,score:scoreText(text,confidence)+45});
      }
    }
    attempts.sort((a,b)=>b.score-a.score); return attempts[0]||{text:'',confidence:0,score:0};
  }

  async function readImages(event) {
    event.preventDefault(); event.stopImmediatePropagation(); if(running)return; const files=[...fileInput.files]; if(!files.length)return alert('Choose at least one recipe image first.');
    running=true; pageCount=files.length; button.disabled=true; button.textContent='Reading…'; setStatus('Starting OCR…'); const pages=[],failures=[];
    try { const ocrWorker=await getWorker(); for(let i=0;i<files.length;i++){ activePage=i+1; setStatus(`Preparing image ${activePage} of ${pageCount}…`); try { const result=await recognizeBest(ocrWorker,files[i]); if(cleanupToggle?.checked)result.text=cleanRecipeText(result.text); if(result.text)pages.push(result);else failures.push(`${files[i].name}: no text found`); } catch(error){console.error(error);failures.push(`${files[i].name}: ${error.message}`);} }
      if(!pages.length)throw new Error(failures.join('; ')||'No readable text was found.'); const combined=combinePages(pages.map(page=>page.text)); output.value=combined; output.focus(); const overallScore=Math.min(...pages.map(page=>page.score)); const quality=qualityMessage(combined,overallScore); output.dataset.ocrQuality=quality.low?'low':'good'; setStatus(`${quality.message}${failures.length?` ${failures.length} image warning${failures.length===1?'':'s'}.`:''}`,quality.low);
    } catch(error){console.error(error); try{await worker?.terminate?.();}catch{} worker=null; setStatus(`Text recognition failed: ${error.message} You can retry, use tighter screenshots, or paste converted text instead.`,true);} finally {running=false;button.disabled=false;button.textContent='Read images';activePage=0;pageCount=0;}
  }

  copyAiPrompt?.addEventListener('click',async()=>{ try{await navigator.clipboard.writeText(AI_PROMPT);setStatus('AI conversion instructions copied. Upload the screenshots to an AI service, then paste its cleaned recipe into Kitchen Companion.',true);}catch{prompt('Copy these instructions:',AI_PROMPT);} });
  openPaste?.addEventListener('click',()=>{ document.querySelector('#imageRecipeDialog')?.close(); const paste=document.querySelector('#pasteRecipeDialog'); const textarea=document.querySelector('#pastedRecipeText'); if(output.value.trim())textarea.value=output.value; paste?.showModal(); textarea?.focus(); });
  output.addEventListener('input',event=>{if(event.isTrusted&&output.dataset.ocrQuality==='low')output.dataset.ocrQuality='edited';});
  button.addEventListener('click',readImages,{capture:true}); window.addEventListener('pagehide',()=>{worker?.terminate?.();worker=null;});
})();
