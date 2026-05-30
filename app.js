/* ==========================================
   FLATLAY STUDIO — app.js
   Gemini API Integration for Loungewear AI
   ========================================== */

// ── STATE ──────────────────────────────────
const state = {
  apiKey: '',
  connected: false,
  count: 6,
  uploadedImage: null,   // base64 string
  uploadedMime: null,
  gallery: [],
  generating: false,
};

// ── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('fs_api_key');
  if (saved) {
    document.getElementById('api-key').value = saved;
    state.apiKey = saved;
    updateStatusUI('saved', 'Key loaded');
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
  updatePrompt();
});

function toggleKey() {
  const input = document.getElementById('api-key');
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function testConnection() {
  const key = document.getElementById('api-key').value.trim();
  if (!key) { showToast('Enter your Gemini API key first', 'error'); return; }
  state.apiKey = key;
  updateStatusUI('loading', 'Testing...');

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    );
    if (res.ok) {
      state.connected = true;
      localStorage.setItem('fs_api_key', key);
      updateStatusUI('connected', 'Connected ✓');
      showToast('Gemini connected!', 'success');
    } else {
      const err = await res.json();
      state.connected = false;
      updateStatusUI('error', 'Invalid key');
      showToast(err?.error?.message || 'Invalid API key', 'error');
    }
  } catch {
    state.connected = false;
    updateStatusUI('error', 'Network error');
    showToast('Network error — check your key', 'error');
  }
  updateGenBtn();
}

function updateStatusUI(status, label) {
  const dot = document.getElementById('status-dot');
  const lbl = document.getElementById('status-label');
  dot.className = 'status-dot';
  if (status === 'connected') dot.classList.add('connected');
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
    const base64 = result.split(',')[1];
    state.uploadedImage = base64;
    state.uploadedMime = file.type;
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
  state.uploadedMime = null;
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
  updatePrompt();
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
function buildPrompt(angleVariant = '') {
  const cat      = getVal('cat-group');
  const type     = getVal('type-group', '.type-card');
  const fabric   = getVal('fabric-group');
  const print    = getVal('print-group');
  const tone     = getVal('tone-group', '.tone-btn');
  const bg       = getVal('bg-group', '.type-card');
  const light    = getVal('light-group');
  const props    = getMultiVals('props-group');

  const propsStr = props.length
    ? `, styled alongside ${props.join(' and ')}`
    : '';
  const refNote  = state.uploadedImage
    ? ' Match the garment style and design from the reference photo provided. '
    : '';

  const base = `Professional e-commerce product flatlay photograph of a ${type} for ${cat}. ` +
    `The garment is made of ${fabric} in a ${print} design with ${tone} colour palette. ` +
    `The flatlay is arranged on a ${bg}${propsStr}. ` +
    `Lighting: ${light}. ` +
    `${refNote}` +
    `${angleVariant ? angleVariant + '. ' : ''}` +
    `Shot from directly above (top-down 90° angle), perfectly folded and styled, ` +
    `high-resolution commercial product photography, clean and editorial, ` +
    `no people, no models, no text overlays, no watermarks.`;

  return base;
}

const ANGLE_VARIANTS = [
  'Perfectly symmetrical flatlay, garments neatly folded and centred',
  'Artfully tousled arrangement, organic and relaxed styling',
  'Close-up detail shot emphasising fabric texture and print pattern',
  'Full outfit spread with each piece separated and fanned out elegantly',
  'Diagonal diagonal composition, asymmetric styling',
  'Minimal styling — single hero piece centred with lots of negative space',
  'Layered styling with garments partially overlapping',
  'Accessory-forward composition with props as equal elements',
  'Wide-angle shot showing full outfit and all accessories',
];

function updatePrompt() {
  const preview = buildPrompt();
  document.getElementById('prompt-preview').textContent = preview;
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
  if (!state.apiKey) {
    showToast('Add your Gemini API key first ↑', 'error');
    document.getElementById('api-key').focus();
    return;
  }

  state.generating = true;
  const btn = document.getElementById('gen-btn');
  const genLabel = document.getElementById('gen-label');
  btn.disabled = true;
  genLabel.textContent = 'Generating...';
  document.getElementById('gen-count').textContent = `0 / ${state.count}`;

  // Show output section
  const outputSection = document.getElementById('output-section');
  outputSection.style.display = 'block';
  document.getElementById('progress-section').style.display = 'block';
  document.getElementById('gallery-hint').style.display = 'none';

  // Build empty grid
  const grid = document.getElementById('output-grid');
  grid.innerHTML = '';
  for (let i = 0; i < state.count; i++) {
    const cell = document.createElement('div');
    cell.className = 'output-cell loading';
    cell.id = `cell-${i}`;
    cell.innerHTML = `<div class="loading-dot"></div>`;
    grid.appendChild(cell);
  }

  // Generate all in parallel
  const promises = [];
  for (let i = 0; i < state.count; i++) {
    const angle = ANGLE_VARIANTS[i % ANGLE_VARIANTS.length];
    promises.push(generateOne(i, angle));
  }

  let done = 0;
  promises.forEach(p => p.then(() => {
    done++;
    const pct = Math.round((done / state.count) * 100);
    document.getElementById('progress-bar').style.width = `${pct}%`;
    document.getElementById('progress-text').textContent = `${done} of ${state.count} complete`;
    document.getElementById('gen-count').textContent = `${done} / ${state.count}`;
  }));

  await Promise.allSettled(promises);

  state.generating = false;
  btn.disabled = false;
  genLabel.textContent = 'Generate Again';
  document.getElementById('gen-count').textContent = `${state.count} images`;
  document.getElementById('progress-text').textContent = `✓ All ${state.count} images ready`;

  // Show gallery
  if (state.gallery.length > 0) {
    document.getElementById('gallery-section').style.display = 'block';
    renderGallery();
  }
  showToast(`${state.count} flatlays generated!`, 'success');
}

async function generateOne(index, angleVariant) {
  const prompt = buildPrompt(angleVariant);
  const cell = document.getElementById(`cell-${index}`);

  try {
    // Build the request parts
    const parts = [];

    // If user uploaded a reference image, include it
    if (state.uploadedImage) {
      parts.push({
        inline_data: {
          mime_type: state.uploadedMime,
          data: state.uploadedImage,
        }
      });
    }

    parts.push({ text: prompt });

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['Text', 'Image'],
      },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${state.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();

    // Extract image from response
    let imageData = null;
    let imageMime = 'image/png';
    let textContent = '';

    const candidate = data.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inline_data?.data) {
          imageData = part.inline_data.data;
          imageMime = part.inline_data.mime_type || 'image/png';
        }
        if (part.text) {
          textContent = part.text;
        }
      }
    }

    if (imageData) {
      const src = `data:${imageMime};base64,${imageData}`;
      cell.className = 'output-cell';
      cell.innerHTML = `
        <img src="${src}" alt="Generated flatlay ${index + 1}" />
        <div class="cell-overlay">
          <button class="cell-btn" onclick="downloadImage('${src}', ${index + 1})">⬇ Download</button>
          <button class="cell-btn" onclick="copyToClipboard('${src}')">⎘ Copy</button>
        </div>`;
      state.gallery.push({ src, prompt, index });
    } else {
      // Fallback: show prompt text (Imagen may not be available on free tier)
      showPromptFallback(cell, index, prompt, textContent);
    }

  } catch (err) {
    console.error(`Image ${index + 1} error:`, err);
    showPromptFallback(cell, index, buildPrompt(angleVariant), err.message);
  }
}

function showPromptFallback(cell, index, prompt, note) {
  cell.className = 'output-cell';
  const shortNote = note && note.length < 200 ? `<p style="color:#C44B4B;font-size:10px;margin-top:6px">${note}</p>` : '';
  cell.innerHTML = `
    <div class="prompt-result-card">
      <div>
        <div class="prompt-result-label">Image ${index + 1} prompt</div>
        <p style="font-size:11px;line-height:1.6;color:#6B6258">${prompt.slice(0, 260)}...</p>
        ${shortNote}
      </div>
      <button class="prompt-copy-btn" onclick="copyText(\`${prompt.replace(/`/g, "'")}\`)">⎘ Copy prompt → use in Midjourney / DALL·E</button>
    </div>`;
}

// ── DOWNLOAD / COPY ────────────────────────
function downloadImage(src, num) {
  const a = document.createElement('a');
  a.href = src;
  a.download = `flatlay-studio-${num}-${Date.now()}.png`;
  a.click();
  showToast('Downloading...');
}

async function copyToClipboard(src) {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    showToast('Image copied!');
  } catch {
    showToast('Copy not supported — use Download', 'error');
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Prompt copied!'));
}

function downloadAll() {
  state.gallery.forEach((item, i) => {
    setTimeout(() => downloadImage(item.src, i + 1), i * 400);
  });
}

// ── GALLERY ────────────────────────────────
function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';
  state.gallery.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.innerHTML = `<img src="${item.src}" alt="Gallery image ${i + 1}" onclick="downloadImage('${item.src}', ${i + 1})" title="Click to download" />`;
    grid.appendChild(div);
  });
}

function clearGallery() {
  state.gallery = [];
  document.getElementById('gallery-section').style.display = 'none';
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
  void toast.offsetWidth; // reflow
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
