const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export const taskApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/tasks${query ? `?${query}` : ''}`);
  },
  get: (id) => request(`/tasks/${id}`),
  create: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  updateStatus: (id, status, extras = {}) =>
    request(`/tasks/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, ...extras }) }),
  addSubtask: (id, data) =>
    request(`/tasks/${id}/subtasks`, { method: 'POST', body: JSON.stringify(data) }),
  getDependencies: (id) => request(`/tasks/${id}/dependencies`),
  reorder: (tasks) => request('/tasks/reorder', { method: 'PUT', body: JSON.stringify({ tasks }) }),
};

export const aiApi = {
  chat: (message, conversationId = null) =>
    request('/ai/chat', { method: 'POST', body: JSON.stringify({ message, conversationId }) }),
  morningCheckIn: () =>
    request('/ai/morning-checkin', { method: 'POST' }),
  planDay: () =>
    request('/ai/plan-day', { method: 'POST' }),
  estimateDuration: (taskId) =>
    request('/ai/estimate-duration', { method: 'POST', body: JSON.stringify({ taskId }) }),
  listConversations: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/ai/conversations${query ? `?${query}` : ''}`);
  },
  getConversation: (id) => request(`/ai/conversations/${id}`),
  updateConversation: (id, data) =>
    request(`/ai/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const authApi = {
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
};

export const userApi = {
  getPreferences: () => request('/user/preferences'),
  updatePreferences: (data) => request('/user/preferences', { method: 'PUT', body: JSON.stringify(data) }),
  verifySms: () => request('/user/verify-sms', { method: 'POST' }),
};
