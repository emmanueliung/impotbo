import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, register } = useAuth();
  const [modo, setModo] = useState('login'); // 'login' | 'registro'
  const [form, setForm] = useState({
    nombre: '', email: '', password: '',
    nit: '', salarioBruto: '', rol: 'particular',
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      if (modo === 'login') {
        await login(form.email, form.password);
      } else {
        await register({
          nombre:       form.nombre,
          email:        form.email,
          password:     form.password,
          rol:          form.rol,
          nit:          form.nit          || undefined,
          salarioBruto: form.salarioBruto ? Number(form.salarioBruto) : undefined,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-screen">
      {/* Hero */}
      <div className="login-hero">
        <div className="login-logo">🧾</div>
        <div className="login-app-name">ImpuestosBO</div>
        <p className="login-tagline">
          Gestiona tus impuestos bolivianos de forma simple y rápida
        </p>
      </div>

      {/* Card */}
      <div className="login-card">
        {/* Tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab${modo === 'login' ? ' active' : ''}`}
            type="button"
            onClick={() => { setModo('login'); setError(''); }}
          >
            Iniciar sesión
          </button>
          <button
            className={`login-tab${modo === 'registro' ? ' active' : ''}`}
            type="button"
            onClick={() => { setModo('registro'); setError(''); }}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={submit}>
          {/* ── Registro ── */}
          {modo === 'registro' && (
            <>
              <label>¿Quién eres?</label>
              <select value={form.rol} onChange={set('rol')}>
                <option value="particular">Soy trabajador / empresa (gestiono mis impuestos)</option>
                <option value="contador">Soy contador (gestiono varios clientes)</option>
              </select>

              <label>Nombre completo</label>
              <input
                value={form.nombre}
                onChange={set('nombre')}
                placeholder="Ej. Juan Mamani"
                required
              />
            </>
          )}

          <label>Correo electrónico</label>
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="tu@correo.com"
            required
            autoComplete="email"
          />

          <label>Contraseña</label>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder={modo === 'login' ? '••••••••' : 'Mínimo 6 caracteres'}
            required
            autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
          />

          {/* Campos adicionales solo para particulares */}
          {modo === 'registro' && form.rol === 'particular' && (
            <>
              <label>NIT <span className="muted">(opcional)</span></label>
              <input
                value={form.nit}
                onChange={set('nit')}
                inputMode="numeric"
                placeholder="Tu número de NIT"
              />

              <label>Salario bruto mensual (Bs) <span className="muted">(opcional)</span></label>
              <input
                value={form.salarioBruto}
                onChange={set('salarioBruto')}
                inputMode="decimal"
                placeholder="Ej. 5000"
              />
              <p className="field-hint">Puedes configurarlo después en tu perfil.</p>
            </>
          )}

          {error && <p className="error">{error}</p>}

          <button className="btn" type="submit" disabled={cargando}>
            {cargando
              ? (modo === 'login' ? 'Entrando…' : 'Creando cuenta…')
              : (modo === 'login' ? 'Entrar' : 'Crear mi cuenta')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--texto-muted)' }}>
          {modo === 'login' ? '¿Todavía no tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button
            className="btn-link"
            type="button"
            onClick={() => { setModo(modo === 'login' ? 'registro' : 'login'); setError(''); }}
          >
            {modo === 'login' ? 'Regístrate gratis' : 'Iniciar sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}
