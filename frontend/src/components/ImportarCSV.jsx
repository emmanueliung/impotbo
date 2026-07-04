import { useRef, useState } from 'react';
import { api } from '../api/client.js';

/* ─── Formatos de columnas aceptados ──────────────────────────
   Formato SIN/SIAT (Bolivia):
     NIT Emisor ; Número Autorización ; Número Factura ; Fecha ; Importe Total

   Formato propio de la app (export CSV):
     NIT Proveedor ; N° Factura ; Cod. Autorización ; Fecha ; Importe (Bs)
   ─────────────────────────────────────────────────────────── */

const bs = (n) => `Bs ${Number(n ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;

export default function ImportarCSV({ periodoId, onImportado }) {
  const inputRef              = useRef(null);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [preview,       setPreview]       = useState(null);   // { headers, filas[] }
  const [csvContent,    setCsvContent]    = useState('');
  const [resultado,     setResultado]     = useState(null);   // { importadas, omitidas, errores[] }
  const [cargando,      setCargando]      = useState(false);
  const [error,         setError]         = useState('');
  const [arrastrando,   setArrastrando]   = useState(false);

  /* ── Leer archivo ── */
  function leerArchivo(archivo) {
    if (!archivo) return;
    if (!archivo.name.endsWith('.csv') && archivo.type !== 'text/csv') {
      setError('Solo se aceptan archivos .csv');
      return;
    }
    setError('');
    setResultado(null);
    setArchivoNombre(archivo.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const texto = e.target.result;
      setCsvContent(texto);
      generarPreview(texto);
    };
    reader.readAsText(archivo, 'UTF-8');
  }

  /* ── Preview: primeras 5 filas ── */
  function generarPreview(texto) {
    const lineas = texto.trim().split(/\r?\n/).filter(l => l.trim());
    if (lineas.length < 2) {
      setError('El archivo está vacío.');
      setPreview(null);
      return;
    }
    // Detectar delimitador
    const primera = lineas[0];
    const delim = (primera.match(/;/g) ?? []).length >= (primera.match(/,/g) ?? []).length ? ';' : ',';
    const parsear = (linea) => linea.split(delim).map(c => c.replace(/^"|"$/g, '').trim());

    const headers = parsear(lineas[0]);
    const filas   = lineas.slice(1, 6).map(parsear); // max 5 filas en preview
    setPreview({ headers, filas, total: lineas.length - 1, delim });
  }

  /* ── Drag & Drop handlers ── */
  function onDragOver(e)  { e.preventDefault(); setArrastrando(true);  }
  function onDragLeave()  { setArrastrando(false); }
  function onDrop(e)      { e.preventDefault(); setArrastrando(false); leerArchivo(e.dataTransfer.files[0]); }

  /* ── Enviar al backend ── */
  async function importar() {
    if (!csvContent || !periodoId) return;
    setCargando(true);
    setError('');
    try {
      const res = await api.post('/facturas/importar-csv', { csvContent, periodoId });
      setResultado(res);
      setPreview(null);
      setCsvContent('');
      setArchivoNombre('');
      if (onImportado) onImportado();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  /* ── Resetear ── */
  function resetear() {
    setPreview(null);
    setCsvContent('');
    setArchivoNombre('');
    setResultado(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  /* ─── Render ───────────────────────────────────────────────── */
  return (
    <div>
      <h2>Importar desde SIN</h2>
      <p className="muted" style={{ marginBottom: 14 }}>
        Descarga tu lista de facturas desde el portal SIN y súbela aquí. Se importarán automáticamente sin duplicar.
      </p>

      {/* ── Zona drag & drop ── */}
      {!preview && !resultado && (
        <>
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border:       `2px dashed ${arrastrando ? 'var(--verde)' : 'var(--borde)'}`,
              borderRadius: 'var(--radio-md)',
              background:   arrastrando ? 'var(--verde-claro)' : 'var(--fondo)',
              padding:      '28px 16px',
              textAlign:    'center',
              cursor:       'pointer',
              transition:   'all 0.2s',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: arrastrando ? 'var(--verde)' : 'var(--texto-sec)' }}>
              {arrastrando ? 'Suelta el archivo aquí' : 'Arrastra tu archivo CSV aquí'}
            </div>
            <div className="muted" style={{ marginTop: 4 }}>o toca para seleccionar</div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => leerArchivo(e.target.files?.[0])}
          />
          <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            Formatos aceptados: CSV del portal SIN/SIAT, separado por punto y coma (;) o coma (,).
          </p>
        </>
      )}

      {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}

      {/* ── Preview ── */}
      {preview && (
        <>
          <div style={{
            background: 'var(--verde-claro)',
            border: '1px solid var(--verde-border)',
            borderRadius: 'var(--radio-sm)',
            padding: '10px 14px',
            marginBottom: 12,
            fontSize: 13,
            color: 'var(--verde)',
            fontWeight: 500,
          }}>
            📄 {archivoNombre} — {preview.total} fila(s) detectadas · delimitador "{preview.delim}"
          </div>

          {/* Tabla preview (scroll horizontal) */}
          <div style={{ overflowX: 'auto', marginBottom: 14, borderRadius: 'var(--radio-sm)', border: '1px solid var(--borde)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 400 }}>
              <thead>
                <tr style={{ background: 'var(--fondo)' }}>
                  {preview.headers.map((h, i) => (
                    <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--texto-sec)', borderBottom: '1px solid var(--borde)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.filas.map((fila, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--borde)' }}>
                    {fila.map((v, j) => (
                      <td key={j} style={{ padding: '7px 10px', color: 'var(--texto)', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.total > 5 && (
            <p className="muted" style={{ marginBottom: 10 }}>Mostrando 5 de {preview.total} filas.</p>
          )}

          <div className="row">
            <button className="btn btn-sec" onClick={resetear} style={{ marginTop: 0 }}>
              Cancelar
            </button>
            <button className="btn" onClick={importar} disabled={cargando} style={{ marginTop: 0 }}>
              {cargando ? 'Importando…' : `Importar ${preview.total} facturas`}
            </button>
          </div>
        </>
      )}

      {/* ── Resultado ── */}
      {resultado && (
        <>
          <div className={resultado.importadas > 0 ? 'estado-ok' : 'estado-falta'} style={{ marginBottom: 12 }}>
            {resultado.importadas > 0 ? '✓' : '⚠'} {resultado.mensaje}
          </div>

          {resultado.importadas > 0 && (
            <div className="metric">
              <span>Facturas importadas</span>
              <span className="val" style={{ color: 'var(--verde)' }}>{resultado.importadas}</span>
            </div>
          )}
          {resultado.omitidas > 0 && (
            <div className="metric">
              <span>Omitidas (duplicadas o inválidas)</span>
              <span className="val" style={{ color: 'var(--texto-muted)' }}>{resultado.omitidas}</span>
            </div>
          )}

          {resultado.errores?.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--texto-muted)' }}>
                Ver detalles de filas omitidas ({resultado.errores.length})
              </summary>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--texto-sec)' }}>
                {resultado.errores.map((e, i) => (
                  <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--borde)' }}>
                    Fila {e.fila}: {e.motivo}
                    {e.datos && <span style={{ color: 'var(--texto-muted)' }}> — {e.datos}</span>}
                  </div>
                ))}
              </div>
            </details>
          )}

          <button className="btn btn-sec" onClick={resetear} style={{ marginTop: 14 }}>
            Importar otro archivo
          </button>
        </>
      )}
    </div>
  );
}
