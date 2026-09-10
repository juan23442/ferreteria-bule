const sql = require('mssql');

let poolPromise = null;
let lastError = null;

function getConfig() {
  const required = ['MSSQL_USER', 'MSSQL_PASSWORD', 'MSSQL_SERVER', 'MSSQL_DATABASE'];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length) {
    const error = new Error(`Faltan variables de SQL Server: ${missing.join(', ')}`);
    error.code = 'MSSQL_CONFIG_MISSING';
    throw error;
  }

  return {
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    server: process.env.MSSQL_SERVER,
    database: process.env.MSSQL_DATABASE,
    port: process.env.MSSQL_PORT ? Number(process.env.MSSQL_PORT) : 1433,
    pool: {
      max: Number(process.env.MSSQL_POOL_MAX || 10),
      min: Number(process.env.MSSQL_POOL_MIN || 0),
      idleTimeoutMillis: 30000
    },
    options: {
      encrypt: process.env.MSSQL_ENCRYPT === 'true',
      trustServerCertificate: process.env.MSSQL_TRUST_CERT !== 'false',
      enableArithAbort: true
    },
    connectionTimeout: Number(process.env.MSSQL_CONNECTION_TIMEOUT || 10000),
    requestTimeout: Number(process.env.MSSQL_REQUEST_TIMEOUT || 30000)
  };
}

async function connectSqlServer() {
  try {
    const config = getConfig();
    if (!poolPromise) {
      poolPromise = sql.connect(config).catch(error => {
        poolPromise = null;
        lastError = error;
        throw error;
      });
    }
    const pool = await poolPromise;
    if (!pool.connected) {
      poolPromise = null;
      return connectSqlServer();
    }
    lastError = null;
    return pool;
  } catch (error) {
    lastError = error;
    poolPromise = null;
    throw error;
  }
}

async function closeSqlServer() {
  if (!poolPromise) return;
  try {
    const pool = await poolPromise;
    await pool.close();
  } finally {
    poolPromise = null;
  }
}

async function query(requestBuilder) {
  const pool = await connectSqlServer();
  try {
    const request = pool.request();
    return await requestBuilder(request);
  } catch (error) {
    lastError = error;
    poolPromise = null;
    try { await sql.close(); } catch {}
    throw error;
  }
}

async function createProduct(product) {
  return query(request => request
    .input('codigo', sql.VarChar(100), product.code)
    .input('nombre', sql.VarChar(255), product.name)
    .input('compra', sql.Decimal(10, 2), product.costPrice)
    .input('venta', sql.Decimal(10, 2), product.salePrice)
    .input('stock', sql.Int, product.stock)
    .query(`INSERT INTO Productos (CodigoBarras, Nombre, PrecioCompra, PrecioVenta, Stock)
      VALUES (@codigo, @nombre, @compra, @venta, @stock)`));
}

async function health() {
  try {
    const result = await query(request => request.query('SELECT DB_NAME() AS databaseName, @@VERSION AS version'));
    return { configured: true, connected: true, database: result.recordset[0].databaseName, error: null };
  } catch (error) {
    return {
      configured: Boolean(process.env.MSSQL_USER && process.env.MSSQL_PASSWORD && process.env.MSSQL_SERVER && process.env.MSSQL_DATABASE),
      connected: false,
      database: process.env.MSSQL_DATABASE || null,
      error: error.code === 'MSSQL_CONFIG_MISSING' ? error.message : 'No se pudo conectar a SQL Server'
    };
  }
}

module.exports = { connectSqlServer, closeSqlServer, query, createProduct, health, getConfig };
