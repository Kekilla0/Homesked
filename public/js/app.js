// ── HomeSKED App ─────────────────────────────────────────────

const State = {
  user: null,
  currentHome: null,
  currentRoom: null,
  currentEquipment: null,
  view: 'dashboard',
  presets: [],
  roomPresets: [],
  // Sidebar tree state
  sidebarRooms: [],
  sidebarEquipment: {},   // roomId -> [] of equipment
  sidebarExpanded: new Set(),
};

// ── Utilities ────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✓' : '✗'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function J(obj) {
  return JSON.stringify(obj).replace(/"/g, '&quot;');
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}

function formatDateTimeLocal(d) {
  if (!d) return '';
  const dt = new Date(d);
  const pad = n => String(n).padStart(2,'0');
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function timeAgo(d) {
  if (!d) return 'Never';
  const diff = Date.now() - new Date(d);
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.floor(days/7)}w ago`;
  if (days < 365) return `${Math.floor(days/30)}mo ago`;
  return `${Math.floor(days/365)}y ago`;
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - Date.now()) / 86400000);
}

function dueDateLabel(task) {
  if (task.trigger_type === 'usage') {
    const diff = (task.next_due_usage || 0) - (task.current_usage_at_check || 0);
    if (diff <= 0) return `${Math.abs(diff).toLocaleString()} ${task.usage_unit || 'units'} over`;
    return `${diff.toLocaleString()} ${task.usage_unit || 'units'} to go`;
  }
  if (!task.next_due_at) return '—';
  const days = daysUntil(task.next_due_at);
  if (task.status === 'overdue') return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
}

function freqLabel(task) {
  if (task.trigger_type === 'usage') {
    return `Every ${Number(task.usage_interval).toLocaleString()} ${task.usage_unit || 'units'}`;
  }
  const u = task.frequency_value === 1 ? task.frequency_unit : task.frequency_unit + 's';
  return `Every ${task.frequency_value} ${u}`;
}

function setContent(html) { document.getElementById('page-content').innerHTML = html; }
function setTopbarActions(html) { document.getElementById('topbar-actions').innerHTML = html; }

function setBreadcrumb(items) {
  document.getElementById('breadcrumb').innerHTML = items.map((item, i) => {
    const isLast = i === items.length - 1;
    const sep = i > 0 ? '<span class="breadcrumb-sep">›</span>' : '';
    if (isLast) return `${sep}<span class="breadcrumb-item current">${item.label}</span>`;
    return `${sep}<span class="breadcrumb-item" onclick="${item.onclick}">${item.label}</span>`;
  }).join('');
}

// ── Modal system ─────────────────────────────────────────────
function showModal(title, bodyHtml, footerHtml, wide = false) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';
  overlay.innerHTML = `
    <div class="modal${wide ? ' modal-wide' : ''}">
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

// ── Sidebar Tree ─────────────────────────────────────────────
async function loadSidebarRooms(homeId) {
  try {
    const rooms = await API.getRooms(homeId);
    State.sidebarRooms = rooms;
    renderSidebarTree();
  } catch {}
}

async function loadSidebarEquipment(roomId) {
  try {
    const items = await API.getEquipment(roomId);
    State.sidebarEquipment[roomId] = items;
    renderSidebarTree();
  } catch {}
}

function toggleSidebarRoom(roomId) {
  if (State.sidebarExpanded.has(roomId)) {
    State.sidebarExpanded.delete(roomId);
  } else {
    State.sidebarExpanded.add(roomId);
    if (!State.sidebarEquipment[roomId]) {
      loadSidebarEquipment(roomId);
    }
  }
  renderSidebarTree();
}

function renderSidebarTree() {
  const container = document.getElementById('sidebar-tree');
  if (!container) return;

  if (!State.currentHome || !State.sidebarRooms.length) {
    container.innerHTML = '';
    return;
  }

  const homeLabel = `
    <div class="tree-home-label">
      🏠 ${esc(State.currentHome.name)}
    </div>`;

  const roomItems = State.sidebarRooms.map(room => {
    const isExpanded = State.sidebarExpanded.has(room.id);
    const isCurrentRoom = State.currentRoom && State.currentRoom.id === room.id;
    const toggleChar = isExpanded ? '▾' : '▸';

    // Overdue badge
    const badge = room.room_task_overdue > 0
      ? `<span class="tree-room-badge overdue">${room.room_task_overdue}</span>` : '';

    // Children (room tasks + equipment)
    let children = '';
    if (isExpanded) {
      const isOnRoomTasks = State.view === 'room-tasks' && isCurrentRoom;
      const isOnEquipment = State.view === 'equipment' && isCurrentRoom;

      children += `
        <a class="tree-child-link room-tasks ${isOnRoomTasks ? 'active' : ''}"
           onclick="enterRoomTasksFromTree(${J(room)})">
          🧹 Room Tasks
          ${room.room_task_count > 0 ? `<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-left:auto">${room.room_task_count}</span>` : ''}
        </a>
        <a class="tree-child-link ${isOnEquipment && !State.currentEquipment ? 'active' : ''}"
           onclick="enterRoomFromTree(${J(room)})">
          📦 Equipment
          ${room.equipment_count > 0 ? `<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-left:auto">${room.equipment_count}</span>` : ''}
        </a>`;

      const equipList = State.sidebarEquipment[room.id];
      if (equipList === undefined) {
        children += `<div class="tree-loading">Loading...</div>`;
      } else if (equipList.length > 0) {
        children += equipList.map(eq => {
          const isActiveEquip = State.currentEquipment && State.currentEquipment.id === eq.id;
          const dot = eq.overdue_count > 0
            ? `<span class="tree-equip-dot" style="background:var(--danger)"></span>`
            : `<span class="tree-equip-dot"></span>`;
          return `<a class="tree-equip-link ${isActiveEquip ? 'active' : ''}"
              onclick="enterEquipmentFromTree(${J(room)}, ${J(eq)})">
              ${dot}${esc(eq.name)}
            </a>`;
        }).join('');
      }
    }

    return `
      <div>
        <div class="tree-room">
          <button class="tree-room-toggle" onclick="toggleSidebarRoom(${room.id})">${toggleChar}</button>
          <div class="tree-room-name ${isCurrentRoom ? 'active' : ''}"
               onclick="enterRoomFromTree(${J(room)})">${esc(room.name)}</div>
          ${badge}
        </div>
        <div class="tree-children ${isExpanded ? 'open' : ''}">${children}</div>
      </div>`;
  }).join('');

  container.innerHTML = homeLabel + roomItems;
}

// Sidebar tree navigation helpers
function enterRoomFromTree(room) {
  State.currentRoom = room;
  State.currentEquipment = null;
  // Auto-expand in sidebar
  if (!State.sidebarExpanded.has(room.id)) {
    State.sidebarExpanded.add(room.id);
    if (!State.sidebarEquipment[room.id]) loadSidebarEquipment(room.id);
  }
  navigate('equipment');
}

function enterRoomTasksFromTree(room) {
  State.currentRoom = room;
  if (!State.sidebarExpanded.has(room.id)) {
    State.sidebarExpanded.add(room.id);
    if (!State.sidebarEquipment[room.id]) loadSidebarEquipment(room.id);
  }
  navigate('room-tasks');
}

function enterEquipmentFromTree(room, equip) {
  State.currentRoom = room;
  State.currentEquipment = equip;
  navigate('tasks');
}

// ── Auth ─────────────────────────────────────────────────────
function showAuthTab(tab) {
  document.getElementById('form-login').style.display    = tab === 'login' ? '' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('auth-error').style.display = 'none';
}

async function doLogin() {
  document.getElementById('auth-error').style.display = 'none';
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) { document.getElementById('auth-error').textContent = 'Please enter username and password.'; document.getElementById('auth-error').style.display = ''; return; }
  try {
    const data = await API.login({ username, password });
    API.setToken(data.token); API.setUser(data.user);
    bootApp(data.user);
  } catch (err) { document.getElementById('auth-error').textContent = err.message; document.getElementById('auth-error').style.display = ''; }
}

async function doRegister() {
  document.getElementById('auth-error').style.display = 'none';
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!username || !password) { document.getElementById('auth-error').textContent = 'Username and password required.'; document.getElementById('auth-error').style.display = ''; return; }
  try {
    const data = await API.register({ username, email, password });
    API.setToken(data.token); API.setUser(data.user);
    bootApp(data.user);
  } catch (err) { document.getElementById('auth-error').textContent = err.message; document.getElementById('auth-error').style.display = ''; }
}

function doLogout() {
  API.clearToken();
  Object.assign(State, { user:null, currentHome:null, currentRoom:null, currentEquipment:null,
    sidebarRooms:[], sidebarEquipment:{}, sidebarExpanded: new Set() });
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-view').style.display = '';
}

// ── Boot ─────────────────────────────────────────────────────
function bootApp(user) {
  State.user = user;
  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('app').style.display = '';
  document.getElementById('user-name-display').textContent = user.username;
  document.getElementById('user-role-display').textContent = user.role;
  document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();
  API.getPresets().then(p => { State.presets = p; }).catch(() => {});
  API.getRoomPresets().then(p => { State.roomPresets = p; }).catch(() => {});
  navigate('dashboard');
}

// ── Navigation ───────────────────────────────────────────────
function setActiveNav(id) {
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.id === id);
  });
}

function navigate(view, params = {}) {
  State.view = view;
  if (params.home)      { State.currentHome = params.home; State.sidebarRooms = []; State.sidebarEquipment = {}; State.sidebarExpanded = new Set(); }
  if (params.room)      State.currentRoom      = params.room;
  if (params.equipment) State.currentEquipment = params.equipment;

  setContent('<div class="loading-center"><div class="spinner"></div></div>');
  setTopbarActions('');

  // Sidebar tree visibility
  const treeContainer = document.getElementById('sidebar-tree-section');
  if (treeContainer) treeContainer.style.display = State.currentHome ? '' : 'none';

  renderSidebarTree();

  switch (view) {
    case 'dashboard':  return renderDashboard();
    case 'homes':      return renderHomes();
    case 'rooms':      return renderRooms();
    case 'equipment':  return renderEquipment();
    case 'tasks':      return renderTasks();
    case 'room-tasks': return renderRoomTasks();
    case 'all-tasks':  return renderAllTasks();
  }
}

// ── DASHBOARD ────────────────────────────────────────────────
async function renderDashboard() {
  setActiveNav('nav-dashboard');
  setBreadcrumb([{ label: 'Dashboard' }]);

  try {
    const d = await API.dashboard();
    const { stats, overdue, upcoming, recentActivity } = d;

    function overdueRow(t) {
      const isUsage = t.trigger_type === 'usage';
      const dueLabel = isUsage
        ? `${((t.current_usage||0)-(t.next_due_usage||0)).toLocaleString()} ${t.usage_unit||'units'} over`
        : dueDateLabel(t);
      const loc = t.equipment_name
        ? `${esc(t.home_name)} › ${esc(t.room_name)} › ${esc(t.equipment_name)}`
        : `${esc(t.home_name)} › ${esc(t.room_name)}`;
      return `
        <div class="task-row overdue">
          <div class="task-status-dot"></div>
          <div class="task-info">
            <div class="task-name">${esc(t.task_name)}</div>
            <div class="task-desc">${loc}</div>
          </div>
          <div class="task-due overdue">${dueLabel}</div>
          <div class="task-actions">
            <button class="btn btn-success btn-sm" onclick="quickComplete(${t.id}, ${isUsage})">Done</button>
          </div>
        </div>`;
    }

    const overdueRows = overdue.length === 0
      ? `<div class="empty-state" style="padding:30px"><div class="empty-icon">✓</div><div class="empty-msg" style="color:var(--success)">All tasks are up to date</div></div>`
      : overdue.map(overdueRow).join('');

    const upcomingRows = upcoming.length === 0
      ? '<p style="color:var(--text-muted);font-size:13px;padding:16px 0">No tasks due in the next 14 days.</p>'
      : upcoming.map(t => `
        <div class="task-row due-soon">
          <div class="task-status-dot"></div>
          <div class="task-info">
            <div class="task-name">${esc(t.task_name)}</div>
            <div class="task-desc">${t.equipment_name ? `${esc(t.home_name)} › ${esc(t.room_name)} › ${esc(t.equipment_name)}` : `${esc(t.home_name)} › ${esc(t.room_name)}`}</div>
          </div>
          <div class="task-due due-soon">${dueDateLabel(t)}</div>
          <div class="task-actions">
            <button class="btn btn-success btn-sm" onclick="quickComplete(${t.id}, false)">Done</button>
          </div>
        </div>`).join('');

    const activityRows = recentActivity.length === 0
      ? '<p style="color:var(--text-muted);font-size:13px;padding:16px 0">No completions recorded yet.</p>'
      : recentActivity.map(a => {
          const usageNote = a.usage_value ? ` @ ${Number(a.usage_value).toLocaleString()} ${a.usage_unit||''}` : '';
          return `<div class="history-row">
            <span class="history-who">${esc(a.completed_by_name||'?')}</span>
            <span style="flex:1">${esc(a.task_name)}${usageNote ? `<span style="color:var(--cyan)">${esc(usageNote)}</span>` : ''} <span style="color:var(--text-muted)">—</span> ${esc(a.equipment_name||a.room_name)}</span>
            <span class="history-time">${timeAgo(a.completed_at)}</span>
          </div>`;
        }).join('');

    setContent(`
      <div class="page-header">
        <div><div class="page-title">DASHBOARD</div>
        <div class="page-subtitle">${new Date().toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div></div>
      </div>
      <div class="stats-grid">
        <div class="stat-card danger"><div class="stat-value">${stats.overdue_count}</div><div class="stat-label">Overdue</div></div>
        <div class="stat-card warning"><div class="stat-value">${stats.upcoming_count}</div><div class="stat-label">Due Soon</div></div>
        <div class="stat-card success"><div class="stat-value">${stats.completions_30d}</div><div class="stat-label">Done (30d)</div></div>
        <div class="stat-card accent"><div class="stat-value">${stats.task_count}</div><div class="stat-label">Total Tasks</div></div>
        <div class="stat-card cyan"><div class="stat-value">${stats.home_count}</div><div class="stat-label">Homes</div></div>
        <div class="stat-card neutral"><div class="stat-value">${stats.equipment_count}</div><div class="stat-label">Equipment</div></div>
      </div>
      <div class="two-col" style="gap:20px;margin-bottom:20px">
        <div class="card">
          <div class="card-header"><div class="card-title">⚠ Overdue Tasks (${overdue.length})</div></div>
          <div style="padding:16px"><div class="task-list">${overdueRows}</div></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">◷ Due in 14 days (${upcoming.length})</div></div>
          <div style="padding:16px"><div class="task-list">${upcomingRows}</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Recent Activity</div></div>
        <div style="padding:16px"><div class="history-list">${activityRows}</div></div>
      </div>`);
  } catch (err) { setContent(`<div class="alert alert-error">${err.message}</div>`); }
}

async function quickComplete(taskId, isUsage) {
  if (isUsage) {
    const val = prompt('Enter current reading (e.g. mileage):');
    if (val === null) return;
    const num = parseInt(val);
    if (isNaN(num)) return toast('Invalid number', 'error');
    try { await API.completeTask(taskId, { usage_value: num }); toast('Task marked complete!'); renderDashboard(); }
    catch (err) { toast(err.message, 'error'); }
  } else {
    try { await API.completeTask(taskId); toast('Task marked complete!'); renderDashboard(); }
    catch (err) { toast(err.message, 'error'); }
  }
}

// ── HOMES ────────────────────────────────────────────────────
async function renderHomes() {
  setActiveNav('nav-homes');
  setBreadcrumb([{ label: 'Homes' }]);
  setTopbarActions(`<button class="btn btn-primary" onclick="showAddHome()">+ Add Home</button>`);

  try {
    const homes = await API.getHomes();
    if (!homes.length) {
      setContent(`<div class="page-header"><div class="page-title">HOMES</div></div>
        <div class="empty-state"><div class="empty-icon">🏠</div><div class="empty-title">No homes yet</div>
        <div class="empty-msg">Add your first home to get started.</div><br>
        <button class="btn btn-primary" onclick="showAddHome()">+ Add Home</button></div>`);
      return;
    }
    setContent(`
      <div class="page-header"><div class="page-title">HOMES</div></div>
      <div class="item-grid">
        ${homes.map(h => `
          <div class="item-card" onclick="enterHome(${J(h)})">
            <div class="item-card-actions">
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showEditHome(${J(h)})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteHome(${h.id})">✕</button>
            </div>
            <div class="item-card-name">${esc(h.name)}</div>
            ${h.address ? `<div class="item-card-meta" style="margin-bottom:8px">${esc(h.address)}</div>` : ''}
            <div class="item-card-badges"><span class="badge badge-neutral">${h.room_count} room${h.room_count!==1?'s':''}</span></div>
          </div>`).join('')}
      </div>`);
  } catch (err) { setContent(`<div class="alert alert-error">${err.message}</div>`); }
}

function enterHome(home) {
  State.currentHome = home;
  State.currentRoom = null;
  State.currentEquipment = null;
  State.sidebarRooms = [];
  State.sidebarEquipment = {};
  State.sidebarExpanded = new Set();
  loadSidebarRooms(home.id);
  navigate('rooms');
}

function showAddHome() {
  showModal('ADD HOME',
    `<div class="form-group"><label>Home Name *</label><input id="f-home-name" placeholder="e.g. Main Residence"></div>
     <div class="form-group"><label>Address</label><input id="f-home-addr" placeholder="123 Main St"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="submit-task-btn" onclick="submitAddHome()">Add Home</button>`);
}

function showEditHome(home) {
  showModal('EDIT HOME',
    `<div class="form-group"><label>Home Name *</label><input id="f-home-name" value="${esc(home.name)}"></div>
     <div class="form-group"><label>Address</label><input id="f-home-addr" value="${esc(home.address||'')}"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="submit-task-btn" onclick="submitEditHome(${home.id})">Save</button>`);
}

async function submitAddHome() {
  const name = document.getElementById('f-home-name').value.trim(); if (!name) return;
  try { await API.createHome({ name, address: document.getElementById('f-home-addr').value.trim() }); closeModal(); toast('Home added!'); renderHomes(); }
  catch (err) { toast(err.message, 'error'); }
}

async function submitEditHome(id) {
  const name = document.getElementById('f-home-name').value.trim(); if (!name) return;
  try { await API.updateHome(id, { name, address: document.getElementById('f-home-addr').value.trim() }); closeModal(); toast('Home updated!'); renderHomes(); }
  catch (err) { toast(err.message, 'error'); }
}

async function deleteHome(id) {
  if (!confirm('Delete this home and all its rooms, equipment, and tasks?')) return;
  try { await API.deleteHome(id); toast('Home deleted.'); renderHomes(); }
  catch (err) { toast(err.message, 'error'); }
}

// ── ROOMS ────────────────────────────────────────────────────
async function renderRooms() {
  if (!State.currentHome) return navigate('homes');
  setActiveNav('nav-rooms');
  setBreadcrumb([
    { label: 'Homes', onclick: "navigate('homes')" },
    { label: State.currentHome.name }
  ]);
  setTopbarActions(`<button class="btn btn-primary" onclick="showAddRoom()">+ Add Room</button>`);

  try {
    const rooms = await API.getRooms(State.currentHome.id);
    State.sidebarRooms = rooms;
    renderSidebarTree();

    if (!rooms.length) {
      setContent(`<div class="page-header"><div><div class="page-title">ROOMS</div>
        <div class="page-subtitle">${esc(State.currentHome.name)}</div></div></div>
        <div class="empty-state"><div class="empty-icon">🚪</div><div class="empty-title">No rooms yet</div>
        <div class="empty-msg">Add rooms to organise equipment and tasks.</div><br>
        <button class="btn btn-primary" onclick="showAddRoom()">+ Add Room</button></div>`);
      return;
    }

    setContent(`
      <div class="page-header"><div><div class="page-title">ROOMS</div>
        <div class="page-subtitle">${esc(State.currentHome.name)}</div></div></div>
      <div class="item-grid">
        ${rooms.map(r => {
          const badges = [];
          if (r.room_task_overdue > 0) badges.push(`<span class="badge badge-overdue">${r.room_task_overdue} overdue</span>`);
          else if (r.room_task_count > 0) badges.push(`<span class="badge badge-ok">${r.room_task_count} room task${r.room_task_count!==1?'s':''}</span>`);
          badges.push(`<span class="badge badge-neutral">${r.equipment_count} item${r.equipment_count!==1?'s':''}</span>`);
          return `
          <div class="item-card">
            <div class="item-card-actions">
              <button class="btn btn-ghost btn-sm" onclick="showEditRoom(${J(r)})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteRoom(${r.id})">✕</button>
            </div>
            <div class="item-card-name" onclick="enterRoomFromTree(${J(r)})" style="cursor:pointer">${esc(r.name)}</div>
            ${r.description ? `<div class="item-card-meta">${esc(r.description)}</div>` : ''}
            <div class="item-card-badges">${badges.join('')}</div>
            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" onclick="enterRoomTasksFromTree(${J(r)})">🧹 Room Tasks</button>
              <button class="btn btn-secondary btn-sm" onclick="navigateAllTasks(${J(r)})">📋 All Tasks</button>
              <button class="btn btn-ghost btn-sm" onclick="enterRoomFromTree(${J(r)})">📦 Equipment →</button>
            </div>
          </div>`; }).join('')}
      </div>`);
  } catch (err) { setContent(`<div class="alert alert-error">${err.message}</div>`); }
}

function navigateAllTasks(room) {
  State.currentRoom = room;
  State.sidebarExpanded.add(room.id);
  if (!State.sidebarEquipment[room.id]) loadSidebarEquipment(room.id);
  navigate('all-tasks');
}

function showAddRoom() {
  // Ensure presets are loaded even if the boot fetch hasn't resolved yet
  const openModal = (roomPresets) => {
    const presetOpts = roomPresets.map(p =>
      `<option value="${esc(p.name)}">${esc(p.icon)} ${esc(p.name)}</option>`
    ).join('');

    showModal('ADD ROOM',
      `<div class="form-group">
         <label>Room Type (optional)</label>
         <select id="f-room-preset" onchange="onRoomPresetChange()">
           <option value="">— Select a type to auto-fill —</option>
           ${presetOpts}
         </select>
         <div class="room-preset-summary" id="room-preset-summary"></div>
       </div>
       <div class="form-group"><label>Room Name *</label><input id="f-room-name" placeholder="e.g. Kitchen, Garage, Master Bath"></div>
       <div class="form-group"><label>Description</label><textarea id="f-room-desc" placeholder="Optional notes"></textarea></div>`,
      `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
       <button class="btn btn-primary" id="submit-task-btn" onclick="submitAddRoom()">Add Room</button>`);
  };

  if (State.roomPresets.length > 0) {
    openModal(State.roomPresets);
  } else {
    API.getRoomPresets()
      .then(p => { State.roomPresets = p; openModal(p); })
      .catch(() => openModal([]));
  }
}

function onRoomPresetChange() {
  const val = document.getElementById('f-room-preset').value;
  const summary = document.getElementById('room-preset-summary');
  if (!val) { summary.classList.remove('visible'); summary.innerHTML = ''; return; }

  const preset = State.roomPresets.find(p => p.name === val);
  if (!preset) return;

  // Auto-fill name if empty
  const nameField = document.getElementById('f-room-name');
  if (!nameField.value.trim()) nameField.value = val;

  // Show summary
  const taskItems = preset.room_task_count > 0
    ? `<div class="room-preset-col">
        <div class="room-preset-col-title">🧹 Room Tasks (${preset.room_task_count})</div>
        <div class="room-preset-item muted">Cleaning &amp; inspection tasks</div>
       </div>` : '';
  const equipItems = preset.equipment_count > 0
    ? `<div class="room-preset-col">
        <div class="room-preset-col-title">📦 Default Equipment (${preset.equipment_count})</div>
        <div class="room-preset-item muted">Loading...</div>
       </div>` : '';

  summary.classList.add('visible');
  summary.innerHTML = taskItems + equipItems;

  // Load full preset to show equipment names
  API.getRoomPreset(val).then(full => {
    const equipList = full.defaultEquipment.map(e =>
      `<div class="room-preset-item">${esc(e.name)}${e.tasks.length ? ` <span style="color:var(--text-muted);font-size:10px">(${e.tasks.length} tasks)</span>` : ''}</div>`
    ).join('');
    const taskList = full.roomTasks.map(t =>
      `<div class="room-preset-item">${esc(t.name)}</div>`
    ).join('');
    summary.innerHTML = `
      ${taskList ? `<div class="room-preset-col"><div class="room-preset-col-title">🧹 Room Tasks</div>${taskList}</div>` : ''}
      ${equipList ? `<div class="room-preset-col"><div class="room-preset-col-title">📦 Equipment</div>${equipList}</div>` : ''}`;
    window._roomPresetCache = window._roomPresetCache || {};
    window._roomPresetCache[val] = full;
  }).catch(() => {});
}

function showEditRoom(room) {
  showModal('EDIT ROOM',
    `<div class="form-group"><label>Room Name *</label><input id="f-room-name" value="${esc(room.name)}"></div>
     <div class="form-group"><label>Description</label><textarea id="f-room-desc">${esc(room.description||'')}</textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="submit-task-btn" onclick="submitEditRoom(${room.id})">Save</button>`);
}

async function submitAddRoom() {
  const name = document.getElementById('f-room-name').value.trim();
  if (!name) return;
  const presetName = (document.getElementById('f-room-preset')?.value || '').trim();

  // Disable button to prevent double-submit
  const btn = document.getElementById('submit-task-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }

  let room;
  try {
    room = await API.createRoom({
      home_id: State.currentHome.id,
      name,
      description: document.getElementById('f-room-desc')?.value.trim() || ''
    });
  } catch (err) {
    toast('Failed to create room: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Add Room'; }
    return;
  }

  if (!presetName) {
    toast('Room added!');
    closeModal();
    const rooms = await API.getRooms(State.currentHome.id);
    State.sidebarRooms = rooms;
    return renderRooms();
  }

  // Apply preset
  try {
    const full = window._roomPresetCache?.[presetName] || await API.getRoomPreset(presetName);
    if (!full) throw new Error('Preset "' + presetName + '" not found');

    let roomTaskCount = 0, equipCount = 0, equipTaskCount = 0;

    // Room-level tasks
    for (const t of (full.roomTasks || [])) {
      try {
        await API.createTask({
          room_id: room.id,
          name: t.name,
          description: t.description || '',
          trigger_type: 'time',
          frequency_value: t.frequency_value || 1,
          frequency_unit: t.frequency_unit || 'month',
        });
        roomTaskCount++;
      } catch (e) { console.error('Room task failed:', t.name, e.message); }
    }

    // Equipment + their tasks
    for (const eq of (full.defaultEquipment || [])) {
      let newEq;
      try {
        newEq = await API.createEquipment({
          room_id: room.id,
          name: eq.name,
          description: eq.description || '',
          preset_type: eq.preset_type || null,
          usage_unit: eq.usage_unit || null,
          current_usage: eq.usage_unit ? 0 : undefined,
        });
        equipCount++;
      } catch (e) { console.error('Equipment failed:', eq.name, e.message); continue; }

      for (const t of (eq.tasks || [])) {
        try {
          await API.createTask({ equipment_id: newEq.id, ...t });
          equipTaskCount++;
        } catch (e) { console.error('Equip task failed:', t.name, e.message); }
      }
    }

    toast(`✓ ${name} created — ${roomTaskCount} room tasks, ${equipCount} equipment, ${equipTaskCount} equipment tasks`);
  } catch (e) {
    console.error('Preset apply error:', e);
    toast('Room created but preset failed: ' + e.message, 'error');
  }

  closeModal();
  const rooms = await API.getRooms(State.currentHome.id);
  State.sidebarRooms = rooms;
  renderRooms();
}

async function submitEditRoom(id) {
  const name = document.getElementById('f-room-name').value.trim(); if (!name) return;
  try {
    await API.updateRoom(id, { name, description: document.getElementById('f-room-desc').value.trim() });
    closeModal(); toast('Room updated!');
    const rooms = await API.getRooms(State.currentHome.id);
    State.sidebarRooms = rooms;
    renderRooms();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteRoom(id) {
  if (!confirm('Delete this room and all its equipment and tasks?')) return;
  try {
    await API.deleteRoom(id); toast('Room deleted.');
    const rooms = await API.getRooms(State.currentHome.id);
    State.sidebarRooms = rooms;
    delete State.sidebarEquipment[id];
    State.sidebarExpanded.delete(id);
    renderRooms();
  } catch (err) { toast(err.message, 'error'); }
}

// ── EQUIPMENT ────────────────────────────────────────────────
async function renderEquipment() {
  if (!State.currentRoom) return navigate('rooms');
  setActiveNav('');
  setBreadcrumb([
    { label: 'Homes', onclick: "navigate('homes')" },
    { label: State.currentHome.name, onclick: "navigate('rooms')" },
    { label: State.currentRoom.name }
  ]);
  setTopbarActions(`<button class="btn btn-primary" onclick="showAddEquipment()">+ Add Equipment</button>`);

  try {
    const items = await API.getEquipment(State.currentRoom.id);
    State.sidebarEquipment[State.currentRoom.id] = items;
    renderSidebarTree();

    if (!items.length) {
      setContent(`<div class="page-header"><div><div class="page-title">EQUIPMENT</div>
        <div class="page-subtitle">${esc(State.currentRoom.name)}</div></div></div>
        <div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No equipment yet</div>
        <div class="empty-msg">Add appliances, systems, or vehicles.</div><br>
        <button class="btn btn-primary" onclick="showAddEquipment()">+ Add Equipment</button></div>`);
      return;
    }

    setContent(`
      <div class="page-header"><div><div class="page-title">EQUIPMENT</div>
        <div class="page-subtitle">${esc(State.currentHome.name)} › ${esc(State.currentRoom.name)}</div></div></div>
      <div class="item-grid">
        ${items.map(e => {
          const badges = [];
          if (e.overdue_count > 0) badges.push(`<span class="badge badge-overdue">${e.overdue_count} overdue</span>`);
          if (e.due_soon_count > 0) badges.push(`<span class="badge badge-due-soon">${e.due_soon_count} due soon</span>`);
          if (e.overdue_count===0 && e.due_soon_count===0 && e.task_count>0) badges.push(`<span class="badge badge-ok">All clear</span>`);
          badges.push(`<span class="badge badge-neutral">${e.task_count} task${e.task_count!==1?'s':''}</span>`);
          if (e.preset_type) badges.push(`<span class="badge badge-cyan">${esc(e.preset_type)}</span>`);
          const sub = [e.make, e.model].filter(Boolean).join(' ');
          const usageBar = e.current_usage !== null && e.current_usage !== undefined ? `
            <div class="usage-bar-wrap"><div class="usage-bar-label">
              <span>${Number(e.current_usage).toLocaleString()} ${esc(e.usage_unit||'')}</span>
              <button class="btn btn-cyan btn-xs" onclick="event.stopPropagation();showUpdateUsage(${J(e)})">Update</button>
            </div></div>` : '';
          return `
          <div class="item-card" onclick="enterEquipment(${J(e)})">
            <div class="item-card-actions">
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showEditEquipment(${J(e)})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteEquipment(${e.id})">✕</button>
            </div>
            <div class="item-card-name">${esc(e.name)}</div>
            ${sub ? `<div class="item-card-meta" style="margin-bottom:4px">${esc(sub)}</div>` : ''}
            ${e.description ? `<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">${esc(e.description)}</div>` : ''}
            ${usageBar}
            <div class="item-card-badges">${badges.join('')}</div>
          </div>`;
        }).join('')}
      </div>`);
  } catch (err) { setContent(`<div class="alert alert-error">${err.message}</div>`); }
}

function enterEquipment(equip) {
  State.currentEquipment = equip;
  State.sidebarExpanded.add(State.currentRoom.id);
  renderSidebarTree();
  navigate('tasks');
}

// Preset dropdown helpers
function presetDropdownHtml() {
  const opts = State.presets.map(p =>
    `<option value="${esc(p.name)}">${esc(p.icon)} ${esc(p.name)} (${p.task_count} tasks)</option>`
  ).join('');
  return `
    <div class="form-group">
      <label>Equipment Type (optional)</label>
      <select id="f-eq-preset" onchange="onPresetChange()">
        <option value="">— Select a type to auto-fill —</option>
        ${opts}
      </select>
      <div class="preset-hint" id="preset-hint"></div>
    </div>`;
}

function onPresetChange() {
  const val = document.getElementById('f-eq-preset').value;
  const hint = document.getElementById('preset-hint');
  if (!val) { hint.classList.remove('visible'); hint.innerHTML = ''; return; }
  const preset = State.presets.find(p => p.name === val);
  if (!preset) return;
  hint.classList.add('visible');
  hint.innerHTML = `<strong>${preset.task_count} tasks</strong> will be created.${preset.usage_unit ? ` Usage tracking in <strong>${preset.usage_unit}</strong> enabled.` : ''}`;
  const nameField = document.getElementById('f-eq-name');
  if (!nameField.value.trim()) nameField.value = val;
  // Show/hide usage field
  const usageWrap = document.getElementById('f-usage-wrap');
  if (usageWrap) usageWrap.style.display = preset.usage_unit ? '' : 'none';
}

function showAddEquipment() {
  showModal('ADD EQUIPMENT',
    `${presetDropdownHtml()}
     <div class="form-group"><label>Name *</label><input id="f-eq-name" placeholder="e.g. HVAC Unit, 2019 Honda Civic"></div>
     <div class="form-group"><label>Description</label><input id="f-eq-desc" placeholder="Brief description"></div>
     <div class="form-row">
       <div class="form-group"><label>Make / Brand</label><input id="f-eq-make" placeholder="e.g. Carrier"></div>
       <div class="form-group"><label>Model</label><input id="f-eq-model" placeholder="e.g. 24ACC636"></div>
     </div>
     <div class="form-row">
       <div class="form-group"><label>Serial / VIN</label><input id="f-eq-serial" placeholder="Optional"></div>
       <div class="form-group" id="f-usage-wrap" style="display:none">
         <label>Current Reading</label>
         <input type="number" id="f-eq-usage" placeholder="e.g. 45000">
       </div>
     </div>
     <div class="form-group"><label>Notes</label><textarea id="f-eq-notes" placeholder="Warranty info, purchase date, etc."></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="submit-task-btn" onclick="submitAddEquipment()">Add Equipment</button>`);
}

function showEditEquipment(e) {
  const usageVis = (e.current_usage !== null && e.current_usage !== undefined) ? '' : 'display:none';
  showModal('EDIT EQUIPMENT',
    `<div class="form-group"><label>Name *</label><input id="f-eq-name" value="${esc(e.name)}"></div>
     <div class="form-group"><label>Description</label><input id="f-eq-desc" value="${esc(e.description||'')}"></div>
     <div class="form-row">
       <div class="form-group"><label>Make / Brand</label><input id="f-eq-make" value="${esc(e.make||'')}"></div>
       <div class="form-group"><label>Model</label><input id="f-eq-model" value="${esc(e.model||'')}"></div>
     </div>
     <div class="form-row">
       <div class="form-group"><label>Serial / VIN</label><input id="f-eq-serial" value="${esc(e.serial_number||'')}"></div>
       <div class="form-group" id="f-usage-wrap" style="${usageVis}">
         <label>Current Reading (${esc(e.usage_unit||'units')})</label>
         <input type="number" id="f-eq-usage" value="${e.current_usage !== null ? e.current_usage : ''}">
       </div>
     </div>
     <div class="form-group"><label>Notes</label><textarea id="f-eq-notes">${esc(e.notes||'')}</textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="submit-task-btn" onclick="submitEditEquipment(${e.id}, '${esc(e.usage_unit||'')}')">Save</button>`);
}

function showUpdateUsage(e) {
  showModal(`UPDATE ${esc((e.usage_unit||'reading').toUpperCase())}`,
    `<div class="form-group">
       <label>Current ${esc(e.usage_unit||'Reading')}</label>
       <input type="number" id="f-usage-val" value="${e.current_usage||0}" min="0">
       <div class="field-hint">Stored: ${Number(e.current_usage||0).toLocaleString()} ${esc(e.usage_unit||'')}</div>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="submit-task-btn" onclick="submitUpdateUsage(${e.id})">Save</button>`);
}

async function submitUpdateUsage(id) {
  const val = parseInt(document.getElementById('f-usage-val').value);
  if (isNaN(val)) return;
  try {
    await API.updateUsage(id, val);
    // Update cached equipment in sidebar
    for (const roomId in State.sidebarEquipment) {
      State.sidebarEquipment[roomId] = State.sidebarEquipment[roomId].map(e => e.id === id ? { ...e, current_usage: val } : e);
    }
    if (State.currentEquipment && State.currentEquipment.id === id) State.currentEquipment.current_usage = val;
    closeModal(); toast('Reading updated!');
    State.view === 'tasks' ? renderTasks() : renderEquipment();
  } catch (err) { toast(err.message, 'error'); }
}

function getEquipmentForm(usageUnit) {
  const presetEl = document.getElementById('f-eq-preset');
  const usageEl  = document.getElementById('f-eq-usage');
  return {
    name:          document.getElementById('f-eq-name').value.trim(),
    description:   document.getElementById('f-eq-desc').value.trim(),
    make:          document.getElementById('f-eq-make').value.trim(),
    model:         document.getElementById('f-eq-model').value.trim(),
    serial_number: document.getElementById('f-eq-serial').value.trim(),
    notes:         document.getElementById('f-eq-notes').value.trim(),
    preset_type:   presetEl ? presetEl.value : undefined,
    current_usage: (usageEl && usageEl.value !== '') ? parseInt(usageEl.value) : undefined,
    usage_unit:    usageUnit || undefined,
  };
}

async function submitAddEquipment() {
  const presetName = document.getElementById('f-eq-preset')?.value;
  let usageUnit = null;
  if (presetName) {
    const preset = State.presets.find(p => p.name === presetName);
    usageUnit = preset?.usage_unit || null;
  }
  const data = getEquipmentForm(usageUnit);
  if (!data.name) return;
  try {
    const eq = await API.createEquipment({ ...data, room_id: State.currentRoom.id });
    if (presetName) {
      try {
        const full = await API.getPreset(presetName);
        for (const task of full.tasks) await API.createTask({ ...task, equipment_id: eq.id });
        toast(`Equipment added with ${full.tasks.length} default tasks!`);
      } catch { toast('Equipment added (preset tasks failed).', 'error'); }
    } else {
      toast('Equipment added!');
    }
    closeModal();
    const items = await API.getEquipment(State.currentRoom.id);
    State.sidebarEquipment[State.currentRoom.id] = items;
    renderEquipment();
  } catch (err) { toast(err.message, 'error'); }
}

async function submitEditEquipment(id, usageUnit) {
  const data = getEquipmentForm(usageUnit);
  if (!data.name) return;
  try {
    await API.updateEquipment(id, data); closeModal(); toast('Equipment updated!');
    const items = await API.getEquipment(State.currentRoom.id);
    State.sidebarEquipment[State.currentRoom.id] = items;
    renderEquipment();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteEquipment(id) {
  if (!confirm('Delete this equipment and all its tasks?')) return;
  try {
    await API.deleteEquipment(id); toast('Equipment deleted.');
    const items = await API.getEquipment(State.currentRoom.id);
    State.sidebarEquipment[State.currentRoom.id] = items;
    renderEquipment();
  } catch (err) { toast(err.message, 'error'); }
}

// ── TASK FORM ────────────────────────────────────────────────
function presetTaskPickerHtml(equipmentPresetType) {
  if (!equipmentPresetType) return '';
  const preset = State.presets.find(p => p.name === equipmentPresetType);
  if (!preset) return '';
  // We need the full preset tasks — fetch async and inject, but for now show a select
  return `<div id="preset-task-picker-wrap">
    <div class="preset-task-picker">
      <div class="preset-task-picker-header">⚡ Quick-fill from ${esc(equipmentPresetType)} templates</div>
      <div class="preset-task-list" id="preset-task-list">
        <div style="padding:8px 10px;font-size:12px;color:var(--text-muted)">Loading templates...</div>
      </div>
    </div>
  </div>`;
}

async function loadPresetTaskList(presetName) {
  const container = document.getElementById('preset-task-list');
  if (!container) return;
  try {
    const full = await API.getPreset(presetName);
    container.innerHTML = full.tasks.map((t, i) => `
      <div class="preset-task-item" onclick="fillTaskFromPreset(${i}, '${esc(presetName)}')">
        <div>${esc(t.name)}</div>
        <div class="preset-task-item-meta">
          ${t.trigger_type === 'usage'
            ? `Every ${Number(t.usage_interval).toLocaleString()} ${t.usage_unit}`
            : `Every ${t.frequency_value} ${t.frequency_unit}(s)`}
        </div>
      </div>`).join('');
    // Store for later use
    window._presetTasksCache = window._presetTasksCache || {};
    window._presetTasksCache[presetName] = full.tasks;
  } catch {
    container.innerHTML = '<div style="padding:8px 10px;font-size:12px;color:var(--text-muted)">Could not load templates.</div>';
  }
}

function fillTaskFromPreset(index, presetName) {
  const tasks = window._presetTasksCache?.[presetName];
  if (!tasks || !tasks[index]) return;
  const t = tasks[index];
  // Fill form fields
  document.getElementById('f-task-name').value = t.name || '';
  document.getElementById('f-task-desc').value = t.description || '';
  setTriggerType(t.trigger_type || 'time');
  if (t.trigger_type === 'usage') {
    const ui = document.getElementById('f-task-uinterval'); if (ui) ui.value = t.usage_interval || '';
    const uu = document.getElementById('f-task-uunit');     if (uu) uu.value = t.usage_unit || '';
  } else {
    const fv = document.getElementById('f-task-fval');  if (fv) fv.value = t.frequency_value || 1;
    const fu = document.getElementById('f-task-funit'); if (fu) fu.value = t.frequency_unit || 'month';
  }
  toast('Template loaded — review and save');
}

function taskFormHtml(t = {}, presetType = null) {
  const isUsage = (t.trigger_type || 'time') === 'usage';
  const units = ['day','week','month','year'];
  const unitOpts = units.map(u => `<option value="${u}" ${(t.frequency_unit||'month')===u?'selected':''}>${u.charAt(0).toUpperCase()+u.slice(1)}(s)</option>`).join('');

  return `
    ${presetTaskPickerHtml(presetType)}
    <div class="form-group">
      <label>Trigger Type</label>
      <div class="trigger-toggle">
        <button type="button" class="trigger-btn ${!isUsage?'active':''}" id="tt-time"  onclick="setTriggerType('time')">⏱ Time-Based</button>
        <button type="button" class="trigger-btn ${isUsage?'active':''}"  id="tt-usage" onclick="setTriggerType('usage')">🔢 Usage-Based</button>
      </div>
    </div>
    <div class="form-group"><label>Task Name *</label>
      <input id="f-task-name" value="${esc(t.name||'')}" placeholder="e.g. Replace filter, Oil change"></div>
    <div class="form-group"><label>Description / Procedure</label>
      <textarea id="f-task-desc" placeholder="Step-by-step notes...">${esc(t.description||'')}</textarea></div>
    <div id="task-time-fields" style="${isUsage?'display:none':''}">
      <div class="form-group"><label>Repeat Every</label>
        <div class="freq-row">
          <input type="number" id="f-task-fval" value="${t.frequency_value||1}" min="1" max="999">
          <select id="f-task-funit">${unitOpts}</select>
        </div>
      </div>
    </div>
    <div id="task-usage-fields" style="${isUsage?'':'display:none'}">
      <div class="form-row">
        <div class="form-group"><label>Every (interval)</label>
          <input type="number" id="f-task-uinterval" value="${t.usage_interval||''}" placeholder="e.g. 5000"></div>
        <div class="form-group"><label>Unit</label>
          <input id="f-task-uunit" value="${esc(t.usage_unit||'')}" placeholder="miles, hours, km..."></div>
      </div>
    </div>`;
}

function setTriggerType(type) {
  document.getElementById('tt-time').classList.toggle('active', type === 'time');
  document.getElementById('tt-usage').classList.toggle('active', type === 'usage');
  document.getElementById('task-time-fields').style.display  = type === 'time' ? '' : 'none';
  document.getElementById('task-usage-fields').style.display = type === 'usage' ? '' : 'none';
}

function getTaskForm() {
  const isUsage = document.getElementById('tt-usage').classList.contains('active');
  return {
    name:            document.getElementById('f-task-name').value.trim(),
    description:     document.getElementById('f-task-desc').value.trim(),
    trigger_type:    isUsage ? 'usage' : 'time',
    frequency_value: parseInt(document.getElementById('f-task-fval')?.value) || 1,
    frequency_unit:  document.getElementById('f-task-funit')?.value || 'month',
    usage_interval:  parseInt(document.getElementById('f-task-uinterval')?.value) || null,
    usage_unit:      document.getElementById('f-task-uunit')?.value.trim() || null,
  };
}

// ── EQUIPMENT TASKS ──────────────────────────────────────────
async function renderTasks() {
  if (!State.currentEquipment) return navigate('equipment');
  setActiveNav('');
  const eq = State.currentEquipment;
  setBreadcrumb([
    { label: 'Homes', onclick: "navigate('homes')" },
    { label: State.currentHome.name, onclick: "navigate('rooms')" },
    { label: State.currentRoom.name, onclick: "navigate('equipment')" },
    { label: eq.name }
  ]);
  setTopbarActions(`<button class="btn btn-primary" onclick="showAddTask('equipment')">+ Add Task</button>`);

  try {
    const tasks = await API.getTasks({ equipment_id: eq.id });
    const equDetails = [eq.make, eq.model, eq.serial_number ? `S/N: ${eq.serial_number}` : ''].filter(Boolean).join(' · ');
    const usageSummary = eq.current_usage !== null && eq.current_usage !== undefined ? `
      <div class="alert alert-info" style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">
        <span>Current ${esc(eq.usage_unit||'reading')}: <strong>${Number(eq.current_usage).toLocaleString()} ${esc(eq.usage_unit||'')}</strong></span>
        <button class="btn btn-cyan btn-sm" onclick="showUpdateUsage(${J(eq)})">Update Reading</button>
      </div>` : '';

    if (!tasks.length) {
      setContent(`<div class="page-header"><div><div class="page-title">TASKS</div>
        <div class="page-subtitle">${esc(eq.name)}${equDetails?' · '+esc(equDetails):''}</div></div></div>
        ${usageSummary}
        ${eq.notes ? `<div class="alert alert-info" style="margin-bottom:20px">📋 ${esc(eq.notes)}</div>` : ''}
        <div class="empty-state"><div class="empty-icon">✓</div><div class="empty-title">No tasks yet</div>
        <div class="empty-msg">Add maintenance tasks for this equipment.</div><br>
        <button class="btn btn-primary" onclick="showAddTask('equipment')">+ Add Task</button></div>`);
      return;
    }

    setContent(`
      <div class="page-header"><div><div class="page-title">TASKS</div>
        <div class="page-subtitle">${esc(eq.name)}${equDetails?' · '+esc(equDetails):''}</div></div></div>
      ${usageSummary}
      ${eq.notes ? `<div class="alert alert-info" style="margin-bottom:20px">📋 ${esc(eq.notes)}</div>` : ''}
      ${renderTaskSections(tasks, eq.current_usage)}`);
  } catch (err) { setContent(`<div class="alert alert-error">${err.message}</div>`); }
}

// ── ROOM TASKS ───────────────────────────────────────────────
async function renderRoomTasks() {
  if (!State.currentRoom) return navigate('rooms');
  setActiveNav('');
  setBreadcrumb([
    { label: 'Homes', onclick: "navigate('homes')" },
    { label: State.currentHome.name, onclick: "navigate('rooms')" },
    { label: State.currentRoom.name, onclick: "navigate('equipment')" },
    { label: 'Room Tasks' }
  ]);
  setTopbarActions(`
    <div class="view-toggle">
      <button class="view-toggle-btn active">Room Tasks</button>
      <button class="view-toggle-btn" onclick="navigateAllTasks(${J(State.currentRoom)})">All Tasks</button>
    </div>
    <button class="btn btn-primary" onclick="showAddTask('room')">+ Add Task</button>`);

  try {
    const tasks = await API.getTasks({ room_id: State.currentRoom.id });
    if (!tasks.length) {
      setContent(`<div class="page-header"><div><div class="page-title">ROOM TASKS</div>
        <div class="page-subtitle">${esc(State.currentRoom.name)} — cleaning, inspections, etc.</div></div></div>
        <div class="empty-state"><div class="empty-icon">🧹</div><div class="empty-title">No room tasks yet</div>
        <div class="empty-msg">Add recurring tasks — cleaning, inspections, seasonal prep.</div><br>
        <button class="btn btn-primary" onclick="showAddTask('room')">+ Add Task</button></div>`);
      return;
    }
    setContent(`
      <div class="page-header"><div><div class="page-title">ROOM TASKS</div>
        <div class="page-subtitle">${esc(State.currentRoom.name)}</div></div></div>
      ${renderTaskSections(tasks, null)}`);
  } catch (err) { setContent(`<div class="alert alert-error">${err.message}</div>`); }
}

// ── ALL TASKS (room tasks + all equipment tasks) ─────────────
async function renderAllTasks() {
  if (!State.currentRoom) return navigate('rooms');
  setActiveNav('');
  setBreadcrumb([
    { label: 'Homes', onclick: "navigate('homes')" },
    { label: State.currentHome.name, onclick: "navigate('rooms')" },
    { label: State.currentRoom.name, onclick: "navigate('equipment')" },
    { label: 'All Tasks' }
  ]);
  setTopbarActions(`
    <div class="view-toggle">
      <button class="view-toggle-btn" onclick="enterRoomTasksFromTree(${J(State.currentRoom)})">Room Tasks</button>
      <button class="view-toggle-btn active">All Tasks</button>
    </div>`);

  try {
    const data = await API.getRoomAllTasks(State.currentRoom.id);
    const { roomTasks, equipment } = data;

    let html = `<div class="page-header"><div><div class="page-title">ALL TASKS</div>
      <div class="page-subtitle">${esc(State.currentRoom.name)} — room tasks + all equipment</div></div></div>`;

    // Room-level tasks section
    if (roomTasks.length) {
      html += `<div class="all-tasks-group">
        <div class="all-tasks-group-header">
          <div class="all-tasks-group-title">🧹 ${esc(State.currentRoom.name)} Room Tasks</div>
          <div class="all-tasks-group-meta">${roomTasks.length} task${roomTasks.length!==1?'s':''}</div>
        </div>
        ${renderTaskSections(roomTasks, null)}
      </div>`;
    }

    // Equipment sections
    for (const eq of equipment) {
      if (!eq.tasks.length) continue;
      const overdueCount = eq.tasks.filter(t => t.status === 'overdue').length;
      const badgeHtml = overdueCount > 0
        ? `<span class="badge badge-overdue" style="font-size:9px">${overdueCount} overdue</span>` : '';
      html += `<div class="all-tasks-group">
        <div class="all-tasks-group-header" onclick="enterEquipment(${J(eq)})">
          <div class="all-tasks-group-title">📦 ${esc(eq.name)} ${badgeHtml}</div>
          <div class="all-tasks-group-meta">${eq.tasks.length} task${eq.tasks.length!==1?'s':''} · click to open →</div>
        </div>
        ${renderTaskSections(eq.tasks, eq.current_usage)}
      </div>`;
    }

    if (!roomTasks.length && !equipment.some(e => e.tasks.length)) {
      html += `<div class="empty-state"><div class="empty-icon">✓</div>
        <div class="empty-title">No tasks in this room yet</div>
        <div class="empty-msg">Add room tasks or equipment with tasks first.</div></div>`;
    }

    setContent(html);
  } catch (err) { setContent(`<div class="alert alert-error">${err.message}</div>`); }
}

// ── SHARED TASK RENDERING ────────────────────────────────────
function renderTaskSections(tasks, currentUsage) {
  const overdue  = tasks.filter(t => t.status === 'overdue');
  const dueSoon  = tasks.filter(t => t.status === 'due_soon');
  const ok       = tasks.filter(t => t.status === 'ok');

  function taskRow(t) {
    const usageNote = t.trigger_type === 'usage' && currentUsage !== null
      ? `<br><span style="font-size:11px;color:var(--cyan);font-family:var(--font-mono)">${Number(currentUsage).toLocaleString()} / ${Number(t.next_due_usage||0).toLocaleString()} ${t.usage_unit||''}</span>`
      : '';
    return `
      <div class="task-row ${t.status}" id="task-row-${t.id}">
        <div class="task-status-dot"></div>
        <div class="task-info">
          <div class="task-name">${esc(t.name)}</div>
          ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ''}
          ${usageNote}
        </div>
        <div class="task-schedule">${freqLabel(t)}</div>
        <div class="task-due ${t.status}">${dueDateLabel(t)}</div>
        <div class="task-actions">
          <button class="btn btn-success btn-sm" onclick="completeTaskUI(${t.id}, ${t.trigger_type==='usage'})">Done</button>
          <button class="btn btn-ghost btn-sm" onclick="showEditTask(${J(t)})">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="showTaskHistory(${t.id}, '${esc(t.name)}')">History</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})">✕</button>
        </div>
      </div>`;
  }

  let html = '';
  if (overdue.length)  html += `<div style="margin-bottom:24px"><div class="task-section-label overdue">⚠ Overdue</div><div class="task-list">${overdue.map(taskRow).join('')}</div></div>`;
  if (dueSoon.length)  html += `<div style="margin-bottom:24px"><div class="task-section-label due-soon">◷ Due Soon</div><div class="task-list">${dueSoon.map(taskRow).join('')}</div></div>`;
  if (ok.length)       html += `<div style="margin-bottom:24px"><div class="task-section-label ok">✓ Up to Date</div><div class="task-list">${ok.map(taskRow).join('')}</div></div>`;
  return html;
}

function showAddTask(context) {
  const presetType = context === 'equipment' ? State.currentEquipment?.preset_type : null;
  showModal('ADD TASK', taskFormHtml({}, presetType),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="submit-task-btn" onclick="submitAddTask('${context}')">Add Task</button>`);
  if (presetType) loadPresetTaskList(presetType);
}

function showEditTask(t) {
  const presetType = State.currentEquipment?.preset_type || null;
  showModal('EDIT TASK', taskFormHtml(t, presetType),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="submit-task-btn" onclick="submitEditTask(${t.id})">Save</button>`);
  if (presetType) loadPresetTaskList(presetType);
}

async function submitAddTask(context) {
  const data = getTaskForm(); if (!data.name) return;
  const payload = { ...data };
  if (context === 'room') payload.room_id = State.currentRoom.id;
  else payload.equipment_id = State.currentEquipment.id;
  try {
    await API.createTask(payload); closeModal(); toast('Task added!');
    reloadCurrentTaskView();
  } catch (err) { toast(err.message, 'error'); }
}

async function submitEditTask(id) {
  const data = getTaskForm(); if (!data.name) return;
  try {
    await API.updateTask(id, data); closeModal(); toast('Task updated!');
    reloadCurrentTaskView();
  } catch (err) { toast(err.message, 'error'); }
}

async function completeTaskUI(taskId, isUsage) {
  if (isUsage) {
    showModal('MARK COMPLETE',
      `<div class="form-group"><label>Current Reading *</label>
         <input type="number" id="f-complete-usage" placeholder="Enter current mileage / hours / etc.">
         <div class="field-hint">This will update the equipment's current reading.</div>
       </div>
       <div class="form-group"><label>Notes (optional)</label>
         <input id="f-complete-notes" placeholder="e.g. Used Mobil 1 5W-30"></div>`,
      `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
       <button class="btn btn-success" id="submit-task-btn" onclick="submitComplete(${taskId}, true)">Mark Complete</button>`);
  } else {
    showModal('MARK COMPLETE',
      `<div class="form-group"><label>Completed On *</label>
         <input type="datetime-local" id="f-complete-date" value="${formatDateTimeLocal(new Date().toISOString())}">
       </div>
       <div class="form-group"><label>Notes (optional)</label>
         <input id="f-complete-notes" placeholder="e.g. Used Hoover filters, took 20 min"></div>`,
      `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
       <button class="btn btn-success" id="submit-task-btn" onclick="submitComplete(${taskId}, false)">Mark Complete</button>`);
  }
}

async function submitComplete(taskId, isUsage) {
  const notes = document.getElementById('f-complete-notes')?.value.trim();
  const payload = { notes: notes || undefined };
  if (isUsage) {
    const val = parseInt(document.getElementById('f-complete-usage').value);
    if (isNaN(val)) return toast('Enter a valid reading', 'error');
    payload.usage_value = val;
  } else {
    const dateVal = document.getElementById('f-complete-date').value;
    if (dateVal) payload.completed_at = new Date(dateVal).toISOString();
  }
  try {
    await API.completeTask(taskId, payload); closeModal(); toast('Task marked complete!');
    reloadCurrentTaskView();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteTask(id) {
  if (!confirm('Delete this task and its history?')) return;
  try {
    await API.deleteTask(id); toast('Task deleted.');
    reloadCurrentTaskView();
  } catch (err) { toast(err.message, 'error'); }
}

function reloadCurrentTaskView() {
  if (State.view === 'room-tasks') renderRoomTasks();
  else if (State.view === 'all-tasks') renderAllTasks();
  else renderTasks();
}

// ── TASK HISTORY ─────────────────────────────────────────────
async function showTaskHistory(taskId, taskName) {
  let history;
  try { history = await API.getTaskHistory(taskId); }
  catch (err) { toast(err.message, 'error'); return; }

  function historyRowHtml(h) {
    const usageNote = h.usage_value ? `<span class="badge badge-cyan" style="margin-left:6px">${Number(h.usage_value).toLocaleString()}</span>` : '';
    return `
      <div class="history-row" id="hrow-${h.id}">
        <span class="history-who">${esc(h.completed_by_name||'?')}</span>
        <span style="flex:1">${formatDate(h.completed_at)}${usageNote}</span>
        <span style="font-size:12px;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.notes||'')}</span>
        <div class="history-actions">
          <button class="btn btn-ghost btn-xs" onclick="showEditCompletion(${taskId}, ${J(h)})">Edit</button>
          <button class="btn btn-danger btn-xs" onclick="deleteCompletion(${taskId}, ${h.id})">✕</button>
        </div>
      </div>`;
  }

  const rows = history.length === 0
    ? '<p style="color:var(--text-muted);font-size:13px">No completions recorded yet.</p>'
    : `<div class="history-list">${history.map(historyRowHtml).join('')}</div>`;

  showModal(`HISTORY: ${esc(taskName.toUpperCase())}`,
    `<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);margin-bottom:16px">
       ${history.length} completion${history.length!==1?'s':''} · edit or delete past entries below
     </div>${rows}`,
    `<button class="btn btn-primary" onclick="closeModal()">Close</button>`, true);
}

function showEditCompletion(taskId, h) {
  showModal('EDIT COMPLETION',
    `<div class="form-group"><label>Completed At *</label>
       <input type="datetime-local" id="f-edit-date" value="${formatDateTimeLocal(h.completed_at)}">
     </div>
     ${h.usage_value !== null && h.usage_value !== undefined ? `
       <div class="form-group"><label>Usage Reading</label>
         <input type="number" id="f-edit-usage" value="${h.usage_value}"></div>` : ''}
     <div class="form-group"><label>Notes</label>
       <input id="f-edit-notes" value="${esc(h.notes||'')}"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="submit-task-btn" onclick="submitEditCompletion(${taskId}, ${h.id})">Save</button>`);
}

async function submitEditCompletion(taskId, completionId) {
  const dateVal = document.getElementById('f-edit-date').value;
  if (!dateVal) return toast('Date is required', 'error');
  const usageEl = document.getElementById('f-edit-usage');
  const payload = { completed_at: new Date(dateVal).toISOString(), notes: document.getElementById('f-edit-notes').value.trim() };
  if (usageEl) payload.usage_value = parseInt(usageEl.value) || null;
  try {
    await API.updateCompletion(taskId, completionId, payload);
    closeModal(); toast('Completion updated!');
    reloadCurrentTaskView();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteCompletion(taskId, completionId) {
  if (!confirm('Delete this completion? This will recalculate the next due date.')) return;
  try {
    await API.deleteCompletion(taskId, completionId);
    toast('Completion deleted.'); closeModal();
    reloadCurrentTaskView();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Init ─────────────────────────────────────────────────────
(function init() {
  const token = API.getToken();
  const user  = API.getUser();
  if (token && user) bootApp(user);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const modal = document.getElementById('active-modal');
    if (modal) {
      if (document.activeElement && document.activeElement.id === 'submit-task-btn') return;
      const btn = modal.querySelector('.modal-footer .btn-primary, .modal-footer .btn-success');
      if (btn) { e.preventDefault(); btn.click(); }
      return;
    }
    if (document.getElementById('form-login').style.display    !== 'none') doLogin();
    if (document.getElementById('form-register').style.display !== 'none') doRegister();
  });
})();
