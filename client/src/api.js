const getToken = () => localStorage.getItem('tf_token') ?? '';

export async function api(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('tf_token');
    localStorage.removeItem('tf_user');
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }
  return res;
}

export default api;