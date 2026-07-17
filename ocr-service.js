(() => {
  'use strict';

  const button = document.querySelector('#recognizeRecipeImages');
  const fileInput = document.querySelector('#recipeImageFiles');
  const output = document.querySelector('#recognizedRecipeText');
  const status = document.querySelector('#ocrStatus');

  if (!button || !fileInput || !output || !status) return;

  let running = false;
  let worker = null;
  let activePage = 0;
  let pageCount = 0;

  function setStatus(message) {
    status.textContent = message;
  }

  function progressLabel(message) {
    const phase = String(message.status || '').replace(/_/g, ' ');
    const percent = Number.isFinite(message.progress) ? ` ${Math.round(message.progress * 100)}%` : '';
    const page = pageCount ? `Image ${activePage} of ${pageCount}: ` : '';
    setStatus(`${page}${phase}${percent}`.trim());
  }

  async function imageToCanvas(file) {
    const bitmap = await createImageBitmap(file);
    const maxWidth = 1800;
    const scale = Math.min(2, maxWidth / bitmap.width, 1.75);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114);
      const contrasted = Math.max(0, Math.min(255, ((gray - 128) * 1.35) + 128));
      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
    }
    context.putImageData(imageData, 0, 0);
    return canvas;
  }

  async function getWorker() {
    if (worker) return worker;
    if (!globalThis.Tesseract?.createWorker) {
      throw new Error('The OCR library did not load. Check the internet connection and reopen Kitchen Companion.');
    }
    setStatus('Preparing the on-device OCR engine. The first use can take a minute…');
    worker = await globalThis.Tesseract.createWorker('eng', globalThis.Tesseract.OEM?.LSTM_ONLY, {
      logger: progressLabel,
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',
      langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'
    });
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: globalThis.Tesseract.PSM?.AUTO || '3'
    });
    return worker;
  }

  async function readImages(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (running) return;

    const files = [...fileInput.files];
    if (!files.length) {
      alert('Choose at least one recipe image first.');
      return;
    }

    running = true;
    pageCount = files.length;
    button.disabled = true;
    button.textContent = 'Reading…';
    const pages = [];
    const failures = [];

    try {
      const ocrWorker = await getWorker();
      for (let index = 0; index < files.length; index += 1) {
        activePage = index + 1;
        setStatus(`Preparing image ${activePage} of ${pageCount}…`);
        try {
          const canvas = await imageToCanvas(files[index]);
          const result = await ocrWorker.recognize(canvas, { rotateAuto: true });
          const text = String(result.data?.text || '').trim();
          if (text) pages.push(text);
          else failures.push(`${files[index].name}: no text found`);
          canvas.width = 1;
          canvas.height = 1;
        } catch (error) {
          console.error('OCR page failed', files[index].name, error);
          failures.push(`${files[index].name}: ${error.message}`);
        }
      }

      if (pages.length) {
        output.value = pages.join('\n\n--- Next image ---\n\n');
        output.focus();
        setStatus(failures.length
          ? `Finished with ${failures.length} image warning${failures.length === 1 ? '' : 's'}. Review the recognized text before parsing.`
          : 'Text recognition complete. Correct anything needed, then choose Parse and review.');
      } else {
        throw new Error(failures.join('; ') || 'No readable text was found.');
      }
    } catch (error) {
      console.error(error);
      setStatus(`Text recognition failed: ${error.message} You can still paste text into the review box.`);
    } finally {
      running = false;
      button.disabled = false;
      button.textContent = 'Read images';
      activePage = 0;
      pageCount = 0;
    }
  }

  button.addEventListener('click', readImages, { capture: true });

  window.addEventListener('pagehide', () => {
    worker?.terminate?.();
    worker = null;
  });
})();
