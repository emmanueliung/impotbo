import { Router } from 'express';
import { query } from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { validarNit } from '../utils/validarNit.js';

const router = Router();
router.use(auth);

// GET /api/facturas?periodoId=#
router.get('/', async (req, res) => {
  const { periodoId } = req.query;
  try {
    const { rows } = await query(
      `SELECT * FROM facturas
       WHERE user_id = $1 ${periodoId ? 'AND periodo_id = $2' : ''}
       ORDER BY fecha DESC`,
      periodoId ? [req.user.id, periodoId] : [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar facturas' });
  }
});

// POST /api/facturas  { periodoId, nitProveedor, nroFactura, fecha, importe, codigoAutorizacion }
router.post('/', async (req, res) => {
  const { periodoId, nitProveedor, nroFactura, fecha, importe, codigoAutorizacion } = req.body;

  if (!periodoId || !nitProveedor || !nroFactura || !fecha || !importe) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  if (!validarNit(nitProveedor)) {
    return res.status(400).json({ error: 'NIT del proveedor inválido' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO facturas (user_id, periodo_id, nit_proveedor, nro_factura, fecha, importe, codigo_autorizacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, periodoId, nitProveedor, nroFactura, fecha, importe, codigoAutorizacion || null]
    );
    await query(
      `INSERT INTO audit_logs (user_id, accion, detalle) VALUES ($1, 'crear_factura', $2)`,
      [req.user.id, JSON.stringify({ facturaId: rows[0].id, importe })]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear factura' });
  }
});

// DELETE /api/facturas/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM facturas WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Factura no encontrada' });
    await query(
      `INSERT INTO audit_logs (user_id, accion, detalle) VALUES ($1, 'eliminar_factura', $2)`,
      [req.user.id, JSON.stringify({ facturaId: req.params.id })]
    );
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar factura' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/facturas/importar-csv
// Body JSON: { csvContent: "...", periodoId: 123 }
// El frontend lee el archivo con FileReader y envía el texto.
// ─────────────────────────────────────────────────────────────
router.post('/importar-csv', async (req, res) => {
  const { csvContent, periodoId } = req.body;

  if (!csvContent || !periodoId) {
    return res.status(400).json({ error: 'csvContent y periodoId requeridos' });
  }

  // ── 1. Detectar delimitador ──────────────────────────────
  const primeraLinea = csvContent.split(/\r?\n/)[0] ?? '';
  const delimitador  = (primeraLinea.match(/;/g) ?? []).length >=
                       (primeraLinea.match(/,/g) ?? []).length ? ';' : ',';

  // ── 2. Parser CSV simple (maneja comillas) ───────────────
  function parsearLinea(linea) {
    const campos = [];
    let campo = '';
    let enComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') { enComillas = !enComillas; }
      else if (c === delimitador && !enComillas) { campos.push(campo.trim()); campo = ''; }
      else { campo += c; }
    }
    campos.push(campo.trim());
    return campos;
  }

  function normalizar(str = '') {
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_').replace(/^_|_$/g, '');
  }

  const lineas  = csvContent.trim().split(/\r?\n/).filter(l => l.trim());
  if (lineas.length < 2) {
    return res.status(400).json({ error: 'El archivo CSV está vacío o no tiene datos.' });
  }

  const headersRaw = parsearLinea(lineas[0]);
  const headers    = headersRaw.map(normalizar);

  // ── 3. Mapeo de columnas (formato SIN + formato propio) ──
  const CANDIDATOS = {
    nit:      ['nit', 'nit_emisor', 'nit_del_emisor', 'nit_proveedor', 'nit_emisor_receptor', 'n_nit', 'nit_entidad'],
    factura:  ['numero_factura', 'nro_factura', 'n_factura', 'num_factura', 'factura', 'nro', 'numero'],
    autorizacion: ['codigo_autorizacion', 'numero_autorizacion', 'cod_autorizacion', 'autorizacion', 'cod_autorizaci_n', 'n_mero_de_autorizaci_n', 'num_autorizacion', 'cuf'],
    fecha:    ['fecha', 'fecha_emision', 'fecha_de_emision', 'fecha_emisi_n', 'date', 'fecha_factura'],
    importe:  ['importe_total', 'importe', 'monto_total', 'monto', 'total', 'importe_base_credito_fiscal', 'subtotal'],
  };

  function detectarIdx(candidatos) {
    for (const c of candidatos) {
      const idx = headers.indexOf(c);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const idxNit      = detectarIdx(CANDIDATOS.nit);
  const idxFactura  = detectarIdx(CANDIDATOS.factura);
  const idxAut      = detectarIdx(CANDIDATOS.autorizacion);
  const idxFecha    = detectarIdx(CANDIDATOS.fecha);
  const idxImporte  = detectarIdx(CANDIDATOS.importe);

  if (idxNit < 0 || idxFactura < 0 || idxFecha < 0 || idxImporte < 0) {
    return res.status(422).json({
      error: 'No se reconocieron las columnas del CSV. Columnas detectadas: ' + headers.join(', '),
      columnas_detectadas: headers,
      columnas_requeridas: ['NIT', 'Número factura', 'Fecha', 'Importe'],
    });
  }

  // ── 4. Verificar que el periodo pertenece al usuario ─────
  try {
    const { rows: pRows } = await query(
      'SELECT id FROM periodos WHERE id = $1 AND user_id = $2',
      [periodoId, req.user.id]
    );
    if (!pRows.length) return res.status(404).json({ error: 'Periodo no encontrado' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al verificar el periodo' });
  }

  // ── 5. Procesar filas ───────────────────────────────────
  let importadas = 0, omitidas = 0;
  const errores  = [];

  for (let i = 1; i < lineas.length; i++) {
    const vals         = parsearLinea(lineas[i]);
    const nitRaw       = vals[idxNit]?.replace(/[^0-9]/g, '') ?? '';
    const nroFactura   = vals[idxFactura]?.trim() ?? '';
    const autorizacion = idxAut >= 0 ? (vals[idxAut]?.trim() ?? null) : null;
    const fechaRaw     = vals[idxFecha]?.trim() ?? '';
    const importeRaw   = vals[idxImporte]?.replace(',', '.').replace(/[^0-9.]/g, '') ?? '';

    // Validaciones básicas
    if (!nitRaw || !nroFactura || !fechaRaw || !importeRaw) {
      omitidas++;
      errores.push({ fila: i + 1, motivo: 'Campos vacíos', datos: vals.slice(0, 5).join(' | ') });
      continue;
    }

    const importe = parseFloat(importeRaw);
    if (isNaN(importe) || importe <= 0) {
      omitidas++;
      errores.push({ fila: i + 1, motivo: `Importe inválido: "${importeRaw}"` });
      continue;
    }

    // Parsear fecha (acepta DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY)
    let fecha;
    const partesBarra = fechaRaw.split('/');
    const partesGuion = fechaRaw.split('-');
    if (partesBarra.length === 3) {
      const [d, m, a] = partesBarra;
      fecha = `${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    } else if (partesGuion.length === 3 && partesGuion[0].length === 4) {
      fecha = fechaRaw; // ya es YYYY-MM-DD
    } else if (partesGuion.length === 3) {
      const [d, m, a] = partesGuion;
      fecha = `${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    } else {
      omitidas++;
      errores.push({ fila: i + 1, motivo: `Fecha no reconocida: "${fechaRaw}"` });
      continue;
    }

    try {
      await query(
        `INSERT INTO facturas
           (user_id, periodo_id, nit_proveedor, nro_factura, fecha, importe, codigo_autorizacion)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [req.user.id, periodoId, nitRaw, nroFactura, fecha, importe, autorizacion]
      );
      importadas++;
    } catch (err) {
      omitidas++;
      errores.push({ fila: i + 1, motivo: err.message });
    }
  }

  // ── 6. Audit log ────────────────────────────────────────
  await query(
    `INSERT INTO audit_logs (user_id, accion, detalle) VALUES ($1,'importar_csv',$2)`,
    [req.user.id, JSON.stringify({ periodoId, importadas, omitidas })]
  ).catch(() => {});

  res.json({
    importadas,
    omitidas,
    errores: errores.slice(0, 20), // max 20 errores en la respuesta
    mensaje: `${importadas} factura(s) importada(s)${omitidas > 0 ? `, ${omitidas} omitida(s)` : ''}.`,
  });
});

export default router;

