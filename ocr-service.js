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

  let running = false, worker = null, activePage = 0, pageCount = 0;
  const MAX_CANVAS_PIXELS = 18_000_000;
  const MAX_CANVAS_EDGE = 10_000;
  const AI_PROMPT = `Convert the attached recipe screenshot(s) into clean plain text. Include the recipe title, yield, prep and cook times, ingredients, instructions, and notes. Remove advertisements, navigation, social buttons, photo credits, repeated headers or footers, and duplicated text caused by overlapping screenshots. Preserve fractions and quantities exactly. Do not invent missing ingredients, quantities, times, or steps. Format the result with clear Ingredients and Instructions headings.`;

  function setStatus(message, showFallback = false) { status.textContent = message; if (fallbackActions) fallbackActions.hidden = !showFallback; }
  function progressLabel(message) { const phase=String(message.status||'').replace(/_/g,' '); const percent=Number.isFinite(message.progress)?` ${Math.round(message.progress*100)}%`:''; setStatus(`${pageCount?`Image ${activePage} of ${pageCount}: `:''}${phase}${percent}`.trim()); }

  async function loadBitmap(file) {
    if ('createImageBitmap' in window) return createImageBitmap(file);
    const url=URL.createObjectURL(file); try { const img=new Image(); await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;}); return img; } finally { URL.revokeObjectURL(url); }
  }

  async function makeCanvas(file, mode='balanced') {
    const bitmap=await loadBitmap(file); const sourceWidth=bitmap.width||bitmap.naturalWidth; const sourceHeight=bitmap.height||bitmap.naturalHeight;
    const targetMinWidth=mode==='detail'?2200:1800;
    let scale=Math.min(3, Math.max(1, targetMinWidth/sourceWidth));
    const edgeScale=Math.min(MAX_CANVAS_EDGE/sourceWidth,MAX_CANVAS_EDGE/sourceHeight);
    const pixelScale=Math.sqrt(MAX_CANVAS_PIXELS/(sourceWidth*sourceHeight));
    scale=Math.max(0.25,Math.min(scale,edgeScale,pixelScale));
    const width=Math.max(1,Math.round(sourceWidth*scale)), height=Math.max(1,Math.round(sourceHeight*scale)); const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; ctx.drawImage(bitmap,0,0,width,height); bitmap.close?.();
    const image=ctx.getImageData(0,0,width,height), d=image.data;
    for(let i=0;i<d.length;i+=4){ const gray=d[i]*.299+d[i+1]*.587+d[i+2]*.114; let value;
      if(mode==='detail') value=Math.max(0,Math.min(255,((gray-128)*1.12)+128));
      else value=Math.max(0,Math.min(255,((gray-128)*1.22)+128));
      d[i]=d[i+1]=d[i+2]=value;
    }
    ctx.putImageData(image,0,0); return canvas;
  }

  async function getWorker() {
    if(worker)return worker;
    if(!globalThis.Tesseract?.createWorker) throw new Error('The OCR library did not load. Connect to the internet for the first OCR use, then reopen Kitchen Companion.');
    setStatus('Preparing the OCR engine. First use can take a minute…');
    worker=await globalThis.Tesseract.createWorker('eng',globalThis.Tesseract.OEM?.LSTM_ONLY,{logger:progressLabel,workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'});
    await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300',tessedit_pageseg_mode:globalThis.Tesseract.PSM?.AUTO||'3'}); return worker;
  }

  function scoreText(text) {
    const words=(text.match(/[A-Za-z]{2,}/g)||[]).length, recipeMarkers=(text.match(/ingredients?|instructions?|directions?|method|prep time|cook time|servings?|yield/gi)||[]).length;
    const broken=(text.match(/\b[A-Za-z]\s+[A-Za-z]\b/g)||[]).length; return words+(recipeMarkers*35)-(broken*4);
  }

  function normalizeLine(line) { return line.replace(/[ \t]+/g,' ').replace(/\s+([,.;:!?])/g,'$1').replace(/\bI\s*\/\s*2\b/gi,'1/2').replace(/\bI\s*\/\s*4\b/gi,'1/4').replace(/(\d)\s*\/\s*(\d)/g,'$1/$2').trim(); }
  function cleanRecipeText(text) {
    const junk=[/^(save|share|print|rate|review|jump to recipe|skip to content|advertisement|sponsored|cookie settings|accept cookies|sign up|log in|subscribe)$/i,/^(facebook|pinterest|instagram|youtube|tiktok|x|twitter)$/i,/^©|all rights reserved|privacy policy|terms of use/i,/^(home|recipes|about|contact|menu)$/i,/^(open in app|download app|view comments)$/i];
    let lines=text.split(/\r?\n/).map(normalizeLine).filter(Boolean).filter(line=>!junk.some(rx=>rx.test(line)));
    const dedup=[]; for(const line of lines){ const key=line.toLowerCase().replace(/[^a-z0-9]/g,''); if(!key)continue; const recent=dedup.slice(-12).some(x=>x.key===key); if(!recent)dedup.push({line,key}); }
    return dedup.map(x=>x.line).join('\n').replace(/([a-z])-\n([a-z])/g,'$1$2').replace(/\n(?=(?:ingredients?|instructions?|directions?|method|steps|notes?)\b)/gi,'\n\n');
  }

  function combinePages(pages) {
    const result=[]; for(const page of pages){ const lines=page.split('\n').filter(Boolean); for(const line of lines){ const key=line.toLowerCase().replace(/[^a-z0-9]/g,''); if(!key)continue; const duplicate=result.slice(-20).some(x=>x.key===key || (key.length>24 && (x.key.includes(key)||key.includes(x.key)))); if(!duplicate) result.push({line,key}); } result.push({line:'',key:`break-${result.length}`}); }
    return result.map(x=>x.line).join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }

  function qualityMessage(text) {
    const markers=(text.match(/ingredients?|instructions?|directions?|method/gi)||[]).length; const words=(text.match(/[A-Za-z]{2,}/g)||[]).length;
    if(words<25 || markers===0) return {low:true,message:'OCR finished, but the result does not look like a complete recipe. Review it, try tighter screenshots, or use the AI conversion instructions.'};
    return {low:false,message:'Text recognition complete. Review the text, then choose Parse and review.'};
  }

  async function recognizeBest(ocrWorker,file) {
    const attempts=[]; for(const mode of ['balanced','detail']){ const canvas=await makeCanvas(file,mode); try { const psm=mode==='detail'?(globalThis.Tesseract.PSM?.SINGLE_BLOCK||'6'):(globalThis.Tesseract.PSM?.AUTO||'3'); await ocrWorker.setParameters({tessedit_pageseg_mode:psm}); const result=await ocrWorker.recognize(canvas,{rotateAuto:true}); const text=String(result.data?.text||'').trim(); attempts.push({text,score:scoreText(text)}); } finally { canvas.width=1;canvas.height=1; } }
    attempts.sort((a,b)=>b.score-a.score); return attempts[0]?.text||'';
  }

  async function readImages(event) {
    event.preventDefault(); event.stopImmediatePropagation(); if(running)return; const files=[...fileInput.files]; if(!files.length)return alert('Choose at least one recipe image first.');
    running=true; pageCount=files.length; button.disabled=true; button.textContent='Reading…'; setStatus('Starting OCR…'); const pages=[],failures=[];
    try { const ocrWorker=await getWorker(); for(let i=0;i<files.length;i++){ activePage=i+1; setStatus(`Preparing image ${activePage} of ${pageCount}…`); try { let text=await recognizeBest(ocrWorker,files[i]); if(cleanupToggle?.checked)text=cleanRecipeText(text); if(text)pages.push(text);else failures.push(`${files[i].name}: no text found`); } catch(error){console.error(error);failures.push(`${files[i].name}: ${error.message}`);} }
      if(!pages.length)throw new Error(failures.join('; ')||'No readable text was found.'); const combined=combinePages(pages); output.value=combined; output.focus(); const quality=qualityMessage(combined); setStatus(`${quality.message}${failures.length?` ${failures.length} image warning${failures.length===1?'':'s'}.`:''}`,quality.low);
    } catch(error){console.error(error); try{await worker?.terminate?.();}catch{} worker=null; setStatus(`Text recognition failed: ${error.message} You can retry, use tighter screenshots, or paste converted text instead.`,true);} finally {running=false;button.disabled=false;button.textContent='Read images';activePage=0;pageCount=0;}
  }

  copyAiPrompt?.addEventListener('click',async()=>{ try{await navigator.clipboard.writeText(AI_PROMPT);setStatus('AI conversion instructions copied. Upload the screenshots to an AI service, then paste its cleaned recipe into Kitchen Companion.',true);}catch{prompt('Copy these instructions:',AI_PROMPT);} });
  openPaste?.addEventListener('click',()=>{ document.querySelector('#imageRecipeDialog')?.close(); const paste=document.querySelector('#pasteRecipeDialog'); const textarea=document.querySelector('#pastedRecipeText'); if(output.value.trim())textarea.value=output.value; paste?.showModal(); textarea?.focus(); });
  button.addEventListener('click',readImages,{capture:true}); window.addEventListener('pagehide',()=>{worker?.terminate?.();worker=null;});
})();
