// ─── CONFIG ───────────────────────────────────────────────────
const SUPABASE_URL = 'https://yhdjasgtuifpywxaxwab.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZGphc2d0dWlmcHl3eGF4d2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMzU1MzQsImV4cCI6MjA5NjcxMTUzNH0.z3YygKIRZIwZ5y3bLnwLsVVRIW8uJ1UX9-0aM2fCyuA';
// ──────────────────────────────────────────────────────────────

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const PRICE_LABELS = { low_msrp: 'Low MSRP', at_msrp: 'At MSRP', above_msrp: 'Above MSRP', borderline_scalper_price: 'Borderline Scalper Price', scalper_price: 'Scalper Price' };
const AVATAR_COLORS = ['#a855f7','#22c55e','#f97316','#3b82f6','#ec4899','#14b8a6'];
const PRODUCT_TYPES = ['Sleeved Boosters', 'Blisters (1-3 Pack)', 'Booster Bundles', 'ETBs', 'Tins / Mini Tins', 'Collection Boxes'];

let db = null;
const IS_DEMO = SUPABASE_URL === 'YOUR_SUPABASE_URL'; 

let state = {
  screen: 'login',
  tab: 'stores',
  currentUser: null,
  users: [],
  stores: [],
  visits: [],
  confirmedDays: [],
  potentialDays: [],
  timeBounds: [],
  filterDay: 'all',
  filterSearch: '',
  modal: null,
  
  editStore: null,
  editConfirmed: [],
  editPotential: [],
  editEarly: '',
  editLate: '',
  
  editVisit: null,
  editQuality: 0,
  editAmount: 0,
  editVariety: 0,
  editProducts: [],
  editDate: '',
  editPrices: '',
  editNotes: '',
  
  routeDay: '',
  routeStart: '',
  routeResult: null,
  addingUser: false,
};

function initDB() {
  if (IS_DEMO) return null;
  try { return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } 
  catch(e) { return null; }
}

async function loadAll() {
  if (IS_DEMO) return;
  try {
    const [u, s, v, cd, pd, tb] = await Promise.all([
      db.from('Users').select('*').order('name'),
      db.from('Location').select('*').order('name'),
      db.from('Visit_Log').select('*').order('visit_date', { ascending: false }),
      db.from('Confirmed_Restock_Day').select('*'),
      db.from('Unconfirmed_Restock_Day').select('*'),
      db.from('Restock_Time_Bound').select('*'),
    ]);
    state.users = u.data || [];
    state.stores = s.data || [];
    state.visits = v.data || [];
    state.confirmedDays = cd.data || [];
    state.potentialDays = pd.data || [];
    state.timeBounds = tb.data || [];
  } catch(e) { showToast('Failed to load data', 'error'); }
}

async function createUser(name) {
  if (IS_DEMO) return true;
  const { error } = await db.from('Users').insert([{ name }]);
  if (error) { showToast(error.message, 'error'); return false; }
  const { data } = await db.from('Users').select('*').order('name');
  state.users = data || [];
  return true;
}

async function saveStore(payload, confirmedDays, potentialDays, timeBound) {
  if (IS_DEMO) return true;
  try {
    let storeId;
    if (state.editStore?.id) {
      const { error: e0 } = await db.from('Location').update(payload).eq('id', state.editStore.id);
      if (e0) throw e0;
      storeId = state.editStore.id;
      
      const { error: d1 } = await db.from('Confirmed_Restock_Day').delete().eq('store_id', storeId);
      if (d1) throw d1;
      const { error: d2 } = await db.from('Unconfirmed_Restock_Day').delete().eq('store_id', storeId);
      if (d2) throw d2;
      const { error: d3 } = await db.from('Restock_Time_Bound').delete().eq('store_id', storeId);
      if (d3) throw d3;
    } else {
      const { data, error: e0 } = await db.from('Location').insert([{ ...payload, created_by: state.currentUser.id }]).select().single();
      if (e0) throw e0;
      storeId = data.id;
    }
    
    if (confirmedDays.length) {
      const { error: e1 } = await db.from('Confirmed_Restock_Day').insert(confirmedDays.map(day => ({ store_id: storeId, day })));
      if (e1) throw e1;
    }
    if (potentialDays.length) {
      const { error: e2 } = await db.from('Unconfirmed_Restock_Day').insert(potentialDays.map(day => ({ store_id: storeId, day })));
      if (e2) throw e2;
    }
    if (timeBound.early || timeBound.late) {
      const { error: e3 } = await db.from('Restock_Time_Bound').insert([{ store_id: storeId, early_bound: timeBound.early || null, late_bound: timeBound.late || null }]);
      if (e3) throw e3;
    }
    
    await loadAll();
    return true;
  } catch(e) { 
    console.error(e);
    showToast(e.message || 'Database error while saving store', 'error'); 
    return false; 
  }
}

async function saveVisit(payload) {
  if (IS_DEMO) return true;
  try {
    const { error } = await db.from('Visit_Log').insert([payload]);
    if (error) throw error;
    await loadAll();
    return true;
  } catch(e) { 
    console.error(e);
    showToast(e.message || 'Database error while saving visit', 'error'); 
    return false; 
  }
}

async function deleteStore(id) {
  if (IS_DEMO) return true;
  const { error } = await db.from('Location').delete().eq('id', id);
  if (error) { showToast(error.message, 'error'); return false; }
  await loadAll();
  return true;
}

function initials(name) { return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function avatarColor(name) { let hash = 0; for (let c of (name||'')) hash = (hash << 5) - hash + c.charCodeAt(0); return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]; }
function stars(n) { return Array.from({length:5}, (_,i) => `<span class="star ${i < n ? 'star-on' : 'star-off'}">★</span>`).join(''); }
function formatTime(t) { if (!t) return null; const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr > 12 ? hr-12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; }
function esc(s) { return (s||'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"'); }
function getTodayString() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = 'toast', 4500); // Extended time so you can read errors
}

// ─── STATE MEMORY ─────────────────────────────────────────────
// Grabs all inputs right before a visual redraw so nothing is wiped
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
  document.getElementById('app').innerHTML = state.screen === 'login' ? renderLogin() : renderMain();
  attachEvents();
}

function renderLogin() {
  return `
  <div class="login-wrap">
    <div class="login-header">
      <div class="login-title">🃏 Restock Tracker</div>
      <div class="login-sub">Pokemon card store manager</div>
    </div>
    <div class="login-card">
      <div class="login-card-title">Who's accessing?</div>
      <div class="user-list">
        ${state.users.map(u => `
          <div class="user-row" data-action="select-user" data-id="${u.id}">
            <div class="avatar" style="background:${avatarColor(u.name)}">${initials(u.name)}</div>
            <div><div class="user-row-name">${esc(u.name)}</div><div class="user-row-sub">Tap to continue</div></div>
          </div>`).join('')}
        ${state.addingUser ? `
          <div class="add-user-form">
            <input type="text" id="new-user-input" placeholder="Your name..." style="flex:1" autofocus />
            <button class="btn btn-accent" data-action="create-user">Add</button>
            <button class="btn btn-ghost" data-action="cancel-add-user">Cancel</button>
          </div>` : `<div class="add-user-row" data-action="show-add-user"><span>+</span> Add profile</div>`}
      </div>
    </div>
  </div>`;
}

function renderMain() {
  return `
  <div id="app-inner">
    <div class="topbar">
      <div class="topbar-brand"><div class="brand-dot"></div>Restock Tracker</div>
      <nav class="nav">
        <button class="nav-btn ${state.tab==='stores'?'active':''}" data-action="tab" data-tab="stores"><span class="nav-dot"></span> Stores</button>
        <button class="nav-btn ${state.tab==='route'?'active':''}" data-action="tab" data-tab="route"><span class="nav-dot"></span> Route</button>
        <button class="nav-btn ${state.tab==='accounts'?'active':''}" data-action="tab" data-tab="accounts"><span class="nav-dot"></span> Accounts</button>
      </nav>
      <div class="topbar-right">
        <div class="user-chip" data-action="logout">
          <div class="avatar" style="background:${avatarColor(state.currentUser?.name)};width:26px;height:26px;font-size:11px">${initials(state.currentUser?.name)}</div>
          <span class="user-chip-name">${esc(state.currentUser?.name)}</span>
        </div>
      </div>
    </div>
    <div class="content">
      ${state.tab === 'stores' ? renderStores() : state.tab === 'route' ? renderRoute() : renderAccounts()}
    </div>
    ${state.modal === 'store' ? renderStoreModal() : state.modal === 'visit' ? renderVisitModal() : ''}
  </div>`;
}

function renderAccounts() {
  return `
  <div class="view-header"><div class="view-title">Manage Accounts</div></div>
  <div class="login-card" style="margin: 0; max-width: 500px;">
    <div class="user-list">
      ${state.users.map(u => `
        <div class="user-row" data-action="switch-user" data-id="${u.id}" style="${state.currentUser?.id === u.id ? 'border-color:var(--accent-border); background:var(--accent-bg)' : ''}">
          <div class="avatar" style="background:${avatarColor(u.name)}">${initials(u.name)}</div>
          <div>
            <div class="user-row-name">${esc(u.name)} ${state.currentUser?.id === u.id ? '<span style="color:var(--accent); font-size:12px; margin-left:6px">(Active)</span>' : ''}</div>
            <div class="user-row-sub">Tap to switch</div>
          </div>
        </div>`).join('')}
      ${state.addingUser ? `
        <div class="add-user-form">
          <input type="text" id="new-user-input" placeholder="Your name..." style="flex:1" autofocus />
          <button class="btn btn-accent" data-action="create-user">Add</button>
          <button class="btn btn-ghost" data-action="cancel-add-user">Cancel</button>
        </div>` : `<div class="add-user-row" data-action="show-add-user"><span>+</span> Create new account</div>`}
    </div>
  </div>`;
}

function renderStores() {
  const filtered = state.stores.filter(s => {
    const conf = state.confirmedDays.filter(d => d.store_id === s.id).map(d => d.day);
    const pot = state.potentialDays.filter(d => d.store_id === s.id).map(d => d.day);
    const dayMatch = state.filterDay === 'all' || conf.includes(state.filterDay) || pot.includes(state.filterDay);
    const q = state.filterSearch.toLowerCase();
    const searchMatch = !q || s.name.toLowerCase().includes(q) || (s.address||'').toLowerCase().includes(q) || (s.city||'').toLowerCase().includes(q);
    return dayMatch && searchMatch;
  });

  return `
  <div class="view-header">
    <div class="view-title">Stores <span class="view-count">${filtered.length}</span></div>
    <button class="btn btn-accent" data-action="open-add-store">+ Add store</button>
  </div>
  <div class="filter-bar">
    <input type="text" placeholder="Search stores..." value="${esc(state.filterSearch)}" data-action="search" style="width:220px" />
    <select data-action="filter-day">
      <option value="all" ${state.filterDay==='all'?'selected':''}>All days</option>
      ${DAYS.map(d => `<option value="${d}" ${state.filterDay===d?'selected':''}>${d}</option>`).join('')}
    </select>
  </div>
  ${filtered.length === 0
    ? `<div class="empty"><div class="empty-icon">🏪</div><div class="empty-title">No stores found</div></div>`
    : `<div class="stores-list">${filtered.map(s => renderStoreCard(s)).join('')}</div>`}`;
}

function renderStoreCard(s) {
  const conf = state.confirmedDays.filter(d => d.store_id === s.id);
  const pot = state.potentialDays.filter(d => d.store_id === s.id);
  const tb = state.timeBounds.find(t => t.store_id === s.id);
  const locationString = [s.address, s.city].filter(Boolean).join(', ');
  const latestVisit = state.visits.filter(v => v.store_id === s.id).sort((a,b) => new Date(b.visit_date) - new Date(a.visit_date))[0];

  return `
  <div class="store-card">
    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom: 16px;">
      <div>
        <div class="store-name">${esc(s.name)}</div>
        ${locationString ? `<div style="color:var(--text-muted); font-size: 0.95rem;">📍 ${esc(locationString)}</div>` : ''}
      </div>
      <div style="display:flex; gap: 8px;">
        <button class="btn btn-ghost" data-action="edit-store" data-id="${s.id}">Edit</button>
        <button class="btn btn-accent" data-action="open-log-visit" data-id="${s.id}">Log Visit</button>
      </div>
    </div>
    
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <span style="font-weight: 600; color: var(--text-muted); font-size: 0.85rem; margin-right: 4px;">RESTOCK DAYS:</span>
        ${conf.map(d => `<span class="pill pill-confirmed">CONFIRMED: ${d.day}</span>`).join('')}
        ${pot.map(d => `<span class="pill pill-potential">POSSIBLE: ${d.day}</span>`).join('')}
        ${tb ? `<span class="pill pill-time">⏰ ${formatTime(tb.early_bound)} – ${formatTime(tb.late_bound)}</span>` : ''}      </div>
      
      ${latestVisit ? `
        <div style="background: var(--bg-app); padding: 16px; border-radius: 8px; border-left: 4px solid var(--primary);">
          <div style="font-size: 0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom: 8px;">
            Latest Log: ${latestVisit.visit_date}
          </div>
          <div style="display:flex; gap:16px; margin-bottom: 8px;">
            <span>Quality: ${stars(latestVisit.inventory_quality)}</span>
            <span>Amount: ${stars(latestVisit.inventory_amount)}</span>
          </div>
          ${latestVisit.notes ? `<div style="font-size: 0.9rem; font-style:italic;">"${esc(latestVisit.notes)}"</div>` : ''}
        </div>
      ` : ''}
    </div>
  </div>`;
}

function renderStoreModal() {
  const isEdit = !!state.editStore.id;
  return `
  <div class="modal-overlay" data-action="close-modal-overlay">
    <div class="modal">
      <div class="modal-title">${isEdit ? 'Edit Store Info' : 'Add New Store'}</div>
      <div class="form-group">
        <label class="form-label">Store name *</label>
        <input type="text" class="form-input" id="f-name" value="${esc(state.editStore.name||'')}" placeholder="Target, Walmart, Meijer..." />
      </div>
      <div class="form-row">
        <div class="form-group" style="flex: 2;">
          <label class="form-label">Address</label>
          <input type="text" class="form-input" id="f-address" value="${esc(state.editStore.address||'')}" placeholder="123 Main St" />
        </div>
        <div class="form-group" style="flex: 1;">
          <label class="form-label">City</label>
          <input type="text" class="form-input" id="f-city" value="${esc(state.editStore.city||'')}" placeholder="Grand Rapids" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Confirmed restock days</label>
        <div class="day-grid">
          ${DAYS.map(d => `<div class="day-toggle ${state.editConfirmed.includes(d)?'selected-confirmed':''}" data-action="toggle-day" data-group="confirmed" data-day="${d}">${d.slice(0,3)}</div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Potential restock days</label>
        <div class="day-grid">
          ${DAYS.map(d => `<div class="day-toggle ${state.editPotential.includes(d)?'selected-potential':''}" data-action="toggle-day" data-group="potential" data-day="${d}">${d.slice(0,3)}</div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Expected Time Window</label>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label" style="font-size:11px">Earliest</label>
            <input type="time" class="form-input" id="f-early" value="${esc(state.editEarly)}" />
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label" style="font-size:11px">Latest</label>
            <input type="time" class="form-input" id="f-late" value="${esc(state.editLate)}" />
          </div>
        </div>
      </div>
      <div class="modal-actions">
        ${isEdit ? `<button class="btn btn-danger" style="margin-right:auto" data-action="delete-store" data-id="${state.editStore.id}">Delete</button>` : ''}
        <button class="btn btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn btn-accent" data-action="save-store">${isEdit ? 'Save changes' : 'Add store'}</button>
      </div>
    </div>
  </div>`;
}

function renderVisitModal() {
  const store = state.stores.find(s => s.id === state.editVisit);
  return `
  <div class="modal-overlay" data-action="close-modal-overlay">
    <div class="modal">
      <div class="modal-title">Log Visit — ${esc(store.name)}</div>
      <div class="form-group">
        <label class="form-label">Date of Visit</label>
        <input type="date" class="form-input" id="v-date" value="${esc(state.editDate)}" />
      </div>
      <div class="form-row">
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
        <label class="form-label">General Pricing</label>
        <select class="form-input" id="v-prices" style="width: 50%">
  <option value="">Select...</option>
  ${Object.entries(PRICE_LABELS).map(([key, label]) => `
    <option value="${key}" ${state.editPrices === key ? 'selected' : ''}>
      ${label}
    </option>
  `).join('')}
</select>
      </div>
      <div class="form-group">
        <label class="form-label">Products Seen</label>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${PRODUCT_TYPES.map(p => `
            <label class="product-chip ${state.editProducts.includes(p) ? 'selected' : ''}">
              <input type="checkbox" style="display:none;" value="${p}" ${state.editProducts.includes(p) ? 'checked' : ''} data-action="toggle-product" />
              ${p}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Visit Notes</label>
        <textarea class="form-input" id="v-notes" rows="3">${esc(state.editNotes)}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn btn-accent" data-action="save-visit">Save Log</button>
      </div>
    </div>
  </div>`;
}

function renderRoute() {
  return `
  <div class="view-header"><div class="view-title">Route planner</div></div>
  <div class="route-setup">
    <div class="section-label">Plan your run</div>
    <div class="route-inputs">
      <div class="form-group">
        <label class="form-label">Day</label>
        <select class="form-input" id="route-day">
          <option value="">Pick a day...</option>
          ${DAYS.map(d => `<option value="${d}" ${state.routeDay===d?'selected':''}>${d}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="flex:2;min-width:220px">
        <label class="form-label">Starting address</label>
        <input type="text" class="form-input" id="route-start" value="${esc(state.routeStart)}" style="width:100%" />
      </div>
      <button class="btn btn-accent" data-action="build-route" style="margin-bottom:0">Build route</button>
    </div>
  </div>
  ${state.routeResult ? renderRouteResult() : `<div class="empty"><div class="empty-icon">🗺️</div><div class="empty-title">No route built</div></div>`}`;
}

function renderRouteResult() {
  const { stops, day } = state.routeResult;
  if (!stops.length) return `<div class="empty"><div class="empty-icon">🤷</div><div class="empty-title">No stores on ${esc(day)}</div></div>`;
  const mapsUrl = 'https://www.google.com/maps/dir/' + [state.routeStart, ...stops.map(s => [s.address, s.city].filter(Boolean).join(', '))].filter(Boolean).map(encodeURIComponent).join('/');

  return `
  <div class="route-header">
    <div class="route-summary">${stops.length} stop${stops.length!==1?'s':''} on <strong>${esc(day)}</strong></div>
    <a href="${mapsUrl}" target="_blank" class="gmaps-link">🗺️ Open in Google Maps</a>
  </div>
  <div class="route-stops">
    ${stops.map((s, i) => {
      const isConf = state.confirmedDays.some(d => d.store_id === s.id && d.day === day);
      const tb = state.timeBounds.find(t => t.store_id === s.id);
      return `
      <div class="route-stop">
        <div class="stop-num ${i===0?'first':''}">${i+1}</div>
        <div class="stop-body">
          <div class="stop-name">${esc(s.name)}</div>
          <div class="stop-address">${esc([s.address, s.city].filter(Boolean).join(', '))}</div>
          <div class="stop-tags" style="margin-top: 8px;">
            <span class="pill ${isConf?'pill-confirmed':'pill-potential'}">${isConf?'✓ Expected':'~ Potential'}</span>
            ${tb ? `<span class="pill pill-price">🕐 ${formatTime(tb.early_bound)} – ${formatTime(tb.late_bound)}</span>` : ''}
          </div>
        </div>
      </div>`}).join('')}
  </div>`;
}

// ─── EVENTS ───────────────────────────────────────────────────
function attachEvents() {
  document.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', handleClick));
  document.querySelectorAll('[data-action="toggle-product"]').forEach(el => el.addEventListener('change', handleToggleProduct));
  const searchEl = document.querySelector('[data-action="search"]');
  if (searchEl) searchEl.addEventListener('input', e => { state.filterSearch = e.target.value; render(); });
  const dayFilter = document.querySelector('[data-action="filter-day"]');
  if (dayFilter) {
    dayFilter.addEventListener('change', e => {
      state.filterDay = e.target.value;
      render();
    });
  }
}

function handleToggleProduct(e) {
  captureModalState();
  const val = e.target.value;
  if (e.target.checked) { if (!state.editProducts.includes(val)) state.editProducts.push(val); } 
  else { state.editProducts = state.editProducts.filter(p => p !== val); }
  render();
}

async function handleClick(e) {
  const action = e.currentTarget.dataset.action;
  
  if (e.currentTarget.tagName === 'SELECT') return;

  if (['toggle-day', 'set-stars'].includes(action)) captureModalState();

  if (action === 'select-user' || action === 'switch-user') {
    state.currentUser = state.users.find(u => u.id === parseInt(e.currentTarget.dataset.id));
    if (action === 'select-user') state.screen = 'main';
    else showToast(`Switched to ${state.currentUser.name}`);
    render();
  } else if (action === 'show-add-user') {
    state.addingUser = true; render();
    setTimeout(() => document.getElementById('new-user-input')?.focus(), 50);
  } else if (action === 'cancel-add-user') {
    state.addingUser = false; render();
  } else if (action === 'create-user') {
    const name = document.getElementById('new-user-input')?.value.trim();
    if (!name) return;
    if (await createUser(name)) { state.addingUser = false; showToast(`${name} added`); render(); }
  } else if (action === 'logout') {
    state.screen = 'login'; state.currentUser = null; state.tab = 'stores'; render();
  } else if (action === 'tab') {
    state.tab = e.currentTarget.dataset.tab; state.routeResult = null; render();
  } else if (action === 'open-add-store') {
    state.editStore = { name: '', address: '', city: '' };
    state.editConfirmed = []; state.editPotential = [];
    state.editEarly = ''; state.editLate = '';
    state.modal = 'store'; render();
  } else if (action === 'edit-store') {
    const id = parseInt(e.currentTarget.dataset.id);
    state.editStore = { ...state.stores.find(s => s.id === id) };
    state.editConfirmed = state.confirmedDays.filter(d => d.store_id === id).map(d => d.day);
    state.editPotential = state.potentialDays.filter(d => d.store_id === id).map(d => d.day);
    const tb = state.timeBounds.find(t => t.store_id === id) || {};
    state.editEarly = tb.early_bound?.slice(0,5) || '';
    state.editLate = tb.late_bound?.slice(0,5) || '';
    state.modal = 'store'; render();
  } else if (action === 'open-log-visit') {
    state.editVisit = parseInt(e.currentTarget.dataset.id);
    state.editQuality = 0; state.editAmount = 0; state.editVariety = 0; state.editProducts = [];
    state.editDate = getTodayString();
    state.editPrices = ''; state.editNotes = '';
    state.modal = 'visit'; render();
  } else if (action === 'delete-store') {
    if (!confirm('Delete this store? This will also delete all historical visit logs.')) return;
    if (await deleteStore(parseInt(e.currentTarget.dataset.id))) { state.modal = null; showToast('Store deleted'); render(); }
  } else if (action === 'set-stars') {
    state[e.currentTarget.dataset.field] = parseInt(e.currentTarget.dataset.val);
    render();
  } else if (action === 'toggle-day') {
    const group = e.currentTarget.dataset.group;
    const day = e.currentTarget.dataset.day;
    const arr = group === 'confirmed' ? state.editConfirmed : state.editPotential;
    const other = group === 'confirmed' ? state.editPotential : state.editConfirmed;
    const idx = arr.indexOf(day);
    if (idx === -1) { arr.push(day); const otherIdx = other.indexOf(day); if (otherIdx !== -1) other.splice(otherIdx, 1); } 
    else arr.splice(idx, 1);
    render();
  } else if (action === 'save-store') {
    captureModalState();
    if (!state.editStore.name) { showToast('Store name is required', 'error'); return; }
    const payload = { 
      name: state.editStore.name, 
      address: state.editStore.address || null,
      city: state.editStore.city || null
    };
    const timeBound = { early: state.editEarly || null, late: state.editLate || null };
    if (await saveStore(payload, state.editConfirmed, state.editPotential, timeBound)) { 
      state.modal = null; state.editStore = null; showToast('Store saved'); render(); 
    }
  } else if (action === 'save-visit') {
    captureModalState();
    const payload = {
      store_id: state.editVisit,
      user_id: state.currentUser.id,
      visit_date: new Date().toISOString(),
      inventory_quality: state.editQuality || null,
      inventory_amount: state.editAmount || null,
      inventory_variety: state.editVariety || null,
      prices: state.editPrices || null,
      products_found: state.editProducts.length > 0 ? state.editProducts : null,
      notes: state.editNotes || null,
    };
    if (await saveVisit(payload)) { 
      state.modal = null; state.editVisit = null; showToast('Visit logged successfully!'); render(); 
    }
  } else if (action === 'close-modal' || action === 'close-modal-overlay') {
    if (action === 'close-modal-overlay' && e.target !== e.currentTarget) return;
    state.modal = null; state.editStore = null; state.editVisit = null; render();
  } else if (action === 'build-route') {
    const day = document.getElementById('route-day')?.value;
    const start = document.getElementById('route-start')?.value.trim();
    if (!day) { showToast('Pick a day first', 'error'); return; }
    state.routeDay = day; state.routeStart = start;
    const eligible = state.stores.filter(s => {
      const conf = state.confirmedDays.filter(d => d.store_id === s.id && d.day === day);
      const pot = state.potentialDays.filter(d => d.store_id === s.id && d.day === day);
      return (conf.length || pot.length) && (s.address || s.city);
    });
    const confirmed = eligible.filter(s => state.confirmedDays.some(d => d.store_id === s.id && d.day === day));
    const potential = eligible.filter(s => !state.confirmedDays.some(d => d.store_id === s.id && d.day === day));
    state.routeResult = { stops: [...confirmed, ...potential], day };
    render();
  } else if (action === 'filter-day') {
  state.filterDay = e.currentTarget.value;
  render();
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('new-user-input') === document.activeElement) document.querySelector('[data-action="create-user"]')?.click();
  if (e.key === 'Escape' && state.modal) { state.modal = null; state.editStore = null; state.editVisit = null; render(); }
});

async function boot() { db = initDB(); await loadAll(); render(); }
boot();