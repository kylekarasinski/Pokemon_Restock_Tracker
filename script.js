const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const PRICE_LABELS = {
  low_msrp: 'Low MSRP',
  at_msrp: 'At MSRP',
  above_msrp: 'Above MSRP',
  borderline_scalper_price: 'Borderline Scalper',
  scalper_price: 'Scalper Price'
};
const AVATAR_COLORS = ['#a855f7','#22c55e','#f97316','#3b82f6','#ec4899','#14b8a6'];
const PRODUCT_TYPES = ['Sleeved Boosters','Blisters (1-3 Pack)','Booster Bundles','ETBs','Tins / Mini Tins','Collection Boxes', 'Other'];

const ADMIN_NAME = 'kyle';

function isAdmin() {
  return (state.currentUser?.name || '').toLowerCase() === ADMIN_NAME;
}

function canEditVisit(visit) {
  return isAdmin() || visit.user_id === state.currentUser?.id;
}

function mapsUrl(store) {
  const query = [store.name, store.address, store.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

let state = {
  screen: 'login',
  tab: 'stores',
  currentUser: null,
  loginName: '',
  loginPasscode: '',
  users: [],
  stores: [],
  visits: [],
  confirmedDays: [],
  potentialDays: [],
  timeBounds: [],
  filterDay: 'all',
  filterCity: 'all',
  filterSearch: '',
  modal: null,

  pendingAdminUser: null,
  passcodeError: false,

  editStore: null,
  editConfirmed: [],
  editPotential: [],
  editEarly: '',
  editLate: '',

  editVisit: null,
  editVisitId: null,
  editVisitStoreId: null,
  editQuality: 0,
  editAmount: 0,
  editVariety: 0,
  editProducts: [],
  editDate: '',
  editPrices: '',
  editNotes: '',

  viewLogsStoreId: null,

  routeDay: '',
  routeStartAddress: '',
  routeStartCity: '',
  routeStartState: '',
  routeResult: null,
  routeExcludedIds: [],
  addingUser: false,

  dropdownOpen: false,
  cropImageSrc: null,
  baseScale: 1,
  cropZoom: 1,
  cropPanX: 0,
  cropPanY: 0,
};

// ─── API CALLS ────────────────────────────────────────────────
async function loadAll() {
  try {
    const response = await fetch('/api/stores', {
      method: 'GET',
      headers: { 'username': state.loginName, 'passcode': state.loginPasscode }
    });

    if (!response.ok) {
      const errData = await response.json();
      showToast(errData.error || 'Access Denied', 'error');
      return;
    }

    const data = await response.json();
    
    state.stores = data.stores || [];
    state.visits = data.visits || [];
    state.confirmedDays = data.confirmedDays || [];
    state.potentialDays = data.potentialDays || [];
    state.timeBounds = data.timeBounds || [];
    
    render();
  } catch (err) {
    showToast('Failed to connect to backend', 'error');
  }
}

async function createUser(name) {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!response.ok) throw new Error('Failed to create user');
    
    const getRes = await fetch('/api/users');
    state.users = await getRes.json() || [];
    return true;
  } catch (err) {
    showToast('Failed to create user', 'error');
    return false;
  }
}

async function deleteUser(id) {
  try {
    const response = await fetch(`/api/users?id=${id}`, {
      method: 'DELETE',
      headers: { 'username': state.loginName, 'passcode': state.loginPasscode }
    });
    if (!response.ok) throw new Error('Failed to delete user');

    const getRes = await fetch('/api/users');
    state.users = await getRes.json() || [];
    return true;
  } catch (err) {
    showToast('Failed to delete user', 'error');
    return false;
  }
}

async function updateUserAvatar(id, base64String) {
  try {
    const response = await fetch(`/api/users?id=${id}`, {
      method: 'PATCH',
      headers: { 
        'username': state.loginName, 
        'passcode': state.loginPasscode,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ avatar_url: base64String })
    });
    
    if (!response.ok) throw new Error('Failed to save avatar');
    
    // Refresh the users list and update state
    const getRes = await fetch('/api/users');
    state.users = await getRes.json() || [];
    if (state.currentUser?.id === id) {
      state.currentUser = state.users.find(u => u.id === id);
    }
    render();
    showToast('Profile picture updated!');
  } catch (err) {
    showToast('Failed to save avatar', 'error');
  }
}

async function saveVisit(payload) {
  try {
    const method = state.editVisitId ? 'PATCH' : 'POST';
    const url = state.editVisitId ? `/api/visits?id=${state.editVisitId}` : `/api/visits`;
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'username': state.loginName,
        'passcode': state.loginPasscode,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Database rejected visit');
    await loadAll();
    return true;
  } catch(e) {
    showToast('Error saving visit', 'error');
    return false;
  }
}

async function deleteVisit(id) {
  try {
    const response = await fetch(`/api/visits?id=${id}`, {
      method: 'DELETE',
      headers: { 'username': state.loginName, 'passcode': state.loginPasscode }
    });
    if (!response.ok) throw new Error('Failed to delete visit');
    
    await loadAll();
    return true;
  } catch(e) {
    showToast('Error deleting visit', 'error');
    return false;
  }
}

async function deleteStore(id) {
  if (!isAdmin()) {
    showToast('Only admins can delete stores', 'error');
    return false;
  }
  
  try {
    const response = await fetch(`/api/stores?id=${id}`, {
      method: 'DELETE',
      headers: { 'username': state.loginName, 'passcode': state.loginPasscode }
    });

    if (!response.ok) throw new Error('Delete failed');
    
    await loadAll();
    return true;
  } catch (e) {
    showToast('Error deleting store', 'error');
    return false;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────
function initials(name) { return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function avatarColor(name) { let h = 0; for (let c of (name||'')) h = (h << 5) - h + c.charCodeAt(0); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }

// Draws the image if they have one, otherwise falls back to their colored initials
function renderAvatarHtml(user, sizeClass = 'avatar') {
  if (!user) return `<div class="${sizeClass}" style="background:#ccc">?</div>`;
  if (user.avatar_url) {
    return `<img src="${user.avatar_url}" class="${sizeClass}" style="object-fit: cover; border-radius: 50%;" />`;
  }
  return `<div class="${sizeClass}" style="background:${avatarColor(user.name)}">${initials(user.name)}</div>`;
}

// Shrinks the image so it doesn't blow up your database
function processImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 150; // Keeps the string small
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
        else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality JPEG
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function stars(n) { return Array.from({length:5}, (_,i) => `<span class="star ${i < n ? 'star-on' : 'star-off'}">★</span>`).join(''); }
function formatTime(t) { if (!t) return null; const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr > 12 ? hr-12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; }
function esc(s) { return String(s || '').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"').replace(/'/g,''); }
function getTodayString() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDate(iso) {
  if (!iso) return '';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function userName(userId) {
  const u = state.users.find(u => u.id === userId);
  return u ? u.name : 'Unknown';
}

let toastTimer = null;
let searchTimeout = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = 'toast', 4000);
}

// ─── CAPTURE ──────────────────────────────────────────────────
function captureModalState() {
  if (state.modal === 'store') {
    const n = document.getElementById('f-name'); if (n) state.editStore.name = n.value;
    const a = document.getElementById('f-address'); if (a) state.editStore.address = a.value;
    const c = document.getElementById('f-city'); if (c) state.editStore.city = c.value;
    const e = document.getElementById('f-early'); if (e) state.editEarly = e.value;
    const l = document.getElementById('f-late'); if (l) state.editLate = l.value;
  } else if (state.modal === 'visit') {
    const d = document.getElementById('v-date'); if (d) state.editDate = d.value;
    const p = document.getElementById('v-prices'); if (p) state.editPrices = p.value;
    const no = document.getElementById('v-notes'); if (no) state.editNotes = no.value;
  }
}

// ─── RENDER ───────────────────────────────────────────────────
function render() {
  const searchWasFocused = document.activeElement?.dataset?.action === 'search';
  const searchCursor = searchWasFocused ? document.activeElement.selectionStart : null;
  const passcodeFocused = document.activeElement?.id === 'passcode-input';

  document.getElementById('app').innerHTML = state.screen === 'login' ? renderLogin() : renderMain();
  attachEvents();

  if (searchWasFocused) {
    const el = document.querySelector('[data-action="search"]');
    if (el) { el.focus(); if (searchCursor !== null) el.setSelectionRange(searchCursor, searchCursor); }
  }
  if (passcodeFocused) {
    document.getElementById('passcode-input')?.focus();
  }
}

// ─── LOGIN ────────────────────────────────────────────────────
function renderLogin() {
  if (state.pendingAdminUser) {
    return `
    <div class="login-wrap">
      <div class="login-brand">
        <span class="brand-mono">RESTOCK</span>
        <span class="brand-dot-lg"></span>
        <span class="brand-mono">TRACKER</span>
      </div>
      <p class="login-sub">Pokemon Card Restock Manager</p>
      <div class="login-card">
        <div class="passcode-header">
        ${renderAvatarHtml(state.pendingAdminUser, 'avatar')}
        <div>
          <p class="passcode-name">${esc(state.pendingAdminUser.name)}</p>
          <p class="login-card-label" style="margin:0">Admin access required</p>
        </div>
      </div>
        <div class="form-group" style="margin-top: 20px; margin-bottom: 6px;">
          <label class="form-label">Passcode</label>
          <input
            type="password"
            id="passcode-input"
            class="form-input ${state.passcodeError ? 'input-error' : ''}"
            placeholder="Enter admin passcode..."
            autocomplete="off"
          />
          ${state.passcodeError ? `<p class="passcode-error-msg">Incorrect passcode. Try again.</p>` : ''}
        </div>
        <div class="passcode-actions">
          <button class="btn btn-ghost" data-action="cancel-passcode">Back</button>
          <button class="btn btn-primary" data-action="submit-passcode">Continue</button>
        </div>
      </div>
    </div>`;
  }

  return `
  <div class="login-wrap">
    <div class="login-brand">
      <span class="brand-mono">RESTOCK</span>
      <span class="brand-dot-lg"></span>
      <span class="brand-mono">TRACKER</span>
    </div>
    <p class="login-sub">Pokemon Card Restock Manager</p>
    <div class="login-card">
      <p class="login-card-label">Select profile</p>
      <div class="user-list">
      ${state.users.map(u => `
        <div class="user-row" data-action="select-user" data-id="${u.id}">
          ${renderAvatarHtml(u, 'avatar')}
          <div>
            <div class="user-row-name">${esc(u.name)}</div>
            <div class="user-row-sub">Continue as ${esc(u.name)}</div>
          </div>
        </div>`).join('')}
        ${state.addingUser ? `
          <div class="add-user-form">
            <input type="text" id="new-user-input" placeholder="Your name..." autofocus />
            <button class="btn btn-primary" data-action="create-user">Add</button>
            <button class="btn btn-ghost" data-action="cancel-add-user">Cancel</button>
          </div>` :
          `<div class="add-user-row" data-action="show-add-user">+ Add profile</div>`}
      </div>
    </div>
  </div>`;
}

function renderMain() {
  return `
  <div id="app-inner">
    <header class="topbar">
      <div class="topbar-left">
        <span class="brand-mono topbar-brand">RESTOCK<span class="brand-sep">·</span>TRACKER</span>
      </div>
      <nav class="nav">
        <button class="nav-btn ${state.tab==='stores'?'active':''}" data-action="tab" data-tab="stores">Stores</button>
        <button class="nav-btn ${state.tab==='route'?'active':''}" data-action="tab" data-tab="route">Route</button>
      </nav>
      <div class="topbar-right dropdown-container">
        <button class="user-chip" data-action="toggle-dropdown">
          ${renderAvatarHtml(state.currentUser, 'avatar-sm')}
          <span class="user-chip-name">${esc(state.currentUser?.name)}</span>
          ${isAdmin() ? '<span class="admin-badge">admin</span>' : ''}
          <span class="chip-caret">⌄</span>
        </button>
        
        ${state.dropdownOpen ? `
        <div class="dropdown-menu">
          <label class="dropdown-item">
            Change Profile Picture
            <input type="file" accept="image/*" style="display:none;" data-action="select-pfp">
          </label>
          <button class="dropdown-item danger" data-action="logout">Log out</button>
        </div>` : ''}
      </div>
    </header>
    <main class="content">
      ${state.tab === 'stores' ? renderStores() : renderRoute()}
    </main>
    ${renderModal()}
  </div>`;
}

function renderModal() {
  if (state.modal === 'store') return renderStoreModal();
  if (state.modal === 'visit') return renderVisitModal();
  if (state.modal === 'accounts') return renderAccountsModal();
  if (state.modal === 'logs') return renderLogsModal();
  if (state.modal === 'crop') return renderCropModal();
  return '';
}

function renderCropModal() {
  return `
  <div class="modal-overlay" data-action="close-modal-overlay">
    <div class="modal modal-sm">
      <div class="modal-header">
        <h2 class="modal-title">Adjust Picture</h2>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div class="crop-area" id="crop-area">
        <img id="crop-img" class="crop-img" src="${state.cropImageSrc}"
             style="transform: translate(calc(-50% + ${state.cropPanX}px), calc(-50% + ${state.cropPanY}px)) scale(${state.baseScale * state.cropZoom});">
      </div>
      <div class="form-group">
        <label class="form-label" style="text-align:center;">Zoom</label>
        <input type="range" class="form-input" id="crop-slider" min="1" max="4" step="0.1" value="${state.cropZoom}">
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary" data-action="save-crop">Save Picture</button>
      </div>
    </div>
  </div>`;
}

function renderAccountsModal() {
  return `
  <div class="modal-overlay" data-action="close-modal-overlay">
    <div class="modal modal-sm">
      <div class="modal-header">
        <h2 class="modal-title">Switch profile</h2>
      </div>
      <div class="user-list">
        ${state.users.map(u => {
          const isActive = state.currentUser?.id === u.id;
          const isSelf = isActive;
          const logCount = state.visits.filter(v => v.user_id === u.id).length;
          return `
          <div class="user-row ${isActive ? 'user-row--active' : ''}" data-action="switch-user" data-id="${u.id}">
            
            ${renderAvatarHtml(u, 'avatar')}
            
            <div style="flex:1;min-width:0; margin-left: 12px;">
              <div class="user-row-name">${esc(u.name)}${isActive ? ' <span class="active-tag">active</span>' : ''}</div>
              <div class="user-row-sub">${isActive ? 'Currently signed in' : 'Switch to this profile'}</div>
            </div>
            
            ${isSelf ? `
              <label class="btn btn-ghost btn-xs" style="cursor: pointer;" onclick="event.stopPropagation()">
                Edit PFP
                <input type="file" accept="image/*" style="display: none;" onchange="handleAvatarUpload(event, ${u.id})">
              </label>
            ` : ''}

            ${isAdmin() && !isSelf ? `
            <button class="btn btn-danger btn-xs delete-user-btn" data-action="delete-user" data-id="${u.id}" data-name="${esc(u.name)}" data-logs="${logCount}">Delete</button>
            ` : ''}
          </div>`;
        }).join('')}
        ${state.addingUser ? `
          <div class="add-user-form">
            <input type="text" id="new-user-input" placeholder="Your name..." autofocus />
            <button class="btn btn-primary" data-action="create-user">Add</button>
            <button class="btn btn-ghost" data-action="cancel-add-user">Cancel</button>
          </div>` :
          `<div class="add-user-row" data-action="show-add-user">+ New profile</div>`}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-action="logout">Sign out</button>
        <button class="btn btn-ghost" data-action="close-modal">Close</button>
      </div>
    </div>
  </div>`;
}

// ─── STORES ───────────────────────────────────────────────────
function renderStores() {
  const uniqueCities = [...new Set(state.stores.map(s => s.city).filter(Boolean))].sort();

  const filtered = state.stores.filter(s => {
    const conf = state.confirmedDays.filter(d => d.store_id === s.id).map(d => d.day);
    const pot = state.potentialDays.filter(d => d.store_id === s.id).map(d => d.day);
    const dayMatch = state.filterDay === 'all' || conf.includes(state.filterDay) || pot.includes(state.filterDay);
    const cityMatch = state.filterCity === 'all' || s.city === state.filterCity;
    const q = state.filterSearch.toLowerCase();
    const searchMatch = !q || s.name.toLowerCase().includes(q) || (s.address||'').toLowerCase().includes(q) || (s.city||'').toLowerCase().includes(q);
    return dayMatch && cityMatch && searchMatch;
  });

  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">Stores</h1>
      <p class="page-sub">${filtered.length} Location${filtered.length !== 1 ? 's' : ''}</p>
    </div>
    <button class="btn btn-primary" data-action="open-add-store">+ Add store</button>
  </div>
  <div class="filter-bar">
    <input type="text" placeholder="Search stores..." value="${esc(state.filterSearch)}" data-action="search" class="filter-input" />
    <select data-action="filter-day" class="filter-select">
      <option value="all" ${state.filterDay==='all'?'selected':''}>All days</option>
      ${DAYS.map(d => `<option value="${d}" ${state.filterDay===d?'selected':''}>${d}</option>`).join('')}
    </select>
    <select data-action="filter-city" class="filter-select">
      <option value="all" ${state.filterCity==='all'?'selected':''}>All cities</option>
      ${uniqueCities.map(c => `<option value="${esc(c)}" ${state.filterCity===c?'selected':''}>${esc(c)}</option>`).join('')}
    </select>
  </div>
  ${filtered.length === 0
    ? `<div class="empty-state"><p class="empty-title">No stores found</p><p class="empty-sub">Try a different search or add a new store.</p></div>`
    : `<div class="stores-grid">${filtered.map(s => renderStoreCard(s)).join('')}</div>`}`;
}

function renderStoreCard(s) {
  const conf = state.confirmedDays.filter(d => d.store_id === s.id);
  const pot = state.potentialDays.filter(d => d.store_id === s.id);
  const tb = state.timeBounds.find(t => t.store_id === s.id);
  const location = [s.address, s.city].filter(Boolean).join(', ');
  const storeVisits = state.visits.filter(v => v.store_id === s.id).sort((a, b) => {
    const dateA = a.visit_date || '';
    const dateB = b.visit_date || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return (b.id || 0) - (a.id || 0); 
  });
  const latest = storeVisits[0];
  const hasLocation = !!(s.address || s.city);

  return `
  <div class="store-card">
    <div class="store-card-top">
      <div class="store-card-info">
        <h3 class="store-name">${esc(s.name)}</h3>
        ${location ? `<p class="store-location">${esc(location)}</p>` : ''}
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
          ${renderAvatarHtml(state.users.find(u => u.id === s.created_by), 'avatar-sm')}
          <span style="font-size:0.75rem;color:#64748b;">Added by ${esc(userName(s.created_by))}</span>
        </div>
      </div>
      <div class="store-card-actions">
        ${hasLocation ? `<a href="${mapsUrl(s)}" target="_blank" class="btn btn-ghost btn-sm maps-btn" title="Open in Google Maps">📍 Maps</a>` : ''}
        <button class="btn btn-ghost btn-sm" data-action="edit-store" data-id="${s.id}">Edit</button>
        ${isAdmin() ? `<button class="btn btn-danger btn-sm" data-action="delete-store-card" data-id="${s.id}" title="Delete store">Delete</button>` : ''}
        <button class="btn btn-primary btn-sm" data-action="open-log-visit" data-id="${s.id}">Log visit</button>
      </div>
    </div>

    <div class="restock-section">
      <span class="field-label">Restock days</span>
      <div class="tag-row">
        ${conf.map(d => `<span class="tag tag-confirmed">✓ ${d.day}</span>`).join('')}
        ${pot.map(d => `<span class="tag tag-potential">~ ${d.day}</span>`).join('')}
        ${(!conf.length && !pot.length) ? `<span class="tag-none">Not set</span>` : ''}
        ${tb ? `<span class="tag tag-time">${formatTime(tb.early_bound)} – ${formatTime(tb.late_bound)}</span>` : ''}
      </div>
    </div>

    ${latest ? `
      <div class="latest-visit">
        <div class="latest-visit-meta">
          <span class="field-label">Last visit</span>
          <span class="visit-meta-right">
            ${renderAvatarHtml(state.users.find(u => u.id === latest.user_id), 'avatar-sm')}
            <span class="visit-by">${esc(userName(latest.user_id))}</span>
            <span class="visit-date">${formatDate(latest.visit_date)}</span>
          </span>
        </div>
        <div class="ratings-row">
          ${latest.inventory_quality ? `<div class="rating-col"><span class="rating-label">Quality</span><div class="stars-sm">${stars(latest.inventory_quality)}</div></div>` : ''}
          ${latest.inventory_amount ? `<div class="rating-col"><span class="rating-label">Amount</span><div class="stars-sm">${stars(latest.inventory_amount)}</div></div>` : ''}
          ${latest.inventory_variety ? `<div class="rating-col"><span class="rating-label">Variety</span><div class="stars-sm">${stars(latest.inventory_variety)}</div></div>` : ''}
          ${latest.prices ? `<div class="rating-col"><span class="rating-label">Pricing</span><span class="price-tag">${PRICE_LABELS[latest.prices] || latest.prices}</span></div>` : ''}
        </div>
        ${latest.notes ? `<p class="visit-notes">${esc(latest.notes)}</p>` : ''}
        ${storeVisits.length > 0 ? `<button class="view-logs-btn" data-action="open-logs" data-id="${s.id}">View all ${storeVisits.length} visit${storeVisits.length !== 1 ? 's' : ''} →</button>` : ''}
      </div>
    ` : `
      <div class="no-visits">
        <span class="no-visits-text">No visits logged yet</span>
        <button class="view-logs-btn" data-action="open-log-visit" data-id="${s.id}">Log first visit →</button>
      </div>
    `}
  </div>`;
}

// ─── LOGS MODAL ───────────────────────────────────────────────
function renderLogsModal() {
  const store = state.stores.find(s => s.id === state.viewLogsStoreId);
  if (!store) return '';
  const logs = state.visits.filter(v => v.store_id === store.id).sort((a, b) => {
      const dateA = a.visit_date || '';
      const dateB = b.visit_date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.id || 0) - (a.id || 0);
    });
  const hasLocation = !!(store.address || store.city);

  return `
  <div class="modal-overlay" data-action="close-modal-overlay">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div>
          <h2 class="modal-title">${esc(store.name)}</h2>
          <div class="modal-sub" style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
            <span>Visit History · ${logs.length} log${logs.length !== 1 ? 's' : ''}</span>
            ${hasLocation ? `<a href="${mapsUrl(store)}" target="_blank" style="text-decoration: none; color: inherit;"><span class="tag tag-price">📍 Maps</span></a>` : ''}
          </div>
        </div>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>

      ${logs.length === 0 ? `<div class="empty-state"><p class="empty-title">No Visits Logged Yet</p></div>` : `
      <div class="logs-list">
        ${logs.map(v => {
          const canEdit = canEditVisit(v);
          const products = Array.isArray(v.products_found)
            ? v.products_found
            : (typeof v.products_found === 'string'
                ? v.products_found.replace(/^[{\[]|[}\]]$/g,'').replace(/"/g,'').split(',').map(s => s.trim()).filter(Boolean)
                : []);
          return `
          <div class="log-row">
            <div class="log-row-header">
              <div class="log-row-meta">
                ${renderAvatarHtml(state.users.find(u => u.id === v.user_id), 'avatar-sm')}
                <span class="log-by">${esc(userName(v.user_id))}</span>
                <span class="log-date">${formatDate(v.visit_date)}</span>
                ${v.prices ? `<span class="tag tag-price">${PRICE_LABELS[v.prices] || v.prices}</span>` : ''}
              </div>
              ${canEdit ? `
              <div class="log-row-actions">
                <button class="btn btn-ghost btn-xs" data-action="edit-visit-log" data-id="${v.id}">Edit</button>
                <button class="btn btn-danger btn-xs" data-action="delete-visit-log" data-id="${v.id}">Delete</button>
              </div>` : ''}
            </div>
            <div class="log-ratings">
              ${v.inventory_quality ? `<div class="rating-col"><span class="rating-label">Quality</span><div class="stars-sm">${stars(v.inventory_quality)}</div></div>` : ''}
              ${v.inventory_amount ? `<div class="rating-col"><span class="rating-label">Amount</span><div class="stars-sm">${stars(v.inventory_amount)}</div></div>` : ''}
              ${v.inventory_variety ? `<div class="rating-col"><span class="rating-label">Variety</span><div class="stars-sm">${stars(v.inventory_variety)}</div></div>` : ''}
            </div>
            ${products.length ? `<div class="log-products">${products.map(p => `<span class="tag tag-product">${esc(p)}</span>`).join('')}</div>` : ''}
            ${v.notes ? `<p class="log-notes">${esc(v.notes)}</p>` : ''}
          </div>`;
        }).join('')}
      </div>`}

      <div class="modal-footer">
        <button class="btn btn-primary" data-action="open-log-visit" data-id="${store.id}">+ Log New Visit</button>
        <button class="btn btn-ghost" data-action="close-modal">Close</button>
      </div>
    </div>
  </div>`;
}

// ─── STORE MODAL ──────────────────────────────────────────────
function renderStoreModal() {
  const isEdit = !!state.editStore.id;
  return `
  <div class="modal-overlay" data-action="close-modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? 'Edit Store' : 'Add Store'}</h2>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div class="form-group">
        <label class="form-label">Store name <span class="required">*</span></label>
        <input type="text" class="form-input" id="f-name" value="${esc(state.editStore.name||'')}" placeholder="Target, Walmart, Meijer..." />
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label class="form-label">Address</label>
          <input type="text" class="form-input" id="f-address" value="${esc(state.editStore.address||'')}" placeholder="123 Main St" />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">City</label>
          <input type="text" class="form-input" id="f-city" value="${esc(state.editStore.city||'')}" placeholder="Grand Rapids" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Confirmed Restock Days</label>
        <div class="day-grid">
          ${DAYS.map(d => `<div class="day-toggle ${state.editConfirmed.includes(d)?'day-confirmed':''}" data-action="toggle-day" data-group="confirmed" data-day="${d}">${d.slice(0,3)}</div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Potential Restock Days</label>
        <div class="day-grid">
          ${DAYS.map(d => `<div class="day-toggle ${state.editPotential.includes(d)?'day-potential':''}" data-action="toggle-day" data-group="potential" data-day="${d}">${d.slice(0,3)}</div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Expected Time Window</label>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0;flex:1">
            <label class="form-label form-label-sub">Earliest</label>
            <input type="time" class="form-input" id="f-early" value="${esc(state.editEarly)}" />
          </div>
          <div class="form-group" style="margin-bottom:0;flex:1">
            <label class="form-label form-label-sub">Latest</label>
            <input type="time" class="form-input" id="f-late" value="${esc(state.editLate)}" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        ${(isEdit && isAdmin()) ? `<button class="btn btn-danger" style="margin-right:auto" data-action="delete-store-modal" data-id="${state.editStore.id}">Delete Store</button>` : ''}
        <button class="btn btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary" data-action="save-store">${isEdit ? 'Save Changes' : 'Add Store'}</button>
      </div>
    </div>
  </div>`;
}

// ─── VISIT MODAL ──────────────────────────────────────────────
function renderVisitModal() {
  const store = state.stores.find(s => s.id === state.editVisitStoreId);
  const isEdit = !!state.editVisitId;
  return `
  <div class="modal-overlay" data-action="close-modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h2 class="modal-title">${isEdit ? 'Edit Visit' : 'Log Visit'}</h2>
          <p class="modal-sub">${esc(store?.name || '')}</p>
        </div>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input type="date" class="form-input" id="v-date" value="${esc(state.editDate)}" style="width:200px" />
      </div>
      <div class="ratings-form-row">
        <div class="form-group">
          <label class="form-label">Quality</label>
          <div class="star-picker">${[1,2,3,4,5].map(i => `<span class="star-pick ${i <= state.editQuality ? 'on' : ''}" data-action="set-stars" data-field="editQuality" data-val="${i}">★</span>`).join('')}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Amount</label>
          <div class="star-picker">${[1,2,3,4,5].map(i => `<span class="star-pick ${i <= state.editAmount ? 'on' : ''}" data-action="set-stars" data-field="editAmount" data-val="${i}">★</span>`).join('')}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Variety</label>
          <div class="star-picker">${[1,2,3,4,5].map(i => `<span class="star-pick ${i <= state.editVariety ? 'on' : ''}" data-action="set-stars" data-field="editVariety" data-val="${i}">★</span>`).join('')}</div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Pricing</label>
        <select class="form-input" id="v-prices" style="width:240px">
          <option value="">Select...</option>
          ${Object.entries(PRICE_LABELS).map(([k, v]) => `<option value="${k}" ${state.editPrices === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Products seen</label>
        <div class="chip-grid">
          ${PRODUCT_TYPES.map(p => `
            <label class="chip ${state.editProducts.includes(p) ? 'chip-on' : ''}">
              <input type="checkbox" style="display:none" value="${p}" ${state.editProducts.includes(p) ? 'checked' : ''} data-action="toggle-product" />
              ${p}
            </label>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-input" id="v-notes" rows="3" placeholder="Anything worth remembering...">${esc(state.editNotes)}</textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary" data-action="save-visit">${isEdit ? 'Save Changes' : 'Save Log'}</button>
      </div>
    </div>
  </div>`;
}

// ─── ROUTE ────────────────────────────────────────────────────
function renderRoute() {
  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">Route Planner</h1>
      <p class="page-sub">Plan a Route For a Specific Day</p>
    </div>
  </div>
  <div class="route-setup">
    <div class="route-form-row">
      <div class="form-group" style="margin:0; flex: 1.2; min-width: 140px;">
        <label class="form-label">Day</label>
        <select class="form-input" id="route-day">
          <option value="">Select day...</option>
          ${DAYS.map(d => `<option value="${d}" ${state.routeDay===d?'selected':''}>${d}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin:0; flex: 2.5; min-width: 180px;">
        <label class="form-label">Starting address</label>
        <input type="text" class="form-input" id="route-start-address" value="${esc(state.routeStartAddress)}" placeholder="123 Main St" />
      </div>
      <div class="form-group" style="margin:0; flex: 1.5; min-width: 120px;">
        <label class="form-label">City</label>
        <input type="text" class="form-input" id="route-start-city" value="${esc(state.routeStartCity)}" placeholder="Grand Rapids" />
      </div>
      <div class="form-group" style="margin:0; width: 70px;">
        <label class="form-label">State</label>
        <input type="text" class="form-input" id="route-start-state" value="${esc(state.routeStartState)}" placeholder="MI" />
      </div>
      <button class="btn btn-primary" data-action="build-route" style="height: 37px;">Build route</button>
    </div>
  </div>
  ${state.routeResult ? renderRouteResult() : `<div class="empty-state"><p class="empty-title">No route built</p><p class="empty-sub">Select a day and hit Build route.</p></div>`}`;
}

function renderRouteResult() {
  const { stops, day } = state.routeResult;
  if (!stops.length) return `<div class="empty-state"><p class="empty-title">No stores on ${esc(day)}</p><p class="empty-sub">Add restock days to your stores to see them here.</p></div>`;

  const activeStops = stops.filter(s => !state.routeExcludedIds.includes(s.id));
  const startLocation = [state.routeStartAddress, state.routeStartCity, state.routeStartState].filter(Boolean).join(', ');
  const googleMapsUrl = 'https://www.google.com/maps/dir/' + [startLocation, ...activeStops.map(s => [s.address, s.city].filter(Boolean).join(', '))].filter(Boolean).map(encodeURIComponent).join('/');

  return `
  <div class="route-result-header">
    <span class="route-summary">${activeStops.length} stop${activeStops.length!==1?'s':''} on <strong>${esc(day)}</strong></span>
    <a href="${googleMapsUrl}" target="_blank" class="btn btn-ghost btn-sm">Open in Google Maps ↗</a>
  </div>
  <div class="route-stops">
    ${stops.map((s) => {
      const isExcluded = state.routeExcludedIds.includes(s.id);
      const isConf = state.confirmedDays.some(d => d.store_id === s.id && d.day === day);
      const tb = state.timeBounds.find(t => t.store_id === s.id);
      const hasLocation = !!(s.address || s.city);
      
      const activeIndex = isExcluded ? null : activeStops.findIndex(x => x.id === s.id) + 1;

      return `
      <div class="route-stop" style="transition: all 0.2s; ${isExcluded ? 'opacity: 0.4;' : ''}">
        <div class="stop-index ${activeIndex === 1 ? 'stop-index-first' : ''}">
          ${isExcluded ? '✕' : activeIndex}
        </div>
        <div class="stop-body">
          <div class="stop-top-row">
            <div class="stop-name-block">
              <div class="stop-name" style="${isExcluded ? 'text-decoration: line-through;' : ''}">${esc(s.name)}</div>
              <div class="stop-address">${esc([s.address, s.city].filter(Boolean).join(', '))}</div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${hasLocation && !isExcluded ? `<a href="${mapsUrl(s)}" target="_blank" class="btn btn-ghost btn-sm maps-btn">📍 Maps</a>` : ''}
              <button class="btn btn-ghost btn-sm" data-action="toggle-route-stop" data-id="${s.id}">
                ${isExcluded ? 'Include' : 'Exclude'}
              </button>
            </div>
          </div>
          <div class="tag-row" style="margin-top:8px; align-items: center;">
            <span class="tag ${isConf?'tag-confirmed':'tag-potential'}">${isConf?'✓ Confirmed':'~ Potential'}</span>
            ${tb ? `<span class="tag tag-time">${formatTime(tb.early_bound)} – ${formatTime(tb.late_bound)}</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ─── EVENTS ───────────────────────────────────────────────────
function attachEvents() {
  document.querySelectorAll('[data-action]').forEach(el => {
    if (el.tagName === 'SELECT') return;
    if (el.tagName === 'INPUT' && el.dataset.action === 'search') return;
    if (el.tagName === 'A') return;
    el.addEventListener('click', handleClick);
  });

  document.querySelectorAll('[data-action="toggle-product"]').forEach(el => el.addEventListener('change', handleToggleProduct));

  const searchEl = document.querySelector('[data-action="search"]');
  if (searchEl) {
    searchEl.addEventListener('input', e => {
      state.filterSearch = e.target.value;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => render(), 150);
    });
  }

  const dayFilter = document.querySelector('[data-action="filter-day"]');
  if (dayFilter) dayFilter.addEventListener('change', e => { state.filterDay = e.target.value; render(); });

  const cityFilter = document.querySelector('[data-action="filter-city"]');
  if (cityFilter) cityFilter.addEventListener('change', e => { state.filterCity = e.target.value; render(); });

  const passcodeInput = document.getElementById('passcode-input');
  if (passcodeInput) {
    passcodeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handlePasscodeSubmit();
    });
  }

  // --- CROPPER LOGIC ---
  // Handle file selection from the dropdown
  const pfpInput = document.querySelector('[data-action="select-pfp"]');
  if (pfpInput) {
    pfpInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        // Pre-measure the image to find the perfect fit scale
        const tempImg = new Image();
        tempImg.onload = () => {
          const shorter = Math.min(tempImg.width, tempImg.height);
          state.baseScale = 150 / shorter;
          state.cropImageSrc = event.target.result;
          state.cropZoom = 1;
          state.cropPanX = 0;
          state.cropPanY = 0;
          state.dropdownOpen = false;
          state.modal = 'crop';
          render();
        };
        tempImg.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Handle Zoom Slider
  const slider = document.getElementById('crop-slider');
  if (slider) {
    slider.addEventListener('input', e => {
      state.cropZoom = parseFloat(e.target.value);
      const img = document.getElementById('crop-img');
      if (img) {
        img.style.transform = `translate(calc(-50% + ${state.cropPanX}px), calc(-50% + ${state.cropPanY}px)) scale(${state.baseScale * state.cropZoom})`;
      }
    });
  }

  const cropArea = document.getElementById('crop-area');
  if (cropArea) {
    let isDragging = false;
    let startX, startY;
    cropArea.addEventListener('mousedown', e => {
      isDragging = true;
      startX = e.clientX - state.cropPanX;
      startY = e.clientY - state.cropPanY;
    });
    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      state.cropPanX = e.clientX - startX;
      state.cropPanY = e.clientY - startY;
      const img = document.getElementById('crop-img');
      if (img) {
        img.style.transform = `translate(calc(-50% + ${state.cropPanX}px), calc(-50% + ${state.cropPanY}px)) scale(${state.baseScale * state.cropZoom})`;
      }
    });
    window.addEventListener('mouseup', () => isDragging = false);
  }
}

function handleToggleProduct(e) {
  captureModalState();
  const val = e.target.value;
  if (e.target.checked) { if (!state.editProducts.includes(val)) state.editProducts.push(val); }
  else { state.editProducts = state.editProducts.filter(p => p !== val); }
  render();
}

function openVisitModal(storeId, existingVisit = null) {
  state.editVisitStoreId = storeId;
  state.editVisitId = existingVisit?.id || null;
  state.editQuality = existingVisit?.inventory_quality || 0;
  state.editAmount = existingVisit?.inventory_amount || 0;
  state.editVariety = existingVisit?.inventory_variety || 0;

  let parsedProducts = [];
  const raw = existingVisit?.products_found;
  if (Array.isArray(raw)) {
    parsedProducts = [...raw];
  } else if (typeof raw === 'string') {
    parsedProducts = raw.replace(/^[{\[]|[}\]]$/g,'').replace(/"/g,'').split(',').map(s => s.trim()).filter(Boolean);
  }
  state.editProducts = parsedProducts;

  state.editDate = existingVisit ? existingVisit.visit_date?.slice(0,10) : getTodayString();
  state.editPrices = existingVisit?.prices || '';
  state.editNotes = existingVisit?.notes || '';
  state.modal = 'visit';
}

// Placed in the global scope so the inline onchange can see it
window.handleAvatarUpload = async function(e, userId) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Must be an image file', 'error');
    return;
  }
  
  showToast('Compressing image...');
  const base64String = await processImage(file);
  await updateUserAvatar(userId, base64String);
};

// ─── PASSCODE ─────────────────────────────────────────────────
async function handlePasscodeSubmit() {
  const input = document.getElementById('passcode-input');
  
  if (!input || !state.pendingAdminUser) return; 
  
  const userToLogin = state.pendingAdminUser;
  const enteredPasscode = input.value.trim();

  state.pendingAdminUser = null; 

  try {
    const response = await fetch('/api/stores', {
      method: 'GET',
      headers: { 'username': userToLogin.name, 'passcode': enteredPasscode }
    });

    if (!response.ok) {
      state.passcodeError = true;
      state.pendingAdminUser = userToLogin; 
      render();
      return;
    }

    const data = await response.json();
    state.stores = data.stores || [];
    state.visits = data.visits || [];
    state.confirmedDays = data.confirmedDays || [];
    state.potentialDays = data.potentialDays || [];
    state.timeBounds = data.timeBounds || [];
    
    state.loginName = userToLogin.name;
    state.loginPasscode = enteredPasscode;
    state.currentUser = userToLogin;
    state.passcodeError = false;
    state.screen = 'main';
    
    render();
  } catch (err) {
    showToast('Network error verifying passcode', 'error');
  }
}

async function handleDeleteStore(id) {
  if (!isAdmin()) {
    showToast('Only admins can delete stores', 'error');
    return;
  }
  const store = state.stores.find(s => s.id === id);
  const visitCount = state.visits.filter(v => v.store_id === id).length;
  const warning = visitCount > 0
    ? `Delete "${store?.name}"? This will also delete ${visitCount} visit log${visitCount !== 1 ? 's' : ''}. This cannot be undone.`
    : `Delete "${store?.name}"? This cannot be undone.`;
  if (!confirm(warning)) return;
  if (await deleteStore(id)) {
    state.modal = null;
    state.editStore = null;
    showToast('Store deleted');
    render();
  }
}

async function handleClick(e) {
  const action = e.currentTarget.dataset.action;
  if (e.currentTarget.tagName === 'SELECT') return;
  if (['toggle-day','set-stars'].includes(action)) captureModalState();

  // ─── PASSCODE ACTIONS ─────────────────────────────────────
  if (action === 'submit-passcode') {
    handlePasscodeSubmit();
    return;
  }

  if (action === 'cancel-passcode') {
    state.pendingAdminUser = null;
    state.passcodeError = false;
    render();
    return;
  }

  // ─── LOGIN ────────────────────────────────────────────────
  if (action === 'select-user') {
    const user = state.users.find(u => u.id === parseInt(e.currentTarget.dataset.id));
    if (!user) return;

    if (user.name.toLowerCase() === ADMIN_NAME) {
      state.pendingAdminUser = user;
      state.passcodeError = false;
      render();
      setTimeout(() => document.getElementById('passcode-input')?.focus(), 50);
    } else {
      state.currentUser = user;
      state.loginName = user.name;
      state.loginPasscode = ''; 
      state.screen = 'main';
      render(); 
      loadAll(); 
    }
    return;
  }

  if (action === 'switch-user') {
    if (e.target.closest('[data-action="delete-user"]')) return;
    const user = state.users.find(u => u.id === parseInt(e.currentTarget.dataset.id));
    if (!user) return;
    
    if (user.name.toLowerCase() === ADMIN_NAME && state.currentUser?.id !== user.id) {
      state.modal = null;
      state.pendingAdminUser = user;
      state.passcodeError = false;
      state.screen = 'login';
      render();
      setTimeout(() => document.getElementById('passcode-input')?.focus(), 50);
    } else {
      state.currentUser = user;
      state.modal = null;
      showToast(`Switched to ${user.name}`);
      render();
    }
    return;
  }

  // ─── USER MANAGEMENT ──────────────────────────────────────
  if (action === 'delete-user') {
    e.stopPropagation();
    if (!isAdmin()) return;
    const id = parseInt(e.currentTarget.dataset.id);
    const name = e.currentTarget.dataset.name;
    const logCount = parseInt(e.currentTarget.dataset.logs);
    const warning = logCount > 0
      ? `Delete ${name}? They have ${logCount} visit log${logCount !== 1 ? 's' : ''} which will become unattributed. This cannot be undone.`
      : `Delete ${name}? This cannot be undone.`;
    if (!confirm(warning)) return;
    if (await deleteUser(id)) { showToast(`${name} deleted`); render(); }
    return;
  }

  if (action === 'open-account-switcher') { state.modal = 'accounts'; render(); return; }
  if (action === 'show-add-user') { state.addingUser = true; render(); setTimeout(() => document.getElementById('new-user-input')?.focus(), 50); return; }
  if (action === 'cancel-add-user') { state.addingUser = false; render(); return; }

  if (action === 'create-user') {
    const name = document.getElementById('new-user-input')?.value.trim();
    if (!name) return;
    if (await createUser(name)) { state.addingUser = false; showToast(`${name} added`); render(); }
    return;
  }

  if (action === 'logout') {
    state.screen = 'login'; state.currentUser = null; state.tab = 'stores';
    state.modal = null; state.pendingAdminUser = null; state.passcodeError = false;
    render();
    return;
  }

  // ─── NAV ──────────────────────────────────────────────────
  if (action === 'tab') { state.tab = e.currentTarget.dataset.tab; state.routeResult = null; render(); return; }

  // ─── STORE CRUD ───────────────────────────────────────────
  if (action === 'open-add-store') {
    state.editStore = { name:'', address:'', city:'' };
    state.editConfirmed = []; state.editPotential = [];
    state.editEarly = ''; state.editLate = '';
    state.modal = 'store'; render();
    return;
  }

  if (action === 'edit-store') {
    const id = parseInt(e.currentTarget.dataset.id);
    state.editStore = { ...state.stores.find(s => s.id === id) };
    state.editConfirmed = state.confirmedDays.filter(d => d.store_id === id).map(d => d.day);
    state.editPotential = state.potentialDays.filter(d => d.store_id === id).map(d => d.day);
    const tb = state.timeBounds.find(t => t.store_id === id) || {};
    state.editEarly = tb.early_bound?.slice(0,5) || '';
    state.editLate = tb.late_bound?.slice(0,5) || '';
    state.modal = 'store'; render();
    return;
  }

  if (action === 'delete-store-card') {
    if (!isAdmin()) { showToast('Only admins can delete stores', 'error'); return; }
    await handleDeleteStore(parseInt(e.currentTarget.dataset.id));
    return;
  }

  if (action === 'delete-store-modal') {
    if (!isAdmin()) { showToast('Only admins can delete stores', 'error'); return; }
    await handleDeleteStore(parseInt(e.currentTarget.dataset.id));
    return;
  }

  if (action === 'save-store') {
    captureModalState();
    
    if (!state.editStore.name) { 
      showToast('Store name is required', 'error'); 
      return; 
    }

    const rawName = state.editStore.name.trim().toLowerCase();
    const rawAddress = (state.editStore.address || '').trim().toLowerCase();
    const rawCity = (state.editStore.city || '').trim().toLowerCase();

    const isDuplicate = state.stores.some(s => {
      if (state.editStore.id && s.id === state.editStore.id) return false;
      return s.name.trim().toLowerCase() === rawName && 
             (s.address || '').trim().toLowerCase() === rawAddress && 
             (s.city || '').trim().toLowerCase() === rawCity;
    });

    if (isDuplicate) {
      showToast('This exact store already exists!', 'error');
      return;
    }

    const payload = { 
      name: state.editStore.name.trim(), 
      address: state.editStore.address?.trim() || null, 
      city: state.editStore.city?.trim() || null 
    };

    try {
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: {
          'username': state.loginName,
          'passcode': state.loginPasscode,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        showToast(errData.error || 'Failed to save store', 'error');
        return;
      }

      state.modal = null; 
      state.editStore = null; 
      showToast('Store saved'); 
      
      await loadAll(); 
    } catch (err) {
      showToast('Network error while saving', 'error');
    }
    return;
  }

  // ─── VISIT CRUD ───────────────────────────────────────────
  if (action === 'open-log-visit') {
    const storeId = parseInt(e.currentTarget.dataset.id);
    const prevLogsStore = state.viewLogsStoreId;
    openVisitModal(storeId);
    if (prevLogsStore) state.viewLogsStoreId = prevLogsStore;
    render();
    return;
  }

  if (action === 'open-logs') {
    state.viewLogsStoreId = parseInt(e.currentTarget.dataset.id);
    state.modal = 'logs'; render();
    return;
  }

  if (action === 'edit-visit-log') {
    const id = parseInt(e.currentTarget.dataset.id);
    const visit = state.visits.find(v => v.id === id);
    if (!visit || !canEditVisit(visit)) { showToast('You can only edit your own visits', 'error'); return; }
    const logsStoreId = state.viewLogsStoreId;
    openVisitModal(visit.store_id, visit);
    state.viewLogsStoreId = logsStoreId;
    render();
    return;
  }

  if (action === 'delete-visit-log') {
    const id = parseInt(e.currentTarget.dataset.id);
    const visit = state.visits.find(v => v.id === id);
    if (!visit || !canEditVisit(visit)) { showToast('You can only delete your own visits', 'error'); return; }
    if (!confirm('Delete this visit log? This cannot be undone.')) return;
    if (await deleteVisit(id)) {
      showToast('Visit deleted');
      const remaining = state.visits.filter(v => v.store_id === state.viewLogsStoreId);
      if (remaining.length === 0) state.modal = null;
      render();
    }
    return;
  }

  if (action === 'set-stars') {
    state[e.currentTarget.dataset.field] = parseInt(e.currentTarget.dataset.val);
    render();
    return;
  }

  if (action === 'toggle-day') {
    const group = e.currentTarget.dataset.group;
    const day = e.currentTarget.dataset.day;
    const arr = group === 'confirmed' ? state.editConfirmed : state.editPotential;
    const other = group === 'confirmed' ? state.editPotential : state.editConfirmed;
    const idx = arr.indexOf(day);
    if (idx === -1) { arr.push(day); const oi = other.indexOf(day); if (oi !== -1) other.splice(oi, 1); }
    else arr.splice(idx, 1);
    render();
    return;
  }

  if (action === 'save-visit') {
    captureModalState();
    const payload = {
      store_id: state.editVisitStoreId,
      user_id: state.currentUser.id,
      visit_date: state.editDate || getTodayString(),
      inventory_quality: state.editQuality || null,
      inventory_amount: state.editAmount || null,
      inventory_variety: state.editVariety || null,
      prices: state.editPrices || null,
      products_found: state.editProducts.length > 0 ? state.editProducts : null,
      notes: state.editNotes || null,
    };
    if (await saveVisit(payload)) {
      const logsStoreId = state.viewLogsStoreId;
      const wasEdit = !!state.editVisitId;
      state.modal = logsStoreId ? 'logs' : null;
      state.editVisitId = null;
      showToast(wasEdit ? 'Visit updated' : 'Visit logged');
      render();
    }
    return;
  }

  // ─── ROUTE ────────────────────────────────────────────────
  if (action === 'build-route') {
    const day = document.getElementById('route-day')?.value;
    const address = document.getElementById('route-start-address')?.value.trim();
    const city = document.getElementById('route-start-city')?.value.trim();
    const stateVal = document.getElementById('route-start-state')?.value.trim();
    if (!day) { showToast('Select a day first', 'error'); return; }
    state.routeDay = day;
    state.routeStartAddress = address;
    state.routeStartCity = city;
    state.routeStartState = stateVal;
    const eligible = state.stores.filter(s => {
      const hasDay = state.confirmedDays.some(d => d.store_id === s.id && d.day === day) || state.potentialDays.some(d => d.store_id === s.id && d.day === day);
      return hasDay && (s.address || s.city);
    });
    const confirmed = eligible.filter(s => state.confirmedDays.some(d => d.store_id === s.id && d.day === day));
    const potential = eligible.filter(s => !state.confirmedDays.some(d => d.store_id === s.id && d.day === day));
    state.routeResult = { stops: [...confirmed, ...potential], day };
    state.routeExcludedIds = [];
    render();
    return;
  }

  if (action === 'toggle-route-stop') {
    const id = parseInt(e.currentTarget.dataset.id);
    if (state.routeExcludedIds.includes(id)) {
      state.routeExcludedIds = state.routeExcludedIds.filter(x => x !== id);
    } else {
      state.routeExcludedIds.push(id);
    }
    render();
    return;
  }

// Open/Close Dropdown
  if (action === 'toggle-dropdown') {
    state.dropdownOpen = !state.dropdownOpen;
    render();
    return;
  }

  if (action === 'save-crop') {
    const img = document.getElementById('crop-img');
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');

    const finalScale = state.baseScale * state.cropZoom;
    const scaledW = img.naturalWidth * finalScale;
    const scaledH = img.naturalHeight * finalScale;

    const imgCenterX = 75 + state.cropPanX;
    const imgCenterY = 75 + state.cropPanY;

    const drawX = imgCenterX - scaledW / 2;
    const drawY = imgCenterY - scaledH / 2;

    ctx.drawImage(img, drawX, drawY, scaledW, scaledH);
    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    state.modal = null;
    await updateUserAvatar(state.currentUser.id, base64);
    return;
  }

  // Ensure dropdown closes if you click anywhere else on the screen
  if (!e.target.closest('.dropdown-container')) {
    if (state.dropdownOpen) {
      state.dropdownOpen = false;
      render();
    }
  }

  // ─── MODAL CLOSE ──────────────────────────────────────────
  if (action === 'close-modal' || action === 'close-modal-overlay') {
    if (action === 'close-modal-overlay' && e.target !== e.currentTarget) return;
    if (state.modal === 'visit' && state.viewLogsStoreId) {
      state.modal = 'logs'; state.editVisitId = null; render(); return;
    }
    state.modal = null; state.editStore = null; state.editVisitId = null; state.viewLogsStoreId = null; render();
    return;
  }
}

// ─── KEYBOARD ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('new-user-input') === document.activeElement) {
      document.querySelector('[data-action="create-user"]')?.click();
    }
    if (document.getElementById('passcode-input') === document.activeElement) {
      handlePasscodeSubmit();
    }
  }
  if (e.key === 'Escape') {
    if (state.pendingAdminUser) {
      state.pendingAdminUser = null; state.passcodeError = false; render(); return;
    }
    if (state.modal) {
      if (state.modal === 'visit' && state.viewLogsStoreId) {
        state.modal = 'logs'; state.editVisitId = null; render(); return;
      }
      state.modal = null; state.editStore = null; state.editVisitId = null; state.viewLogsStoreId = null; render();
    }
  }
});

// ─── BOOT ─────────────────────────────────────────────────────
async function boot() {
  try {
    const response = await fetch('/api/users');
    if (response.ok) {
      state.users = await response.json();
    }
  } catch (err) {
    console.error('Failed to fetch user list');
  }
  render();
}

boot();