// Servidor estático mínimo para los tests — sirve el repo real tal cual,
// excepto index.html, donde reescribe la línea de REDAUTO_API_URL del lado
// del servidor antes de mandarla al navegador. Nunca toca el archivo en
// disco y nunca pasa por page.route() del lado del browser: interceptar un
// fetch cross-origin real hacia el backend con page.route() puede colgar
// la petición (ya lo vimos al construirlo — ver tests/README.md). Esto
// evita el problema de raíz en vez de trabajarlo.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PORT = Number(process.argv[2] || 8080);
const API_BASE_URL = process.argv[3] || 'http://localhost:4000/api';
const PROD_API_LINE = "window.REDAUTO_API_URL = 'https://redauto-production.up.railway.app/api';";

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    const filePath = path.normalize(path.join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }

    let body = await readFile(filePath);
    if (pathname === '/index.html') {
      const text = body.toString('utf8');
      if (!text.includes(PROD_API_LINE)) {
        throw new Error(
          'index.html ya no tiene la línea esperada de REDAUTO_API_URL — actualiza static-server.mjs.'
        );
      }
      body = Buffer.from(text.replace(PROD_API_LINE, `window.REDAUTO_API_URL = '${API_BASE_URL}';`), 'utf8');
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`[static-server] http://localhost:${PORT} (API -> ${API_BASE_URL})`);
});
