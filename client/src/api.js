const getToken = () => localStorage.getItem('tf_token') ?? '';

export class ApiError extends Error {
  constructor(message, { auth = false } = {}) {
    super(message);
    this.auth = auth;
  }
}

export async function api(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError('No se pudo conectar con la API');
  }
  if (res.status === 401) {
    localStorage.removeItem('tf_token');
    localStorage.removeItem('tf_user');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError('Sesión expirada. Iniciá sesión de nuevo.', { auth: true });
  }
  return res;
}

export default api;