require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

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

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
