require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/css', express.static('css', { maxAge: '1h' }));
app.use('/js', express.static('js', { maxAge: '1h' }));
app.use('/assets', express.static('assets', { maxAge: '1h' }));
app.use('/data', express.static('data', { maxAge: '1h' }));
app.use(express.static('public'));

// Configuracion de la conexion a Supabase (PostgreSQL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Estado compartido para que todos los dispositivos vean los mismos datos.
const appStateReady = pool.query(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY,
    state JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`).catch(err => console.error('No se pudo preparar el estado compartido:', err.message));

// Conserva el precio de compra que necesita el inventario original.
pool.query('ALTER TABLE productos ADD COLUMN IF NOT EXISTS costo NUMERIC NOT NULL DEFAULT 0')
  .catch(err => console.error('No se pudo preparar el costo de productos:', err.message));

// Prueba de conexion a la Base de Datos
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error adquiriendo cliente de PostgreSQL:', err.stack);
  }
  console.log('Conexion exitosa a Supabase PostgreSQL');
  release();
});

app.get('/api/state', async (req, res) => {
  try {
    await appStateReady;
    const result = await pool.query('SELECT state, updated_at FROM app_state WHERE id = 1');
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Todavía no hay datos compartidos' });
    }
    const state = result.rows[0].state;
    const hasData = Object.keys(state).some(key => key !== 'categories' && Array.isArray(state[key]) && state[key].length > 0);
    if (!hasData) return res.status(404).json({ error: 'Todavía no hay datos compartidos' });

    const seedPath = path.join(__dirname, 'data', 'products.json');
    const seedProducts = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const productsById = new Map((state.products || []).map(product => [String(product.id), product]));
    const productsByCode = new Map((state.products || []).map(product => [String(product.code || '').toLowerCase(), product]));
    for (const product of seedProducts) {
      const code = String(product.code || '').toLowerCase();
      if (!productsById.has(String(product.id)) && !productsByCode.has(code)) {
        productsById.set(String(product.id), product);
      }
    }
    const mergedProducts = [...productsById.values()];
    if (mergedProducts.length > (state.products || []).length) {
      state.products = mergedProducts;
      await pool.query('UPDATE app_state SET state = $1::jsonb, updated_at = NOW() WHERE id = 1', [JSON.stringify(state)]);
    }
    res.json({ ...state, _updatedAt: result.rows[0].updated_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo leer el estado compartido' });
  }
});

app.post('/api/state', async (req, res) => {
  try {
    await appStateReady;
    const state = req.body;
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return res.status(400).json({ error: 'El estado debe ser un objeto' });
    }
    const current = await pool.query('SELECT state FROM app_state WHERE id = 1');
    const currentState = current.rows[0]?.state;
    const incomingHasData = Object.keys(state).some(key => Array.isArray(state[key]) && state[key].length > 0);
    const currentHasData = currentState && Object.keys(currentState).some(key => Array.isArray(currentState[key]) && currentState[key].length > 0);
    if (!incomingHasData) return res.status(204).end();
    if (currentHasData && !state.products?.length && currentState.products?.length) return res.status(204).end();

    await pool.query(`
      INSERT INTO app_state (id, state, updated_at) VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
    `, [JSON.stringify(state)]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar el estado compartido' });
  }
});

// Rutas de tu aplicacion
app.get('/api/productos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  }
});

// Compatibilidad con los módulos de la aplicación original.
app.get('/api/products', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 50));
    const result = await pool.query('SELECT id, codigo, nombre, precio, stock, costo FROM productos ORDER BY id ASC');
    const query = String(req.query.q || '').trim().toLowerCase();
    const filtered = result.rows.filter(product => !query || `${product.codigo} ${product.nombre}`.toLowerCase().includes(query));
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map(product => ({
      id: String(product.id),
      code: product.codigo,
      name: product.nombre,
      costPrice: Number(product.costo) || 0,
      salePrice: Number(product.precio) || 0,
      stock: Number(product.stock) || 0,
      minStock: 3,
      active: true
    }));
    res.json({ items, total: filtered.length, page, pageSize, pages: Math.max(1, Math.ceil(filtered.length / pageSize)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(costo * stock), 0)::numeric AS cost,
        COALESCE(SUM(precio * stock), 0)::numeric AS sale,
        COUNT(*) FILTER (WHERE stock <= 0)::int AS "outStock",
        COUNT(*) FILTER (WHERE stock > 0 AND stock <= 3)::int AS "lowStock"
      FROM productos
    `);
    res.json({ ...result.rows[0], cost: Number(result.rows[0].cost) || 0, sale: Number(result.rows[0].sale) || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Crear un nuevo producto
app.post('/api/productos', async (req, res) => {
  const codigo = req.body.codigo ?? req.body.code;
  const nombre = req.body.nombre ?? req.body.name;
  const precio = req.body.precio ?? req.body.salePrice;
  const costo = req.body.costo ?? req.body.costPrice;
  const stock = req.body.stock;
  try {
    if (!codigo || !nombre || !Number.isFinite(Number(precio)) || !Number.isFinite(Number(stock))) {
      return res.status(400).json({ error: 'Código, nombre, precio y stock son obligatorios' });
    }
    const result = await pool.query(
      'INSERT INTO productos (codigo, nombre, precio, stock, costo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [codigo, nombre, Number(precio), Number(stock), Number(costo) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar un producto existente
app.put('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  const codigo = req.body.codigo ?? req.body.code;
  const nombre = req.body.nombre ?? req.body.name;
  const precio = req.body.precio ?? req.body.salePrice;
  const costo = req.body.costo ?? req.body.costPrice;
  const stock = req.body.stock;
  try {
    if (!codigo || !nombre || !Number.isFinite(Number(precio)) || !Number.isFinite(Number(stock))) {
      return res.status(400).json({ error: 'Código, nombre, precio y stock son obligatorios' });
    }
    const result = await pool.query(
      'UPDATE productos SET codigo = $1, nombre = $2, precio = $3, stock = $4, costo = $5 WHERE id::text = $6 OR codigo = $6 RETURNING *',
      [codigo, nombre, Number(precio), Number(stock), Number(costo) || 0, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar un producto
app.delete('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM productos WHERE id = $1', [id]);
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
