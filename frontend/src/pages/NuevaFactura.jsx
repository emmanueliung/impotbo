import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import QRScanner from '../components/QRScanner.jsx';

export default function NuevaFactura() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hoy = new Date();

  const [form, setForm] = useState({
    nitProveedor:       '',
    nroFactura:         '',
    fecha:              hoy.toISOString().slice(0, 10),
    importe:            '',
    codigoAutorizacion: '',
  });
  const [error,      setError]      = useState('');
  const [guardando,  setGuardando]  = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMsg,     setScanMsg]     = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  /* ── Résultat du scan QR ─── */
  function handleQRResult({ nit, nroFactura, fecha, importe, codigoAutorizacion, raw }) {
    setShowScanner(false);
    if (nit || nroFactura || importe) {
      setForm((prev) => ({
        ...prev,
        nitProveedor:       nit       || prev.nitProveedor,
        nroFactura:         nroFactura || prev.nroFactura,
        fecha:              fecha      || prev.fecha,
        importe:            importe    || prev.importe,
        codigoAutorizacion: codigoAutorizacion || prev.codigoAutorizacion,
      }));
      setScanMsg('✅ QR leído correctamente. Verifique los datos antes de guardar.');
      setTimeout(() => setScanMsg(''), 4000);
    } else {
      setError(`No se pudo extraer datos del QR. Código: ${raw?.slice(0, 60) ?? '—'}`);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const periodo = await api.post('/periodos', {
        anio: hoy.getFullYear(),
        mes:  hoy.getMonth() + 1,
        salarioMes: user?.salarioBruto || 0,
      });
      await api.post('/facturas', {
        periodoId:          periodo.id,
        nitProveedor:       form.nitProveedor,
        nroFactura:         form.nroFactura,
        fecha:              form.fecha,
        importe:            Number(form.importe),
        codigoAutorizacion: form.codigoAutorizacion || undefined,
      });
      navigate('/');
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <>
      {showScanner && (
        <QRScanner
          onResult={handleQRResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Nueva factura</h2>
          <button
            type="button"
            className="btn btn-qr"
            onClick={() => { setError(''); setShowScanner(true); }}
            title="Escanear código QR de la factura"
          >
            📷 Escanear QR
          </button>
        </div>

        {scanMsg && (
          <div className="estado-ok" style={{ marginBottom: 14, padding: 10 }}>{scanMsg}</div>
        )}

        <form onSubmit={submit}>
          <label>NIT del proveedor</label>
          <input
            value={form.nitProveedor}
            onChange={set('nitProveedor')}
            inputMode="numeric"
            placeholder="Ej: 1234567890"
            required
          />

          <label>N° de factura</label>
          <input
            value={form.nroFactura}
            onChange={set('nroFactura')}
            placeholder="Ej: 00001234"
            required
          />

          <label>Fecha</label>
          <input
            type="date"
            value={form.fecha}
            onChange={set('fecha')}
            required
          />

          <label>Importe (Bs)</label>
          <input
            value={form.importe}
            onChange={set('importe')}
            inputMode="decimal"
            placeholder="Ej: 250.00"
            required
          />

          <label>Código de autorización (opcional)</label>
          <input
            value={form.codigoAutorizacion}
            onChange={set('codigoAutorizacion')}
            placeholder="CUF o código de autorización"
          />

          {error && <p className="error">{error}</p>}

          <div className="row" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-sec" onClick={() => navigate('/')}>
              Cancelar
            </button>
            <button type="submit" className="btn" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
