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

  async function quickLogin(email, password) {
    setModo('login');
    setError('');
    setCargando(true);
    setForm((prev) => ({ ...prev, email, password }));
    try {
      await login(email, password);
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

        {/* Acceso Rápido Modo Demo */}
        <div style={{
          marginTop: 20,
          padding: '14px 16px',
          background: 'var(--fondo)',
          border: '1px dashed var(--verde-border)',
          borderRadius: 'var(--radio-md)',
        }}>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--verde)',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>✨</span> Accesos Rápidos — Modo Demo
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              className="btn btn-sec"
              style={{ fontSize: 12, padding: '8px 4px', margin: 0, textAlign: 'center' }}
              onClick={() => quickLogin('cliente@demo.bo', 'demo123')}
              disabled={cargando}
            >
              👤 Cliente Demo
            </button>
            <button
              type="button"
              className="btn btn-sec"
              style={{ fontSize: 12, padding: '8px 4px', margin: 0, textAlign: 'center' }}
              onClick={() => quickLogin('contador@demo.bo', 'demo123')}
              disabled={cargando}
            >
              📊 Contador Demo
            </button>
          </div>

          <div style={{ fontSize: 11, color: 'var(--texto-muted)', lineHeight: 1.5 }}>
            <div>• <strong>Cliente:</strong> cliente@demo.bo · <em>demo123</em></div>
            <div>• <strong>Contador:</strong> contador@demo.bo · <em>demo123</em></div>
            <div style={{ marginTop: 4, color: 'var(--texto-sec)' }}>
              (Contraseña para cualquier cuenta registrada: <strong>demo123</strong>)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
