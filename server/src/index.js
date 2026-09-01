import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { productsImportRouter } from './routes/productsImport.js';
import { storesRouter } from './routes/stores.js';
import { ordersRouter } from './routes/orders.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
// Antes que /api/products: si no, "/api/products/import/template" cae en
// la ruta /:id de productsRouter, que trataría "import" como un id de
// producto y respondería 404 antes de llegar acá.
app.use('/api/products/import', productsImportRouter);
app.use('/api/products', productsRouter);
app.use('/api/stores', storesRouter);
app.use('/api/orders', ordersRouter);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`RedAuto API escuchando en http://localhost:${PORT}`);
});
