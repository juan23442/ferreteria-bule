/**
 * FERRETERÍA EL BULE — Servidor HTTP Local
 * Node.js 18+ nativo, sin dependencias externas
 * Soporta: HTML, CSS, JS, JSON, PNG, JPG, SVG, ICO, WOFF, WOFF2
 * Seguridad: Path traversal protection, headers seguros
 * Rendimiento: Gzip/Deflate habilitado, Cache-Control para assets estáticos
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { makeDatabase, createRepository } = require('./server-db');
const { health: sqlHealth, createProduct, closeSqlServer } = require('./server-sql');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp'
};

// Tipos de archivo que se pueden comprimir con gzip
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg']);
let repository;

function getSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  };
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res).catch(error => {
      console.error('Error API:', error.message);
      sendJson(res, 500, { error: 'Error interno del servidor' });
    });
    return;
  }

  // Solo GET y HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Allow': 'GET, HEAD' });
    res.end('Método no permitido');
    return;
  }

  if (req.url.split('?')[0] === '/health') {
    const body = JSON.stringify({ status: 'ok', service: 'ferreteria-el-bule' });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      ...getSecurityHeaders()
    });
    if (req.method === 'HEAD') { res.end(); return; }
    res.end(body);
    return;
  }

  // Resolver ruta, protección contra path traversal
  let urlPath = req.url.split('?')[0]; // Ignorar query strings
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));

  // Bloquear acceso a rutas fuera del directorio público
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    res.writeHead(403, getSecurityHeaders());
    res.end('Acceso denegado');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Si no existe el archivo, servir index.html (SPA fallback)
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.stat(indexPath, (e2, s2) => {
        if (e2 || !s2.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...getSecurityHeaders() });
          res.end('<h1>404 - Página no encontrada</h1>');
          return;
        }
        serveFile(req, res, indexPath, '.html', s2);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    serveFile(req, res, filePath, ext, stats);
  });
});

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...getSecurityHeaders()
  });
  res.end(body);
}

function readJson(req, maxBytes = 50 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.setEncoding('utf8');
    req.on('data', chunk => {
      size += Buffer.byteLength(chunk);
      if (size > maxBytes) {
        reject(new Error('Payload demasiado grande'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { sqlite: await repository.health(), sqlServer: await sqlHealth() });
    return;
  }
  if (url.pathname === '/api/sqlserver/health' && req.method === 'GET') {
    const result = await sqlHealth();
    sendJson(res, result.connected ? 200 : 503, result);
    return;
  }
  if (url.pathname === '/api/migrate' && req.method === 'POST') {
    const snapshot = await readJson(req);
    await repository.migrateSnapshot(snapshot);
    sendJson(res, 200, { ok: true, migrated: true, ...(await repository.health()) });
    return;
  }
  if ((url.pathname === '/api/productos' || url.pathname === '/api/products') && req.method === 'POST') {
    const payload = await readJson(req);
    const product = {
      code: String(payload.code ?? payload.codigoBarras ?? '').trim(),
      name: String(payload.name ?? payload.nombre ?? '').trim(),
      costPrice: Number(payload.costPrice ?? payload.precioCompra),
      salePrice: Number(payload.salePrice ?? payload.precioVenta),
      stock: Number(payload.stock)
    };
    if (!product.code || !product.name || !Number.isFinite(product.costPrice) || !Number.isFinite(product.salePrice) || !Number.isInteger(product.stock)) {
      sendJson(res, 400, { error: 'Código, nombre, precios y stock son obligatorios y deben ser válidos' });
      return;
    }
    await createProduct(product);
    sendJson(res, 201, { message: 'Producto guardado en SQL Server', product });
    return;
  }
  if (url.pathname === '/api/products' && req.method === 'GET') {
    sendJson(res, 200, await repository.listProducts({
      query: url.searchParams.get('q') || '',
      category: url.searchParams.get('category') || '',
      stock: url.searchParams.get('stock') || '',
      page: url.searchParams.get('page') || 1,
      pageSize: url.searchParams.get('pageSize') || 50,
      activeOnly: url.searchParams.get('activeOnly') === 'true'
    }));
    return;
  }
  if (url.pathname === '/api/products/summary' && req.method === 'GET') {
    sendJson(res, 200, await repository.productSummary());
    return;
  }
  sendJson(res, 404, { error: 'Ruta API no encontrada' });
}

function serveFile(req, res, filePath, ext, stats) {
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const canCompress = COMPRESSIBLE.has(ext);
  const acceptEncoding = req.headers['accept-encoding'] || '';

  const headers = {
    'Content-Type': contentType,
    ...getSecurityHeaders()
  };

  // Evitar archivos estáticos antiguos en caché del navegador para que los cambios se vean inmediatamente.
  if (ext !== '.html') {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
    headers['Last-Modified'] = stats.mtime.toUTCString();
  }

  // Compresión Gzip
  if (canCompress && acceptEncoding.includes('gzip')) {
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(res);
    return;
  }

  // Compresión Deflate
  if (canCompress && acceptEncoding.includes('deflate')) {
    headers['Content-Encoding'] = 'deflate';
    headers['Vary'] = 'Accept-Encoding';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(filePath).pipe(zlib.createDeflate()).pipe(res);
    return;
  }

  // Sin compresión
  headers['Content-Length'] = stats.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(filePath).pipe(res);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ ERROR: El puerto ${PORT} ya está en uso.`);
    console.error('   Cierra el proceso anterior o cambia el puerto:');
    console.error('   PowerShell: $env:PORT=8081; node server.js');
    console.error('   CMD:        set PORT=8081 && node server.js\n');
  } else {
    console.error('Error del servidor:', err.message);
  }
  process.exit(1);
});

makeDatabase().then(db => {
  repository = createRepository(db);
  server.listen(PORT, () => {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('   🔧 FERRO PINTURAS EL BULE — Sistema Administrativo');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   ✅ Servidor ejecutándose en: http://localhost:${PORT}`);
    console.log(`   📦 Node.js: ${process.version}`);
    console.log(`   📂 Directorio: ${PUBLIC_DIR}`);
    console.log('   🗄️  SQLite: persistencia relacional activa');
    console.log('═══════════════════════════════════════════════════\n');
  });
}).catch(error => {
  console.error('No se pudo inicializar SQLite:', error.message);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await closeSqlServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeSqlServer();
  process.exit(0);
});
