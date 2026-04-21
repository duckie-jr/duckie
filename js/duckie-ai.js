import '../css/duckie-ai.css';

const STORAGE_KEY = 'duckie_save';
const SYSPROMPT_KEY = 'duckie_sysprompt';
const MAX_HISTORY = 50;

const DEFAULT_SYSTEM_PROMPT = `You are Duckie AI — a terminal-style AI assistant running entirely in the user's browser via WebGPU. Be direct, concise, and helpful. Do not use emojis. Do not repeat the question back.

Use markdown in all responses: \`\`\`lang for code blocks, **bold**, *italic*, ### headings, - bullet lists, --- for dividers. Always use a fenced code block with the language when showing code.

--- APP LAYOUT ---
The interface has two areas:
1. **Sidebar** — on the LEFT side of the screen. This is where ALL tools and panels live.
2. **Chat area** — the main area on the RIGHT where messages appear and you type.

On mobile the sidebar is hidden by default; tap the ☰ button (top-left) to open it, tap ✕ or swipe left to close it.

--- SIDEBAR CONTENTS (top to bottom) ---
The sidebar contains the following, in this order:

1. **Status bar** — shows four stats: LLM status, Vision status, Memory count, Messages count. The coloured dot next to LLM and Vision shows: amber pulsing = still loading, green = ready, red = failed/unsupported.

2. **Search panel** — click "SEARCH" in the sidebar to expand it. Type to highlight matching messages in the chat. Also accessible via Ctrl+F / Cmd+F.

3. **Conversations panel** — click "CONVERSATIONS" in the sidebar. Contains [new], [save], [clear] buttons and a list of saved chats. Click a saved chat to load it; double-click its name to rename it.

4. **System Prompt panel** — click "SYSTEM PROMPT" in the sidebar. Lets the user edit the instructions that control how Duckie responds. [save] stores it; [reset] restores the default.

5. **Stopwatch panel** — click "STOPWATCH" in the sidebar. Has a centisecond timer with [start]/[pause] and [reset] buttons.

6. **Memory panel** — click "MEMORY" in the sidebar. Shows saved memories and lets the user add or delete them manually.

Only one panel can be open at a time — clicking a panel header opens it and closes any other open panel.

--- OTHER FEATURES ---
**Chat**
- Type in the input bar at the bottom of the chat area and press Enter or [>] to send.
- Requires WebGPU (Chrome 113+ or Edge 113+). If the LLM dot is red, the browser does not support WebGPU.

**Image / Vision**
- Click [IMG] in the input bar, or drag and drop an image onto the chat area, to run object detection.
- The Vision model draws bounding boxes with confidence scores. Click the image to expand it fullscreen.

**Memory via chat**
- Say "remember that [fact]" to store something.
- Say "what do you remember?" to list memories.
- Say "forget everything" to clear all memories.

**Clock**
- A live clock (HH:MM:SS) is shown in the input bar between [IMG] and the text field. Hidden on mobile.

--- BEHAVIOUR RULES ---
- NEVER tell users to go to "settings" — there are no settings. Everything is in the sidebar.
- NEVER tell users to go to a "menu" — there is no menu. Everything is in the sidebar.
- When directing a user to a feature, always say "open the X panel in the sidebar on the left".
- If a user seems lost, tell them to look at the sidebar on the left.
- If asked "what can you do?" or "help", summarise the sidebar panels and chat features.
- If the LLM is not ready yet, tell the user to wait for the green dot next to LLM in the sidebar.
- If WebGPU is not supported, suggest Chrome or Edge 113+.
- Do not make up features that are not listed above.`;


function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

let saveTimer = 0;
function saveToLocalStorage() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        memory: state.memory,
        history: state.history.slice(-MAX_HISTORY),
        savedAt: Date.now(),
      }));
    } catch {}
  }, 500);
}

const savedState = loadFromLocalStorage();
const state = {
  memory: savedState?.memory ?? {},
  history: savedState?.history ?? [],
  count: 0,
  startTime: Date.now(),
  detections: [],
};

let chatEngine = null;
let chatReady = false;
let visionModel = null;
const messagesEl = document.getElementById('messages');
const form = document.getElementById('input-form');
const inputEl = document.getElementById('user-input');
const typingEl = document.getElementById('typing-indicator');
const progressWrap = document.getElementById('progress-wrap');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const imageUploadInput = document.getElementById('image-upload');
const chatArea = document.getElementById('chat-area');

const scrollBtn = document.createElement('button');
scrollBtn.id = 'scroll-bottom-btn';
scrollBtn.textContent = 'v';
scrollBtn.classList.add('hidden');
chatArea.appendChild(scrollBtn);
scrollBtn.addEventListener('click', () => scrollToBottom());
messagesEl.addEventListener('scroll', () => {
  const distFromBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
  scrollBtn.classList.toggle('hidden', distFromBottom < 100);
});

function getTimestamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function showProgress(pct) {
  progressWrap.classList.remove('hidden');
  progressBar.style.width = `${pct}%`;
  progressText.textContent = `${pct}%`;
}
function hideProgress() { progressWrap.classList.add('hidden'); }

function setStatus(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setModelDotState(dotId, newState) {
  const dot = document.getElementById(dotId);
  if (!dot) return;
  // Remove the attribute first and force a reflow so the browser
  // re-triggers the CSS animation when we set the new state.
  dot.removeAttribute('data-state');
  void dot.offsetWidth;
  dot.setAttribute('data-state', newState);
}

const notificationContainerEl = document.getElementById('notification-container');
const TOAST_DURATION_MS = 3500;

function showToastNotification(message, type = 'success') {
  if (!notificationContainerEl) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon"></span>
    <span class="toast-label">${type === 'error' ? 'error' : 'ready'}</span>
    <span class="toast-message">${message}</span>
  `;

  notificationContainerEl.appendChild(toast);

  const removeToast = () => {
    toast.classList.add('toast-removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  setTimeout(removeToast, TOAST_DURATION_MS);
  toast.addEventListener('click', removeToast);
}

/* ── Live clock in input bar ── */
const inputClockTimeEl = document.getElementById('input-clock-time');

function formatClockTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function tickInputClock() {
  if (inputClockTimeEl) {
    inputClockTimeEl.textContent = formatClockTime(new Date());
  }
}

tickInputClock();
setInterval(tickInputClock, 1000);

async function loadChatEngine() {
  if (!navigator.gpu) {
    setStatus('status-text', 'No WebGPU [X]');
    setModelDotState('llm-dot', 'error');
    return;
  }
  setStatus('status-text', 'Loading WebLLM...');
  setModelDotState('llm-dot', 'loading');
  showProgress(0);
  try {
    const webllm = await import('https://esm.run/@mlc-ai/web-llm');
    chatEngine = await webllm.CreateMLCEngine('Qwen2.5-0.5B-Instruct-q4f16_1-MLC', {
      initProgressCallback: (report) => {
        const match = report.text.match(/([\d.]+)%/);
        if (match) showProgress(Math.round(parseFloat(match[1])));
        setStatus('status-text', report.text.length > 28 ? report.text.slice(0, 28) + '…' : report.text);
      },
    });
    chatReady = true;
    setStatus('status-text', 'LLM Ready [OK]');
    setModelDotState('llm-dot', 'ready');
    showToastNotification('LLM ready');
    hideProgress();
  } catch (err) {
    console.error('WebLLM failed:', err);
    setStatus('status-text', 'LLM Failed [X]');
    setModelDotState('llm-dot', 'error');
    showToastNotification('LLM failed to load', 'error');
    hideProgress();
  }
}

async function loadTransformersModels() {
  try {
    const tfjs = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    tfjs.env.allowLocalModels = false;
    tfjs.env.useBrowserCache = true;
    setStatus('status-vision', 'Loading...');
    setModelDotState('vision-dot', 'loading');
    try {
      visionModel = await tfjs.pipeline('object-detection', 'Xenova/detr-resnet-50',
        { progress_callback: (e) => { if (e.status === 'progress') showProgress(Math.round(e.progress)); } });
      setStatus('status-vision', 'Ready [OK]');
      setModelDotState('vision-dot', 'ready');
      showToastNotification('Vision ready');
    } catch {
      setStatus('status-vision', 'Failed [X]');
      setModelDotState('vision-dot', 'error');
      showToastNotification('Vision failed to load', 'error');
    }
    hideProgress();
  } catch (err) {
    console.error('Transformers.js failed:', err);
    setStatus('status-vision', 'Failed [X]');
    setModelDotState('vision-dot', 'error');
    showToastNotification('Vision failed to load', 'error');
    hideProgress();
  }
}

async function loadAllModels() { await loadChatEngine(); await loadTransformersModels(); }

function buildSystemPrompt() {
  const customPrompt = localStorage.getItem(SYSPROMPT_KEY);
  let prompt = customPrompt || DEFAULT_SYSTEM_PROMPT;
  const memories = Object.values(state.memory).filter(m => typeof m === 'string');
  if (memories.length > 0) prompt += '\n\nThe user asked you to remember:\n' + memories.map((m, i) => `${i + 1}. ${m}`).join('\n');
  return prompt;
}

function formatMarkdown(text) {
  let html = text;
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, language, code) => {
    const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const languageLabel = language ? `<span class="code-lang">${language}</span>` : '';
    return `<div class="code-block">${languageLabel}<button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent).then(()=>{this.textContent='copied';setTimeout(()=>this.textContent='copy',1200)})">copy</button><pre><code>${escapedCode.trim()}</code></pre></div>`;
  });
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="code-block"><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent).then(()=>{this.textContent='copied';setTimeout(()=>this.textContent='copy',1200)})">copy</button><pre><code>${escapedCode.trim()}</code></pre></div>`;
  });
  const lines = html.split('\n');
  const processedLines = [];
  let inList = false;
  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      if (inList) { processedLines.push('</ul>'); inList = false; }
      const headingLevel = line.match(/^(#{1,3})/)[1].length;
      const headingText = line.replace(/^#{1,3}\s+/, '');
      processedLines.push(`<h${headingLevel + 2} class="md-heading">${headingText}</h${headingLevel + 2}>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) { processedLines.push('<ul class="md-list">'); inList = true; }
      processedLines.push(`<li>${line.replace(/^[-*]\s+/, '')}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      if (!inList) { processedLines.push('<ol class="md-list">'); inList = true; }
      processedLines.push(`<li>${line.replace(/^\d+\.\s+/, '')}</li>`);
    } else if (/^---+$/.test(line.trim())) {
      if (inList) { processedLines.push('</ul>'); inList = false; }
      processedLines.push('<hr class="md-hr">');
    } else {
      if (inList) { processedLines.push('</ul>'); inList = false; }
      processedLines.push(line);
    }
  }
  if (inList) processedLines.push('</ul>');
  html = processedLines.join('\n');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function detectRepetitionLoop(text) {
  if (text.length < 80) return false;
  const tail = text.slice(-60);
  const chunk = tail.slice(-20);
  const beforeTail = tail.slice(0, 40);
  if (beforeTail.includes(chunk)) return true;
  const words = text.split(/\s+/);
  if (words.length < 12) return false;
  const lastTwelve = words.slice(-12).join(' ');
  const preceding = words.slice(-24, -12).join(' ');
  return lastTwelve === preceding;
}

function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

function createStreamingAiMessage() {
  clearWelcome();
  const div = document.createElement('div');
  div.className = 'message ai';
  const label = document.createElement('span');
  label.className = 'ai-label';
  label.textContent = '> Duckie';
  div.appendChild(label);
  const contentSpan = document.createElement('span');
  contentSpan.className = 'streaming-content';
  div.appendChild(contentSpan);
  messagesEl.appendChild(div);
  scrollToBottom();
  return contentSpan;
}

let pendingFrame = 0;

function updateStreamingContent(contentSpan, text) {
  if (pendingFrame) return;
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = 0;
    contentSpan.textContent = text;
    scrollToBottom();
  });
}

function finalizeStreamingContent(contentSpan, text) {
  cancelAnimationFrame(pendingFrame);
  pendingFrame = 0;
  contentSpan.innerHTML = formatMarkdown(text);
  const messageDiv = contentSpan.closest('.message');
  if (messageDiv && !messageDiv.querySelector('.msg-time')) {
    const ts = document.createElement('span');
    ts.className = 'msg-time';
    ts.textContent = getTimestamp();
    messageDiv.appendChild(ts);
  }
  scrollToBottom();
}

function clearWelcome() { const el = messagesEl.querySelector('.welcome-msg'); if (el) el.remove(); }

function showWelcome() {
  const div = document.createElement('div');
  div.className = 'welcome-msg';
  div.innerHTML = `
    <span class="big-icon">&gt;_</span>
    <h2>Hey there! I'm Duckie</h2>
    <p>A real LLM running entirely in your browser via WebGPU.</p>
    <p class="vision-hint">Drop or upload an image for object detection.</p>
    <div class="suggestions">
      <span class="suggestion-chip">HTTP vs HTTPS?</span>
      <span class="suggestion-chip">Explain recursion simply</span>
      <span class="suggestion-chip">5 project ideas for beginners</span>
      <span class="suggestion-chip">Remember my name is Alex</span>
    </div>`;
  messagesEl.appendChild(div);
  div.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => { inputEl.value = chip.textContent; form.dispatchEvent(new Event('submit', { cancelable: true })); });
  });
}

function addUserMessage(text) {
  clearWelcome();
  const div = document.createElement('div');
  div.className = 'message user';
  div.innerHTML = formatMarkdown(text);
  const userTs = document.createElement('span');
  userTs.className = 'msg-time';
  userTs.textContent = getTimestamp();
  div.appendChild(userTs);
  messagesEl.appendChild(div);
  scrollToBottom();
}

function addAiMessage(text) {
  clearWelcome();
  const div = document.createElement('div');
  div.className = 'message ai';
  const label = document.createElement('span');
  label.className = 'ai-label';
  label.textContent = '> Duckie';
  div.appendChild(label);
  const content = document.createElement('span');
  content.innerHTML = formatMarkdown(text);
  div.appendChild(content);
  const aiTs = document.createElement('span');
  aiTs.className = 'msg-time';
  aiTs.textContent = getTimestamp();
  div.appendChild(aiTs);
  messagesEl.appendChild(div);
  scrollToBottom();
}

let activeAbort = null;

function abortCurrentStream() {
  if (activeAbort) {
    activeAbort.abort();
    activeAbort = null;
  }
}

async function chatWithLLM(userText) {
  if (!chatReady || !chatEngine) { addAiMessage("I'm still loading the LLM -- please wait a moment."); return; }
  abortCurrentStream();
  state.history.push({ role: 'user', content: userText });
  typingEl.classList.remove('hidden');
  const contentSpan = createStreamingAiMessage();
  const abortController = new AbortController();
  activeAbort = abortController;
  try {
    await chatEngine.interruptGenerate();
  } catch {}
  try {
    const messages = [{ role: 'system', content: buildSystemPrompt() }, ...state.history.slice(-10)];
    const chunks = await chatEngine.chat.completions.create({
      messages,
      stream: true,
      max_tokens: 512,
      temperature: 0.7,
      frequency_penalty: 1.2,
      presence_penalty: 0.6,
    });
    let fullResponse = '';
    typingEl.classList.add('hidden');
    for await (const chunk of chunks) {
      if (abortController.signal.aborted) break;
      const delta = chunk.choices[0]?.delta?.content || '';
      fullResponse += delta;
      if (detectRepetitionLoop(fullResponse)) break;
      updateStreamingContent(contentSpan, fullResponse);
    }
    contentSpan.classList.remove('streaming-content');
    finalizeStreamingContent(contentSpan, fullResponse);
    if (fullResponse) state.history.push({ role: 'assistant', content: fullResponse });
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Chat error:', err);
    typingEl.classList.add('hidden');
    contentSpan.classList.remove('streaming-content');
    const currentText = contentSpan.textContent;
    if (currentText) {
      finalizeStreamingContent(contentSpan, currentText);
      state.history.push({ role: 'assistant', content: currentText });
    } else if (err.name !== 'AbortError') {
      finalizeStreamingContent(contentSpan, "Oops -- something went wrong. Try again?");
    }
  }
  if (activeAbort === abortController) activeAbort = null;
  updateCounters();
}

/* ── Visual Stopwatch ── */
let stopwatchElapsedMs = 0;
let stopwatchRunning = false;
let stopwatchStartTimestamp = 0;
let stopwatchAnimFrame = 0;
const stopwatchDisplayEl = document.getElementById('stopwatch-display');
const stopwatchStartBtn = document.getElementById('stopwatch-start-btn');
const stopwatchResetBtn = document.getElementById('stopwatch-reset-btn');

function formatStopwatchTime(totalMs) {
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const centiseconds = Math.floor((totalMs % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function tickStopwatch() {
  if (!stopwatchRunning) return;
  const currentElapsed = stopwatchElapsedMs + (Date.now() - stopwatchStartTimestamp);
  stopwatchDisplayEl.textContent = formatStopwatchTime(currentElapsed);
  stopwatchAnimFrame = requestAnimationFrame(tickStopwatch);
}

function startStopwatch() {
  stopwatchRunning = true;
  stopwatchStartTimestamp = Date.now();
  stopwatchStartBtn.textContent = '[pause]';
  stopwatchDisplayEl.classList.add('running');
  tickStopwatch();
}

function pauseStopwatch() {
  stopwatchRunning = false;
  stopwatchElapsedMs += Date.now() - stopwatchStartTimestamp;
  cancelAnimationFrame(stopwatchAnimFrame);
  stopwatchStartBtn.textContent = '[start]';
  stopwatchDisplayEl.classList.remove('running');
  stopwatchDisplayEl.textContent = formatStopwatchTime(stopwatchElapsedMs);
}

function resetStopwatch() {
  stopwatchRunning = false;
  stopwatchElapsedMs = 0;
  cancelAnimationFrame(stopwatchAnimFrame);
  stopwatchStartBtn.textContent = '[start]';
  stopwatchDisplayEl.classList.remove('running');
  stopwatchDisplayEl.textContent = '00:00.00';
  document.getElementById('stopwatch-laps').innerHTML = '';
}

stopwatchStartBtn.addEventListener('click', () => {
  if (stopwatchRunning) pauseStopwatch();
  else startStopwatch();
});

stopwatchResetBtn.addEventListener('click', resetStopwatch);

document.getElementById('stopwatch-toggle').addEventListener('click', () =>
  togglePanel(document.getElementById('stopwatch-toggle'), document.getElementById('stopwatch-panel'))
);

function handleMemoryCommand(text) {
  const rememberMatch = text.match(/remember\s+(?:that\s+)?(.+)/i);
  if (rememberMatch) {
    state.memory[`mem_${Date.now()}`] = rememberMatch[1].trim();
    addAiMessage(`Got it -- I'll remember: **"${rememberMatch[1].trim()}"**`);
    updateCounters();
    return true;
  }
  if (/what do you remember|show.*memor/i.test(text)) {
    const memories = Object.values(state.memory).filter(m => typeof m === 'string');
    if (memories.length === 0) addAiMessage("I don't have any memories saved yet. Tell me to **remember** something.");
    else addAiMessage(`Here's what I remember:\n\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`);
    return true;
  }
  if (/forget everything|clear.*memor/i.test(text)) {
    state.memory = {};
    addAiMessage("Done -- memory wiped clean.");
    updateCounters();
    return true;
  }
  return false;
}

const DETECTION_COLORS = ['#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    const imageDataUrl = event.target.result;
    clearWelcome();
    addUserMessage('[Uploaded an image]');
    if (!visionModel) { addAiMessage("Vision model isn't loaded yet -- hang tight."); return; }
    typingEl.classList.remove('hidden');
    try {
      const detections = await visionModel(imageDataUrl, { threshold: 0.7 });
      typingEl.classList.add('hidden');
      state.detections = detections;
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message ai';
      const label = document.createElement('span');
      label.className = 'ai-label';
      label.textContent = '> Duckie Vision';
      messageDiv.appendChild(label);
      const imageContainer = document.createElement('div');
      imageContainer.className = 'chat-image-container';
      const img = document.createElement('img');
      img.className = 'chat-image';
      img.src = imageDataUrl;
      imageContainer.appendChild(img);
      renderBoundingBoxes(imageContainer, img, detections);
      imageContainer.addEventListener('click', () => showImageOverlay(imageDataUrl, detections));
      messageDiv.appendChild(imageContainer);
      if (detections.length > 0) {
        const summary = document.createElement('p');
        summary.style.marginTop = '10px';
        summary.innerHTML = `Found: ${detections.map(d => `<strong>${d.label}</strong> (${Math.round(d.score * 100)}%)`).join(', ')}`;
        messageDiv.appendChild(summary);
      } else {
        const noDetect = document.createElement('p');
        noDetect.style.marginTop = '10px';
        noDetect.textContent = "Hmm, I didn't detect any objects. Try a clearer image.";
        messageDiv.appendChild(noDetect);
      }
      messagesEl.appendChild(messageDiv);
      scrollToBottom();
      updateCounters();
    } catch (err) { console.error('Vision error:', err); typingEl.classList.add('hidden'); addAiMessage("Vision detection failed -- sorry about that."); }
  };
  reader.readAsDataURL(file);
}

function renderBoundingBoxes(container, imgEl, detections) {
  const draw = () => {
    if (!imgEl.clientWidth || !imgEl.clientHeight) {
      requestAnimationFrame(draw);
      return;
    }
    const scaleX = imgEl.clientWidth / imgEl.naturalWidth;
    const scaleY = imgEl.clientHeight / imgEl.naturalHeight;
    detections.forEach((det, i) => {
      const { xmin, ymin, xmax, ymax } = det.box;
      const color = DETECTION_COLORS[i % DETECTION_COLORS.length];
      const box = document.createElement('div');
      box.className = 'bounding-box';
      Object.assign(box.style, { left: `${xmin * scaleX}px`, top: `${ymin * scaleY}px`, width: `${(xmax - xmin) * scaleX}px`, height: `${(ymax - ymin) * scaleY}px`, borderColor: color });
      const lbl = document.createElement('span');
      lbl.className = 'bounding-box-label';
      lbl.textContent = `${det.label} ${Math.round(det.score * 100)}%`;
      lbl.style.backgroundColor = color;
      box.appendChild(lbl);
      container.appendChild(box);
    });
  };
  if (imgEl.complete) draw(); else imgEl.addEventListener('load', draw);
}

function showImageOverlay(imageDataUrl, detections) {
  document.querySelector('.image-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'image-overlay';
  overlay.innerHTML = `<div class="overlay-backdrop"></div><div class="overlay-content"><button class="overlay-close">&times;</button><div class="overlay-detection-container"><img class="overlay-image" src="${imageDataUrl}" /></div></div>`;
  const close = () => overlay.remove();
  overlay.querySelector('.overlay-backdrop').addEventListener('click', close);
  overlay.querySelector('.overlay-close').addEventListener('click', close);
  document.body.appendChild(overlay);
  renderBoundingBoxes(overlay.querySelector('.overlay-detection-container'), overlay.querySelector('.overlay-image'), detections);
}

async function handleSubmit(event) {
  event.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  addUserMessage(text);
  if (handleMemoryCommand(text)) return;
  await chatWithLLM(text);
}

function updateCounters() {
  state.count = state.history.filter(h => h.role === 'user').length;
  setStatus('msg-count', String(state.count));
  setStatus('memory-count', String(Object.keys(state.memory).length));
  saveToLocalStorage();
}

/* ── Search Chat History ── */
function performSearch(query) {
  const resultsEl = document.getElementById('search-results');
  if (!query.trim()) { resultsEl.innerHTML = '<div class="panel-empty">type to search</div>'; clearSearchHighlights(); return; }
  const lowerQuery = query.toLowerCase();
  const matchingMessages = [];
  const allMessageEls = messagesEl.querySelectorAll('.message');
  clearSearchHighlights();
  allMessageEls.forEach((messageEl) => {
    const textContent = messageEl.textContent.toLowerCase();
    if (textContent.includes(lowerQuery)) {
      matchingMessages.push(messageEl);
      messageEl.classList.add('search-highlight');
    }
  });
  if (!matchingMessages.length) {
    resultsEl.innerHTML = '<div class="panel-empty">no results</div>';
    return;
  }
  resultsEl.innerHTML = '';
  matchingMessages.forEach((messageEl, index) => {
    const isUser = messageEl.classList.contains('user');
    const previewText = messageEl.textContent.trim().slice(0, 50);
    const resultItem = document.createElement('div');
    resultItem.className = 'panel-item search-result-item';
    resultItem.innerHTML = `<span class="search-result-role">${isUser ? 'you' : 'ai'}</span><span class="panel-item-text">${previewText}...</span>`;
    resultItem.addEventListener('click', () => {
      messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageEl.classList.add('search-flash');
      setTimeout(() => messageEl.classList.remove('search-flash'), 1500);
    });
    resultsEl.appendChild(resultItem);
  });
}

function clearSearchHighlights() {
  messagesEl.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
  messagesEl.querySelectorAll('.search-flash').forEach(el => el.classList.remove('search-flash'));
}

document.getElementById('search-toggle').addEventListener('click', () => togglePanel(document.getElementById('search-toggle'), document.getElementById('search-panel')));
document.getElementById('search-btn').addEventListener('click', () => performSearch(document.getElementById('search-input').value));
document.getElementById('search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); performSearch(e.target.value); } });
document.getElementById('search-input').addEventListener('input', (e) => {
  if (!e.target.value.trim()) clearSearchHighlights();
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    const searchPanel = document.getElementById('search-panel');
    const searchToggle = document.getElementById('search-toggle');
    if (searchPanel.classList.contains('hidden')) {
      togglePanel(searchToggle, searchPanel);
    }
    document.getElementById('search-input').focus();
  }
});

/* ── Conversation Rename ── */
function renameConvo(convoId, newName) {
  const convos = getSavedConvos();
  const convo = convos.find(c => c.id === convoId);
  if (convo) {
    convo.name = newName.trim() || convo.name;
    saveConvosList(convos);
    renderConvoList();
  }
}

/* ── Conversation Management ── */
const CONVOS_KEY = 'duckie_convos';
function getSavedConvos() { try { return JSON.parse(localStorage.getItem(CONVOS_KEY)) || []; } catch { return []; } }
function saveConvosList(list) { localStorage.setItem(CONVOS_KEY, JSON.stringify(list)); }

function saveCurrentConvo() {
  if (!state.history.length) return;
  const firstMsg = state.history.find(m => m.role === 'user');
  const convos = getSavedConvos();
  convos.unshift({ id: Date.now(), name: firstMsg ? firstMsg.content.slice(0, 28) : 'chat', history: [...state.history], memory: { ...state.memory } });
  saveConvosList(convos);
  renderConvoList();
}

function loadConvo(convoId) {
  const convo = getSavedConvos().find(e => e.id === convoId);
  if (!convo) return;
  state.history = convo.history || [];
  state.memory = convo.memory || {};
  messagesEl.innerHTML = '';
  if (!state.history.length) showWelcome();
  else state.history.forEach(m => { if (m.role === 'user') addUserMessage(m.content); else if (m.role === 'assistant') addAiMessage(m.content); });
  updateCounters();
  renderMemoryList();
}

function deleteConvo(id) { saveConvosList(getSavedConvos().filter(e => e.id !== id)); renderConvoList(); }

function clearAllConvos() {
  localStorage.removeItem(CONVOS_KEY);
  renderConvoList();
}

function clearChat() {
  saveCurrentConvo();
  state.history = [];
  state.count = 0;
  messagesEl.innerHTML = '';
  showWelcome();
  updateCounters();
}

function renderConvoList() {
  const el = document.getElementById('convo-list');
  const convos = getSavedConvos();
  if (!convos.length) { el.innerHTML = '<div class="panel-empty">no saved chats</div>'; return; }
  el.innerHTML = '';
  convos.forEach(c => {
    const d = document.createElement('div'); d.className = 'panel-item';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'panel-item-text';
    nameSpan.textContent = c.name;
    nameSpan.title = 'click to load, double-click to rename';
    nameSpan.addEventListener('click', () => loadConvo(c.id));
    nameSpan.addEventListener('dblclick', (ev) => {
      ev.stopPropagation();
      const renameInput = document.createElement('input');
      renameInput.type = 'text';
      renameInput.className = 'convo-rename-input';
      renameInput.value = c.name;
      nameSpan.replaceWith(renameInput);
      renameInput.focus();
      renameInput.select();
      const commitRename = () => {
        renameConvo(c.id, renameInput.value);
      };
      renameInput.addEventListener('blur', commitRename);
      renameInput.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { ke.preventDefault(); renameInput.blur(); }
        if (ke.key === 'Escape') { renameInput.value = c.name; renameInput.blur(); }
      });
    });
    const delSpan = document.createElement('span');
    delSpan.className = 'panel-item-del';
    delSpan.textContent = 'x';
    delSpan.addEventListener('click', (ev) => { ev.stopPropagation(); deleteConvo(c.id); });
    d.appendChild(nameSpan);
    d.appendChild(delSpan);
    el.appendChild(d);
  });
}

/* ── Memory Management ── */
function addMemoryFromInput() {
  const inp = document.getElementById('memory-input');
  const text = inp.value.trim();
  if (!text) return;
  state.memory[`mem_${Date.now()}`] = text;
  inp.value = '';
  updateCounters();
  renderMemoryList();
}

function deleteMemoryEntry(key) { delete state.memory[key]; updateCounters(); renderMemoryList(); }

function renderMemoryList() {
  const el = document.getElementById('memory-list');
  const entries = Object.entries(state.memory).filter(([, v]) => typeof v === 'string');
  if (!entries.length) { el.innerHTML = '<div class="panel-empty">no memories</div>'; return; }
  el.innerHTML = '';
  entries.forEach(([k, v]) => {
    const d = document.createElement('div'); d.className = 'panel-item';
    d.innerHTML = `<span class="panel-item-text">${v}</span><span class="panel-item-del">x</span>`;
    d.querySelector('.panel-item-del').addEventListener('click', () => deleteMemoryEntry(k));
    el.appendChild(d);
  });
}

/* ── Panel Toggles ── */
const ALL_PANELS = [
  { headerId: 'search-toggle',    bodyId: 'search-panel' },
  { headerId: 'convos-toggle',    bodyId: 'convos-panel' },
  { headerId: 'sysprompt-toggle', bodyId: 'sysprompt-panel' },
  { headerId: 'stopwatch-toggle', bodyId: 'stopwatch-panel' },
  { headerId: 'memory-toggle',    bodyId: 'memory-panel' },
];

function togglePanel(header, body) {
  const isCurrentlyOpen = !body.classList.contains('hidden');

  // Close every panel first
  ALL_PANELS.forEach(({ headerId, bodyId }) => {
    const panelBody = document.getElementById(bodyId);
    const panelHeader = document.getElementById(headerId);
    if (panelBody && !panelBody.classList.contains('hidden')) {
      panelBody.classList.add('hidden');
      panelHeader.querySelector('.panel-arrow').textContent = '+';
    }
  });

  // If it was closed before, open it now
  if (!isCurrentlyOpen) {
    body.classList.remove('hidden');
    header.querySelector('.panel-arrow').textContent = '-';
  }
}

document.getElementById('convos-toggle').addEventListener('click', () => togglePanel(document.getElementById('convos-toggle'), document.getElementById('convos-panel')));
document.getElementById('memory-toggle').addEventListener('click', () => togglePanel(document.getElementById('memory-toggle'), document.getElementById('memory-panel')));
document.getElementById('new-convo-btn').addEventListener('click', clearChat);
document.getElementById('save-convo-btn').addEventListener('click', saveCurrentConvo);
document.getElementById('clear-convo-btn').addEventListener('click', clearAllConvos);
document.getElementById('add-memory-btn').addEventListener('click', addMemoryFromInput);
document.getElementById('memory-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMemoryFromInput(); } });

chatArea.addEventListener('dragover', (e) => { e.preventDefault(); chatArea.classList.add('drag-over'); });
chatArea.addEventListener('dragleave', () => chatArea.classList.remove('drag-over'));
chatArea.addEventListener('drop', (e) => { e.preventDefault(); chatArea.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]); });
form.addEventListener('submit', handleSubmit);
imageUploadInput.addEventListener('change', (e) => { if (e.target.files[0]) handleImageFile(e.target.files[0]); e.target.value = ''; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelector('.image-overlay')?.remove(); });

function restoreSavedMessages() {
  if (state.history.length === 0) return;
  clearWelcome();
  for (const msg of state.history) {
    if (msg.role === 'user') addUserMessage(msg.content);
    else if (msg.role === 'assistant') addAiMessage(msg.content);
  }
}

/* ── Typing indicator text cycler ── */
const typingSnippets = [
  '> async fn generate()',
  '> yield* tokens()',
  '> await model.forward()',
  '> stream.pipe(response)',
  '> for await (const tok of llm)',
  '> decoding { logits }',
  '> sampling(temperature=0.7)',
];
let typingLineEl = document.querySelector('#typing-indicator .typing-line');
let typingInterval = null;
let typingCharIndex = 0;
let typingSnippetIndex = 0;

function startTypingCycler() {
  if (typingInterval) return;
  typingCharIndex = 0;
  typingSnippetIndex = Math.floor(Math.random() * typingSnippets.length);
  if (typingLineEl) typingLineEl.textContent = '';
  typingInterval = setInterval(() => {
    const currentSnippet = typingSnippets[typingSnippetIndex];
    if (typingCharIndex <= currentSnippet.length) {
      if (typingLineEl) typingLineEl.textContent = currentSnippet.slice(0, typingCharIndex);
      typingCharIndex++;
    } else {
      typingCharIndex = 0;
      typingSnippetIndex = (typingSnippetIndex + 1) % typingSnippets.length;
    }
  }, 65);
}

function stopTypingCycler() {
  clearInterval(typingInterval);
  typingInterval = null;
  if (typingLineEl) typingLineEl.textContent = '';
}

const originalTypingRemove = typingEl.classList.remove.bind(typingEl.classList);
const originalTypingAdd = typingEl.classList.add.bind(typingEl.classList);

typingEl.classList.remove = function (...args) {
  originalTypingRemove(...args);
  if (args.includes('hidden') && !typingEl.classList.contains('hidden')) {
    startTypingCycler();
  }
};
typingEl.classList.add = function (...args) {
  originalTypingAdd(...args);
  if (args.includes('hidden')) {
    stopTypingCycler();
  }
};

/* ── Mobile sidebar toggle ── */
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
}

function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('active');
}

sidebarToggle.addEventListener('click', () => {
  if (sidebar.classList.contains('open')) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

sidebarOverlay.addEventListener('click', closeSidebar);
sidebarCloseBtn.addEventListener('click', closeSidebar);

/* Swipe-to-close sidebar on mobile */
let touchStartX = 0;
let touchCurrentX = 0;
let isSwiping = false;

sidebar.addEventListener('touchstart', (event) => {
  touchStartX = event.touches[0].clientX;
  isSwiping = true;
}, { passive: true });

sidebar.addEventListener('touchmove', (event) => {
  if (!isSwiping) return;
  touchCurrentX = event.touches[0].clientX;
  const swipeDelta = touchStartX - touchCurrentX;
  if (swipeDelta > 0 && sidebar.classList.contains('open')) {
    const clampedDelta = Math.min(swipeDelta, sidebar.offsetWidth);
    sidebar.style.transform = `translateX(-${clampedDelta}px)`;
  }
}, { passive: true });

sidebar.addEventListener('touchend', () => {
  if (!isSwiping) return;
  isSwiping = false;
  const swipeDelta = touchStartX - touchCurrentX;
  sidebar.style.transform = '';
  if (swipeDelta > 80) {
    closeSidebar();
  }
}, { passive: true });

/* ── System Prompt Editor ── */
const syspromptInput = document.getElementById('sysprompt-input');
const savedCustomPrompt = localStorage.getItem(SYSPROMPT_KEY);
syspromptInput.value = savedCustomPrompt || DEFAULT_SYSTEM_PROMPT;

document.getElementById('sysprompt-toggle').addEventListener('click', () => togglePanel(document.getElementById('sysprompt-toggle'), document.getElementById('sysprompt-panel')));
document.getElementById('sysprompt-save-btn').addEventListener('click', () => {
  const promptValue = syspromptInput.value.trim();
  if (promptValue && promptValue !== DEFAULT_SYSTEM_PROMPT) {
    localStorage.setItem(SYSPROMPT_KEY, promptValue);
  } else {
    localStorage.removeItem(SYSPROMPT_KEY);
  }
  addAiMessage('System prompt updated.');
});
document.getElementById('sysprompt-reset-btn').addEventListener('click', () => {
  localStorage.removeItem(SYSPROMPT_KEY);
  syspromptInput.value = DEFAULT_SYSTEM_PROMPT;
  addAiMessage('System prompt reset to default.');
});

showWelcome();
restoreSavedMessages();
updateCounters();
renderConvoList();
renderMemoryList();
loadAllModels();
