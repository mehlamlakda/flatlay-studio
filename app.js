/* ==========================================
   FLATLAY STUDIO — app.js
   Hugging Face API (FREE) — Stable Diffusion XL
   ========================================== */

// ── STATE ──────────────────────────────────
const state = {
  apiKey: '',
  connected: false,
  count: 6,
  uploadedImage: null,
  uploadedMime: null,
  gallery: [],
  generating: false,
};

// HF model — SDXL is best for product photography
const HF_MODEL = 'stabilityai/stable-diffusion-xl-base-1.0';
const HF_API   = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

// ── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('fs_hf_key');
  if (saved) {
    document.getElementById('api-key').value = saved;
    state.apiKey = saved;
    updateStatusUI('saved', 'Key loaded ✓');
  }
  updatePrompt();
  updateGenBtn();
});

// ── API KEY ────────────────────────────────
document.getElementById('api-key').addEventListener('input', (e) => {
  state.apiKey = e.target.value.trim();
  state.connected = false;
  updateStatusUI('idle', 'Not verified');
  updateGenBtn();
});

function toggleKey() {
  const input = document.getElementById('api-key');
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function testConnection() {
  const key = document.getElementById('api-key').value.trim();
  if (!key) { showToast('Enter your Hugging Face token first', 'error'); return; }
  if (!key.startsWith('hf_')) { showToast('Token should start with hf_', 'error'); return; }
  state.apiKey = key;
  updateStatusUI('loading', 'Testing...');

  try {
    // Test by hitting the model info endpoint
    const res = await fetch(
      `https://huggingface.co/api/models/${HF_MODEL}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (res.ok || res.status === 200) {
      state.connected = true;
      localStorage.setItem('fs_hf_key', key);
      updateStatusUI('connected', 'Connected ✓');
      showToast('Hugging Face connected! Ready to generate.', 'success');
    } else {
      state.connected = false;
      updateStatusUI('error', 'Invalid token');
      showToast('Invalid token — check it starts with hf_', 'error');
    }
  } catch {
    // Network error — still allow generating (HF sometimes blocks OPTIONS)
    state.connected = true;
    localStorage.setItem('fs_hf_key', key);
    updateStatusUI('connected', 'Ready (unverified)');
    showToast('Token saved — will verify on first generation', 'success');
  }
  updateGenBtn();
}

function updateStatusUI(status, label) {
  const dot = document.getElementById('status-dot');
  const lbl = document.getElementById('status-label');
  dot.className = 'status-dot';
  if (status === 'connected' || status === 'saved') dot.classList.add('connected');
  if (status === 'error') dot.classList.add('error');
  lbl.textContent = label;
}

// ── IMAGE UPLOAD ───────────────────────────
function dragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('dragover');
}
function dragLeave(e) {
  document.getElementById('upload-zone').classList.remove('dragover');
}
function dropFile(e) {
  e.preventDefault();
  dragLeave(e);
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}
function handleFile(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}
function processFile(file) {
  if (!file.type.startsWith('image/')) { showToast('Please upload an image file', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target.result;
    state.uploadedImage = result.split(',')[1];
    state.uploadedMime  = file.type;
    document.getElementById('preview-img').src = result;
    document.getElementById('upload-content').style.display = 'none';
    document.getElementById('upload-preview').style.display = 'block';
    showToast('Reference photo added');
    updatePrompt();
  };
  reader.readAsDataURL(file);
}
function removeImage(e) {
  e.stopPropagation();
  state.uploadedImage = null;
  state.uploadedMime  = null;
  document.getElementById('preview-img').src = '';
  document.getElementById('upload-content').style.display = 'block';
  document.getElementById('upload-preview').style.display = 'none';
  document.getElementById('file-input').value = '';
  updatePrompt();
}

// ── PREFERENCE SELECTORS ───────────────────
function selectChip(el, groupId) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  updatePrompt();
}
function selectCard(el, groupId) {
  document.querySelectorAll(`#${groupId} .type-card`).forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  updatePrompt();
}
function toggleMulti(el) {
  el.classList.toggle('active');
  updatePrompt();
}
function changeCount(delta) {
  state.count = Math.max(3, Math.min(9, state.count + delta));
  document.getElementById('count-num').textContent = state.count;
  document.getElementById('gen-count').textContent = `${state.count} images`;
}

// ── PREFERENCE GETTERS ─────────────────────
function getVal(groupId, selector = '.chip') {
  const el = document.querySelector(`#${groupId} ${selector}.active`);
  return el ? el.dataset.val : '';
}
function getMultiVals(groupId) {
  return [...document.querySelectorAll(`#${groupId} .chip.active`)].map(e => e.dataset.val);
}

// ── PROMPT BUILDER ─────────────────────────
const ANGLE_VARIANTS = [
  'perfectly symmetrical flatlay, garments neatly folded and centred',
  'artfully relaxed arrangement, organic and lifestyle styling',
  'close-up detail flatlay emphasising fabric texture and print',
  'full outfit spread, each piece separated and fanned out',
  'diagonal composition, asymmetric elegant styling',
  'minimal flatlay, single hero piece centred, lots of negative space',
  'layered styling, garments partially overlapping naturally',
  'accessory-forward composition, props as equal design elements',
  'wide-angle flatlay showing full outfit and all accessories together',
];

// Strong negative prompt to keep images clean for e-commerce
const NEGATIVE_PROMPT =
  'person, human, model, mannequin, body parts, hands, face, ' +
  'text, watermark, logo, signature, blurry, low quality, ' +
  'distorted, ugly, bad anatomy, extra limbs, dark, grainy, noise, ' +
  'cropped, out of frame, duplicate';

function buildPrompt(angleVariant = '') {
  const cat    = getVal('cat-group');
  const type   = getVal('type-group', '.type-card');
  const fabric = getVal('fabric-group');
  const print  = getVal('print-group');
  const tone   = getVal('tone-group', '.tone-btn');
  const bg     = getVal('bg-group', '.type-card');
  const light  = getVal('light-group');
  const props  = getMultiVals('props-group');

  const propsStr = props.length ? `, ${props.join(', ')} as props` : '';
  const angle    = angleVariant ? `, ${angleVariant}` : '';

  return (
    `product flatlay photography, ${type} loungewear for ${cat}, ` +
    `${print} pattern, ${fabric}, ${tone} color palette, ` +
    `arranged on ${bg}${propsStr}, ` +
    `${light}, overhead top-down view, 90 degree angle${angle}, ` +
    `professional e-commerce photography, sharp focus, 4k, ` +
    `studio quality, no people, clean background, commercial product shot`
  );
}

function updatePrompt() {
  document.getElementById('prompt-preview').textContent = buildPrompt();
  updateGenBtn();
}

function copyPromptPreview() {
  navigator.clipboard.writeText(document.getElementById('prompt-preview').textContent)
    .then(() => showToast('Prompt copied!'));
}

function updateGenBtn() {
  const btn = document.getElementById('gen-btn');
  btn.disabled = state.generating;
}

// ── GENERATE ───────────────────────────────
async function generate() {
  const key = document.getElementById('api-key').value.trim();
  if (!key) {
    showToast('Paste your Hugging Face token first ↑', 'error');
    document.getElementById('api-key').focus();
    return;
  }
  state.apiKey = key;

  state.generating = true;
  const btn      = document.getElementById('gen-btn');
  const genLabel = document.getElementById('gen-label');
  btn.disabled   = true;
  genLabel.textContent = 'Generating...';
  document.getElementById('gen-count').textContent = `0 / ${state.count}`;
  document.getElementById('output-section').style.display  = 'block';
  document.getElementById('progress-section').style.display = 'block';
  document.getElementById('gallery-hint').style.display    = 'none';
  document.getElementById('progress-bar').style.width      = '0%';

  // Build empty loading grid
  const grid = document.getElementById('output-grid');
  grid.innerHTML = '';
  for (let i = 0; i < state.count; i++) {
    const cell = document.createElement('div');
    cell.className = 'output-cell loading';
    cell.id = `cell-${i}`;
    cell.innerHTML = `<div class="loading-dot"></div><p class="loading-text">Generating ${i + 1}...</p>`;
    grid.appendChild(cell);
  }

  // Generate sequentially to avoid HF rate limits (free tier = 1 req at a time)
  let done = 0;
  for (let i = 0; i < state.count; i++) {
    await generateOne(i, ANGLE_VARIANTS[i % ANGLE_VARIANTS.length]);
    done++;
    const pct = Math.round((done / state.count) * 100);
    document.getElementById('progress-bar').style.width   = `${pct}%`;
    document.getElementById('progress-text').textContent  = `${done} of ${state.count} done...`;
    document.getElementById('gen-count').textContent      = `${done} / ${state.count}`;
  }

  state.generating = false;
  btn.disabled     = false;
  genLabel.textContent = 'Generate Again';
  document.getElementById('gen-count').textContent     = `${state.count} images`;
  document.getElementById('progress-text').textContent = `✓ All ${state.count} images ready!`;

  if (state.gallery.length > 0) {
    document.getElementById('gallery-section').style.display = 'block';
    renderGallery();
  }
  showToast(`${done} flatlays generated!`, 'success');
}

async function generateOne(index, angleVariant) {
  const cell   = document.getElementById(`cell-${index}`);
  const prompt = buildPrompt(angleVariant);

  try {
    const body = {
      inputs: prompt,
      parameters: {
        negative_prompt: NEGATIVE_PROMPT,
        width: 1024,
        height: 1024,
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
    };

    const res = await fetchWithRetry(HF_API, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${state.apiKey}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true',   // wait if model is loading (cold start)
      },
      body: JSON.stringify(body),
    }, 3);

    if (!res.ok) {
      const txt = await res.text();
      let msg = `Error ${res.status}`;
      try { msg = JSON.parse(txt)?.error || msg; } catch {}
      throw new Error(msg);
    }

    // HF returns raw image bytes (blob)
    const blob = await res.blob();
    const src  = URL.createObjectURL(blob);

    cell.className = 'output-cell';
    cell.innerHTML = `
      <img src="${src}" alt="Flatlay ${index + 1}" loading="lazy" />
      <div class="cell-overlay">
        <button class="cell-btn" onclick="downloadBlob('${src}', ${index + 1})">⬇ Download</button>
        <button class="cell-btn" onclick="viewFull('${src}')">⤢ Full view</button>
      </div>`;

    // Store for gallery (keep blob URL)
    state.gallery.push({ src, prompt, index });

  } catch (err) {
    console.error(`Image ${index + 1} failed:`, err);
    showErrorCell(cell, index, prompt, err.message);
  }
}

// Retry wrapper — HF free tier sometimes needs 1-2 retries on cold start
async function fetchWithRetry(url, options, retries = 3, delayMs = 4000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, options);
    // 503 = model loading, 500 = transient error — retry
    if ((res.status === 503 || res.status === 500) && attempt < retries - 1) {
      const waitMs = delayMs * (attempt + 1);
      document.getElementById('progress-text').textContent =
        `Model warming up, retrying in ${Math.round(waitMs / 1000)}s...`;
      await sleep(waitMs);
      continue;
    }
    return res;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showErrorCell(cell, index, prompt, errMsg) {
  cell.className = 'output-cell';
  const safeMsg  = (errMsg || '').slice(0, 120);
  const safePrompt = prompt.replace(/`/g, "'").replace(/"/g, '&quot;');
  cell.innerHTML = `
    <div class="prompt-result-card">
      <div>
        <div class="prompt-result-label" style="color:#C44B4B">Image ${index + 1} — failed</div>
        <p style="font-size:11px;color:#C44B4B;margin-bottom:6px">${safeMsg}</p>
        <p style="font-size:11px;line-height:1.6;color:#6B6258">${prompt.slice(0, 200)}...</p>
      </div>
      <button class="prompt-copy-btn" onclick="copyText('${safePrompt}')">⎘ Copy prompt for Midjourney</button>
    </div>`;
}

// ── DOWNLOAD / VIEW ────────────────────────
function downloadBlob(src, num) {
  const a    = document.createElement('a');
  a.href     = src;
  a.download = `flatlay-${num}-${Date.now()}.png`;
  a.click();
  showToast('Downloading...');
}

function viewFull(src) {
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Flatlay</title>
    <style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh}
    img{max-width:100%;max-height:100vh;object-fit:contain}</style></head>
    <body><img src="${src}" /></body></html>`);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Prompt copied!'));
}

function downloadAll() {
  if (state.gallery.length === 0) { showToast('No images to download', 'error'); return; }
  state.gallery.forEach((item, i) => {
    setTimeout(() => downloadBlob(item.src, i + 1), i * 500);
  });
  showToast(`Downloading ${state.gallery.length} images...`);
}

// ── GALLERY ────────────────────────────────
function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';
  state.gallery.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.innerHTML = `
      <img src="${item.src}" alt="Gallery ${i + 1}" onclick="viewFull('${item.src}')" title="Click to view full size" />`;
    grid.appendChild(div);
  });
}

function clearGallery() {
  state.gallery.forEach(item => URL.revokeObjectURL(item.src));
  state.gallery = [];
  document.getElementById('gallery-section').style.display = 'none';
  document.getElementById('gallery-grid').innerHTML = '';
  showToast('Gallery cleared');
}

// ── TOAST ──────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
