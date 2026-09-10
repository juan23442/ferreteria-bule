require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use('/css', express.static('css'));
app.use('/js', express.static('js'));
app.use('/assets', express.static('assets'));
app.use(express.static('public'));

// Configuracion de la conexion a Supabase (PostgreSQL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Prueba de conexion a la Base de Datos
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error adquiriendo cliente de PostgreSQL:', err.stack);
  }
  console.log('Conexion exitosa a Supabase PostgreSQL');
  release();
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

// Crear un nuevo producto
app.post('/api/productos', async (req, res) => {
  const codigo = req.body.codigo ?? req.body.code;
  const nombre = req.body.nombre ?? req.body.name;
  const precio = req.body.precio ?? req.body.salePrice;
  const stock = req.body.stock;
  try {
    if (!codigo || !nombre || !Number.isFinite(Number(precio)) || !Number.isFinite(Number(stock))) {
      return res.status(400).json({ error: 'Código, nombre, precio y stock son obligatorios' });
    }
    const result = await pool.query(
      'INSERT INTO productos (codigo, nombre, precio, stock) VALUES ($1, $2, $3, $4) RETURNING *',
      [codigo, nombre, Number(precio), Number(stock)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar un producto existente
app.put('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  const { codigo, nombre, precio, stock } = req.body;
  try {
    const result = await pool.query(
      'UPDATE productos SET codigo = $1, nombre = $2, precio = $3, stock = $4 WHERE id = $5 RETURNING *',
      [codigo, nombre, precio, stock, id]
    );
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
