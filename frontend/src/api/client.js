// Cliente API simple sobre fetch. El token se guarda en localStorage.
const TOKEN_KEY = 'impuestos_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. ¿Está encendido el backend?');
  }

  if (res.status === 204) return null;

  // Lee el cuerpo como texto y luego intenta parsear (evita el error de JSON vacío)
  const texto = await res.text();
  let data = {};
  if (texto) {
    try { data = JSON.parse(texto); }
    catch { throw new Error('El servidor respondió de forma inesperada. Verifica que el backend esté activo.'); }
  }

  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

export const api = {
  get:   (p)    => request('GET',    p),
  post:  (p, b) => request('POST',   p, b),
  patch: (p, b) => request('PATCH',  p, b),
  del:   (p)    => request('DELETE', p),
};
