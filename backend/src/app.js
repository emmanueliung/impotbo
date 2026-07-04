import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import periodosRoutes from './routes/periodos.routes.js';
import facturasRoutes from './routes/facturas.routes.js';
import invitationsRoutes from './routes/invitations.routes.js';
import clientesRoutes from './routes/clientes.routes.js';
import mensajesRoutes from './routes/mensajes.routes.js';
import parametrosRoutes from './routes/parametros.routes.js';
import adminRoutes from './routes/admin.routes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Página raíz informativa (esto NO es la interfaz; la app está en :5173)
app.get('/', (req, res) =>
  res.send(
    '<h2>API impuestos-bo</h2>' +
      '<p>Este es el servidor (API), no tiene interfaz visual.</p>' +
      '<p>La aplicación está en <a href="http://localhost:5173">http://localhost:5173</a></p>'
  )
);

// Verificación de salud
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'impuestos-bo' }));

app.use('/api/auth', authRoutes);
app.use('/api/periodos', periodosRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/mensajes', mensajesRoutes);
app.use('/api/parametros', parametrosRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API impuestos-bo en http://localhost:${PORT}`);
});
