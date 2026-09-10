/* =============================================
   FERRETERÍA EL BULE — Módulo Compras (purchases.js)
   Registro de compras a proveedores en $ COP.
  Cada compra de un producto existente se registra como un nuevo lote,
  conservando el historial de costos con el mismo código.
   ============================================= */

window.Modules = window.Modules || {};
window.Modules.purchases = {
  _items: [],

  render() {
    const purchases = DB.getAll('purchases');
    const suppliers = DB.getAll('suppliers');
    const today = Utils.today();
    const month = today.slice(0, 7);
    const monthPurchases = purchases.filter(p => p.date && p.date.startsWith(month));
    const monthTotal = monthPurchases.reduce((a, p) => a + p.total, 0);

    const suppOptions = suppliers.map(s => `<option value="${Utils.escHtml(s.name)}">${Utils.escHtml(s.name)}</option>`).join('');

    return `
    <div class="grid-3 mb-24">
      <div class="stat-card"><div class="stat-icon blue">📦</div><div class="stat-info"><div class="stat-label">Compras del Mes</div><div class="stat-value">${monthPurchases.length}</div></div></div>
      <div class="stat-card"><div class="stat-icon yellow">💵</div><div class="stat-info"><div class="stat-label">Monto Compras Mes</div><div class="stat-value accent">${Utils.formatCurrency(monthTotal)}</div></div></div>
      <div class="stat-card"><div class="stat-icon green">🤝</div><div class="stat-info"><div class="stat-label">Proveedores Activos</div><div class="stat-value success">${suppliers.length}</div></div></div>
    </div>

    <div class="grid-2">
      <!-- Formulario Nueva Compra -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📦 Nueva Compra a Proveedor</span>
          <button class="btn btn-sm btn-secondary" id="btn-manage-suppliers">🤝 Gestionar Proveedores</button>
        </div>
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Proveedor *</label>
              <input class="form-control" id="purch-supplier" list="supp-list" placeholder="Nombre del proveedor">
              <datalist id="supp-list">${suppOptions}</datalist>
            </div>
            <div class="form-group">
              <label class="form-label">Fecha de Compra</label>
              <input class="form-control" type="date" id="purch-date" value="${today}">
            </div>
          </div>

          <div style="background:rgba(37,99,235,0.08);border:1px solid var(--accent);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;display:flex;align-items:center;gap:10px">
            <span style="font-size:18px">⚖️</span>
            <div><strong>Control de lotes activo:</strong> cada compra conserva su costo y cantidad como un lote independiente. Si el costo cambia, se marcará como <em>AUMENTO</em> o <em>BAJO</em>.</div>
          </div>

          <div class="section-title mt-16">Productos Comprados</div>
          <table class="items-table" style="width:100%">
            <thead>
              <tr>
                <th style="min-width:260px">Producto en Inventario</th>
                <th style="width:80px">Cant.</th>
                <th style="width:140px">Costo Unit. ($ COP)</th>
                <th style="width:120px">Subtotal</th>
                <th style="width:40px"></th>
              </tr>
            </thead>
            <tbody id="purch-items-tbody"></tbody>
          </table>

          <button class="btn btn-sm btn-secondary mt-8" id="btn-add-purch-item">+ Agregar Fila de Producto</button>

          <div class="form-group mt-16">
            <label class="form-label">Notas u Observaciones</label>
            <input class="form-control" id="purch-notes" placeholder="Ej: Factura Proveedor #1234, Pago de contado">
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
            <span style="font-size:20px;font-weight:900;color:var(--accent)" id="purch-total">Total: ${Utils.formatCurrency(0)}</span>
            <button class="btn btn-primary btn-lg" id="btn-confirm-purchase">✅ Confirmar Compra y Aumentar Stock</button>
          </div>
        </div>
      </div>

      <!-- Historial de Compras -->
      <div class="card">
        <div class="card-header"><span class="card-title">📋 Historial de Compras</span></div>
        <div class="card-body" style="padding:0">
          <div class="table-wrapper">
            <table class="table">
              <thead><tr><th>Fecha</th><th>Proveedor</th><th>Items</th><th>Total Compra</th><th>Detalle</th></tr></thead>
              <tbody id="purch-history-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Proveedores -->
    <div class="modal" id="supplierModal" style="display:none">
      <div class="modal-content modal-lg">
        <div class="modal-header"><h3>Gestionar Proveedores</h3><button class="modal-close" onclick="Utils.closeModal('supplierModal')">✕</button></div>
        <div class="modal-body">
          <div class="form-row mb-16">
            <div class="form-group"><label class="form-label">Nombre del Proveedor *</label><input class="form-control" id="supp-name" placeholder="Ej: Distribuidora Belén S.A.S."></div>
            <div class="form-group"><label class="form-label">NIT / Documento</label><input class="form-control" id="supp-nit" placeholder="800.123.456-1"></div>
          </div>
          <div class="form-row mb-16">
            <div class="form-group"><label class="form-label">Contacto</label><input class="form-control" id="supp-contact" placeholder="Ej: Juan Pérez"></div>
            <div class="form-group"><label class="form-label">Teléfono</label><input class="form-control" id="supp-phone" placeholder="310 000 0000"></div>
          </div>
          <div class="form-row mb-16">
            <div class="form-group"><label class="form-label">Correo</label><input class="form-control" id="supp-email" placeholder="ventas@proveedor.com"></div>
            <div class="form-group"><label class="form-label">Dirección</label><input class="form-control" id="supp-address" placeholder="Calle 20 #15-30"></div>
          </div>
          <button class="btn btn-primary btn-sm mb-16" id="btn-save-supplier">+ Guardar Proveedor</button>

          <div class="table-wrapper">
            <table class="table">
              <thead><tr><th>Nombre</th><th>NIT</th><th>Contacto</th><th>Teléfono</th><th>Acciones</th></tr></thead>
              <tbody id="supp-list-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Detalle Compra -->
    <div class="modal" id="purchDetailModal" style="display:none">
      <div class="modal-content modal-lg">
        <div class="modal-header"><h3>Detalle de la Compra</h3><button class="modal-close" onclick="Utils.closeModal('purchDetailModal')">✕</button></div>
        <div class="modal-body" id="purch-detail-body"></div>
      </div>
    </div>

    <!-- Modal Resumen de Productos Creados por Aumento -->
    <div class="modal" id="purchIncreaseResultModal" style="display:none">
      <div class="modal-content modal-lg">
        <div class="modal-header" style="background:#ecfdf5">
          <h3 style="color:#065f46">✅ Compra Registrada — Nuevos Productos Creados</h3>
          <button class="modal-close" onclick="Utils.closeModal('purchIncreaseResultModal')">✕</button>
        </div>
        <div class="modal-body" id="purch-increase-result-body"></div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="Utils.closeModal('purchIncreaseResultModal')">Entendido</button>
        </div>
      </div>
    </div>`;
  },

  init() {
    this._items = [];
    this._renderPurchItems();
    this._renderHistory();
    this._syncProductsFromApi();

    document.getElementById('btn-add-purch-item')?.addEventListener('click', () => {
      this._items.push({
        productId: '',
        name: '',
        originalName: '',
        code: '',
        qty: 1,
        unitCost: 0,
        currentCost: 0,
        currentSalePrice: 0,
        subtotal: 0,
        isPriceIncrease: false,
        increaseType: 'aumento',
        customName: '',
        newSalePrice: 0,
        searchTerm: '',
        searchResults: []
      });
      this._renderPurchItems();
    });

    document.getElementById('btn-confirm-purchase')?.addEventListener('click', () => this._confirmPurchase());
    document.getElementById('btn-manage-suppliers')?.addEventListener('click', () => {
      this._renderSuppliers();
      Utils.openModal('supplierModal');
    });
    document.getElementById('btn-save-supplier')?.addEventListener('click', () => this._saveSupplier());
  },

  async _syncProductsFromApi() {
    try {
      const response = await fetch('/api/products?page=1&pageSize=100');
      if (!response.ok) return;
      const payload = await response.json();
      const localProducts = DB.getAll('products');
      const byCode = new Map(localProducts.map(product => [String(product.code || '').trim().toLowerCase(), product]));
      const syncedProducts = [...localProducts];

      (payload.items || []).forEach(remoteProduct => {
        const code = String(remoteProduct.code || '').trim();
        if (!code) return;
        const existing = byCode.get(code.toLowerCase());
        const product = {
          ...(existing || {}),
          id: existing?.id || String(remoteProduct.id),
          code,
          name: remoteProduct.name || existing?.name || code,
          costPrice: Number(remoteProduct.costPrice ?? existing?.costPrice) || 0,
          salePrice: Number(remoteProduct.salePrice ?? existing?.salePrice) || 0,
          stock: Number(remoteProduct.stock) || 0,
          minStock: Number(remoteProduct.minStock ?? existing?.minStock) || 3,
          active: remoteProduct.active !== false
        };
        if (existing) {
          const index = syncedProducts.findIndex(item => item.id === existing.id);
          if (index !== -1) syncedProducts[index] = product;
        } else {
          syncedProducts.push(product);
        }
      });

      DB.save('products', syncedProducts);
      this._renderPurchItems();
    } catch (error) {
      console.warn('No se pudieron sincronizar productos para Compras:', error.message);
    }
  },

  _resolveNewProductName(originalName, type, customName) {
    if (type === 'custom' && customName && customName.trim()) {
      return customName.trim();
    }

    const allProducts = DB.getAll('products');

    if (type === 'numero') {
      // Find next number: e.g. "Nombre 2", "Nombre 3"
      let num = 2;
      while (allProducts.some(p => p.name.trim().toLowerCase() === `${originalName.trim().toLowerCase()} ${num}`)) {
        num++;
      }
      return `${originalName} ${num}`;
    }

    // Default 'aumento':
    const baseAumento = `${originalName} (Aumento)`;
    if (!allProducts.some(p => p.name.trim().toLowerCase() === baseAumento.toLowerCase())) {
      return baseAumento;
    }

    // If "Nombre (Aumento)" already exists, roll over to "Nombre 2", "Nombre 3", etc.
    let num = 2;
    while (allProducts.some(p => p.name.trim().toLowerCase() === `${originalName.trim().toLowerCase()} ${num}`)) {
      num++;
    }
    return `${originalName} ${num}`;
  },

  _resolvePriceVariantName(originalName, changeType) {
    const suffix = changeType === 'AUMENTO' ? 'Aumento' : 'Bajo';
    const baseName = `${originalName} (${suffix})`;
    const products = DB.getAll('products');
    if (!products.some(p => p.name.trim().toLowerCase() === baseName.toLowerCase())) return baseName;

    let num = 2;
    while (products.some(p => p.name.trim().toLowerCase() === `${originalName.trim().toLowerCase()} (${suffix} ${num})`)) {
      num++;
    }
    return `${originalName} (${suffix} ${num})`;
  },

  _renderPurchItems() {
    const tbody = document.getElementById('purch-items-tbody');
    if (!tbody) return;

    if (this._items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Haz clic en "+ Agregar Fila de Producto" para ingresar artículos</td></tr>`;
      return;
    }

    let rowsHtml = '';
    this._items.forEach((item, i) => {
      const costChange = item.unitCost - (item.currentCost || 0);
      const changeType = costChange > 0 ? 'AUMENTO' : (costChange < 0 ? 'BAJO' : 'REGULAR');
      const isHigher = changeType === 'AUMENTO';
      const currentCost = item.currentCost || 0;
      const diff = item.unitCost - currentCost;
      const results = item.productId ? [] : (item.searchResults || this._searchProductsByQuery(item.searchTerm || ''));

      rowsHtml += `
      <tr style="${isHigher ? 'background:rgba(245,158,11,0.06);border-left:4px solid #f59e0b' : ''}">
        <td style="padding:10px 8px;vertical-align:top">
          ${item.productId ? `
            <div style="display:flex;flex-direction:column;gap:6px">
              <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${Utils.escHtml(item.code || 'S/C')} | ${Utils.escHtml(item.name)}</div>
              <div style="font-size:11px;color:var(--text-muted)">Stock: <strong>${DB.findById('products', item.productId)?.stock ?? 0}</strong> | Costo actual: <strong>${Utils.formatCurrency(currentCost)}</strong></div>
              <button class="btn btn-sm btn-secondary" type="button" onclick="Modules.purchases._clearSelectedProduct(${i})">Cambiar producto</button>
            </div>
          ` : `
            <div style="position:relative">
              <input
                type="text"
                class="form-control"
                placeholder="Buscar por código o nombre..."
                value="${Utils.escHtml(item.searchTerm || '')}"
                oninput="Modules.purchases._searchProductInput(${i}, this.value)"
                autocomplete="off"
                style="width:100%"
              >
              ${results.length ? `
                <div style="position:absolute;left:0;right:0;top:calc(100% + 4px);background:var(--bg);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 18px rgba(15,23,42,.12);z-index:10;max-height:220px;overflow:auto;padding:4px">
                  ${results.map(p => `
                    <button type="button" class="btn btn-sm btn-ghost" style="display:block;width:100%;text-align:left;padding:8px 10px;border-radius:6px;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onclick="Modules.purchases._selectProductFromSearch(${i}, '${p.id}')">
                      <strong>${Utils.escHtml(p.code || 'S/C')}</strong> | ${Utils.escHtml(p.name)} | Stock: ${p.stock}
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `}
        </td>
        <td style="padding:10px 8px;vertical-align:top">
          <input type="number" min="1" value="${item.qty}" onchange="Modules.purchases._itemChange(${i}, 'qty', this.value)" style="width:75px" class="form-control">
        </td>
        <td style="padding:10px 8px;vertical-align:top">
          <input type="number" step="100" min="0" value="${item.unitCost}" onchange="Modules.purchases._itemChange(${i}, 'unitCost', this.value)" style="width:130px;font-weight:700;${isHigher ? 'border-color:#f59e0b;background:#fffbeb;color:#b45309' : ''}" class="form-control">
          ${changeType !== 'REGULAR' ? `<div style="font-size:10.5px;color:${isHigher ? '#b45309' : '#047857'};font-weight:700;margin-top:2px">${isHigher ? '▲ +' : '▼ -'}${Utils.formatCurrency(Math.abs(diff))} · ${changeType}</div>` : ''}
        </td>
        <td class="text-accent font-bold" style="padding:10px 8px;vertical-align:top;font-size:14px">
          ${Utils.formatCurrency(item.subtotal)}
        </td>
        <td style="padding:10px 8px;vertical-align:top">
          <button class="btn btn-sm btn-danger" onclick="Modules.purchases._removeItem(${i})" title="Quitar fila">✕</button>
        </td>
      </tr>`;

      if (changeType !== 'REGULAR' && item.productId) {
        rowsHtml += `<tr><td colspan="5" style="padding:0 12px 10px;color:${isHigher ? '#92400e' : '#047857'};font-size:12px;font-weight:700">${isHigher ? '🔺 AUMENTO' : '🔻 BAJO'}: se conservará el producto anterior y se creará otro producto con el mismo código.</td></tr>`;
      }
    });

    tbody.innerHTML = rowsHtml;

    const total = this._items.reduce((a, it) => a + it.subtotal, 0);
    const totalEl = document.getElementById('purch-total');
    if (totalEl) totalEl.textContent = `Total: ${Utils.formatCurrency(total)}`;
  },

  _searchProductsByQuery(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];

    return DB.getAll('products')
      .filter(p => p.active !== false)
      .filter(p => {
        const haystack = `${p.code || ''} ${p.name || ''} ${p.brand || ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 10);
  },

  _searchProductInput(i, query) {
    const item = this._items[i];
    if (!item) return;
    item.searchTerm = query || '';
    item.searchResults = this._searchProductsByQuery(query);
    this._renderPurchItems();
  },

  _selectProductFromSearch(i, productId) {
    const p = DB.findById('products', productId);
    if (!p) return;

    const curCost = p.costPrice || 0;
    const curSale = p.salePrice || 0;
    this._items[i].productId = p.id;
    this._items[i].name = p.name;
    this._items[i].originalName = p.name;
    this._items[i].code = p.code || '';
    this._items[i].unitCost = curCost;
    this._items[i].currentCost = curCost;
    this._items[i].currentSalePrice = curSale;
    this._items[i].subtotal = this._items[i].qty * curCost;
    this._items[i].isPriceIncrease = false;
    this._items[i].increaseType = 'aumento';
    this._items[i].customName = '';
    this._items[i].newSalePrice = curSale;
    this._items[i].searchTerm = '';
    this._items[i].searchResults = [];
    this._renderPurchItems();
  },

  _clearSelectedProduct(i) {
    if (!this._items[i]) return;
    this._items[i].productId = '';
    this._items[i].name = '';
    this._items[i].originalName = '';
    this._items[i].code = '';
    this._items[i].unitCost = 0;
    this._items[i].currentCost = 0;
    this._items[i].currentSalePrice = 0;
    this._items[i].subtotal = 0;
    this._items[i].isPriceIncrease = false;
    this._items[i].searchTerm = '';
    this._items[i].searchResults = [];
    this._renderPurchItems();
  },

  _itemProductChange(i, productId) {
    const p = DB.findById('products', productId);
    if (p) {
      const curCost = p.costPrice || 0;
      const curSale = p.salePrice || 0;
      this._items[i].productId = p.id;
      this._items[i].name = p.name;
      this._items[i].originalName = p.name;
      this._items[i].code = p.code || '';
      this._items[i].unitCost = curCost;
      this._items[i].currentCost = curCost;
      this._items[i].currentSalePrice = curSale;
      this._items[i].subtotal = this._items[i].qty * curCost;
      this._items[i].isPriceIncrease = false;
      this._items[i].increaseType = 'aumento';
      this._items[i].customName = '';
      this._items[i].newSalePrice = curSale;
    } else {
      this._items[i].productId = '';
      this._items[i].name = '';
      this._items[i].originalName = '';
      this._items[i].code = '';
      this._items[i].unitCost = 0;
      this._items[i].currentCost = 0;
      this._items[i].currentSalePrice = 0;
      this._items[i].subtotal = 0;
      this._items[i].isPriceIncrease = false;
    }
    this._renderPurchItems();
  },

  _itemChange(i, field, val) {
    const item = this._items[i];
    if (!item) return;

    if (field === 'qty') {
      item.qty = Math.max(1, parseInt(val) || 1);
    } else if (field === 'unitCost') {
      const unitCost = Math.max(0, parseFloat(val) || 0);
      item.unitCost = unitCost;

      // Un cambio de costo siempre crea un lote; el costo igual se acumula en su lote.
      if (item.currentCost > 0 && unitCost !== item.currentCost) {
        item.isPriceIncrease = true;
        // Calcular precio de venta sugerido manteniendo el margen original
        if (item.currentSalePrice > item.currentCost) {
          const marginMultiplier = item.currentSalePrice / item.currentCost;
          item.newSalePrice = Math.round(unitCost * marginMultiplier);
        } else {
          item.newSalePrice = Math.round(unitCost * 1.3);
        }
        if (!item.increaseType) item.increaseType = 'aumento';
      } else {
        item.isPriceIncrease = false;
        item.newSalePrice = item.currentSalePrice;
      }
    }

    item.subtotal = item.qty * item.unitCost;
    this._renderPurchItems();
  },

  _setIncreaseType(i, type) {
    if (!this._items[i]) return;
    this._items[i].increaseType = type;
    this._renderPurchItems();
  },

  _setCustomName(i, name) {
    if (!this._items[i]) return;
    this._items[i].customName = name.trim();
    this._renderPurchItems();
  },

  _setNewSalePrice(i, price) {
    if (!this._items[i]) return;
    this._items[i].newSalePrice = Math.max(0, parseFloat(price) || 0);
    this._renderPurchItems();
  },

  _removeItem(i) {
    this._items.splice(i, 1);
    this._renderPurchItems();
  },

  _confirmPurchase() {
    const supplierName = document.getElementById('purch-supplier').value.trim() || 'Proveedor Directo';
    const date = document.getElementById('purch-date').value || Utils.today();
    const notes = document.getElementById('purch-notes').value.trim();

    const validItems = this._items.filter(it => it.productId && it.qty > 0);

    if (validItems.length === 0) {
      Utils.showToast('Agrega al menos un producto válido a la compra', 'error');
      return;
    }

    const total = validItems.reduce((a, it) => a + it.subtotal, 0);

    let createdNewProducts = 0;

    // Procesar cada producto según la regla
    validItems.forEach(it => {
      const p = DB.findById('products', it.productId);
      if (!p) return;

      const change = it.unitCost - (it.currentCost || p.costPrice || 0);
      const changeType = change > 0 ? 'AUMENTO' : (change < 0 ? 'BAJO' : 'REGULAR');
      if (changeType === 'REGULAR') {
        DB.addPurchaseBatch(p.id, {
          qty: it.qty,
          unitCost: it.unitCost,
          salePrice: p.salePrice,
          date,
          supplier: supplierName,
          changeType: 'REGULAR',
          label: `${p.name} — ${p.code || 'S/C'} — REGULAR`
        });
        it.finalProductId = p.id;
        it.finalName = p.name;
      } else {
        const variantName = this._resolvePriceVariantName(p.name, changeType);
        const variantId = Utils.generateId('prod');
        const variantSalePrice = it.newSalePrice || Math.round(it.unitCost * 1.3);
        DB.add('products', {
          id: variantId,
          code: p.code || '',
          name: variantName,
          brand: p.brand || '',
          category: p.category || '',
          unit: p.unit || 'unidad',
          costPrice: it.unitCost,
          salePrice: variantSalePrice,
          stock: it.qty,
          minStock: p.minStock || 3,
          supplier: supplierName,
          description: p.description || '',
          active: true,
          parentProductId: p.id,
          createdAt: date,
          batches: [{
            id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            batchNumber: 1,
            label: `${variantName} — ${p.code || 'S/C'} — ${changeType}`,
            changeType,
            costPrice: it.unitCost,
            salePrice: variantSalePrice,
            initialQty: it.qty,
            stock: it.qty,
            date,
            supplier: supplierName
          }]
        }, true);
        it.finalProductId = variantId;
        it.finalName = variantName;
        createdNewProducts++;
      }
      DB.logMovement({
        productId: it.finalProductId,
        productName: it.finalName,
        qty: it.qty,
        type: changeType === 'REGULAR' ? 'Compra' : `Compra — ${changeType}`,
        reason: `Compra a ${supplierName}`,
        value: it.subtotal
      });
    });

    const purchase = {
      id: Utils.generateId('purch'),
      date,
      supplierName,
      items: validItems.map(it => ({
        productId: it.finalProductId || it.productId,
        name: it.finalName || it.name,
        originalName: it.originalName || it.name,
        qty: it.qty,
        unitCost: it.unitCost,
        subtotal: it.subtotal,
        code: it.code,
        isPriceIncrease: it.unitCost > it.currentCost,
        changeType: it.unitCost > it.currentCost ? 'AUMENTO' : (it.unitCost < it.currentCost ? 'BAJO' : 'REGULAR')
      })),
      total,
      notes,
      createdAt: Utils.nowISO()
    };

    DB.add('purchases', purchase);

    // CASH MOVEMENT (EGRESO)
    DB.add('cash_movements', {
      id: Utils.generateId('cash'),
      date,
      datetime: Utils.nowISO(),
      type: 'egreso',
      concept: `Compra de mercancía a ${supplierName}`,
      amount: total,
      reference: purchase.id
    });

    this._items = [];

    Utils.showToast(createdNewProducts > 0
      ? `Compra registrada. Se creó ${createdNewProducts} producto(s) con el mismo código.`
      : 'Compra registrada correctamente. Se aumentó la cantidad del producto.', 'success');

    const content = document.getElementById('content');
    if (content) { content.innerHTML = this.render(); this.init(); }
  },

  _renderHistory() {
    const tbody = document.getElementById('purch-history-tbody');
    if (!tbody) return;
    const purchases = DB.getAll('purchases').slice().reverse();

    if (purchases.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">${Utils.emptyState('Sin compras registradas', '📦')}</td></tr>`;
      return;
    }

    tbody.innerHTML = purchases.slice(0, 15).map(p => `
      <tr>
        <td>${Utils.formatDate(p.date)}</td>
        <td><strong>${Utils.escHtml(p.supplierName)}</strong></td>
        <td>Productos: ${(p.items||[]).length}<br><small>Unidades ingresadas: ${(p.items||[]).reduce((sum, it) => sum + (it.qty || 0), 0)}</small></td>
        <td class="text-accent font-bold">${Utils.formatCurrency(p.total)}</td>
        <td><button class="btn btn-sm btn-secondary" onclick="Modules.purchases._viewDetail('${p.id}')">👁️ Ver</button></td>
      </tr>
    `).join('');
  },

  _viewDetail(id) {
    const p = DB.findById('purchases', id);
    if (!p) return;

    let html = `
    <div class="grid-2 mb-16">
      <div>
        <p><strong>Proveedor:</strong> ${Utils.escHtml(p.supplierName)}</p>
        <p><strong>Fecha de Compra:</strong> ${Utils.formatDate(p.date)}</p>
      </div>
      <div>
        ${p.notes ? `<p><strong>Notas:</strong> ${Utils.escHtml(p.notes)}</p>` : ''}
      </div>
    </div>
    <div class="section-title">Mercancía Ingresada al Inventario</div>
    <table class="table mb-16">
      <thead><tr><th>Producto</th><th>Código</th><th>Cantidad</th><th>Costo Unit.</th><th>Subtotal</th><th>Detalle</th></tr></thead>
      <tbody>
        ${(p.items||[]).map(it => `
          <tr>
            <td>
              <strong>${Utils.escHtml(it.name)}</strong>
            </td>
            <td>${Utils.escHtml(it.code || '-')}</td>
            <td class="text-success font-bold">+${it.qty}</td>
            <td>${Utils.formatCurrency(it.unitCost)}</td>
            <td class="text-accent font-bold">${Utils.formatCurrency(it.subtotal)}</td>
            <td><small>${it.changeType === 'AUMENTO' ? '🔺 AUMENTO' : (it.changeType === 'BAJO' ? '🔻 BAJO' : 'Lote con costo igual')}</small></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="text-align:right;font-size:20px;font-weight:900;color:var(--accent)">
      Total Compra: ${Utils.formatCurrency(p.total)}
    </div>`;

    document.getElementById('purch-detail-body').innerHTML = html;
    Utils.openModal('purchDetailModal');
  },

  _renderSuppliers() {
    const tbody = document.getElementById('supp-list-tbody');
    if (!tbody) return;
    const suppliers = DB.getAll('suppliers');

    if (suppliers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted)">Sin proveedores registrados</td></tr>`;
      return;
    }

    tbody.innerHTML = suppliers.map(s => `
      <tr>
        <td><strong>${Utils.escHtml(s.name)}</strong></td>
        <td>${Utils.escHtml(s.nit||'-')}</td>
        <td>${Utils.escHtml(s.contact||'-')}</td>
        <td>${Utils.escHtml(s.phone||'-')}</td>
        <td><button class="btn btn-sm btn-danger" onclick="Modules.purchases._delSupplier('${s.id}')">🗑️</button></td>
      </tr>
    `).join('');
  },

  _saveSupplier() {
    const name = document.getElementById('supp-name').value.trim();
    if (!name) { Utils.showToast('El nombre del proveedor es obligatorio', 'error'); return; }

    DB.add('suppliers', {
      id: Utils.generateId('supp'),
      name,
      nit: document.getElementById('supp-nit').value.trim(),
      contact: document.getElementById('supp-contact').value.trim(),
      phone: document.getElementById('supp-phone').value.trim(),
      email: document.getElementById('supp-email').value.trim(),
      address: document.getElementById('supp-address').value.trim()
    });

    Utils.showToast('Proveedor registrado correctamente', 'success');
    this._renderSuppliers();
    ['supp-name','supp-nit','supp-contact','supp-phone','supp-email','supp-address'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  },

  _delSupplier(id) {
    if (!Utils.confirm('¿Eliminar proveedor?')) return;
    DB.delete('suppliers', id);
    this._renderSuppliers();
    Utils.showToast('Proveedor eliminado', 'success');
  }
};
