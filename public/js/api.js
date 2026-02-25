const API = {
  base: '/api',

  getToken() { return localStorage.getItem('hs_token'); },
  setToken(t) { localStorage.setItem('hs_token', t); },
  clearToken() { localStorage.removeItem('hs_token'); localStorage.removeItem('hs_user'); },
  getUser() { try { return JSON.parse(localStorage.getItem('hs_user')); } catch { return null; } },
  setUser(u) { localStorage.setItem('hs_user', JSON.stringify(u)); },

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(this.base + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  get:    (path)       => API.request('GET',    path),
  post:   (path, body) => API.request('POST',   path, body),
  put:    (path, body) => API.request('PUT',    path, body),
  patch:  (path, body) => API.request('PATCH',  path, body),
  delete: (path)       => API.request('DELETE', path),

  // Auth
  login:    (b) => API.post('/auth/login', b),
  register: (b) => API.post('/auth/register', b),
  me:       ()  => API.get('/auth/me'),

  // Dashboard
  dashboard: () => API.get('/dashboard'),

  // Presets
  getPresets:    ()     => API.get('/presets'),
  getPreset:     (name) => API.get(`/presets/${encodeURIComponent(name)}`),

  // Homes
  getHomes:   ()     => API.get('/homes'),
  createHome: (b)    => API.post('/homes', b),
  updateHome: (id,b) => API.put(`/homes/${id}`, b),
  deleteHome: (id)   => API.delete(`/homes/${id}`),

  // Rooms
  getRooms:   (homeId) => API.get(`/rooms?home_id=${homeId}`),
  createRoom: (b)      => API.post('/rooms', b),
  updateRoom: (id,b)   => API.put(`/rooms/${id}`, b),
  deleteRoom: (id)     => API.delete(`/rooms/${id}`),

  // Equipment
  getEquipment:    (roomId) => API.get(`/equipment?room_id=${roomId}`),
  createEquipment: (b)      => API.post('/equipment', b),
  updateEquipment: (id,b)   => API.put(`/equipment/${id}`, b),
  updateUsage:     (id,val) => API.patch(`/equipment/${id}/usage`, { current_usage: val }),
  deleteEquipment: (id)     => API.delete(`/equipment/${id}`),

  // Tasks (equipment or room level)
  getTasks:       (params) => API.get(`/tasks?${new URLSearchParams(params)}`),
  createTask:     (b)      => API.post('/tasks', b),
  updateTask:     (id,b)   => API.put(`/tasks/${id}`, b),
  deleteTask:     (id)     => API.delete(`/tasks/${id}`),
  completeTask:   (id,b)   => API.post(`/tasks/${id}/complete`, b || {}),

  // History
  getTaskHistory:    (id)           => API.get(`/tasks/${id}/history`),
  updateCompletion:  (tid, cid, b)  => API.put(`/tasks/${tid}/history/${cid}`, b),
  deleteCompletion:  (tid, cid)     => API.delete(`/tasks/${tid}/history/${cid}`),
};
