// ── HomeSKED App ─────────────────────────────────────────────

// ── State ──
const State = {
  user: null,
  currentHome: null,
  currentRoom: null,
  currentEquipment: null,
  view: 'dashboard',
};

// ── Helpers ──
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : '✗';
  el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function timeAgo(d) {
  if (!d) return 'Never';
  const diff = Date.now() - new Date(d);
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  if (days < 365) return `${Math.floor(days/30)}mo ago`;
  return `${Math.floor(days/365)}y ago`;
}

function daysUntil(d) {
  if (!d) return null;
  const diff = new Date(d) - Date.now();
  return Math.ceil(diff / 86400000);
}

function dueDateLabel(nextDue, status) {
  if (!nextDue) return '—';
  const days = daysUntil(nextDue);
  if (status === 'overdue') {
    return `${Math.abs(days)}d overdue`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
}

function freqLabel(val, unit) {
  const u = val === 1 ? unit : unit + 's';
  return `Every ${val} ${u}`;
}

function setContent(html) {
  document.getElementById('page-content').innerHTML = html;
}

function setBreadcrumb(items) {
  document.getElementById('breadcrumb').innerHTML = items.map((item, i) => {
    const isLast = i === items.length - 1;
    const sep = i > 0 ? '<span class="breadcrumb-sep">›</span>' : '';
    if (isLast) return `${sep}<span class="breadcrumb-item current">${item.label}</span>`;
    return `${sep}<span class="breadcrumb-item" onclick="${item.onclick}">${item.label}</span>`;
  }).join('');
}

function setTopbarActions(html) {
  document.getElementById('topbar-actions').innerHTML = html;
}

// ── Modal system ──
function showModal(title, bodyHtml, footerHtml) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">${footerHtml}</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-container').appendChild(overlay);
}

function closeModal() {
  const m = document.getElementById('active-modal');
  if (m) m.remove();
}

// ── Auth ──
function showAuthTab(tab) {
  document.getElementById('form-login').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  clearAuthError();
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = '';
}
function clearAuthError() {
  document.getElementById('auth-error').style.display = 'none';
}

async function doLogin() {
  clearAuthError();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) return showAuthError('Please enter username and password.');
  try {
    const data = await API.login({ username, password });
    API.setToken(data.token);
    API.setUser(data.user);
    bootApp(data.user);
  } catch (err) {
    showAuthError(err.message);
  }
}

async function doRegister() {
  clearAuthError();
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!username || !password) return showAuthError('Username and password are required.');
  try {
    const data = await API.register({ username, email, password });
    API.setToken(data.token);
    API.setUser(data.user);
    bootApp(data.user);
  } catch (err) {
    showAuthError(err.message);
  }
}

function doLogout() {
  API.clearToken();
  State.user = null;
  State.currentHome = null;
  State.currentRoom = null;
  State.currentEquipment = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-view').style.display = '';
}

// ── Boot ──
function bootApp(user) {
  State.user = user;
  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('app').style.display = '';

  // Update sidebar user info
  document.getElementById('user-name-display').textContent = user.username;
  document.getElementById('user-role-display').textContent = user.role;
  document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();

  navigate('dashboard');
}

// ── Navigation ──
function setActiveNav(id) {
  ['nav-dashboard', 'nav-homes', 'nav-rooms', 'nav-equipment', 'nav-tasks'].forEach(n => {
    const el = document.getElementById(n);
    if (el) el.classList.toggle('active', n === id);
  });
}

function navigate(view, params = {}) {
  State.view = view;
  if (params.home) State.currentHome = params.home;
  if (params.room) State.currentRoom = params.room;
  if (params.equipment) State.currentEquipment = params.equipment;

  setContent('<div class="loading-center"><div class="spinner"></div></div>');
  setTopbarActions('');

  switch (view) {
    case 'dashboard': return renderDashboard();
    case 'homes':     return renderHomes();
    case 'rooms':     return renderRooms();
    case 'equipment': return renderEquipment();
    case 'tasks':     return renderTasks();
  }
}

// ── DASHBOARD ──
async function renderDashboard() {
  setActiveNav('nav-dashboard');
  setBreadcrumb([{ label: 'Dashboard' }]);
  setTopbarActions('');

  // Update context nav visibility
  document.getElementById('context-nav').style.display = State.currentHome ? '' : 'none';

  try {
    const d = await API.dashboard();
    const { stats, overdue, upcoming, recentActivity } = d;

    let overdueRows = overdue.length === 0
      ? '<div class="empty-state" style="padding:30px"><div class="empty-icon">✓</div><div class="empty-msg" style="color:var(--success)">All tasks are up to date</div></div>'
      : overdue.map(t => `
        <div class="task-row overdue">
          <div class="task-status-dot"></div>
          <div class="task-info">
            <div class="task-name">${esc(t.task_name)}</div>
            <div class="task-desc">${esc(t.home_name)} › ${esc(t.room_name)} › ${esc(t.equipment_name)}</div>
          </div>
          <div class="task-due overdue">${dueDateLabel(t.next_due_at, 'overdue')}</div>
          <div class="task-actions">
            <button class="btn btn-success btn-sm" onclick="quickComplete(${t.id})">Done</button>
          </div>
        </div>`).join('');

    let upcomingRows = upcoming.length === 0
      ? '<p style="color:var(--text-muted);font-size:13px;padding:16px 0">No tasks due in the next 14 days.</p>'
      : upcoming.map(t => `
        <div class="task-row due-soon">
          <div class="task-status-dot"></div>
          <div class="task-info">
            <div class="task-name">${esc(t.task_name)}</div>
            <div class="task-desc">${esc(t.home_name)} › ${esc(t.room_name)} › ${esc(t.equipment_name)}</div>
          </div>
          <div class="task-due due-soon">${dueDateLabel(t.next_due_at, 'due_soon')}</div>
          <div class="task-actions">
            <button class="btn btn-success btn-sm" onclick="quickComplete(${t.id})">Done</button>
          </div>
        </div>`).join('');

    let activityRows = recentActivity.length === 0
      ? '<p style="color:var(--text-muted);font-size:13px;padding:16px 0">No completions recorded yet.</p>'
      : recentActivity.map(a => `
        <div class="history-row">
          <span class="history-who">${esc(a.completed_by_name || '?')}</span>
          <span style="flex:1">${esc(a.task_name)} <span style="color:var(--text-muted)">on</span> ${esc(a.equipment_name)}</span>
          <span class="history-time">${timeAgo(a.completed_at)}</span>
        </div>`).join('');

    setContent(`
      <div class="page-header">
        <div>
          <div class="page-title">DASHBOARD</div>
          <div class="page-subtitle">${new Date().toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card danger">
          <div class="stat-value">${stats.overdue_count}</div>
          <div class="stat-label">Overdue</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">${stats.upcoming_count}</div>
          <div class="stat-label">Due Soon</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">${stats.completions_30d}</div>
          <div class="stat-label">Done (30d)</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-value">${stats.task_count}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card cyan">
          <div class="stat-value">${stats.home_count}</div>
          <div class="stat-label">Homes</div>
        </div>
        <div class="stat-card neutral">
          <div class="stat-value">${stats.equipment_count}</div>
          <div class="stat-label">Equipment</div>
        </div>
      </div>

      <div class="two-col" style="gap:20px;margin-bottom:20px">
        <div class="card">
          <div class="card-header">
            <div class="card-title">⚠ Overdue Tasks (${overdue.length})</div>
          </div>
          <div style="padding:16px">
            <div class="task-list">${overdueRows}</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">◷ Due in 14 days (${upcoming.length})</div>
          </div>
          <div style="padding:16px">
            <div class="task-list">${upcomingRows}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Recent Activity</div></div>
        <div style="padding:16px">
          <div class="history-list">${activityRows}</div>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(`<div class="alert alert-error">${err.message}</div>`);
  }
}

async function quickComplete(taskId) {
  try {
    await API.completeTask(taskId);
    toast('Task marked complete!');
    renderDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── HOMES ──
async function renderHomes() {
  setActiveNav('nav-homes');
  setBreadcrumb([{ label: 'Homes' }]);
  setTopbarActions(`<button class="btn btn-primary" onclick="showAddHome()">+ Add Home</button>`);
  document.getElementById('context-nav').style.display = 'none';

  try {
    const homes = await API.getHomes();
    if (homes.length === 0) {
      setContent(`
        <div class="page-header"><div class="page-title">HOMES</div></div>
        <div class="empty-state">
          <div class="empty-icon">🏠</div>
          <div class="empty-title">No homes yet</div>
          <div class="empty-msg">Add your first home to get started.</div>
          <br><button class="btn btn-primary" onclick="showAddHome()">+ Add Home</button>
        </div>`);
      return;
    }
    setContent(`
      <div class="page-header">
        <div class="page-title">HOMES</div>
      </div>
      <div class="item-grid">
        ${homes.map(h => `
          <div class="item-card" onclick="enterHome(${JSON.stringify(h).replace(/"/g, '&quot;')})">
            <div class="item-card-actions">
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showEditHome(${JSON.stringify(h).replace(/"/g, '&quot;')})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteHome(${h.id})">✕</button>
            </div>
            <div class="item-card-name">${esc(h.name)}</div>
            ${h.address ? `<div class="item-card-meta" style="margin-bottom:8px">${esc(h.address)}</div>` : ''}
            <div class="item-card-badges">
              <span class="badge badge-neutral">${h.room_count} room${h.room_count !== 1 ? 's' : ''}</span>
            </div>
          </div>`).join('')}
      </div>`);
  } catch (err) {
    setContent(`<div class="alert alert-error">${err.message}</div>`);
  }
}

function enterHome(home) {
  State.currentHome = home;
  State.currentRoom = null;
  State.currentEquipment = null;
  document.getElementById('context-nav').style.display = '';
  document.getElementById('nav-equipment').style.display = 'none';
  document.getElementById('nav-tasks').style.display = 'none';
  navigate('rooms');
}

function showAddHome() {
  showModal('ADD HOME',
    `<div class="form-group"><label>Home Name *</label><input id="f-home-name" placeholder="e.g. Main Residence"></div>
     <div class="form-group"><label>Address</label><input id="f-home-addr" placeholder="123 Main St"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitAddHome()">Add Home</button>`
  );
}

function showEditHome(home) {
  showModal('EDIT HOME',
    `<div class="form-group"><label>Home Name *</label><input id="f-home-name" value="${esc(home.name)}"></div>
     <div class="form-group"><label>Address</label><input id="f-home-addr" value="${esc(home.address || '')}"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitEditHome(${home.id})">Save</button>`
  );
}

async function submitAddHome() {
  const name = document.getElementById('f-home-name').value.trim();
  if (!name) return;
  try {
    await API.createHome({ name, address: document.getElementById('f-home-addr').value.trim() });
    closeModal(); toast('Home added!'); renderHomes();
  } catch (err) { toast(err.message, 'error'); }
}

async function submitEditHome(id) {
  const name = document.getElementById('f-home-name').value.trim();
  if (!name) return;
  try {
    await API.updateHome(id, { name, address: document.getElementById('f-home-addr').value.trim() });
    closeModal(); toast('Home updated!'); renderHomes();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteHome(id) {
  if (!confirm('Delete this home and all its rooms, equipment, and tasks?')) return;
  try {
    await API.deleteHome(id); toast('Home deleted.'); renderHomes();
  } catch (err) { toast(err.message, 'error'); }
}

// ── ROOMS ──
async function renderRooms() {
  if (!State.currentHome) return navigate('homes');
  setActiveNav('nav-rooms');
  setBreadcrumb([
    { label: 'Homes', onclick: "navigate('homes')" },
    { label: State.currentHome.name }
  ]);
  setTopbarActions(`<button class="btn btn-primary" onclick="showAddRoom()">+ Add Room</button>`);
  document.getElementById('nav-equipment').style.display = 'none';
  document.getElementById('nav-tasks').style.display = 'none';

  try {
    const rooms = await API.getRooms(State.currentHome.id);
    if (rooms.length === 0) {
      setContent(`
        <div class="page-header"><div><div class="page-title">ROOMS</div><div class="page-subtitle">${esc(State.currentHome.name)}</div></div></div>
        <div class="empty-state">
          <div class="empty-icon">🚪</div>
          <div class="empty-title">No rooms yet</div>
          <div class="empty-msg">Add rooms to organize equipment.</div>
          <br><button class="btn btn-primary" onclick="showAddRoom()">+ Add Room</button>
        </div>`);
      return;
    }
    setContent(`
      <div class="page-header">
        <div><div class="page-title">ROOMS</div><div class="page-subtitle">${esc(State.currentHome.name)}</div></div>
      </div>
      <div class="item-grid">
        ${rooms.map(r => `
          <div class="item-card" onclick="enterRoom(${JSON.stringify(r).replace(/"/g, '&quot;')})">
            <div class="item-card-actions">
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showEditRoom(${JSON.stringify(r).replace(/"/g, '&quot;')})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteRoom(${r.id})">✕</button>
            </div>
            <div class="item-card-name">${esc(r.name)}</div>
            ${r.description ? `<div class="item-card-meta">${esc(r.description)}</div>` : ''}
            <div class="item-card-badges">
              <span class="badge badge-neutral">${r.equipment_count} item${r.equipment_count !== 1 ? 's' : ''}</span>
            </div>
          </div>`).join('')}
      </div>`);
  } catch (err) {
    setContent(`<div class="alert alert-error">${err.message}</div>`);
  }
}

function enterRoom(room) {
  State.currentRoom = room;
  State.currentEquipment = null;
  document.getElementById('nav-equipment').style.display = '';
  document.getElementById('nav-tasks').style.display = 'none';
  navigate('equipment');
}

function showAddRoom() {
  showModal('ADD ROOM',
    `<div class="form-group"><label>Room Name *</label><input id="f-room-name" placeholder="e.g. Kitchen, Garage, Master Bath"></div>
     <div class="form-group"><label>Description</label><textarea id="f-room-desc" placeholder="Optional notes"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitAddRoom()">Add Room</button>`
  );
}

function showEditRoom(room) {
  showModal('EDIT ROOM',
    `<div class="form-group"><label>Room Name *</label><input id="f-room-name" value="${esc(room.name)}"></div>
     <div class="form-group"><label>Description</label><textarea id="f-room-desc">${esc(room.description || '')}</textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitEditRoom(${room.id})">Save</button>`
  );
}

async function submitAddRoom() {
  const name = document.getElementById('f-room-name').value.trim();
  if (!name) return;
  try {
    await API.createRoom({ home_id: State.currentHome.id, name, description: document.getElementById('f-room-desc').value.trim() });
    closeModal(); toast('Room added!'); renderRooms();
  } catch (err) { toast(err.message, 'error'); }
}

async function submitEditRoom(id) {
  const name = document.getElementById('f-room-name').value.trim();
  if (!name) return;
  try {
    await API.updateRoom(id, { name, description: document.getElementById('f-room-desc').value.trim() });
    closeModal(); toast('Room updated!'); renderRooms();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteRoom(id) {
  if (!confirm('Delete this room and all its equipment and tasks?')) return;
  try {
    await API.deleteRoom(id); toast('Room deleted.'); renderRooms();
  } catch (err) { toast(err.message, 'error'); }
}

// ── EQUIPMENT ──
async function renderEquipment() {
  if (!State.currentRoom) return navigate('rooms');
  setActiveNav('nav-equipment');
  setBreadcrumb([
    { label: 'Homes', onclick: "navigate('homes')" },
    { label: State.currentHome.name, onclick: "navigate('rooms')" },
    { label: State.currentRoom.name }
  ]);
  setTopbarActions(`<button class="btn btn-primary" onclick="showAddEquipment()">+ Add Equipment</button>`);
  document.getElementById('nav-tasks').style.display = 'none';

  try {
    const items = await API.getEquipment(State.currentRoom.id);
    if (items.length === 0) {
      setContent(`
        <div class="page-header"><div><div class="page-title">EQUIPMENT</div><div class="page-subtitle">${esc(State.currentRoom.name)}</div></div></div>
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <div class="empty-title">No equipment yet</div>
          <div class="empty-msg">Add appliances, systems, or items that need maintenance.</div>
          <br><button class="btn btn-primary" onclick="showAddEquipment()">+ Add Equipment</button>
        </div>`);
      return;
    }
    setContent(`
      <div class="page-header">
        <div><div class="page-title">EQUIPMENT</div><div class="page-subtitle">${esc(State.currentHome.name)} › ${esc(State.currentRoom.name)}</div></div>
      </div>
      <div class="item-grid">
        ${items.map(e => {
          const badges = [];
          if (e.overdue_count > 0) badges.push(`<span class="badge badge-overdue">${e.overdue_count} overdue</span>`);
          if (e.due_soon_count > 0) badges.push(`<span class="badge badge-due-soon">${e.due_soon_count} due soon</span>`);
          if (e.overdue_count === 0 && e.due_soon_count === 0 && e.task_count > 0) badges.push(`<span class="badge badge-ok">All clear</span>`);
          badges.push(`<span class="badge badge-neutral">${e.task_count} task${e.task_count !== 1 ? 's' : ''}</span>`);
          const sub = [e.make, e.model].filter(Boolean).join(' ');
          return `
          <div class="item-card" onclick="enterEquipment(${JSON.stringify(e).replace(/"/g, '&quot;')})">
            <div class="item-card-actions">
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showEditEquipment(${JSON.stringify(e).replace(/"/g, '&quot;')})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteEquipment(${e.id})">✕</button>
            </div>
            <div class="item-card-name">${esc(e.name)}</div>
            ${sub ? `<div class="item-card-meta" style="margin-bottom:4px">${esc(sub)}</div>` : ''}
            ${e.description ? `<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">${esc(e.description)}</div>` : ''}
            <div class="item-card-badges">${badges.join('')}</div>
          </div>`;
        }).join('')}
      </div>`);
  } catch (err) {
    setContent(`<div class="alert alert-error">${err.message}</div>`);
  }
}

function enterEquipment(equip) {
  State.currentEquipment = equip;
  document.getElementById('nav-tasks').style.display = '';
  navigate('tasks');
}

function showAddEquipment() {
  showModal('ADD EQUIPMENT',
    `<div class="form-group"><label>Name *</label><input id="f-eq-name" placeholder="e.g. HVAC Unit, Dishwasher, Water Heater"></div>
     <div class="form-group"><label>Description</label><input id="f-eq-desc" placeholder="Brief description"></div>
     <div class="form-row">
       <div class="form-group"><label>Make / Brand</label><input id="f-eq-make" placeholder="e.g. Carrier"></div>
       <div class="form-group"><label>Model</label><input id="f-eq-model" placeholder="e.g. 24ACC636A003"></div>
     </div>
     <div class="form-group"><label>Serial Number</label><input id="f-eq-serial" placeholder="Optional"></div>
     <div class="form-group"><label>Notes</label><textarea id="f-eq-notes" placeholder="Any additional notes, warranty info, etc."></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitAddEquipment()">Add Equipment</button>`
  );
}

function showEditEquipment(e) {
  showModal('EDIT EQUIPMENT',
    `<div class="form-group"><label>Name *</label><input id="f-eq-name" value="${esc(e.name)}"></div>
     <div class="form-group"><label>Description</label><input id="f-eq-desc" value="${esc(e.description||'')}"></div>
     <div class="form-row">
       <div class="form-group"><label>Make / Brand</label><input id="f-eq-make" value="${esc(e.make||'')}"></div>
       <div class="form-group"><label>Model</label><input id="f-eq-model" value="${esc(e.model||'')}"></div>
     </div>
     <div class="form-group"><label>Serial Number</label><input id="f-eq-serial" value="${esc(e.serial_number||'')}"></div>
     <div class="form-group"><label>Notes</label><textarea id="f-eq-notes">${esc(e.notes||'')}</textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitEditEquipment(${e.id})">Save</button>`
  );
}

function getEquipmentForm() {
  return {
    name:          document.getElementById('f-eq-name').value.trim(),
    description:   document.getElementById('f-eq-desc').value.trim(),
    make:          document.getElementById('f-eq-make').value.trim(),
    model:         document.getElementById('f-eq-model').value.trim(),
    serial_number: document.getElementById('f-eq-serial').value.trim(),
    notes:         document.getElementById('f-eq-notes').value.trim(),
  };
}

async function submitAddEquipment() {
  const data = getEquipmentForm();
  if (!data.name) return;
  try {
    await API.createEquipment({ ...data, room_id: State.currentRoom.id });
    closeModal(); toast('Equipment added!'); renderEquipment();
  } catch (err) { toast(err.message, 'error'); }
}

async function submitEditEquipment(id) {
  const data = getEquipmentForm();
  if (!data.name) return;
  try {
    await API.updateEquipment(id, data);
    closeModal(); toast('Equipment updated!'); renderEquipment();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteEquipment(id) {
  if (!confirm('Delete this equipment and all its tasks?')) return;
  try {
    await API.deleteEquipment(id); toast('Equipment deleted.'); renderEquipment();
  } catch (err) { toast(err.message, 'error'); }
}

// ── TASKS ──
async function renderTasks() {
  if (!State.currentEquipment) return navigate('equipment');
  setActiveNav('nav-tasks');
  setBreadcrumb([
    { label: 'Homes', onclick: "navigate('homes')" },
    { label: State.currentHome.name, onclick: "navigate('rooms')" },
    { label: State.currentRoom.name, onclick: "navigate('equipment')" },
    { label: State.currentEquipment.name }
  ]);
  setTopbarActions(`<button class="btn btn-primary" onclick="showAddTask()">+ Add Task</button>`);

  try {
    const tasks = await API.getTasks(State.currentEquipment.id);
    const eq = State.currentEquipment;

    const equDetails = [eq.make, eq.model, eq.serial_number ? `S/N: ${eq.serial_number}` : ''].filter(Boolean).join(' · ');

    if (tasks.length === 0) {
      setContent(`
        <div class="page-header">
          <div>
            <div class="page-title">TASKS</div>
            <div class="page-subtitle">${esc(eq.name)}${equDetails ? ' · ' + esc(equDetails) : ''}</div>
          </div>
        </div>
        ${eq.notes ? `<div class="alert alert-info" style="margin-bottom:20px">📋 ${esc(eq.notes)}</div>` : ''}
        <div class="empty-state">
          <div class="empty-icon">✓</div>
          <div class="empty-title">No tasks yet</div>
          <div class="empty-msg">Add maintenance tasks, cleaning schedules, or inspections.</div>
          <br><button class="btn btn-primary" onclick="showAddTask()">+ Add Task</button>
        </div>`);
      return;
    }

    const overdueList  = tasks.filter(t => t.status === 'overdue');
    const dueSoonList  = tasks.filter(t => t.status === 'due_soon');
    const okList       = tasks.filter(t => t.status === 'ok');

    function renderTaskRow(t) {
      return `
        <div class="task-row ${t.status}" id="task-row-${t.id}">
          <div class="task-status-dot"></div>
          <div class="task-info">
            <div class="task-name">${esc(t.name)}</div>
            ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ''}
          </div>
          <div class="task-schedule">${freqLabel(t.frequency_value, t.frequency_unit)}</div>
          <div class="task-due ${t.status}">${dueDateLabel(t.next_due_at, t.status)}</div>
          <div class="task-actions">
            <button class="btn btn-success btn-sm" onclick="completeTask(${t.id})">Done</button>
            <button class="btn btn-ghost btn-sm" onclick="showEditTask(${JSON.stringify(t).replace(/"/g, '&quot;')})">Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="showTaskHistory(${t.id}, '${esc(t.name)}')">History</button>
            <button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})">✕</button>
          </div>
        </div>`;
    }

    let sections = '';
    if (overdueList.length) sections += `
      <div style="margin-bottom:24px">
        <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--danger);margin-bottom:10px">⚠ Overdue</div>
        <div class="task-list">${overdueList.map(renderTaskRow).join('')}</div>
      </div>`;
    if (dueSoonList.length) sections += `
      <div style="margin-bottom:24px">
        <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--warning);margin-bottom:10px">◷ Due Soon</div>
        <div class="task-list">${dueSoonList.map(renderTaskRow).join('')}</div>
      </div>`;
    if (okList.length) sections += `
      <div style="margin-bottom:24px">
        <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px">✓ Up to Date</div>
        <div class="task-list">${okList.map(renderTaskRow).join('')}</div>
      </div>`;

    setContent(`
      <div class="page-header">
        <div>
          <div class="page-title">TASKS</div>
          <div class="page-subtitle">${esc(eq.name)}${equDetails ? ' · ' + esc(equDetails) : ''}</div>
        </div>
      </div>
      ${eq.notes ? `<div class="alert alert-info" style="margin-bottom:20px">📋 ${esc(eq.notes)}</div>` : ''}
      ${sections}`);
  } catch (err) {
    setContent(`<div class="alert alert-error">${err.message}</div>`);
  }
}

function taskFormHtml(t = {}) {
  const units = ['day','week','month','year'];
  const unitOpts = units.map(u => `<option value="${u}" ${t.frequency_unit === u ? 'selected' : ''}>${u.charAt(0).toUpperCase()+u.slice(1)}(s)</option>`).join('');
  const defUnit = t.frequency_unit || 'month';
  const defUnitOpts = units.map(u => `<option value="${u}" ${u === defUnit ? 'selected' : ''}>${u.charAt(0).toUpperCase()+u.slice(1)}(s)</option>`).join('');

  return `
    <div class="form-group"><label>Task Name *</label><input id="f-task-name" value="${esc(t.name||'')}" placeholder="e.g. Replace filter, Clean coils, Lubricate bearings"></div>
    <div class="form-group"><label>Description / Procedure</label><textarea id="f-task-desc" placeholder="Step-by-step notes or procedure details...">${esc(t.description||'')}</textarea></div>
    <div class="form-group">
      <label>Repeat Frequency</label>
      <div class="freq-row">
        <input type="number" id="f-task-fval" value="${t.frequency_value||1}" min="1" max="999">
        <select id="f-task-funit">${t.frequency_unit ? unitOpts : defUnitOpts}</select>
      </div>
    </div>`;
}

function showAddTask() {
  showModal('ADD TASK', taskFormHtml(),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitAddTask()">Add Task</button>`
  );
}

function showEditTask(t) {
  showModal('EDIT TASK', taskFormHtml(t),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitEditTask(${t.id})">Save</button>`
  );
}

function getTaskForm() {
  return {
    name:            document.getElementById('f-task-name').value.trim(),
    description:     document.getElementById('f-task-desc').value.trim(),
    frequency_value: parseInt(document.getElementById('f-task-fval').value) || 1,
    frequency_unit:  document.getElementById('f-task-funit').value,
  };
}

async function submitAddTask() {
  const data = getTaskForm();
  if (!data.name) return;
  try {
    await API.createTask({ ...data, equipment_id: State.currentEquipment.id });
    closeModal(); toast('Task added!'); renderTasks();
  } catch (err) { toast(err.message, 'error'); }
}

async function submitEditTask(id) {
  const data = getTaskForm();
  if (!data.name) return;
  try {
    await API.updateTask(id, data);
    closeModal(); toast('Task updated!'); renderTasks();
  } catch (err) { toast(err.message, 'error'); }
}

async function completeTask(id) {
  try {
    await API.completeTask(id);
    toast('Task marked complete!');
    renderTasks();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteTask(id) {
  if (!confirm('Delete this task and its history?')) return;
  try {
    await API.deleteTask(id); toast('Task deleted.'); renderTasks();
  } catch (err) { toast(err.message, 'error'); }
}

async function showTaskHistory(id, name) {
  try {
    const history = await API.getTaskHistory(id);
    const rows = history.length === 0
      ? '<p style="color:var(--text-muted);font-size:13px">No completions recorded yet.</p>'
      : `<div class="history-list">${history.map(h => `
          <div class="history-row">
            <span class="history-who">${esc(h.completed_by_name || '?')}</span>
            <span style="flex:1;font-size:12px;color:var(--text-muted)">${h.notes ? esc(h.notes) : 'No notes'}</span>
            <span class="history-time">${formatDate(h.completed_at)}</span>
          </div>`).join('')}</div>`;

    showModal(`HISTORY: ${esc(name).toUpperCase()}`,
      `<div style="font-family:var(--font-mono);font-size:10px;letter-spacing:1px;color:var(--text-muted);margin-bottom:16px">${history.length} completion${history.length !== 1 ? 's' : ''} recorded</div>${rows}`,
      `<button class="btn btn-primary" onclick="closeModal()">Close</button>`
    );
  } catch (err) { toast(err.message, 'error'); }
}

// ── Utility: HTML escape ──
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Init ──
(function init() {
  const token = API.getToken();
  const user = API.getUser();

  if (token && user) {
    bootApp(user);
  }

  // Enter key on login
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const modal = document.getElementById('active-modal');
      if (modal) {
        const btn = modal.querySelector('.modal-footer .btn-primary');
        if (btn) btn.click();
        return;
      }
      if (document.getElementById('form-login').style.display !== 'none') doLogin();
      if (document.getElementById('form-register').style.display !== 'none') doRegister();
    }
  });
})();
