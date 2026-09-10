PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON UPDATE CASCADE ON DELETE SET NULL,
  category_name TEXT,
  brand TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'unidad',
  description TEXT NOT NULL DEFAULT '',
  supplier_name TEXT NOT NULL DEFAULT '',
  cost_price NUMERIC NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sale_price NUMERIC NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  stock NUMERIC NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock NUMERIC NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  legacy_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id, active);
CREATE INDEX IF NOT EXISTS idx_products_stock_alert ON products(active, stock, min_stock);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  document TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  legacy_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  document TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  legacy_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS inventory_batches (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_number INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  change_type TEXT NOT NULL DEFAULT 'REGULAR',
  cost_price NUMERIC NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sale_price NUMERIC NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  initial_qty NUMERIC NOT NULL DEFAULT 0 CHECK (initial_qty >= 0),
  stock NUMERIC NOT NULL DEFAULT 0 CHECK (stock >= 0),
  date TEXT,
  supplier TEXT NOT NULL DEFAULT '',
  purchase_id TEXT,
  UNIQUE(product_id, batch_number)
);
CREATE INDEX IF NOT EXISTS idx_batches_fifo ON inventory_batches(product_id, date, id);
CREATE INDEX IF NOT EXISTS idx_batches_purchase ON inventory_batches(purchase_id);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL DEFAULT '',
  invoice_number TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  total NUMERIC NOT NULL DEFAULT 0 CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'registrada',
  legacy_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date, id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id, date);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_code TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  qty NUMERIC NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  unit_price NUMERIC NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total NUMERIC NOT NULL DEFAULT 0 CHECK (total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id, purchase_id);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  total NUMERIC NOT NULL DEFAULT 0 CHECK (total >= 0),
  total_paid NUMERIC NOT NULL DEFAULT 0 CHECK (total_paid >= 0),
  total_pending NUMERIC NOT NULL DEFAULT 0 CHECK (total_pending >= 0),
  status TEXT NOT NULL DEFAULT 'pagada',
  payment_method TEXT NOT NULL DEFAULT '',
  real_profit NUMERIC NOT NULL DEFAULT 0,
  legacy_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_sales_date_status ON sales(date, status, id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_date ON sales(customer_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_pending ON sales(status, total_pending) WHERE total_pending > 0;

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_code TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  qty NUMERIC NOT NULL CHECK (qty > 0),
  unit_price NUMERIC NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  cost_price NUMERIC NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  total NUMERIC NOT NULL DEFAULT 0 CHECK (total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id, id);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL UNIQUE REFERENCES sales(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'emitida',
  legacy_json TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_payments_sale_date ON payments(sale_id, date, id);

CREATE TABLE IF NOT EXISTS cash_movements (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  datetime TEXT,
  type TEXT NOT NULL CHECK (type IN ('ingreso', 'egreso')),
  concept TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  reference_type TEXT,
  reference_id TEXT,
  legacy_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_cash_date_type ON cash_movements(date, type, id);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  created_at TEXT,
  legacy_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_date_category ON expenses(date, category, id);

CREATE TABLE IF NOT EXISTS movements (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  datetime TEXT,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT '',
  qty NUMERIC NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT 'Sistema',
  value NUMERIC NOT NULL DEFAULT 0,
  legacy_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_movements_product_date ON movements(product_id, date, id);
CREATE INDEX IF NOT EXISTS idx_movements_date_type ON movements(date, type, id);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS migration_log (
  name TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL,
  rows_migrated INTEGER NOT NULL DEFAULT 0
);
