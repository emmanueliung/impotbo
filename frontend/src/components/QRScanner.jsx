import { useEffect, useRef, useState } from 'react';

/**
 * QRScanner — Scanner QR natif pour les factures boliviennes SIN.
 * Utilise l'API BarcodeDetector si disponible, sinon fallback manuel.
 *
 * @param {function} onResult  Appelé avec { nit, nroFactura, fecha, importe, raw }
 * @param {function} onClose   Ferme le scanner
 */
export default function QRScanner({ onResult, onClose }) {
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const rafRef      = useRef(null);
  const canvasRef   = useRef(null);
  const [estado,    setEstado]  = useState('iniciando'); // 'iniciando' | 'activo' | 'error' | 'no-soporte'
  const [errorMsg,  setErrorMsg] = useState('');

  const SOPORTE_BARCODE = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    iniciarCamera();
    return () => detenerCamera();
  }, []);

  async function iniciarCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setEstado('activo');

        if (SOPORTE_BARCODE) {
          iniciarDeteccion();
        }
        // Si pas BarcodeDetector: l'utilisateur peut saisir manuellement
      }
    } catch (err) {
      setEstado('error');
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Permiso de cámara denegado. Actívelo en la configuración del navegador.');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No se encontró cámara trasera en este dispositivo.');
      } else {
        setErrorMsg(`Error de cámara: ${err.message}`);
      }
    }
  }

  function detenerCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function iniciarDeteccion() {
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const canvas   = canvasRef.current;
    const ctx      = canvas?.getContext('2d');

    async function detectar() {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(detectar);
        return;
      }
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue;
          detenerCamera();
          const parsed = parsearQRBolivia(raw);
          onResult(parsed);
          return;
        }
      } catch (_) { /* continuar */ }
      rafRef.current = requestAnimationFrame(detectar);
    }
    rafRef.current = requestAnimationFrame(detectar);
  }

  /**
   * Parse le format QR des factures électroniques boliviennes (SIN/SIAT).
   * Format typique: NIT|NRO|FECHA|IMPORTE|AUTORIZACION ou JSON
   */
  function parsearQRBolivia(raw) {
    // Tentative JSON
    try {
      const obj = JSON.parse(raw);
      return {
        nit:        String(obj.nit ?? obj.NIT ?? obj.nitEmisor ?? ''),
        nroFactura: String(obj.nroFactura ?? obj.numero ?? obj.factura ?? ''),
        fecha:      obj.fecha ?? obj.date ?? '',
        importe:    String(obj.importe ?? obj.monto ?? obj.total ?? ''),
        codigoAutorizacion: String(obj.autorizacion ?? obj.cuf ?? ''),
        raw,
      };
    } catch (_) { /* continuar */ }

    // Tentative pipe-separated: NIT|NRO|FECHA|IMPORTE|AUTORIZACION
    const parts = raw.split('|');
    if (parts.length >= 4) {
      return {
        nit:        parts[0]?.replace(/\D/g, '') ?? '',
        nroFactura: parts[1]?.trim() ?? '',
        fecha:      normalizarFecha(parts[2]?.trim() ?? ''),
        importe:    parts[3]?.replace(',', '.').replace(/[^0-9.]/g, '') ?? '',
        codigoAutorizacion: parts[4]?.trim() ?? '',
        raw,
      };
    }

    // Retourner brut si non parsé
    return { nit: '', nroFactura: '', fecha: '', importe: '', raw };
  }

  function normalizarFecha(f) {
    if (!f) return '';
    // DD/MM/YYYY → YYYY-MM-DD
    const slash = f.split('/');
    if (slash.length === 3 && slash[2].length === 4) {
      return `${slash[2]}-${slash[1].padStart(2, '0')}-${slash[0].padStart(2, '0')}`;
    }
    return f;
  }

  return (
    <div className="qr-overlay">
      <div className="qr-modal">
        <div className="qr-header">
          <h3>📷 Escanear QR Factura</h3>
          <button className="qr-close" onClick={() => { detenerCamera(); onClose(); }}>✕</button>
        </div>

        {estado === 'iniciando' && (
          <p className="muted" style={{ padding: 20 }}>Iniciando cámara…</p>
        )}

        {estado === 'error' && (
          <div style={{ padding: 16 }}>
            <p className="error">{errorMsg}</p>
            <p className="muted" style={{ marginTop: 8 }}>Puedes ingresar los datos manualmente.</p>
            <button className="btn btn-sec" style={{ marginTop: 12 }} onClick={onClose}>
              Ingresar manualmente
            </button>
          </div>
        )}

        {estado === 'activo' && (
          <>
            <div className="qr-video-wrap">
              <video ref={videoRef} className="qr-video" playsInline muted autoPlay />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div className="qr-frame" />
              <p className="qr-hint">Apunta al código QR de la factura</p>
            </div>

            {!SOPORTE_BARCODE && (
              <div style={{ padding: '0 16px 16px' }}>
                <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                  ⚠️ Tu navegador no soporta detección automática. Ingresa los datos manualmente.
                </p>
                <button className="btn btn-sec" onClick={onClose}>
                  Ingresar manualmente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
