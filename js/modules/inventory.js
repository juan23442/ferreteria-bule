/* =============================================
   FERRETERÍA EL BULE — Módulo Inventario (inventory.js)
   Paginación para miles de productos, Detección Inmediata
   de Códigos Duplicados y Formato COP para valores grandes
   ============================================= */

window.Modules = window.Modules || {};
window.Modules.inventory = {
  _editId: null,
  _adjustId: null,
  _currentPage: 1,
  _pageSize: 15,
  _searchDebounceTimer: null,

  render() {
    const categories = DB.getAll('categories');

    const catOptions = categories.map(c => `<option value="${Utils.escHtml(c.name)}">${Utils.escHtml(c.name)}</option>`).join('');

    return `
    <!-- Fila de Resumen -->
    <div class="grid-4 mb-24">
      <div class="stat-card"><div class="stat-icon blue">📦</div><div class="stat-info"><div class="stat-label">Total Productos</div><div class="stat-value" id="inv-total-count">Cargando...</div></div></div>
      <div class="stat-card"><div class="stat-icon yellow">💵</div><div class="stat-info"><div class="stat-label">Valor Inventario (Costo)</div><div class="stat-value accent" id="inv-cost-total">Cargando...</div></div></div>
      <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><div class="stat-label">Valor Inventario (Venta)</div><div class="stat-value success" id="inv-sale-total">Cargando...</div></div></div>
      <div class="stat-card"><div class="stat-icon red">⚠️</div><div class="stat-info"><div class="stat-label">Bajo / Agotado</div><div class="stat-value danger" id="inv-alert-count">Cargando...</div></div></div>
    </div>

    <!-- Barra de Filtros -->
    <div class="filters-bar">
      <div class="search-box"><input type="text" id="inv-search" placeholder="Buscar rápidamente por código, nombre, marca o categoría..."></div>
      <select class="form-select" id="inv-cat-filter" style="width:170px"><option value="">Todas las categorías</option>${catOptions}</select>
      <select class="form-select" id="inv-stock-filter" style="width:160px">
        <option value="">Todos los estados</option>
        <option value="disponible">🟢 Disponibles</option>
        <option value="bajo">🟡 Stock Bajo</option>
        <option value="agotado">🔴 Agotados</option>
        <option value="inactivo">🚫 Desactivados</option>
      </select>
      <button class="btn btn-primary" id="btn-add-product">+ Agregar Producto</button>
      <button class="btn btn-secondary" id="btn-export-inv">📤 Exportar CSV</button>
    </div>

    <!-- Tabla de Productos con Paginación -->
    <div class="card">
      <div class="card-body" style="padding:0">
        <div class="table-wrapper">
          <table class="table" id="inv-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Categoría / Marca</th>
                <th>Precio Compra</th>
                <th>Precio Venta</th>
                <th>Ganancia/Unit</th>
                <th>Stock</th>
                <th>Valor Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="inv-tbody"></tbody>
          </table>
        </div>
      </div>
      <!-- Controles de Paginación -->
      <div class="card-header" style="border-top:1px solid var(--border);border-bottom:none;background:var(--bg-input)">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:12px;color:var(--text-muted)">Mostrar por página:</span>
          <select class="form-select" id="inv-page-size" style="width:80px;font-size:12px;padding:4px 8px">
            <option value="15">15</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <span style="font-size:12px;color:var(--text-muted)" id="inv-pagination-info">Mostrando 0 de 0 productos</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px" id="inv-pagination-btns">
          <button class="btn btn-secondary btn-sm" id="btn-prev-page" disabled>◀ Anterior</button>
          <span style="font-size:12.5px;font-weight:700" id="inv-page-num">Página 1</span>
          <button class="btn btn-secondary btn-sm" id="btn-next-page" disabled>Siguiente ▶</button>
        </div>
      </div>
    </div>

    <!-- Modal Agregar / Editar Producto -->
    <div class="modal" id="productModal" style="display:none">
      <div class="modal-content">
        <div class="modal-header"><h3 id="productModalTitle">Agregar Producto</h3><button class="modal-close" onclick="Utils.closeModal('productModal')">✕</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Código de Barras / Ref *</label>
              <input class="form-control" id="prod-code" placeholder="Ej: P-1001">
              <div id="code-duplicate-msg" style="display:none;font-size:12px;font-weight:700;color:var(--danger);margin-top:4px">⚠️ Este código ya existe</div>
            </div>
            <div class="form-group"><label class="form-label">Nombre del Producto *</label><input class="form-control" id="prod-name" placeholder="Ej: Martillo Mango de Goma 16oz" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Categoría</label><select class="form-select" id="prod-category"><option value="">Seleccionar Categoría</option>${catOptions}</select></div>
            <div class="form-group"><label class="form-label">Marca</label><input class="form-control" id="prod-brand" placeholder="Ej: Stanley, Truper, Bellota"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Precio de Compra ($ COP) *</label><input class="form-control" id="prod-cost" type="number" step="100" min="0" placeholder="20000"></div>
            <div class="form-group"><label class="form-label">Precio de Venta ($ COP) *</label><input class="form-control" id="prod-sale" type="number" step="100" min="0" placeholder="30000"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Stock Inicial *</label><input class="form-control" id="prod-stock" type="number" min="0" value="10"></div>
            <div class="form-group"><label class="form-label">Stock Mínimo Alerta *</label><input class="form-control" id="prod-minstock" type="number" min="1" value="3"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Unidad de Medida</label>
              <select class="form-select" id="prod-unit">
                <option value="unidad">Unidad (und)</option>
                <option value="metro">Metro (m)</option>
                <option value="litro">Litro (L)</option>
                <option value="kilo">Kilo (kg)</option>
                <option value="caja">Caja</option>
                <option value="rollo">Rollo</option>
                <option value="bolsa">Bolsa</option>
                <option value="par">Par</option>
                <option value="galón">Galón</option>
                <option value="libra">Libra</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label">Proveedor Predeterminado</label><input class="form-control" id="prod-supplier" placeholder="Nombre del proveedor"></div>
          </div>
          <div class="form-group"><label class="form-label">Descripción u Observaciones</label><textarea class="form-control form-textarea" id="prod-desc" rows="2" placeholder="Detalles técnicos o del producto"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal('productModal')">Cancelar</button>
          <button class="btn btn-primary" id="btn-save-product">Guardar Producto</button>
        </div>
      </div>
    </div>

    <!-- Modal Ajustar Stock -->
    <div class="modal" id="adjustStockModal" style="display:none">
      <div class="modal-content">
        <div class="modal-header"><h3>Ajustar Stock Manual</h3><button class="modal-close" onclick="Utils.closeModal('adjustStockModal')">✕</button></div>
        <div class="modal-body">
          <p id="adjust-prod-info" class="font-bold text-accent mb-16"></p>
          <div class="form-group"><label class="form-label">Tipo de Ajuste</label>
            <select class="form-select" id="adjust-type">
              <option value="entrada">➕ Entrada (+ Aumentar Stock)</option>
              <option value="salida">➖ Salida (- Disminuir Stock)</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Cantidad a Ajustar *</label><input class="form-control" type="number" id="adjust-qty" min="1" value="1"></div>
          <div class="form-group"><label class="form-label">Motivo del Ajuste *</label><input class="form-control" id="adjust-reason" placeholder="Ej: Daño, Corrección de Inventario, Conteo Físico"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal('adjustStockModal')">Cancelar</button>
          <button class="btn btn-primary" id="btn-save-adjust">Confirmar Ajuste</button>
        </div>
      </div>
    </div>

    <!-- Modal Ver Producto -->
    <div class="modal" id="viewProductModal" style="display:none">
      <div class="modal-content modal-lg">
        <div class="modal-header"><h3>Detalle del Producto</h3><button class="modal-close" onclick="Utils.closeModal('viewProductModal')">✕</button></div>
        <div class="modal-body" id="view-prod-body"></div>
      </div>
    </div>`;
  },

  init() {
    const self = this;
    this._currentPage = 1;
    this._pageSize = parseInt(document.getElementById('inv-page-size')?.value || 15);
    this._renderTable();
    DB.productSummary().then(summary => {
      this._renderSummary(summary);
    }).catch(() => {
      const products = DB.getAll('products');
      this._renderSummary({
        total: products.length,
        cost: products.reduce((sum, product) => sum + (Number(product.costPrice) || 0) * (Number(product.stock) || 0), 0),
        sale: products.reduce((sum, product) => sum + (Number(product.salePrice) || 0) * (Number(product.stock) || 0), 0),
        lowStock: products.filter(product => Number(product.stock) > 0 && Number(product.stock) <= (Number(product.minStock) || 3)).length,
        outStock: products.filter(product => Number(product.stock) <= 0).length
      });
    });

    // Detección Inmediata de Código Duplicado al Escribir
    const codeInput = document.getElementById('prod-code');
    if (codeInput) {
      codeInput.addEventListener('input', () => self._validateCodeLive());
    }

    document.getElementById('btn-add-product').addEventListener('click', () => {
      self._editId = null;
      self._clearForm();
      document.getElementById('productModalTitle').textContent = 'Agregar Producto';
      Utils.openModal('productModal');
    });

    document.getElementById('btn-save-product').addEventListener('click', () => self._save());
    document.getElementById('btn-save-adjust').addEventListener('click', () => self._saveAdjust());

    // Buscador con Debounce de 100ms para Máximo Rendimiento
    document.getElementById('inv-search').addEventListener('input', () => {
      clearTimeout(self._searchDebounceTimer);
      self._searchDebounceTimer = setTimeout(() => {
        self._currentPage = 1;
        self._renderTable();
      }, 100);
    });

    document.getElementById('inv-cat-filter').addEventListener('change', () => { self._currentPage = 1; self._renderTable(); });
    document.getElementById('inv-stock-filter').addEventListener('change', () => { self._currentPage = 1; self._renderTable(); });

    // Paginación
    document.getElementById('inv-page-size')?.addEventListener('change', (e) => {
      self._pageSize = parseInt(e.target.value) || 15;
      self._currentPage = 1;
      self._renderTable();
    });

    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
      if (self._currentPage > 1) {
        self._currentPage--;
        self._renderTable();
      }
    });

    document.getElementById('btn-next-page')?.addEventListener('click', () => {
      self._currentPage++;
      self._renderTable();
    });

    document.getElementById('btn-export-inv').addEventListener('click', () => self._export());
  },

  _renderSummary(summary) {
    const localProducts = DB.getAll('products');
    const localCost = localProducts.reduce((sum, product) => sum + (Number(product.costPrice) || 0) * (Number(product.stock) || 0), 0);
    const total = document.getElementById('inv-total-count');
    const cost = document.getElementById('inv-cost-total');
    const sale = document.getElementById('inv-sale-total');
    const alerts = document.getElementById('inv-alert-count');
    if (total) total.textContent = Number(summary.total || 0).toLocaleString('es-CO');
    if (cost) cost.textContent = Utils.formatCurrency(Number(summary.cost) || localCost);
    if (sale) sale.textContent = Utils.formatCurrency(summary.sale || 0);
    if (alerts) alerts.textContent = (Number(summary.lowStock || 0) + Number(summary.outStock || 0)).toLocaleString('es-CO');
  },

  _validateCodeLive() {
    const codeInput = document.getElementById('prod-code');
    const msgEl = document.getElementById('code-duplicate-msg');
    const saveBtn = document.getElementById('btn-save-product');
    if (!codeInput || !msgEl || !saveBtn) return;

    const code = codeInput.value.trim();
    if (!code) {
      msgEl.style.display = 'none';
      codeInput.style.borderColor = '';
      saveBtn.disabled = false;
      return;
    }

    if (this._editId) {
      const current = DB.findById('products', this._editId);
      if (current && current.code && current.code.trim().toLowerCase() === code.toLowerCase()) {
        msgEl.style.display = 'none';
        codeInput.style.borderColor = 'var(--success)';
        saveBtn.disabled = false;
        return;
      }
    }

    const isDup = DB.isCodeDuplicate(code, this._editId);

    if (isDup) {
      msgEl.style.display = 'block';
      msgEl.textContent = '⚠️ Este código ya existe';
      codeInput.style.borderColor = 'var(--danger)';
      saveBtn.disabled = true;
    } else {
      msgEl.style.display = 'none';
      codeInput.style.borderColor = 'var(--success)';
      saveBtn.disabled = false;
    }
  },

  _getFilteredProducts() {
    const search = (document.getElementById('inv-search')?.value || '').toLowerCase();
    const catFilter = document.getElementById('inv-cat-filter')?.value || '';
    const stockFilter = document.getElementById('inv-stock-filter')?.value || '';

    let filtered = DB.searchProducts(search);

    if (catFilter) filtered = filtered.filter(p => p.category === catFilter);

    if (stockFilter === 'disponible') filtered = filtered.filter(p => p.active !== false && p.stock > (p.minStock||3));
    else if (stockFilter === 'bajo') filtered = filtered.filter(p => p.active !== false && p.stock > 0 && p.stock <= (p.minStock||3));
    else if (stockFilter === 'agotado') filtered = filtered.filter(p => p.active !== false && p.stock <= 0);
    else if (stockFilter === 'inactivo') filtered = filtered.filter(p => p.active === false);

    return filtered;
  },

  _renderTable() {
    const tbody = document.getElementById('inv-tbody');
    if (!tbody) return;

    const search = document.getElementById('inv-search')?.value || '';
    const category = document.getElementById('inv-cat-filter')?.value || '';
    const stock = document.getElementById('inv-stock-filter')?.value || '';
    tbody.innerHTML = `<tr><td colspan="10"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>`;

    DB.listProducts({ query: search, category, stock, page: this._currentPage, pageSize: this._pageSize })
      .then(result => this._renderProductPage(result))
      .catch(() => {
        const filtered = this._getFilteredProducts();
        this._renderProductPage({ items: filtered.slice((this._currentPage - 1) * this._pageSize, this._currentPage * this._pageSize), total: filtered.length, pages: Math.ceil(filtered.length / this._pageSize) || 1, page: this._currentPage });
      });
  },

  _renderProductPage(result) {
    const tbody = document.getElementById('inv-tbody');
    if (!tbody) return;
    const localByCode = new Map(DB.getAll('products').map(product => [String(product.code || '').trim().toLowerCase(), product]));
    const pageItems = (result.items || []).map(remoteProduct => {
      const localProduct = localByCode.get(String(remoteProduct.code || '').trim().toLowerCase());
      return localProduct ? {
        ...remoteProduct,
        ...localProduct,
        costPrice: Number(remoteProduct.costPrice) > 0 ? Number(remoteProduct.costPrice) : (Number(localProduct.costPrice) || 0),
        salePrice: Number(remoteProduct.salePrice) || Number(localProduct.salePrice) || 0,
        stock: Number(remoteProduct.stock) || 0,
        id: remoteProduct.id
      } : remoteProduct;
    });
    const totalItems = result.total || 0;
    const totalPages = result.pages || Math.ceil(totalItems / this._pageSize) || 1;

    if (this._currentPage > totalPages) this._currentPage = totalPages;
    if (this._currentPage < 1) this._currentPage = 1;

    const startIdx = (this._currentPage - 1) * this._pageSize;
    const endIdx = Math.min(startIdx + pageItems.length, totalItems);

    // Update pagination controls
    const infoEl = document.getElementById('inv-pagination-info');
    const pageNumEl = document.getElementById('inv-page-num');
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');

    if (infoEl) infoEl.textContent = `Mostrando ${totalItems > 0 ? startIdx + 1 : 0} - ${endIdx} de ${totalItems.toLocaleString('es-CO')} productos`;
    if (pageNumEl) pageNumEl.textContent = `Página ${this._currentPage} de ${totalPages}`;
    if (prevBtn) prevBtn.disabled = this._currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this._currentPage >= totalPages;

    if (pageItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10">${Utils.emptyState('No se encontraron productos con los filtros seleccionados','📦')}</td></tr>`;
      return;
    }

    tbody.innerHTML = pageItems.map(p => {
      const unitProfit = Math.max(0, (p.salePrice||0) - (p.costPrice||0));
      const totalVal = (p.stock||0) * (p.salePrice||0);
      const isInactive = p.active === false;

      return `
      <tr style="${isInactive ? 'opacity:0.5;background:rgba(0,0,0,0.2)' : ''}">
        <td class="muted"><strong>${Utils.escHtml(p.code||'-')}</strong></td>
        <td>
          <strong>${Utils.escHtml(p.name)}</strong>
          ${p.brand ? `<div style="font-size:11px;color:var(--text-muted)">${Utils.escHtml(p.brand)}</div>` : ''}
        </td>
        <td>${Utils.escHtml(p.category||'General')}</td>
        <td>${Utils.formatCurrency(p.costPrice)}</td>
        <td class="text-accent font-bold">${Utils.formatCurrency(p.salePrice)}</td>
        <td class="text-success">${Utils.formatCurrency(unitProfit)}</td>
        <td><strong>${p.stock}</strong> <small>${Utils.escHtml(p.unit||'und')}</small></td>
        <td class="font-bold">${Utils.formatCurrency(totalVal)}</td>
        <td>${isInactive ? `<span class="badge badge-danger">Inactivo</span>` : Utils.stockBadge(p.stock, p.minStock)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-secondary" title="Ver Detalle" onclick="Modules.inventory._view('${p.id}')">👁️</button>
          <button class="btn btn-sm btn-secondary" title="Editar" onclick="Modules.inventory._edit('${p.id}')">✏️</button>
          <button class="btn btn-sm btn-warning" title="Ajustar Stock" onclick="Modules.inventory._openAdjust('${p.id}')">⚖️</button>
          <button class="btn btn-sm ${isInactive ? 'btn-success' : 'btn-danger'}" title="${isInactive ? 'Activar' : 'Desactivar'}" onclick="Modules.inventory._toggleActive('${p.id}')">${isInactive ? '✔️' : '🚫'}</button>
        </td>
      </tr>`;
    }).join('');
  },

  _clearForm() {
    ['prod-code','prod-name','prod-brand','prod-supplier','prod-desc'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('prod-cost').value = '';
    document.getElementById('prod-sale').value = '';
    document.getElementById('prod-stock').value = '10';
    document.getElementById('prod-minstock').value = '3';
    document.getElementById('prod-category').value = '';
    document.getElementById('prod-unit').value = 'unidad';

    const msgEl = document.getElementById('code-duplicate-msg');
    const codeInput = document.getElementById('prod-code');
    const saveBtn = document.getElementById('btn-save-product');
    if (msgEl) msgEl.style.display = 'none';
    if (codeInput) codeInput.style.borderColor = '';
    if (saveBtn) saveBtn.disabled = false;
  },

  _edit(id) {
    const p = DB.findById('products', id);
    if (!p) return;
    this._editId = id;
    document.getElementById('productModalTitle').textContent = 'Editar Producto';
    document.getElementById('prod-code').value = p.code || '';
    document.getElementById('prod-name').value = p.name || '';
    document.getElementById('prod-brand').value = p.brand || '';
    document.getElementById('prod-category').value = p.category || '';
    document.getElementById('prod-unit').value = p.unit || 'unidad';
    document.getElementById('prod-cost').value = p.costPrice || '';
    document.getElementById('prod-sale').value = p.salePrice || '';
    document.getElementById('prod-stock').value = p.stock || 0;
    document.getElementById('prod-minstock').value = p.minStock || 3;
    document.getElementById('prod-supplier').value = p.supplier || '';
    document.getElementById('prod-desc').value = p.description || '';

    this._validateCodeLive();
    Utils.openModal('productModal');
  },

  async _save() {
    const code = document.getElementById('prod-code').value.trim();
    const name = document.getElementById('prod-name').value.trim();

    if (!name) { Utils.showToast('El nombre del producto es obligatorio', 'error'); return; }
    if (!code) { Utils.showToast('El código del producto es obligatorio', 'error'); return; }

    // Strict Database Duplicate Check
    let isCodeChanging = true;
    if (this._editId) {
      const current = DB.findById('products', this._editId);
      if (current && current.code && current.code.trim().toLowerCase() === code.toLowerCase()) {
        isCodeChanging = false;
      }
    }

    if (isCodeChanging && DB.isCodeDuplicate(code, this._editId)) {
      Utils.showToast(`⚠️ Este código "${code}" ya existe en otro producto`, 'error');
      this._validateCodeLive();
      return;
    }

    const data = {
      code,
      name,
      brand: document.getElementById('prod-brand').value.trim(),
      category: document.getElementById('prod-category').value,
      unit: document.getElementById('prod-unit').value,
      costPrice: parseFloat(document.getElementById('prod-cost').value) || 0,
      salePrice: parseFloat(document.getElementById('prod-sale').value) || 0,
      stock: parseInt(document.getElementById('prod-stock').value) || 0,
      minStock: parseInt(document.getElementById('prod-minstock').value) || 3,
      supplier: document.getElementById('prod-supplier').value.trim(),
      description: document.getElementById('prod-desc').value.trim(),
      active: true
    };

    try {
      if (this._editId) {
        const old = DB.findById('products', this._editId);
        if (!old) throw new Error('No se encontró el producto que deseas editar');
        const response = await fetch(`/api/productos/${encodeURIComponent(old.code)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'No se pudo actualizar el producto en Supabase');
        DB.update('products', this._editId, data);
        if (old && old.stock !== data.stock) {
          DB.logMovement({ productId: this._editId, productName: data.name, qty: Math.abs(data.stock - old.stock), type: 'Ajuste Stock', reason: 'Edición directa de producto', value: data.salePrice });
        }
        Utils.showToast('Producto actualizado correctamente', 'success');
      } else {
        const response = await fetch('/api/productos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'No se pudo guardar el producto en SQL Server');

        data.id = Utils.generateId('prod');
        data.createdAt = Utils.today();
        DB.add('products', data);
        DB.logMovement({ productId: data.id, productName: data.name, qty: data.stock, type: 'Ajuste Stock', reason: 'Creación de producto nuevo', value: data.salePrice });
        Utils.showToast('Producto agregado al inventario', 'success');
      }

      Utils.closeModal('productModal');
      this._renderTable();
    } catch (err) {
      Utils.showToast(err.message || 'Error al guardar producto', 'error');
    }
  },

  _openAdjust(id) {
    const p = DB.findById('products', id);
    if (!p) return;
    this._adjustId = id;
    document.getElementById('adjust-prod-info').textContent = `${p.code} - ${p.name} (Stock Actual: ${p.stock} ${p.unit||'und'})`;
    document.getElementById('adjust-qty').value = '1';
    document.getElementById('adjust-reason').value = '';
    Utils.openModal('adjustStockModal');
  },

  _saveAdjust() {
    const p = DB.findById('products', this._adjustId);
    if (!p) return;
    const type = document.getElementById('adjust-type').value;
    const qty = parseInt(document.getElementById('adjust-qty').value) || 0;
    const reason = document.getElementById('adjust-reason').value.trim();

    if (qty <= 0) { Utils.showToast('La cantidad debe ser mayor a 0', 'error'); return; }
    if (!reason) { Utils.showToast('Ingrese el motivo del ajuste', 'error'); return; }

    const newStock = type === 'entrada' ? (p.stock + qty) : (p.stock - qty);
    if (newStock < 0) { Utils.showToast('El stock no puede quedar en negativo', 'error'); return; }

    DB.update('products', p.id, { stock: newStock });
    DB.logMovement({ productId: p.id, productName: p.name, qty: (type==='entrada'?qty:-qty), type: 'Ajuste Stock', reason: `Ajuste manual (${type}): ${reason}`, value: p.salePrice });

    Utils.showToast(`Stock de ${p.name} actualizado a ${newStock}`, 'success');
    Utils.closeModal('adjustStockModal');
    this._renderTable();
  },

  _toggleActive(id) {
    const p = DB.findById('products', id);
    if (!p) return;
    const newStatus = p.active === false ? true : false;
    DB.update('products', id, { active: newStatus });
    Utils.showToast(`Producto ${newStatus ? 'activado' : 'desactivado'}`, newStatus ? 'success' : 'warning');
    this._renderTable();
  },

  _view(id) {
    const p = DB.findById('products', id);
    if (!p) return;
    const movements = DB.getAll('movements').filter(m => m.productId === id).slice(-10).reverse();

    let html = `
    <div class="grid-2 mb-16">
      <div>
        <p><strong>Código:</strong> ${Utils.escHtml(p.code||'-')}</p>
        <p><strong>Producto:</strong> ${Utils.escHtml(p.name)}</p>
        <p><strong>Marca:</strong> ${Utils.escHtml(p.brand||'-')}</p>
        <p><strong>Categoría:</strong> ${Utils.escHtml(p.category||'-')}</p>
      </div>
      <div>
        <p><strong>Precio Compra:</strong> ${Utils.formatCurrency(p.costPrice)}</p>
        <p><strong>Precio Venta:</strong> <strong class="text-accent">${Utils.formatCurrency(p.salePrice)}</strong></p>
        <p><strong>Stock Actual:</strong> <strong>${p.stock} ${p.unit||'und'}</strong></p>
        <p><strong>Estado:</strong> ${Utils.stockBadge(p.stock, p.minStock)}</p>
      </div>
    </div>
    <div class="section-title">Lotes de Inventario por Costo</div>
    ${p.batches && p.batches.length ? `
      <table class="table mb-16">
        <thead><tr><th>Lote</th><th>Fecha</th><th>Cantidad inicial</th><th>Stock actual</th><th>Costo unitario</th><th>Variación</th><th>Proveedor</th></tr></thead>
        <tbody>
          ${p.batches.map(batch => `
            <tr>
              <td><strong>${Utils.escHtml(batch.label || `Lote ${batch.batchNumber}`)}</strong></td>
              <td>${Utils.formatDate(batch.date)}</td>
              <td>${batch.initialQty || 0}</td>
              <td class="font-bold">${batch.stock || 0} ${Utils.escHtml(p.unit || 'und')}</td>
              <td>${Utils.formatCurrency(batch.costPrice)}</td>
              <td>${batch.changeType === 'AUMENTO' ? '<span class="badge badge-warning">🔺 AUMENTO</span>' : (batch.changeType === 'BAJO' ? '<span class="badge badge-success">🔻 BAJO</span>' : '<span class="badge badge-info">REGULAR</span>')}</td>
              <td>${Utils.escHtml(batch.supplier || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p style="color:var(--text-muted)">Sin lotes registrados</p>'}
    <div class="section-title">Últimos Movimientos de Inventario</div>
    ${movements.length === 0 ? '<p style="color:var(--text-muted)">Sin movimientos registrados</p>' : `
      <table class="table">
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th></tr></thead>
        <tbody>
          ${movements.map(m => `
            <tr>
              <td>${Utils.formatDatetime(m.datetime)}</td>
              <td><span class="badge badge-info">${Utils.escHtml(m.type)}</span></td>
              <td class="${m.qty > 0 ? 'text-success' : 'text-danger'} font-bold">${m.qty > 0 ? '+'+m.qty : m.qty}</td>
              <td>${Utils.escHtml(m.reason)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `}`;

    document.getElementById('view-prod-body').innerHTML = html;
    Utils.openModal('viewProductModal');
  },

  _export() {
    const products = DB.getAll('products');
    const rows = [['Código','Nombre','Marca','Categoría','Precio Compra','Precio Venta','Stock','Unidad','Proveedor','Estado']];
    products.forEach(p => rows.push([
      p.code||'', p.name, p.brand||'', p.category||'', p.costPrice, p.salePrice, p.stock, p.unit||'', p.supplier||'', p.active!==false?'Activo':'Inactivo'
    ]));
    Utils.downloadCSV(rows, 'inventario_ferreteria_el_bule.csv');
    Utils.showToast('Inventario exportado a CSV', 'success');
  }
};
