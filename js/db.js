/* =============================================
   FERRETERÍA EL BULE — Data Layer (db.js)
   Persistencia en localStorage con Caché en Memoria e Índices Rápidos
   Garantiza 100% retrocompatibilidad y conservación de datos
   ============================================= */

const DEFAULT_SETTINGS = {
  companyName: 'FERRO PINTURAS EL BULE',
  nit: '900.123.456-7',
  address: 'Calle 12#12A31',
  phone: '3012189225',
  email: 'contacto@ferreteriaelbule.com',
  logo: null,
  currency: '$',
  taxRate: 0,
  taxEnabled: false,
  invoicePrefix: 'FAC',
  invoiceNotes: 'Gracias por su compra en FERRO PINTURAS EL BULE.\nConserve su factura para cualquier reclamo o garantía.',
};

const DB = (() => {
  const KEYS = ['products','categories','sales','purchases','customers','suppliers','cash_movements','expenses','movements'];
  const _cache = {};
  const _indexes = {};
  let _syncTimer = null;
  let _syncing = false;

  function _scheduleRemoteSync() {
    if (_syncing) return;
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
      try {
        await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(DB.exportAll())
        });
      } catch (error) {
        console.warn('No se pudo sincronizar con el servidor:', error.message);
      }
    }, 250);
  }

  function _get(key) {
    if (_cache[key] !== undefined) return _cache[key];
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      _cache[key] = parsed;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function _set(key, val) {
    _cache[key] = val;
    delete _indexes[key];
    if (key === 'fb_products') {
      delete _indexes.fb_products_by_code;
      delete _indexes.fb_products_search;
    }
    try {
      localStorage.setItem(key, JSON.stringify(val));
      _scheduleRemoteSync();
    } catch (e) {
      console.error('localStorage write error', e);
    }
  }

  function _getIdIndex(col) {
    const key = `fb_${col}`;
    if (_indexes[key]) return _indexes[key];
    _get(key);
    const index = new Map();
    (_cache[key] || []).forEach(item => {
      if (item && item.id) index.set(item.id, item);
    });
    _indexes[key] = index;
    return index;
  }

  function _getCodeIndex() {
    const key = 'fb_products_by_code';
    if (_indexes[key]) return _indexes[key];
    _get('fb_products');
    const index = new Map();
    (_cache.fb_products || []).forEach(product => {
      const code = String(product.code || '').trim().toLowerCase();
      if (!code) return;
      if (!index.has(code)) index.set(code, []);
      index.get(code).push(product);
    });
    _indexes[key] = index;
    return index;
  }

  function _getProductSearchIndex() {
    const key = 'fb_products_search';
    if (_indexes[key]) return _indexes[key];
    _get('fb_products');
    const index = new Map();
    (_cache.fb_products || []).forEach(product => {
      index.set(product.id, [product.name, product.code, product.brand, product.category]
        .filter(Boolean).join(' ').toLowerCase());
    });
    _indexes[key] = index;
    return index;
  }

  function normalizeSalePaymentState(sale) {
    if (!sale || !sale.total || !Number.isFinite(Number(sale.total))) return sale;

    const total = Number(sale.total) || 0;
    const paid = Number(sale.totalPaid != null ? sale.totalPaid : (sale.status === 'pendiente' ? 0 : total));
    const pending = Number(sale.totalPending != null ? sale.totalPending : Math.max(0, total - paid));
    const normalizedPaid = Math.max(0, Math.min(total, paid));
    const normalizedPending = Math.max(0, total - normalizedPaid);

    if (['anulada', 'pagada_no_retirada', 'retirada'].includes(sale.status)) {
      return { ...sale, totalPaid: normalizedPaid, totalPending: normalizedPending };
    }

    const nextSale = { ...sale, totalPaid: normalizedPaid, totalPending: normalizedPending };

    if (normalizedPending <= 0.01) {
      nextSale.status = 'pagada';
      nextSale.paidAt = nextSale.paidAt || new Date().toISOString();
      nextSale.stockDeducted = nextSale.stockDeducted !== false;
      nextSale.totalPending = 0;
      return nextSale;
    }

    if (normalizedPaid > 0.01) {
      nextSale.status = 'con_abono';
      return nextSale;
    }

    nextSale.status = 'pendiente';
    nextSale.totalPending = total;
    return nextSale;
  }

  return {
    // ---- Generic CRUD ----
    getAll(col) { return _get(`fb_${col}`) || []; },

    normalizeSalePaymentState,

    searchProducts(query = '', activeOnly = false) {
      const products = this.getAll('products');
      const normalizedQuery = String(query).trim().toLowerCase();
      const searchIndex = normalizedQuery ? _getProductSearchIndex() : null;
      return products.filter(product =>
        (!activeOnly || product.active !== false) &&
        (!searchIndex || (searchIndex.get(product.id) || '').includes(normalizedQuery))
      );
    },

    async listProducts(options = {}) {
      const params = new URLSearchParams();
      if (options.query) params.set('q', options.query);
      if (options.category) params.set('category', options.category);
      if (options.stock) params.set('stock', options.stock);
      if (options.page) params.set('page', options.page);
      if (options.pageSize) params.set('pageSize', options.pageSize);
      if (options.activeOnly) params.set('activeOnly', 'true');
      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) throw new Error(`Consulta de productos falló (${response.status})`);
      const result = await response.json();
      if (result.items?.length || !this.getAll('products').length) return result;

      const query = String(options.query || '').trim().toLowerCase();
      const products = this.getAll('products').filter(product => {
        const matchesQuery = !query || [product.code, product.name, product.brand, product.category]
          .filter(Boolean).join(' ').toLowerCase().includes(query);
        const matchesCategory = !options.category || product.category === options.category;
        const stock = Number(product.stock) || 0;
        const minStock = Number(product.minStock) || 3;
        const matchesStock = !options.stock ||
          (options.stock === 'disponible' && product.active !== false && stock > minStock) ||
          (options.stock === 'bajo' && product.active !== false && stock > 0 && stock <= minStock) ||
          (options.stock === 'agotado' && product.active !== false && stock <= 0) ||
          (options.stock === 'inactivo' && product.active === false);
        return matchesQuery && matchesCategory && matchesStock && (!options.activeOnly || product.active !== false);
      });
      const page = Math.max(1, Number(options.page) || 1);
      const pageSize = Math.max(1, Number(options.pageSize) || 50);
      return {
        items: products.slice((page - 1) * pageSize, page * pageSize),
        total: products.length,
        page,
        pageSize,
        pages: Math.max(1, Math.ceil(products.length / pageSize))
      };
    },

    async productSummary() {
      const response = await fetch('/api/products/summary');
      if (!response.ok) throw new Error(`Resumen de productos falló (${response.status})`);
      const result = await response.json();
      const products = this.getAll('products');
      if (Number(result.total) || !products.length) return result;
      return {
        total: products.length,
        cost: products.reduce((sum, product) => sum + (Number(product.costPrice) || 0) * (Number(product.stock) || 0), 0),
        sale: products.reduce((sum, product) => sum + (Number(product.salePrice) || 0) * (Number(product.stock) || 0), 0),
        outStock: products.filter(product => Number(product.stock) <= 0).length,
        lowStock: products.filter(product => Number(product.stock) > 0 && Number(product.stock) <= (Number(product.minStock) || 3)).length
      };
    },

    save(col, items) {
      _set(`fb_${col}`, items);
    },

    add(col, item, allowDuplicate = false) {
      // Duplicate Code Validation for Products
      if (col === 'products' && item.code && !allowDuplicate && !item._allowDuplicateCode) {
        if (this.isCodeDuplicate(item.code)) {
          throw new Error(`El código de producto "${item.code}" ya existe.`);
        }
      }

      if (item._allowDuplicateCode) delete item._allowDuplicateCode;
      const arr = this.getAll(col);
      arr.push(item);
      this.save(col, arr);
      return item;
    },

    update(col, id, patch, allowDuplicate = false) {
      const arr = this.getAll(col);
      const i = arr.findIndex(x => x.id === id);
      if (i !== -1) {
        // Duplicate Code Validation for Products
        if (col === 'products' && patch.code && !allowDuplicate && !patch._allowDuplicateCode) {
          const existing = arr[i];
          const isChangingCode = !existing.code || existing.code.trim().toLowerCase() !== patch.code.trim().toLowerCase();
          if (isChangingCode && this.isCodeDuplicate(patch.code, id)) {
            throw new Error(`El código de producto "${patch.code}" ya existe en otro producto.`);
          }
        }
        if (patch._allowDuplicateCode) delete patch._allowDuplicateCode;
        arr[i] = Object.assign({}, arr[i], patch);
        if (col === 'sales') arr[i] = this.normalizeSalePaymentState(arr[i]);
        this.save(col, arr);
        return arr[i];
      }
      return null;
    },

    delete(col, id) {
      this.save(col, this.getAll(col).filter(x => x.id !== id));
    },

    findById(col, id) {
      return _getIdIndex(col).get(id) || null;
    },

    // ---- Duplicate Code Verification ----
    isCodeDuplicate(code, excludeId = null) {
      if (!code) return false;
      const cleanCode = String(code).trim().toLowerCase();
      if (!cleanCode) return false;
      return (_getCodeIndex().get(cleanCode) || []).some(p => p.id !== excludeId);
    },

    // ---- Settings ----
    getSettings() {
      let s = _get('fb_settings');
      if (!s) {
        s = Object.assign({}, DEFAULT_SETTINGS);
        _set('fb_settings', s);
      } else {
        let settingsChanged = false;
        if (!s.currency || s.currency === 'Q' || s.currency === 'Q ') {
          s.currency = '$';
          settingsChanged = true;
        }
        if (!s.companyName) {
          s.companyName = DEFAULT_SETTINGS.companyName;
          settingsChanged = true;
        }
        const oldAddress = 'Calle Principal #10-20, Centro';
        const oldPhone = '(601) 555-0199 / 310 555 0100';
        const oldInvoiceNotes = 'Gracias por su compra en FERRETERÍA EL BULE.\nConserve su factura para cualquier reclamo o garantía.';
        if (s.companyName === 'FERRETERÍA EL BULE') { s.companyName = DEFAULT_SETTINGS.companyName; settingsChanged = true; }
        if (s.address === oldAddress) { s.address = DEFAULT_SETTINGS.address; settingsChanged = true; }
        if (s.phone === oldPhone) { s.phone = DEFAULT_SETTINGS.phone; settingsChanged = true; }
        if (s.invoiceNotes === oldInvoiceNotes) { s.invoiceNotes = DEFAULT_SETTINGS.invoiceNotes; settingsChanged = true; }
        if (settingsChanged) _set('fb_settings', s);
      }
      return s;
    },
    saveSettings(s) { _set('fb_settings', s); },

    // ---- Invoice counter ----
    getInvoiceCounter() { return _get('fb_inv_counter') || 1; },
    nextInvoiceNumber() {
      const n = this.getInvoiceCounter();
      _set('fb_inv_counter', n + 1);
      return n;
    },

    // ---- Caja: saldo actual ----
    getCashBalance() {
      const movs = this.getAll('cash_movements');
      return movs.reduce((acc, m) => acc + (m.type === 'ingreso' ? m.amount : -m.amount), 0);
    },

    // ---- Audit Stock Movement Log ----
    logMovement({ productId, productName, qty, type, reason, user = 'Sistema', value = 0 }) {
      const movement = {
        id: `mov_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        date: new Date().toISOString().split('T')[0],
        datetime: new Date().toISOString(),
        productId,
        productName: productName || 'Producto N/A',
        qty: parseInt(qty) || 0,
        type,
        reason: reason || 'Movimiento de inventario',
        user,
        value: parseFloat(value) || 0
      };
      this.add('movements', movement);
    },

    // ---- Inventory Batches (Lotes de Inventario) ----
    addPurchaseBatch(productId, batchData) {
      const p = this.findById('products', productId);
      if (!p) return null;

      if (!p.batches || !Array.isArray(p.batches)) {
        p.batches = [];
      }

      // If no batches yet, initialize existing stock as Batch 1
      if (p.batches.length === 0 && (p.stock > 0 || p.costPrice > 0)) {
        p.batches.push({
          id: `batch_init_${p.id}`,
          batchNumber: 1,
          label: `${p.name} — ${p.code || 'S/C'} — INICIAL`,
          changeType: 'INICIAL',
          costPrice: p.costPrice || 0,
          salePrice: p.salePrice || 0,
          initialQty: p.stock || 0,
          stock: p.stock || 0,
          date: p.createdAt || Utils.today(),
          supplier: p.supplier || 'Inicial'
        });
      }

      const nextBatchNum = p.batches.length + 1;
      const changeType = batchData.changeType || 'REGULAR';
      const label = batchData.label || `${p.name} — ${p.code || 'S/C'} — ${changeType}`;
      const qty = parseInt(batchData.qty) || 0;
      const unitCost = parseFloat(batchData.unitCost) || 0;
      const salePrice = parseFloat(batchData.salePrice) || p.salePrice || 0;

      const existingBatch = p.batches.find(batch => (batch.costPrice || 0) === unitCost);
      if (existingBatch) {
        existingBatch.stock = (existingBatch.stock || 0) + qty;
        existingBatch.initialQty = (existingBatch.initialQty || 0) + qty;
        existingBatch.salePrice = salePrice || existingBatch.salePrice;
        p.stock = p.batches.reduce((sum, b) => sum + (b.stock || 0), 0);
        this.update('products', p.id, { batches: p.batches, stock: p.stock, salePrice });
        return existingBatch;
      }

      const newBatch = {
        id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        batchNumber: nextBatchNum,
        label,
        changeType,
        costPrice: unitCost,
        salePrice,
        initialQty: qty,
        stock: qty,
        date: batchData.date || Utils.today(),
        supplier: batchData.supplier || '',
        purchaseId: batchData.purchaseId || null
      };

      p.batches.push(newBatch);
      // Total stock is sum of all batch stocks
      p.stock = p.batches.reduce((sum, b) => sum + (b.stock || 0), 0);
      p.costPrice = unitCost; // Reference cost of newest batch

      this.update('products', p.id, { batches: p.batches, stock: p.stock, costPrice: p.costPrice, salePrice });
      return newBatch;
    },

    deductStock(productId, qty) {
      const p = this.findById('products', productId);
      if (!p) return 0;
      let remaining = Math.max(0, parseInt(qty) || 0);
      let totalCostOfSold = 0;

      if (p.batches && p.batches.length > 0) {
        // FIFO: Deduct from oldest batch with stock
        for (const batch of p.batches) {
          if (remaining <= 0) break;
          if (batch.stock > 0) {
            const take = Math.min(batch.stock, remaining);
            batch.stock -= take;
            remaining -= take;
            totalCostOfSold += take * (batch.costPrice || 0);
          }
        }
        p.stock = Math.max(0, p.batches.reduce((sum, b) => sum + (b.stock || 0), 0));
      } else {
        p.stock = Math.max(0, (p.stock || 0) - qty);
        totalCostOfSold = qty * (p.costPrice || 0);
      }

      this.update('products', p.id, { batches: p.batches, stock: p.stock });
      return totalCostOfSold;
    },

    restoreStock(productId, qty) {
      const p = this.findById('products', productId);
      if (!p) return;
      const toRestore = Math.max(0, parseInt(qty) || 0);
      if (p.batches && p.batches.length > 0) {
        // Restore to the latest active batch
        p.batches[p.batches.length - 1].stock = (p.batches[p.batches.length - 1].stock || 0) + toRestore;
        p.stock = p.batches.reduce((sum, b) => sum + (b.stock || 0), 0);
      } else {
        p.stock = (p.stock || 0) + toRestore;
      }
      this.update('products', p.id, { batches: p.batches, stock: p.stock });
    },

    // ---- Backup / Restore ----
    exportAll() {
      const d = { _version: 2, _date: new Date().toISOString() };
      KEYS.forEach(k => d[k] = this.getAll(k));
      d.settings = this.getSettings();
      d.inv_counter = this.getInvoiceCounter();
      return d;
    },

    importAll(d) {
      KEYS.forEach(k => { if (d[k]) this.save(k, d[k]); });
      if (d.settings) _set('fb_settings', d.settings);
      if (d.inv_counter) _set('fb_inv_counter', d.inv_counter);
    },

    // ---- Seed & Migrate Existing Data ----
    async seed() {
      // El servidor es la fuente compartida; localStorage queda como respaldo offline.
      try {
        const remoteResponse = await fetch('/api/state', { cache: 'no-store' });
        if (remoteResponse.ok) {
          const remoteState = await remoteResponse.json();
          _syncing = true;
          this.importAll(remoteState);
          _syncing = false;
          return;
        }
      } catch (error) {
        console.warn('Servidor no disponible; se conserva la copia local:', error.message);
      }

      const currentProducts = this.getAll('products');
      // El catálogo inicial es grande; solo cargarlo cuando el navegador todavía no tiene productos.
      if (currentProducts.length === 0) {
        try {
          const response = await fetch('data/products.json', { cache: 'no-store' });
          if (response.ok) {
            const seedProducts = await response.json();
            const currentIds = new Set(currentProducts.map(product => product.id));
            const missingProducts = seedProducts.filter(product => !currentIds.has(product.id));
            if (missingProducts.length) this.save('products', currentProducts.concat(missingProducts));
          }
        } catch (error) {
          console.warn('No se pudo cargar el inventario inicial:', error.message);
        }
      }

      if (!this.getAll('categories').length) {
        const categories = ['Herramientas', 'Eléctrico', 'Plomería', 'Pintura', 'Construcción',
         'Ferretería General', 'Seguridad', 'Adhesivos', 'Jardinería', 'Tornillería', 'Otros']
          .map((name, i) => ({ id: `cat_${i + 1}`, name }));
        this.save('categories', categories);
      }

      // Migrate products
      const products = this.getAll('products');
      let prodUpdated = false;
      products.forEach(p => {
        if (p.brand === undefined) { p.brand = ''; prodUpdated = true; }
        if (p.active === undefined) { p.active = true; prodUpdated = true; }
      });
      if (prodUpdated) this.save('products', products);

      // Migrate sales
      const sales = this.getAll('sales');
      let salesUpdated = false;
      sales.forEach(s => {
        if (!s.status) { s.status = 'pagada'; salesUpdated = true; }
        if (s.realProfit === undefined) {
          const costTotal = (s.items || []).reduce((acc, it) => acc + ((it.qty || 1) * (it.costPrice || 0)), 0);
          s.realProfit = Math.max(0, (s.total || 0) - costTotal);
          salesUpdated = true;
        }

        const normalized = this.normalizeSalePaymentState(s);
        if (normalized.status !== s.status || normalized.totalPaid !== s.totalPaid || normalized.totalPending !== s.totalPending) {
          Object.assign(s, normalized);
          salesUpdated = true;
        }
      });
      if (salesUpdated) this.save('sales', sales);

      try {
        const response = await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.exportAll())
        });
        if (!response.ok) throw new Error(`Sincronización inicial falló (${response.status})`);
      } catch (error) {
        console.warn('No se pudo guardar la copia compartida:', error.message);
      }
    }
  };
})();
