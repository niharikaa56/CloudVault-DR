import axios from 'axios';

let inMemoryToken = null;
let onUnauthorizedCallback = null;

export function setInMemoryAuthToken(token) {
  inMemoryToken = token || null;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorizedCallback = handler;
}

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  if (inMemoryToken) {
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && inMemoryToken && typeof onUnauthorizedCallback === 'function') {
      onUnauthorizedCallback();
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error, fallback = 'An unexpected error occurred.') {
  return error?.response?.data?.error || error?.message || fallback;
}

export function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'recovered-file';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const healthApi = {
  check: (retry = false) =>
    api.get('/health', { params: retry ? { retry: 'true' } : undefined }).then((r) => r.data),
};

export const authApi = {
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data),
  getMe: () => api.get('/auth/me').then((r) => r.data),
  updateSettings: (payload) => api.patch('/auth/settings', payload).then((r) => r.data),
  changePassword: (payload) => api.patch('/auth/password', payload).then((r) => r.data),
};

export const filesApi = {
  list: (params) => api.get('/files', { params }).then((r) => r.data),
  getById: (id) => api.get(`/files/${id}`).then((r) => r.data),
  upload: (formData, onUploadProgress) =>
    api
      .post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
      })
      .then((r) => r.data),
  downloadBlob: (id, inline = false) =>
    api
      .get(`/files/${id}/download`, {
        params: inline ? { inline: 'true' } : undefined,
        responseType: 'blob',
      })
      .then((r) => r.data),
  verifyIntegrity: (id) => api.post(`/files/${id}/verify`).then((r) => r.data),
  softDelete: (id) => api.delete(`/files/${id}`).then((r) => r.data),
  listTrash: () => api.get('/files/trash').then((r) => r.data),
  restoreFromTrash: (id) => api.post(`/files/${id}/restore`).then((r) => r.data),
  permanentDelete: (id) => api.delete(`/files/${id}/permanent`).then((r) => r.data),
  emptyTrash: () => api.delete('/files/trash/empty').then((r) => r.data),
};

export const backupsApi = {
  list: (params) => api.get('/backups', { params }).then((r) => r.data),
  listForFile: (fileId) => api.get(`/backups/file/${fileId}`).then((r) => r.data),
  createManual: (fileId, notes = '') =>
    api.post(`/backups/file/${fileId}`, { notes }).then((r) => r.data),
  downloadBlob: (id) =>
    api.get(`/backups/${id}/download`, { responseType: 'blob' }).then((r) => r.data),
  deleteBackup: (id) => api.delete(`/backups/${id}`).then((r) => r.data),
};

export const recoveryApi = {
  getDashboard: () => api.get('/recovery/dashboard').then((r) => r.data),
  getCatalog: () => api.get('/recovery/catalog').then((r) => r.data),
  recoverDownloadBlob: (backupId) =>
    api.get(`/recovery/recover/${backupId}`, { responseType: 'blob' }).then((r) => r.data),
  restoreVersion: (fileId, backupId) =>
    api.post('/recovery/restore', { fileId, backupId }).then((r) => r.data),
  getHistory: (params) => api.get('/recovery/history', { params }).then((r) => r.data),
};

export default api;
