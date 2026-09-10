const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'ferreteria.sqlite');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const text = (value, fallback = '') => value === undefined || value === null ? fallback : String(value);
const json = value => JSON.stringify(value ?? null);
const dateOf = value => text(value, new Date().toISOString());
const bool = (value, fallback = true) => value === undefined || value === null ? (fallback ? 1 : 0) : (value === false || value === 0 ? 0 : 1);

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function onRun(error) {
    if (error) reject(error); else resolve({ changes: this.changes, lastID: this.lastID });
  }));
}
function get(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}
function exec(db, sql) {
  return new Promise((resolve, reject) => db.exec(sql, error => error ? reject(error) : resolve()));
}

async function makeDatabase() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = await new Promise((resolve, reject) => {
    const instance = new sqlite3.Database(DB_PATH, error => error ? reject(error) : resolve(instance));
  });
  await exec(db, fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}

async function insertSimple(db, table, item) {
  const mappings = {
    suppliers: ['id,name,document,phone,email,address,notes,legacy_json', [text(item.id), text(item.name, 'Sin nombre'), text(item.document || item.nit), text(item.phone), text(item.email), text(item.address), text(item.notes), json(item)]],
    customers: ['id,name,document,phone,email,address,notes,legacy_json', [text(item.id), text(item.name, 'Sin nombre'), text(item.document || item.nit), text(item.phone), text(item.email), text(item.address), text(item.notes), json(item)]],
    expenses: ['id,date,category,description,amount,created_at,legacy_json', [text(item.id), dateOf(item.date), text(item.category), text(item.description), Math.max(0, number(item.amount)), item.createdAt || null, json(item)]],
    cash_movements: ['id,date,datetime,type,concept,amount,legacy_json', [text(item.id), dateOf(item.date), item.datetime || null, item.type === 'egreso' ? 'egreso' : 'ingreso', text(item.concept), Math.max(0, number(item.amount)), json(item)]],
    movements: ['id,date,datetime,product_id,product_name,qty,type,reason,user_name,value,legacy_json', [text(item.id), dateOf(item.date), item.datetime || null, item.productId || null, text(item.productName, 'Producto N/A'), number(item.qty), text(item.type), text(item.reason), text(item.user, 'Sistema'), number(item.value), json(item)]]
  };
  const [columns, values] = mappings[table];
  await run(db, `INSERT OR IGNORE INTO ${table} (${columns}) VALUES (${values.map(() => '?').join(',')})`, values);
}

async function migrateSnapshot(db, snapshot = {}) {
  await exec(db, 'BEGIN IMMEDIATE');
  try {
    const categories = new Map();
    for (const category of snapshot.categories || []) {
      const id = text(category.id, `cat_${category.name}`);
      const name = text(category.name, 'Otros');
      await run(db, 'INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)', [id, name]);
      categories.set(name.toLowerCase(), id);
    }
    for (const product of snapshot.products || []) {
      const categoryName = text(product.category, 'Otros');
      const categoryId = categories.get(categoryName.toLowerCase()) || `cat_${categoryName}`;
      await run(db, 'INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)', [categoryId, categoryName]);
      categories.set(categoryName.toLowerCase(), categoryId);
      await run(db, `INSERT OR IGNORE INTO products
        (id,code,name,category_id,category_name,brand,unit,description,supplier_name,cost_price,sale_price,stock,min_stock,active,created_at,legacy_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [text(product.id), text(product.code, text(product.id)), text(product.name, 'Producto'), categoryId,
        categoryName, text(product.brand), text(product.unit, 'unidad'), text(product.description), text(product.supplier), number(product.costPrice), number(product.salePrice),
        Math.max(0, number(product.stock)), Math.max(0, number(product.minStock)), bool(product.active), product.createdAt || null, json(product)]);
    }
    for (const table of ['suppliers', 'customers', 'expenses', 'cash_movements', 'movements']) {
      for (const item of snapshot[table] || []) await insertSimple(db, table, item);
    }

    const productIds = new Set((snapshot.products || []).map(item => item.id));
    const customerIds = new Set((snapshot.customers || []).map(item => item.id));
    for (const sale of snapshot.sales || []) {
      const total = number(sale.total);
      const paid = number(sale.totalPaid, sale.status === 'pendiente' ? 0 : total);
      const invoiceNumber = text(sale.invoiceNumber, text(sale.id));
      await run(db, `INSERT OR IGNORE INTO sales
        (id,invoice_number,customer_id,customer_name,date,total,total_paid,total_pending,status,payment_method,real_profit,legacy_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [text(sale.id), invoiceNumber, customerIds.has(sale.customerId) ? sale.customerId : null, text(sale.customerName), dateOf(sale.date), total,
        paid, Math.max(0, total - paid), text(sale.status, 'pagada'), text(sale.paymentMethod), number(sale.realProfit), json(sale)]);
      await run(db, `INSERT OR IGNORE INTO invoices (id,sale_id,invoice_number,issued_at,status,legacy_json) VALUES (?,?,?,?,?,?)`,
        [`invoice_${sale.id}`, text(sale.id), invoiceNumber, dateOf(sale.createdAt || sale.date), 'emitida', json(sale)]);
      await run(db, 'DELETE FROM sale_items WHERE sale_id = ?', [text(sale.id)]);
      await run(db, 'DELETE FROM payments WHERE sale_id = ? AND notes = ?', [text(sale.id), 'Migración inicial']);
      for (const item of sale.items || []) {
        if (!productIds.has(item.productId)) continue;
        await run(db, `INSERT INTO sale_items (sale_id,product_id,product_code,product_name,qty,unit_price,cost_price,total) VALUES (?,?,?,?,?,?,?,?)`,
          [text(sale.id), item.productId, text(item.code), text(item.name), Math.max(1, number(item.qty, 1)), number(item.price || item.salePrice), number(item.costPrice), number(item.total || item.qty * (item.price || item.salePrice))]);
      }
      if (paid > 0) await run(db, 'INSERT OR IGNORE INTO payments (id,sale_id,date,amount,method,notes) VALUES (?,?,?,?,?,?)',
        [`payment_${sale.id}`, text(sale.id), dateOf(sale.date), paid, text(sale.paymentMethod), 'Migración inicial']);
    }
    const supplierIds = new Set((snapshot.suppliers || []).map(item => item.id));
    for (const purchase of snapshot.purchases || []) {
      await run(db, `INSERT OR IGNORE INTO purchases (id,supplier_id,supplier_name,invoice_number,date,subtotal,total,status,legacy_json) VALUES (?,?,?,?,?,?,?,?,?)`,
        [text(purchase.id), supplierIds.has(purchase.supplierId) ? purchase.supplierId : null, text(purchase.supplierName), text(purchase.invoiceNumber), dateOf(purchase.date), number(purchase.subtotal || purchase.total), number(purchase.total), text(purchase.status, 'registrada'), json(purchase)]);
      await run(db, 'DELETE FROM purchase_items WHERE purchase_id = ?', [text(purchase.id)]);
      for (const item of purchase.items || []) {
        await run(db, `INSERT INTO purchase_items (purchase_id,product_id,product_code,product_name,qty,unit_cost,unit_price,total) VALUES (?,?,?,?,?,?,?,?)`,
          [text(purchase.id), productIds.has(item.productId) ? item.productId : null, text(item.code), text(item.name), Math.max(1, number(item.qty, 1)), number(item.unitCost || item.costPrice), number(item.unitPrice || item.salePrice), number(item.total || item.qty * (item.unitCost || item.costPrice))]);
      }
    }
    for (const [key, value] of Object.entries(snapshot.settings || {})) await run(db, 'INSERT OR REPLACE INTO app_settings (key,value) VALUES (?,?)', [key, json(value)]);
    if (snapshot.inv_counter) await run(db, 'INSERT OR REPLACE INTO app_settings (key,value) VALUES (?,?)', ['invoice_counter', json(snapshot.inv_counter)]);
    await run(db, `INSERT OR REPLACE INTO migration_log (name,completed_at,rows_migrated) VALUES ('localStorage-v1',?,?)`, [new Date().toISOString(),
      (snapshot.products || []).length + (snapshot.sales || []).length + (snapshot.purchases || []).length]);
    await exec(db, 'COMMIT');
  } catch (error) {
    await exec(db, 'ROLLBACK');
    throw error;
  }
}

function createRepository(db) {
  return {
    migrateSnapshot: snapshot => migrateSnapshot(db, snapshot),
    count: table => get(db, `SELECT COUNT(*) AS count FROM ${table}`).then(row => row.count),
    listProducts: async ({ query = '', category = '', stock = '', page = 1, pageSize = 50, activeOnly = false } = {}) => {
      const safePage = Math.max(1, Number(page) || 1);
      const safeSize = Math.min(200, Math.max(1, Number(pageSize) || 50));
      const params = [];
      const where = [];
      if (activeOnly) where.push('p.active = 1');
      if (query.trim()) { where.push('(p.code LIKE ? OR p.name LIKE ? OR p.brand LIKE ?)'); params.push(`%${query.trim()}%`, `%${query.trim()}%`, `%${query.trim()}%`); }
      if (category) { where.push('p.category_name = ?'); params.push(category); }
      if (stock === 'disponible') where.push('p.active = 1 AND p.stock > p.min_stock');
      if (stock === 'bajo') where.push('p.active = 1 AND p.stock > 0 AND p.stock <= p.min_stock');
      if (stock === 'agotado') where.push('p.active = 1 AND p.stock <= 0');
      if (stock === 'inactivo') where.push('p.active = 0');
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const count = await get(db, `SELECT COUNT(*) AS count FROM products p ${clause}`, params);
      const items = await all(db, `SELECT p.id,p.code,p.name,p.category_name AS category,p.brand,p.unit,p.cost_price AS costPrice,p.sale_price AS salePrice,
        p.stock,p.min_stock AS minStock,p.active,p.description,p.supplier_name AS supplier,p.created_at AS createdAt
        FROM products p ${clause} ORDER BY p.name COLLATE NOCASE,p.id LIMIT ? OFFSET ?`, [...params, safeSize, (safePage - 1) * safeSize]);
      return { items, total: count.count, page: safePage, pageSize: safeSize, pages: Math.ceil(count.count / safeSize) };
    },
    productSummary: async () => get(db, `SELECT COUNT(*) AS total,
      COALESCE(SUM(stock * cost_price), 0) AS cost,
      COALESCE(SUM(stock * sale_price), 0) AS sale,
      COALESCE(SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END), 0) AS outStock,
      COALESCE(SUM(CASE WHEN stock > 0 AND stock <= min_stock THEN 1 ELSE 0 END), 0) AS lowStock
      FROM products WHERE active = 1`),
    health: async () => ({ database: 'sqlite', path: DB_PATH, products: await get(db, 'SELECT COUNT(*) AS count FROM products').then(row => row.count), sales: await get(db, 'SELECT COUNT(*) AS count FROM sales').then(row => row.count), purchases: await get(db, 'SELECT COUNT(*) AS count FROM purchases').then(row => row.count) })
  };
}

module.exports = { DB_PATH, makeDatabase, createRepository };
