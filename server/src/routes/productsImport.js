import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { parseImportWorkbook } from '../services/productImportParser.js';
import { buildImportTemplate } from '../services/productImportTemplate.js';

export const productsImportRouter = Router();

// En memoria, nunca a disco: Railway no garantiza almacenamiento
// persistente entre despliegues, y el archivo no hace falta guardarlo, solo
// procesarlo. 10MB alcanza de sobra para miles de filas de texto.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function getOwnStoreId(userId) {
  const result = await pool.query('SELECT id FROM stores WHERE owner_user_id = $1', [userId]);
  return result.rows[0]?.id || null;
}

// GET /api/products/import/template — la plantilla oficial, generada al
// vuelo (nunca queda un archivo viejo desincronizado del esquema real).
productsImportRouter.get('/template', asyncHandler(async (req, res) => {
  const buffer = await buildImportTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="redauto-plantilla-productos.xlsx"');
  res.send(buffer);
}));

// POST /api/products/import/preview — valida el archivo subido SIN escribir
// nada en la base de datos. El vendedor revisa el resultado antes de
// confirmar (ver js/ui/productImport.js).
productsImportRouter.post('/preview', requireAuth, requireSeller, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Sube un archivo .xlsx o .csv.' });
  const categories = (await pool.query('SELECT id, name FROM categories')).rows;
  const result = await parseImportWorkbook(req.file.buffer, categories, req.file.originalname);
  res.json(result);
}));

// POST /api/products/import/commit — vuelve a validar el mismo archivo
// (misma lógica que /preview, para que no pueda importarse algo que nunca
// se le mostró al vendedor) y esta vez sí escribe: upsert por (store_id,
// sku) en una sola transacción, para que una importación a medio camino
// nunca deje productos sueltos si algo falla.
productsImportRouter.post('/commit', requireAuth, requireSeller, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Sube un archivo .xlsx o .csv.' });
  const storeId = await getOwnStoreId(req.auth.id);
  if (!storeId) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });

  const categories = (await pool.query('SELECT id, name FROM categories')).rows;
  const { products, errors } = await parseImportWorkbook(req.file.buffer, categories, req.file.originalname);
  if (!products.length) {
    return res.status(400).json({ error: 'No hay productos válidos para importar.', errors });
  }

  const toCents = (value) => Math.round(Number(value) * 100);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of products) {
      const result = await client.query(
        `INSERT INTO products
           (store_id, category_id, name, part_brand, sku, type, description, price_cents, stock, availability, internal_location)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (store_id, sku) WHERE sku IS NOT NULL DO UPDATE SET
           category_id = EXCLUDED.category_id,
           name = EXCLUDED.name,
           part_brand = EXCLUDED.part_brand,
           type = EXCLUDED.type,
           description = EXCLUDED.description,
           price_cents = EXCLUDED.price_cents,
           stock = EXCLUDED.stock,
           availability = EXCLUDED.availability,
           internal_location = EXCLUDED.internal_location,
           updated_at = now()
         RETURNING id`,
        [
          storeId, p.categoryId, p.name, p.partBrand, p.sku, p.type, p.description,
          toCents(p.price), p.stock, p.availability, p.internalLocation,
        ]
      );
      const productId = result.rows[0].id;
      await client.query('DELETE FROM product_compatibility WHERE product_id = $1', [productId]);
      for (const c of p.compatibility) {
        await client.query(
          `INSERT INTO product_compatibility (product_id, vehicle_brand, vehicle_model, year_from, year_to, engine, vehicle_trim)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [productId, c.brand, c.model, c.yearFrom || null, c.yearTo || null, c.engine || null, c.trim || null]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({ imported: products.length, errors });
}));
