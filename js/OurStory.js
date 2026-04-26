// ================================================================
// STATE
// ================================================================
const STORAGE_KEY = 'youandme';

const DEFAULT_STATE = {
  person1: { name: 'Person 1', nickname: '', birthday: '', photo: '', likes: [], dislikes: [], hobbies: [] },
  person2: { name: 'Person 2', nickname: '', birthday: '', photo: '', likes: [], dislikes: [], hobbies: [] },
  couple:  { anniversary: '', firstDate: '', milestones: [], notes: '' },
};

function mergeWithDefaults(defaults, saved) {
  const merged = { ...defaults };
  for (const key of Object.keys(saved)) {
    const isPlainObject =
      typeof saved[key] === 'object' && saved[key] !== null && !Array.isArray(saved[key]);
    merged[key] = isPlainObject ? mergeWithDefaults(defaults[key] ?? {}, saved[key]) : saved[key];
  }
  return merged;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? mergeWithDefaults(DEFAULT_STATE, JSON.parse(raw)) : structuredClone(DEFAULT_STATE);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  refreshSidebarNames();
}

let appState = loadState();
let currentSection = 'couple';

// ================================================================
// SIDEBAR HELPERS
// ================================================================
function refreshSidebarNames() {
  const p1 = document.getElementById('nav-label-person1');
  const p2 = document.getElementById('nav-label-person2');
  if (p1) p1.textContent = appState.person1.name || 'Person 1';
  if (p2) p2.textContent = appState.person2.name || 'Person 2';
}

function setActiveNavLink(section) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    const isActive = link.dataset.section === section;
    link.classList.toggle('active', isActive);
    isActive ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current');
  });
}

// ================================================================
// MOBILE SIDEBAR TOGGLE
// ================================================================
function openSidebar() {
  document.body.classList.add('sidebar-open');
  document.getElementById('menu-toggle')?.setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  document.getElementById('menu-toggle')?.setAttribute('aria-expanded', 'false');
}

function bindMenuToggle() {
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
}

// ================================================================
// DATE UTILITIES
// ================================================================
function daysSince(isoDate) {
  if (!isoDate) return null;
  const start = new Date(isoDate + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((today - start) / 86_400_000);
}

function daysUntilNextAnniversary(isoDate) {
  if (!isoDate) return null;
  const ann   = new Date(isoDate + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next  = new Date(today.getFullYear(), ann.getMonth(), ann.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.floor((next - today) / 86_400_000);
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ================================================================
// HTML HELPERS
// ================================================================
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function buildPhotoHTML(personKey, photoBase64) {
  const inner = photoBase64
    ? `<img class="photo-circle" src="${photoBase64}" alt="${personKey} photo" />`
    : `<div class="photo-circle-placeholder">Tap to add photo</div>`;
  return `
    <div class="photo-circle-wrapper" id="photo-wrapper-${personKey}">
      ${inner}
      <span class="photo-upload-hint" aria-hidden="true">${photoBase64 ? 'edit' : '+'}</span>
    </div>`;
}

function buildTagListHTML(tagsArray, tagClass, placeholder, addKey) {
  const chips = tagsArray.length
    ? tagsArray.map((tag, i) => `
        <span class="tag ${tagClass}">
          ${escapeHtml(tag)}
          <button class="tag-delete-btn" data-index="${i}" aria-label="Remove ${escapeHtml(tag)}">x</button>
        </span>`).join('')
    : `<span class="empty-state">None added yet</span>`;

  return `
    <div class="tag-list">${chips}</div>
    <div class="add-tag-row">
      <input class="add-tag-input" type="text" placeholder="${placeholder}"
        data-add="${addKey}" maxlength="60" autocomplete="off" />
      <button class="btn btn-icon btn-add" data-add-btn="${addKey}">+</button>
    </div>`;
}

// ================================================================
// SECTION RENDERERS
// ================================================================
function renderCouple() {
  const p1Name     = appState.person1.name || 'Person 1';
  const p2Name     = appState.person2.name || 'Person 2';
  const together   = daysSince(appState.couple.anniversary);
  const untilAnn   = daysUntilNextAnniversary(appState.couple.anniversary);
  const annYear    = appState.couple.anniversary
    ? new Date(appState.couple.anniversary + 'T00:00:00').getFullYear() : null;
  const yearsCount = annYear ? new Date().getFullYear() - annYear : null;

  const togetherStr = together   !== null ? together.toLocaleString()                         : '—';
  const untilAnnStr = untilAnn   !== null ? (untilAnn === 0 ? 'Today!' : untilAnn.toString()) : '—';
  const yearsStr    = yearsCount !== null ? yearsCount.toString()                              : '—';

  const quickTags = (arr, cls) => arr.length
    ? arr.slice(0, 3).map(t => `<span class="tag ${cls}">${escapeHtml(t)}</span>`).join('')
    : `<span class="text-muted">None yet</span>`;

  return `
    <div class="section-header">
      <h1 class="section-title">Our Story</h1>
      <p class="section-subtitle">Everything about us, in one place.</p>
    </div>

    <div class="couple-hero">
      <div class="couple-hero-names">
        ${escapeHtml(p1Name)}
        <span class="couple-hero-heart">&#9829;</span>
        ${escapeHtml(p2Name)}
      </div>
      <div class="couple-hero-tagline">Together, making every day count.</div>
    </div>

    <div class="couple-stats-grid">
      <div class="card countdown-card">
        <div class="countdown-number">${togetherStr}</div>
        <div class="countdown-label">Days Together</div>
      </div>
      <div class="card countdown-card">
        <div class="countdown-number">${untilAnnStr}</div>
        <div class="countdown-label">Days Until Anniversary</div>
      </div>
      <div class="card countdown-card">
        <div class="countdown-number">${yearsStr}</div>
        <div class="countdown-label">Years Together</div>
      </div>
    </div>

    <div class="section-grid">
      <div class="card">
        <div class="card-title">${escapeHtml(p1Name)}</div>
        <div class="field-row mb-1"><span class="field-label">Birthday</span><span>${formatDate(appState.person1.birthday)}</span></div>
        <div class="field-row mb-1"><span class="field-label">Likes</span><div class="tag-list">${quickTags(appState.person1.likes, '')}</div></div>
        <div class="field-row"><span class="field-label">Hobbies</span><div class="tag-list">${quickTags(appState.person1.hobbies, 'hobby')}</div></div>
      </div>
      <div class="card">
        <div class="card-title">${escapeHtml(p2Name)}</div>
        <div class="field-row mb-1"><span class="field-label">Birthday</span><span>${formatDate(appState.person2.birthday)}</span></div>
        <div class="field-row mb-1"><span class="field-label">Likes</span><div class="tag-list">${quickTags(appState.person2.likes, '')}</div></div>
        <div class="field-row"><span class="field-label">Hobbies</span><div class="tag-list">${quickTags(appState.person2.hobbies, 'hobby')}</div></div>
      </div>
    </div>

    ${appState.couple.anniversary ? `
      <div class="card">
        <div class="card-title">Anniversary</div>
        <p style="color:var(--text-secondary)">${formatDate(appState.couple.anniversary)}</p>
      </div>` : ''}`;
}

function renderPerson(personKey) {
  const person          = appState[personKey];
  const escapedName     = escapeHtml(person.name);
  const escapedNickname = escapeHtml(person.nickname);

  const nameSpan = '<span class="editable large" contenteditable="true" '
    + 'data-person="' + personKey + '" data-field="name">' + escapedName + '</span>';

  const nicknameSpan = '<span class="editable" contenteditable="true" '
    + 'data-person="' + personKey + '" data-field="nickname">' + escapedNickname + '</span>';

  const birthdayInput = '<input type="date" class="date-input" '
    + 'data-person="' + personKey + '" data-field="birthday" value="' + person.birthday + '" />';

  const likesHtml    = buildTagListHTML(person.likes,    '',        'Add a like...',    personKey + '-likes');
  const dislikesHtml = buildTagListHTML(person.dislikes, 'dislike', 'Add a dislike...', personKey + '-dislikes');
  const hobbiesHtml  = buildTagListHTML(person.hobbies,  'hobby',   'Add a hobby...',   personKey + '-hobbies');

  return `
    <div class="section-header">
      <h1 class="section-title">${escapedName}</h1>
      <p class="section-subtitle">Tap any field to edit. Changes save automatically.</p>
    </div>

    <div class="person-header">
      ${buildPhotoHTML(personKey, person.photo)}
      <div class="person-header-info">
        <div class="field-row">
          <span class="field-label">Name</span>
          ${nameSpan}
        </div>
        <div class="field-row">
          <span class="field-label">Nickname</span>
          ${nicknameSpan}
        </div>
        <div class="field-row">
          <span class="field-label">Birthday</span>
          ${birthdayInput}
        </div>
      </div>
    </div>

    <div class="section-grid">
      <div class="card">
        <div class="card-title">Likes</div>
        ${likesHtml}
      </div>
      <div class="card">
        <div class="card-title">Dislikes</div>
        ${dislikesHtml}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Hobbies</div>
      ${hobbiesHtml}
    </div>`;
}

function renderDates() {
  const milestoneRowsHTML = appState.couple.milestones.length
    ? appState.couple.milestones.map((m, i) => {
        const dateInput  = '<input type="date" class="milestone-date-input" value="'
          + m.date + '" data-milestone-index="' + i + '" data-field="date" />';
        const labelInput = '<input type="text" class="milestone-label-input" value="'
          + escapeHtml(m.label) + '" placeholder="What happened?" '
          + 'data-milestone-index="' + i + '" data-field="label" maxlength="120" />';
        const deleteBtn  = '<button class="btn btn-icon" data-delete-milestone="'
          + i + '" aria-label="Delete milestone">x</button>';
        return '<div class="milestone-row">' + dateInput + labelInput + deleteBtn + '</div>';
      }).join('')
    : '<p class="milestones-empty">No milestones yet — add your first one!</p>';

  return `
    <div class="section-header">
      <h1 class="section-title">Dates &amp; Milestones</h1>
      <p class="section-subtitle">Key dates and moments in your story.</p>
    </div>

    <div class="card">
      <div class="card-title">Key Dates</div>
      <div class="dates-key-row">
        <div class="date-field-block">
          <label class="date-field-label" for="input-anniversary">Anniversary</label>
          <input type="date" id="input-anniversary" class="date-input"
            data-couple-field="anniversary" value="${appState.couple.anniversary}" />
        </div>
        <div class="date-field-block">
          <label class="date-field-label" for="input-first-date">First Date</label>
          <input type="date" id="input-first-date" class="date-input"
            data-couple-field="firstDate" value="${appState.couple.firstDate}" />
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Milestones</div>
      <div class="milestone-list" id="milestone-list">${milestoneRowsHTML}</div>
      <button class="btn btn-secondary" id="add-milestone-btn">+ Add Milestone</button>
    </div>`;
}

function renderNotes() {
  return `
    <div class="section-header">
      <h1 class="section-title">Love Notes</h1>
      <p class="section-subtitle">Thoughts, memories, things you love about each other.</p>
    </div>
    <div class="card">
      <div class="card-title">Notes</div>
      <textarea class="notes-textarea" id="notes-textarea"
        placeholder="Write anything here... memories, things you adore, inside jokes."
      >${escapeHtml(appState.couple.notes)}</textarea>
    </div>`;
}

function renderData() {
  return `
    <div class="section-header">
      <h1 class="section-title">Save &amp; Load</h1>
      <p class="section-subtitle">Your data lives in this browser. Export to back it up or move it elsewhere.</p>
    </div>
    <div class="data-section-grid">

      <div class="card">
        <div class="data-card-title">Auto-Save</div>
        <p class="data-card-desc">Every change saves automatically to your browser's local storage.</p>
        <div class="local-save-indicator">
          <span class="local-save-dot"></span> Auto-saving enabled
        </div>
      </div>

      <div class="card">
        <div class="data-card-title">Export Profile</div>
        <p class="data-card-desc">Download everything as a <code>.json</code> file to keep as a backup.</p>
        <button class="btn btn-primary" id="export-json-btn">Download JSON</button>
      </div>

      <div class="card">
        <div class="data-card-title">Import Profile</div>
        <p class="data-card-desc">Load a <code>.json</code> file to restore a profile. <strong>Overwrites current data.</strong></p>
        <button class="btn btn-secondary" id="import-json-btn">Load JSON File</button>
      </div>

      <div class="card">
        <div class="data-card-title">Reset Everything</div>
        <p class="data-card-desc">Clear all data and start fresh. Export first if you want a backup.</p>
        <button class="btn" id="reset-data-btn"
          style="border:2px solid #fecaca;color:#b91c1c;background:#fef2f2;min-height:44px;">
          Reset All Data
        </button>
      </div>

    </div>`;
}
// ================================================================
// TOAST
// ================================================================
function showToast(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
}

// ================================================================
// EVENT BINDING — PERSON
// ================================================================
function bindPersonEvents(personKey) {
  // Contenteditable fields (name, nickname)
  document.querySelectorAll(`[contenteditable][data-person="${personKey}"]`).forEach((el) => {
    el.addEventListener('blur', () => {
      const field = el.dataset.field;
      appState[personKey][field] = el.textContent.trim();
      saveState();
      if (field === 'name') {
        const title = document.querySelector('.section-title');
        if (title) title.textContent = appState[personKey].name;
      }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    });
  });

  // Birthday date input
  const birthdayInput = document.querySelector(
    `input[data-person="${personKey}"][data-field="birthday"]`
  );
  birthdayInput?.addEventListener('change', () => {
    appState[personKey].birthday = birthdayInput.value;
    saveState();
  });

  // Photo upload — tap photo circle to trigger hidden file input
  const photoWrapper   = document.getElementById(`photo-wrapper-${personKey}`);
  const photoFileInput = document.getElementById(`photo-upload-${personKey}`);
  if (photoWrapper && photoFileInput) {
    photoWrapper.addEventListener('click', () => photoFileInput.click());
    photoFileInput.addEventListener('change', () => {
      const file = photoFileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        appState[personKey].photo = e.target.result;
        saveState();
        navigate(currentSection);
      };
      reader.readAsDataURL(file);
      photoFileInput.value = '';
    });
  }

  // Tag add — Enter key or + button
  document.querySelectorAll(`.add-tag-input[data-add^="${personKey}"]`).forEach((tagInput) => {
    const addKey    = tagInput.dataset.add;
    const arrayName = addKey.split('-')[1];

    const commitNewTag = () => {
      const value = tagInput.value.trim();
      if (!value) return;
      appState[personKey][arrayName].push(value);
      saveState();
      navigate(currentSection);
    };

    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitNewTag(); }
    });

    document.querySelector(`[data-add-btn="${addKey}"]`)
      ?.addEventListener('click', commitNewTag);
  });

  // Tag delete — x button on each chip
  document.querySelectorAll('.tag-delete-btn').forEach((deleteBtn) => {
    deleteBtn.addEventListener('click', () => {
      const chipIndex = parseInt(deleteBtn.dataset.index, 10);
      const addInput  = deleteBtn.closest('.card')?.querySelector('.add-tag-input');
      if (!addInput) return;
      const arrayName = addInput.dataset.add.split('-')[1];
      appState[personKey][arrayName].splice(chipIndex, 1);
      saveState();
      navigate(currentSection);
    });
  });
}

// ================================================================
// EVENT BINDING — DATES
// ================================================================
function bindDatesEvents() {
  // Anniversary + first date pickers
  document.querySelectorAll('[data-couple-field]').forEach((input) => {
    input.addEventListener('change', () => {
      appState.couple[input.dataset.coupleField] = input.value;
      saveState();
    });
  });

  // Add milestone row
  document.getElementById('add-milestone-btn')?.addEventListener('click', () => {
    appState.couple.milestones.push({ date: '', label: '' });
    saveState();
    navigate(currentSection);
  });

  // Milestone field edits
  document.querySelectorAll('[data-milestone-index]').forEach((input) => {
    const index = parseInt(input.dataset.milestoneIndex, 10);
    const field = input.dataset.field;
    input.addEventListener('change', () => {
      appState.couple.milestones[index][field] = input.value;
      saveState();
    });
    if (input.type === 'text') {
      input.addEventListener('input', () => {
        appState.couple.milestones[index][field] = input.value;
        saveState();
      });
    }
  });

  // Delete milestone
  document.querySelectorAll('[data-delete-milestone]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.deleteMilestone, 10);
      appState.couple.milestones.splice(index, 1);
      saveState();
      navigate(currentSection);
    });
  });
}

// ================================================================
// EVENT BINDING — NOTES
// ================================================================
function bindNotesEvents() {
  document.getElementById('notes-textarea')?.addEventListener('input', (e) => {
    appState.couple.notes = e.target.value;
    saveState();
  });
}

// ================================================================
// EVENT BINDING — DATA / SAVE & LOAD
// ================================================================
function bindDataEvents() {
  // Export — build Blob and trigger download
  document.getElementById('export-json-btn')?.addEventListener('click', () => {
    const blob        = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor      = document.createElement('a');
    anchor.href       = downloadUrl;
    anchor.download   = 'youandme.json';
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
    showToast('Profile exported');
  });

  // Import — delegate to persistent hidden file input
  document.getElementById('import-json-btn')?.addEventListener('click', () => {
    document.getElementById('json-import-input').click();
  });

  // Reset — confirm before wiping
  document.getElementById('reset-data-btn')?.addEventListener('click', () => {
    if (!window.confirm('This will erase everything and cannot be undone. Continue?')) return;
    appState = structuredClone(DEFAULT_STATE);
    saveState();
    navigate('couple');
    showToast('Data reset');
  });
}

// ================================================================
// NAVIGATION
// ================================================================
function navigate(section) {
  currentSection = section;
  setActiveNavLink(section);

  const contentPanel = document.getElementById('content');

  switch (section) {
    case 'couple':
      contentPanel.innerHTML = renderCouple();
      break;
    case 'person1':
      contentPanel.innerHTML = renderPerson('person1');
      bindPersonEvents('person1');
      break;
    case 'person2':
      contentPanel.innerHTML = renderPerson('person2');
      bindPersonEvents('person2');
      break;
    case 'dates':
      contentPanel.innerHTML = renderDates();
      bindDatesEvents();
      break;
    case 'notes':
      contentPanel.innerHTML = renderNotes();
      bindNotesEvents();
      break;
    case 'data':
      contentPanel.innerHTML = renderData();
      bindDataEvents();
      break;
    default:
      contentPanel.innerHTML = `<p class="text-muted">Section not found.</p>`;
  }

  // Scroll content back to top on every navigation — important on mobile
  contentPanel.scrollTop = 0;
}

// ================================================================
// JSON IMPORT — bound once on the persistent hidden input so it
// survives section re-renders that replace #content innerHTML
// ================================================================
function bindGlobalImportInput() {
  document.getElementById('json-import-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      try {
        const parsed = JSON.parse(readerEvent.target.result);
        appState = mergeWithDefaults(DEFAULT_STATE, parsed);
        saveState();
        navigate(currentSection);
        showToast('Profile imported');
      } catch {
        showToast('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

// ================================================================
// SIDEBAR NAV — closes sidebar on mobile after every nav tap
// ================================================================
function bindSidebarNav() {
  document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      closeSidebar();
      navigate(link.dataset.section);
    });
  });
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  refreshSidebarNames();
  bindSidebarNav();
  bindMenuToggle();
  bindGlobalImportInput();
  navigate('couple');
});
