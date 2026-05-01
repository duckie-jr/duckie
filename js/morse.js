// ─── Morse tables ──────────────────────────────────────────────────────────
const MORSE = {
  A:'.-',   B:'-...', C:'-.-.', D:'-..', E:'.',    F:'..-.', G:'--.',   H:'....',
  I:'..',   J:'.---', K:'-.-',  L:'.-..', M:'--',   N:'-.',   O:'---',   P:'.--.',
  Q:'--.-', R:'.-.',  S:'...',  T:'-',    U:'..-',  V:'...-', W:'.--',   X:'-..-',
  Y:'-.--', Z:'--..',
  '0':'-----', '1':'.----', '2':'..---', '3':'...--', '4':'....-',
  '5':'.....', '6':'-....', '7':'--...', '8':'---..', '9':'----.',
  '.':'.-.-.-', ',':'--..--', '?':'..--..', "'":'.--.-..',
  '!':'-.-.--', '/':'-..-.', '(':'-.--.', ')':'-.--.-',
  '&':'.-...', ':':'---...', ';':'-.-.-.', '=':'-...-',
  '+':'.-.-.', '-':'-....-', '_':'..--.-', '"':'.-..-.',
  '$':'...-..-', '@':'.--.-.',
};



const DECODE = Object.fromEntries(Object.entries(MORSE).map(([char, morse]) => [morse, char]));
const symStr = str => str.replace(/\./g, '·').replace(/-/g, '—');

// ─── Themes ────────────────────────────────────────────────────────────────
const THEMES = {
  amber:   { label:'Amber',    preview:{ bg:'#0c0d11', accent:'#f5a623' }, vars:{ '--bg':'#0c0d11','--surface':'#14161f','--surface2':'#1b1d28','--border':'#252838','--accent':'#f5a623','--text':'#dde0f0','--dim':'#484b66','--green':'#4ec98a','--red':'#e05c5c' }},
  terminal:{ label:'Terminal', preview:{ bg:'#030a04', accent:'#00e84a' }, vars:{ '--bg':'#030a04','--surface':'#071009','--surface2':'#0c1a0e','--border':'#143018','--accent':'#00e84a','--text':'#aaeeb4','--dim':'#286030','--green':'#00e84a','--red':'#ff4455' }},
  ocean:   { label:'Ocean',    preview:{ bg:'#050c18', accent:'#00ccff' }, vars:{ '--bg':'#050c18','--surface':'#091528','--surface2':'#0d1f3c','--border':'#162e58','--accent':'#00ccff','--text':'#b8dcff','--dim':'#254878','--green':'#00ffaa','--red':'#ff4466' }},
  crimson: { label:'Crimson',  preview:{ bg:'#110508', accent:'#ff2244' }, vars:{ '--bg':'#110508','--surface':'#1e0b10','--surface2':'#2c1018','--border':'#44181f','--accent':'#ff2244','--text':'#f0c8cc','--dim':'#662830','--green':'#44dd88','--red':'#ff2244' }},
  violet:  { label:'Violet',   preview:{ bg:'#0a0610', accent:'#cc66ff' }, vars:{ '--bg':'#0a0610','--surface':'#130e20','--surface2':'#1c1630','--border':'#2e2248','--accent':'#cc66ff','--text':'#e8d8ff','--dim':'#5a4478','--green':'#44ddaa','--red':'#ff5566' }},
  paper:   { label:'Paper',    preview:{ bg:'#f4f0e4', accent:'#8b4513' }, vars:{ '--bg':'#f4f0e4','--surface':'#faf8f2','--surface2':'#ece8dc','--border':'#ccc8bc','--accent':'#8b4513','--text':'#28200f','--dim':'#998870','--green':'#2d7a48','--red':'#cc2222' }},
  sunset:  { label:'Sunset',   preview:{ bg:'#16060a', accent:'#ff6b35' }, vars:{ '--bg':'#16060a','--surface':'#241010','--surface2':'#321818','--border':'#4a2020','--accent':'#ff6b35','--text':'#ffe0cc','--dim':'#7a3828','--green':'#44dd88','--red':'#ff2244' }},
  midnight:{ label:'Midnight', preview:{ bg:'#02030f', accent:'#7eb8ff' }, vars:{ '--bg':'#02030f','--surface':'#080c1e','--surface2':'#0e1430','--border':'#1a2448','--accent':'#7eb8ff','--text':'#c8d8ff','--dim':'#2a3a6a','--green':'#44ddaa','--red':'#ff5566' }},
  neon:    { label:'Neon',     preview:{ bg:'#080810', accent:'#ff00ff' }, vars:{ '--bg':'#080810','--surface':'#0e0e1e','--surface2':'#16162c','--border':'#26204a','--accent':'#ff00ff','--text':'#f0d8ff','--dim':'#4a3070','--green':'#00ffaa','--red':'#ff2255' }},
  copper:  { label:'Copper',   preview:{ bg:'#100800', accent:'#c87833' }, vars:{ '--bg':'#100800','--surface':'#1c1000','--surface2':'#281800','--border':'#3c2800','--accent':'#c87833','--text':'#f0d8b0','--dim':'#6a4820','--green':'#88cc44','--red':'#dd4422' }},
  arctic:  { label:'Arctic',   preview:{ bg:'#0a0e12', accent:'#88ccdd' }, vars:{ '--bg':'#0a0e12','--surface':'#121820','--surface2':'#1a2430','--border':'#263444','--accent':'#88ccdd','--text':'#d0e4ec','--dim':'#34505e','--green':'#44ddbb','--red':'#ff5566' }},
  sakura:  { label:'Sakura',   preview:{ bg:'#120008', accent:'#ff69b4' }, vars:{ '--bg':'#120008','--surface':'#200010','--surface2':'#2e0018','--border':'#440028','--accent':'#ff69b4','--text':'#ffd0e8','--dim':'#6a2048','--green':'#44dd88','--red':'#ff2244' }},
};

// ─── Config ────────────────────────────────────────────────────────────────
const DEFAULTS = {
  theme: 'amber', soundOn: true, volume: 80,
  pitch: 680, waveform: 'sine', hapticOn: true,
  letterDelayMs: 1000, autoWordSpace: true,
  textSize: 'md', showMorse: false,
  transformPreset: 'upper',
};
let cfg = { ...DEFAULTS };

function loadCfg() {
  try {
    const stored = localStorage.getItem('morse-cfg');
    if (stored) cfg = { ...DEFAULTS, ...JSON.parse(stored) };
  } catch (_) {}
}

function saveCfg() {
  localStorage.setItem('morse-cfg', JSON.stringify(cfg));
}

// ─── WPM ───────────────────────────────────────────────────────────────────
const commitTimes = [];

function recordCommit() {
  const now = Date.now();
  commitTimes.push(now);
  while (commitTimes.length && now - commitTimes[0] > 60000) commitTimes.shift();
  updateWpmDisplay();
}

function updateWpmDisplay() {
  const displayEl = document.getElementById('wpm-display');
  if (!displayEl) return;
  const now = Date.now();
  const recentTimes = commitTimes.filter(t => now - t < 60000);
  if (recentTimes.length < 2) { displayEl.textContent = '– wpm'; return; }
  const elapsedMinutes = (now - recentTimes[0]) / 60000;
  displayEl.textContent = Math.round((recentTimes.length / 5) / elapsedMinutes) + ' wpm';
}

// ─── Audio ─────────────────────────────────────────────────────────────────
const audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);

function makeTone(startTime, duration) {
  const oscillator = audioCtx.createOscillator();
  const gainNode   = audioCtx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(masterGain);
  oscillator.frequency.value = cfg.pitch;
  oscillator.type            = cfg.waveform;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.85, startTime + 0.005);
  gainNode.gain.setValueAtTime(0.85, startTime + duration - 0.005);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function playKeyTone(isDash) {
  if (!cfg.soundOn) return;
  audioCtx.resume();
  masterGain.gain.value = cfg.volume / 100;
  const dotDuration = 0.08;
  makeTone(audioCtx.currentTime + 0.01, isDash ? dotDuration * 3 : dotDuration);
}

function playRefTone(morseCode) {
  if (!cfg.soundOn) return;
  audioCtx.resume();
  masterGain.gain.value = cfg.volume / 100;
  const dotDuration  = 0.08;
  const dashDuration = dotDuration * 3;
  const gapDuration  = dotDuration;
  let scheduledTime = audioCtx.currentTime + 0.05;
  morseCode.split('').forEach((symbol, index, allSymbols) => {
    const symbolDuration = symbol === '-' ? dashDuration : dotDuration;
    makeTone(scheduledTime, symbolDuration);
    scheduledTime += symbolDuration + (index < allSymbols.length - 1 ? gapDuration : 0);
  });
}

function vibrate(durationMs) {
  if (cfg.hapticOn && navigator.vibrate) navigator.vibrate(durationMs);
}
// ─── Notes state ───────────────────────────────────────────────────────────
const entries     = [];
let   pendingSyms = [];
let   letterTimer = null;
let   wordTimer   = null;
let   cursorPosition = 0; // insertion point: 0..entries.length

// ─── Undo stack ───────────────────────────────────────────────────────────
const undoStack = [];
const MAX_UNDO  = 60;

function pushUndoSnapshot() {
  undoStack.push({ entries: entries.map(e => ({ ...e })), cursorPosition });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

function undo() {
  if (!undoStack.length) return;
  clearTimeout(letterTimer);
  clearTimeout(wordTimer);
  const snapshot = undoStack.pop();
  entries.length = 0;
  entries.push(...snapshot.entries);
  cursorPosition = snapshot.cursorPosition;
  pendingSyms    = [];
  refreshPending();
  refreshNotes();
}

const outputText  = () => entries.map(entry => entry.space ? ' ' : entry.char).join('');
const outputMorse = () => entries.map(entry => entry.space ? '   ' : symStr(entry.morse)).join(' ');

// ─── DOM refs ──────────────────────────────────────────────────────────────
const elNotes      = document.getElementById('notes');
const elNotesMorse = document.getElementById('notes-morse');
const elPendSyms   = document.getElementById('pend-syms');
const elPendArrow  = document.getElementById('pend-arrow');
const elPendChar   = document.getElementById('pend-char');
const elCharCount  = document.getElementById('char-count');

// ─── Input logic ───────────────────────────────────────────────────────────
function addSymbol(isDash) {
  audioCtx.resume();
  clearTimeout(letterTimer);
  clearTimeout(wordTimer);
  pendingSyms.push(isDash ? '-' : '.');
  playKeyTone(isDash);
  vibrate(isDash ? 28 : 10);
  refreshPending();
  letterTimer = setTimeout(commitLetter, cfg.letterDelayMs);
}

function commitLetter() {
  if (!pendingSyms.length) return;
  pushUndoSnapshot();
  const morseSequence = pendingSyms.join('');
  const decodedChar   = DECODE[morseSequence] ?? '?';
  entries.splice(cursorPosition, 0, { char: decodedChar, morse: morseSequence });
  cursorPosition++;
  pendingSyms = [];
  refreshPending();
  refreshNotes();
  flashRefCard(decodedChar);
  recordCommit();
  if (cfg.autoWordSpace) {
    wordTimer = setTimeout(() => {
      entries.splice(cursorPosition, 0, { space: true });
      cursorPosition++;
      refreshNotes();
    }, cfg.letterDelayMs * 2.5);
  }
}

function addSpace() {
  clearTimeout(letterTimer);
  clearTimeout(wordTimer);
  pushUndoSnapshot();
  if (pendingSyms.length) {
    const morseSequence = pendingSyms.join('');
    const decodedChar   = DECODE[morseSequence] ?? '?';
    entries.splice(cursorPosition, 0, { char: decodedChar, morse: morseSequence });
    cursorPosition++;
    pendingSyms = [];
    flashRefCard(decodedChar);
    recordCommit();
  }
  entries.splice(cursorPosition, 0, { space: true });
  cursorPosition++;
  refreshPending();
  refreshNotes();
}

function backspace() {
  clearTimeout(letterTimer);
  clearTimeout(wordTimer);
  if (pendingSyms.length) {
    pendingSyms.pop();
    refreshPending();
    if (pendingSyms.length) letterTimer = setTimeout(commitLetter, cfg.letterDelayMs);
  } else if (cursorPosition > 0) {
    pushUndoSnapshot();
    entries.splice(cursorPosition - 1, 1);
    cursorPosition--;
    refreshNotes();
  }
}

function clearAll() {
  if (!entries.length && !pendingSyms.length) return;
  pushUndoSnapshot();
  clearTimeout(letterTimer);
  clearTimeout(wordTimer);
  entries.length = 0;
  cursorPosition = 0;
  pendingSyms    = [];
  refreshPending();
  refreshNotes();
}

function moveCursorLeft() {
  if (cursorPosition > 0) {
    cursorPosition--;
    refreshNotes();
  }
}

function moveCursorRight() {
  if (cursorPosition < entries.length) {
    cursorPosition++;
    refreshNotes();
  }
}

// ─── Display ───────────────────────────────────────────────────────────────
function refreshPending() {
  const morseSequence = pendingSyms.join('');
  if (!morseSequence) {
    elPendSyms.textContent = elPendArrow.textContent = elPendChar.textContent = '';
    return;
  }
  elPendSyms.textContent  = symStr(morseSequence);
  elPendArrow.textContent = '→';
  elPendChar.textContent  = DECODE[morseSequence] ?? '?';
}

function refreshNotes() {
  const rawText   = outputText();
  const charCount = rawText.replace(/ /g, '').length;
  const wordCount = rawText.trim().length ? rawText.trim().split(/\s+/).length : 0;
  elCharCount.textContent = `${charCount} chars · ${wordCount} word${wordCount !== 1 ? 's' : ''}`;
  if (!rawText) {
    elNotes.innerHTML        = '<span class="notes-hint">tap the keys below…</span>';
    elNotesMorse.textContent = '';
    return;
  }
  const fullTransformed   = applyTransform(rawText);
  const splitIndex        = Math.min(cursorPosition, fullTransformed.length);
  const escape            = str => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const beforeCursor      = escape(fullTransformed.substring(0, splitIndex));
  const afterCursor       = escape(fullTransformed.substring(splitIndex));
  elNotes.innerHTML        = beforeCursor + '<span class="cursor"></span>' + afterCursor;
  elNotesMorse.textContent = outputMorse();
}

function flashRefCard(char) {
  const card = document.querySelector(`.ref-card[data-char="${char}"]`);
  if (!card) return;
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 500);
}

// ─── Theme / display helpers ───────────────────────────────────────────────
function applyTheme(themeName) {
  const theme = THEMES[themeName];
  if (!theme) return;
  Object.entries(theme.vars).forEach(([property, value]) =>
    document.documentElement.style.setProperty(property, value)
  );
  cfg.theme = themeName;
  document.querySelectorAll('.theme-card').forEach(card =>
    card.classList.toggle('on', card.dataset.theme === themeName)
  );
}

function applyTextSize(size) {
  cfg.textSize      = size;
  elNotes.className = 'notes sz-' + size;
  document.querySelectorAll('#size-btns button').forEach(btn =>
    btn.classList.toggle('on', btn.dataset.size === size)
  );
}

function applyShowMorse(isVisible) {
  cfg.showMorse = isVisible;
  elNotesMorse.classList.toggle('visible', isVisible);
}

// ─── Text transform ────────────────────────────────────────────────────────
const PRESET_TRANSFORMS = {
  upper:    text => text.toUpperCase(),
  lower:    text => text.toLowerCase(),
  sentence: text => text
    .toLowerCase()
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix, char) => prefix + char.toUpperCase()),
  title:    text => text.toLowerCase().replace(/\b[a-z]/g, char => char.toUpperCase()),
};

let customTransformFn   = null;
let customTransformName = '';

function applyTransform(rawText) {
  if (customTransformFn) {
    try { return customTransformFn(rawText); } catch (_) { return rawText; }
  }
  const presetFn = PRESET_TRANSFORMS[cfg.transformPreset];
  return presetFn ? presetFn(rawText) : rawText;
}

function loadTransformFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      // File must define a function named `transform(text)` — it will be extracted and called
      const wrappedFn = new Function(e.target.result + '\nreturn typeof transform === "function" ? transform : null;');
      const fn = wrappedFn();
      if (typeof fn !== 'function') throw new Error('No "transform" function found. Make sure your file defines: function transform(text) { ... }');
      customTransformFn   = fn;
      customTransformName = file.name;
      document.getElementById('transform-file-name').textContent = file.name;
      document.getElementById('transform-file-row').style.display = '';
      // Deselect preset buttons while custom is active
      document.querySelectorAll('#transform-preset-btns button').forEach(btn => btn.classList.remove('on'));
      refreshNotes();
    } catch (err) {
      alert('Transform load error:\n' + err.message);
    }
  };
  reader.readAsText(file);
}

function clearCustomTransform() {
  customTransformFn   = null;
  customTransformName = '';
  document.getElementById('transform-file-row').style.display = 'none';
  // Restore preset button highlight
  document.querySelectorAll('#transform-preset-btns button').forEach(btn =>
    btn.classList.toggle('on', btn.dataset.preset === cfg.transformPreset)
  );
  refreshNotes();
}

function initTransform() {
  const presetContainer = document.getElementById('transform-preset-btns');

  presetContainer.querySelectorAll('button').forEach(btn =>
    btn.classList.toggle('on', btn.dataset.preset === cfg.transformPreset)
  );

  presetContainer.addEventListener('click', e => {
    const preset = e.target.dataset.preset;
    if (!preset) return;
    cfg.transformPreset = preset;
    customTransformFn   = null;
    document.getElementById('transform-file-row').style.display = 'none';
    presetContainer.querySelectorAll('button').forEach(btn =>
      btn.classList.toggle('on', btn.dataset.preset === preset)
    );
    saveCfg();
    refreshNotes();
  });

  // Hidden file input — accepts .js files
  const fileInput  = document.createElement('input');
  fileInput.type   = 'file';
  fileInput.accept = '.js';
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadTransformFile(file);
    fileInput.value = '';  // reset so the same file can be re-uploaded
  });

  document.getElementById('transform-upload-btn').addEventListener('click', () => fileInput.click());
  document.getElementById('transform-clear-btn').addEventListener('click', clearCustomTransform);
}

// ─── Settings ──────────────────────────────────────────────────────────────
function openSettings() {
  document.getElementById('settings-panel').classList.add('open');
  document.getElementById('settings-overlay').classList.add('open');
}

function closeSettings() {
  document.getElementById('settings-panel').classList.remove('open');
  document.getElementById('settings-overlay').classList.remove('open');
}

function syncToggles() {
  const toggleMap = {
    'tog-sound':     'soundOn',
    'tog-haptic':    'hapticOn',
    'tog-autoword':  'autoWordSpace',
    'tog-showmorse': 'showMorse',
  };
  Object.entries(toggleMap).forEach(([buttonId, configKey]) => {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.dataset.on  = cfg[configKey];
    button.textContent = cfg[configKey] ? 'ON' : 'OFF';
  });
}

function initSettings() {
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('settings-overlay').addEventListener('click', closeSettings);

  function wireToggle(buttonId, configKey, onChange) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.addEventListener('click', () => {
      cfg[configKey]     = !cfg[configKey];
      button.dataset.on  = cfg[configKey];
      button.textContent = cfg[configKey] ? 'ON' : 'OFF';
      saveCfg();
      if (onChange) onChange(cfg[configKey]);
    });
  }

  wireToggle('tog-sound', 'soundOn', isOn => {
    document.getElementById('volume-row').style.opacity = isOn ? '1' : '.4';
  });
  wireToggle('tog-haptic',    'hapticOn');
  wireToggle('tog-autoword',  'autoWordSpace');
  wireToggle('tog-showmorse', 'showMorse', isOn => applyShowMorse(isOn));

  // Volume
  const volumeSlider = document.getElementById('vol-slider');
  const volumeLabel  = document.getElementById('vol-label');
  volumeSlider.value = cfg.volume;
  volumeLabel.textContent = cfg.volume + '%';
  volumeSlider.addEventListener('input', () => {
    cfg.volume = Number(volumeSlider.value);
    volumeLabel.textContent = cfg.volume + '%';
    saveCfg();
  });
  document.getElementById('volume-row').style.opacity = cfg.soundOn ? '1' : '.4';

  // Pitch
  const pitchSlider = document.getElementById('pitch-slider');
  const pitchLabel  = document.getElementById('pitch-label');
  pitchSlider.value = cfg.pitch;
  pitchLabel.textContent = cfg.pitch + ' Hz';
  pitchSlider.addEventListener('input', () => {
    cfg.pitch = Number(pitchSlider.value);
    pitchLabel.textContent = cfg.pitch + ' Hz';
    saveCfg();
  });

  // Waveform
  const waveButtonsContainer = document.getElementById('wave-btns');
  waveButtonsContainer.addEventListener('click', e => {
    const waveformType = e.target.dataset.wave;
    if (!waveformType) return;
    cfg.waveform = waveformType;
    waveButtonsContainer.querySelectorAll('button').forEach(btn =>
      btn.classList.toggle('on', btn.dataset.wave === waveformType)
    );
    saveCfg();
  });
  waveButtonsContainer.querySelectorAll('button').forEach(btn =>
    btn.classList.toggle('on', btn.dataset.wave === cfg.waveform)
  );

  // Letter delay
  const delaySlider = document.getElementById('delay-slider');
  const delayLabel  = document.getElementById('delay-label');
  delaySlider.value = cfg.letterDelayMs / 100;
  delayLabel.textContent = (cfg.letterDelayMs / 1000).toFixed(1) + 's';
  delaySlider.addEventListener('input', () => {
    cfg.letterDelayMs = Number(delaySlider.value) * 100;
    delayLabel.textContent = (cfg.letterDelayMs / 1000).toFixed(1) + 's';
    saveCfg();
  });

  // Text size
  document.getElementById('size-btns').addEventListener('click', e => {
    const size = e.target.dataset.size;
    if (!size) return;
    applyTextSize(size);
    saveCfg();
  });

  // Reset
  document.getElementById('reset-btn').addEventListener('click', () => {
    cfg = { ...DEFAULTS };
    saveCfg();
    applyTheme(cfg.theme);
    applyTextSize(cfg.textSize);
    applyShowMorse(cfg.showMorse);
    syncToggles();
    volumeSlider.value     = cfg.volume;
    volumeLabel.textContent = cfg.volume + '%';
    pitchSlider.value      = cfg.pitch;
    pitchLabel.textContent  = cfg.pitch + ' Hz';
    delaySlider.value      = cfg.letterDelayMs / 100;
    delayLabel.textContent  = (cfg.letterDelayMs / 1000).toFixed(1) + 's';
    waveButtonsContainer.querySelectorAll('button').forEach(btn =>
      btn.classList.toggle('on', btn.dataset.wave === cfg.waveform)
    );
    document.getElementById('volume-row').style.opacity = '1';
    clearCustomTransform();
    buildThemeGrid();
    closeSettings();
  });
}
// ─── Build theme grid ──────────────────────────────────────────────────────
function buildThemeGrid() {
  const grid = document.getElementById('theme-grid');
  grid.innerHTML = '';
  Object.entries(THEMES).forEach(([themeKey, theme]) => {
    const card = document.createElement('div');
    card.className    = 'theme-card';
    card.dataset.theme = themeKey;
    if (themeKey === cfg.theme) card.classList.add('on');
    card.innerHTML =
      `<div class="theme-preview" style="background:${theme.preview.bg}">` +
        `<div class="theme-preview-dot"  style="background:${theme.preview.accent}"></div>` +
        `<div class="theme-preview-dash" style="background:${theme.preview.accent}"></div>` +
      `</div>` +
      `<div class="theme-name">${theme.label}</div>`;
    card.addEventListener('pointerdown', e => {
      e.preventDefault();
      applyTheme(themeKey);
      saveCfg();
    });
    grid.appendChild(card);
  });
}

// ─── Build reference index ─────────────────────────────────────────────────
function buildReference() {
  const container = document.getElementById('ref-content');
  container.innerHTML = '';

  const SECTIONS = [
    { label: 'Letters',     chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
    { label: 'Numbers',     chars: '0123456789'.split('') },
    { label: 'Punctuation', chars: ['.', ',', '?', '!', "'", '/', '(', ')', '&', ':', ';', '=', '+', '-', '_', '"', '$', '@'] },
  ];

  SECTIONS.forEach(section => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'ref-section';

    const labelEl = document.createElement('div');
    labelEl.className   = 'ref-section-label';
    labelEl.textContent = section.label;
    sectionEl.appendChild(labelEl);

    const grid = document.createElement('div');
    grid.className = 'ref-grid';

    section.chars.forEach(char => {
      const morseCode = MORSE[char];
      if (!morseCode) return;
      const card = document.createElement('div');
      card.className    = 'ref-card';
      card.dataset.char = char;
      card.innerHTML =
        `<span class="ref-letter">${char}</span>` +
        `<span class="ref-morse">${symStr(morseCode)}</span>`;
      card.addEventListener('pointerdown', e => {
        e.preventDefault();
        playRefTone(morseCode);
        flashRefCard(char);
      });
      grid.appendChild(card);
    });

    sectionEl.appendChild(grid);
    container.appendChild(sectionEl);
  });
}

// ─── Keyboard ──────────────────────────────────────────────────────────────
function initKeyboard() {
  document.getElementById('btn-dot').addEventListener('pointerdown',  e => { e.preventDefault(); addSymbol(false); });
  document.getElementById('btn-dash').addEventListener('pointerdown', e => { e.preventDefault(); addSymbol(true);  });
  document.getElementById('btn-space').addEventListener('pointerdown',e => { e.preventDefault(); addSpace();       });

  // Hold-to-repeat backspace
  const backBtn = document.getElementById('btn-back');
  let backHoldTimer   = null;
  let backRepeatTimer = null;

  function startBackspace() {
    backspace();
    backHoldTimer = setTimeout(() => {
      backRepeatTimer = setInterval(backspace, 80);
    }, 450);
  }
  function stopBackspace() {
    clearTimeout(backHoldTimer);
    clearInterval(backRepeatTimer);
  }

  backBtn.addEventListener('pointerdown',  e => { e.preventDefault(); startBackspace(); });
  backBtn.addEventListener('pointerup',    stopBackspace);
  backBtn.addEventListener('pointerleave', stopBackspace);

  // Hold-to-clear (600 ms) — animates red, then fires
  const clearBtn       = document.getElementById('btn-clear');
  let   clearHoldTimer = null;

  function startClearHold(e) {
    e.preventDefault();
    clearBtn.classList.add('holding');
    clearHoldTimer = setTimeout(() => {
      clearBtn.classList.remove('holding');
      clearAll();
      vibrate(30);
    }, 600);
  }
  function cancelClearHold() {
    clearTimeout(clearHoldTimer);
    clearBtn.classList.remove('holding');
  }

  clearBtn.addEventListener('pointerdown',  startClearHold);
  clearBtn.addEventListener('pointerup',    cancelClearHold);
  clearBtn.addEventListener('pointerleave', cancelClearHold);

  document.getElementById('btn-left').addEventListener('pointerdown',  e => { e.preventDefault(); moveCursorLeft();  });
  document.getElementById('btn-right').addEventListener('pointerdown', e => { e.preventDefault(); moveCursorRight(); });
}

// ─── Swipe gestures on keyboard ───────────────────────────────────────────
function initSwipeBackspace() {
  const keyboard = document.getElementById('keyboard');
  let touchStartX = 0;
  let touchStartY = 0;

  keyboard.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  keyboard.addEventListener('touchend', e => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(deltaY) > 35) return;
    if (deltaX < -55) backspace();
    if (deltaX >  55) undo();
  }, { passive: true });
}

// ─── Physical keyboard shortcuts ───────────────────────────────────────────
function initKeyShortcuts() {
  document.addEventListener('keydown', e => {
    if (document.activeElement.tagName === 'INPUT') return;
    if (e.code === 'Minus')        { e.preventDefault(); addSymbol(false);  }
    if (e.code === 'Equal')        { e.preventDefault(); addSymbol(true);   }
    if (e.code === 'Space')        { e.preventDefault(); addSpace();         }
    if (e.code === 'Backspace')    { e.preventDefault(); backspace();        }
    if (e.code === 'BracketLeft')  { e.preventDefault(); moveCursorLeft();  }
    if (e.code === 'BracketRight') { e.preventDefault(); moveCursorRight(); }
    if (e.code === 'KeyU' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); undo(); }
    if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
  });
}

// ─── Reference panel toggle ────────────────────────────────────────────────
function initRefToggle() {
  document.getElementById('ref-toggle').addEventListener('click', () => {
    document.getElementById('ref-panel').classList.toggle('open');
  });
}

// ─── Copy ──────────────────────────────────────────────────────────────────
function initCopy() {
  const copyBtn = document.getElementById('copy-btn');
  copyBtn.addEventListener('click', async () => {
    const text = applyTransform(outputText());
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'copy';
        copyBtn.classList.remove('copied');
      }, 1800);
    } catch (_) {
      copyBtn.textContent = 'failed';
      setTimeout(() => { copyBtn.textContent = 'copy'; }, 1500);
    }
  });
}

// ─── Boot ──────────────────────────────────────────────────────────────────
loadCfg();
applyTheme(cfg.theme);
applyTextSize(cfg.textSize);
applyShowMorse(cfg.showMorse);
buildThemeGrid();
buildReference();
syncToggles();
initSettings();
initKeyboard();
initSwipeBackspace();
initKeyShortcuts();
initRefToggle();
initCopy();
initTransform();
refreshNotes();
