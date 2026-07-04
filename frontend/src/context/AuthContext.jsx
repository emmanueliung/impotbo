import { createContext, useContext, useState } from 'react';
import { api, setToken, clearToken, getToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('impuestos_user');
    return saved ? JSON.parse(saved) : null;
  });

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    localStorage.setItem('impuestos_user', JSON.stringify(data.user));
    setUser(data.user);
  }

  async function register(payload) {
    await api.post('/auth/register', payload);
    await login(payload.email, payload.password);
  }

  function logout() {
    clearToken();
    localStorage.removeItem('impuestos_user');
    setUser(null);
  }

  // ─── Helpers de rol y tipo ────────────────────────────
  const esContador       = user?.rol === 'contador';
  const esIndependiente  = user?.tipoContribuyente === 'independiente'
                        || user?.tipoContribuyente === 'ambos';
  const esDependiente    = !esIndependiente;
  const esRegimenEspecial = user?.regimen === 'siete_rg';

  return (
    <AuthContext.Provider value={{
      user, login, register, logout,
      isAuth: !!getToken(),
      esContador,
      esIndependiente,
      esDependiente,
      esRegimenEspecial,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
