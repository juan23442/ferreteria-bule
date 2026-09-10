/* =============================================
   FERRETERÍA EL BULE — Módulo Ventas (sales.js)
   POS optimizado con Control Estricto de Stock Máximo Disponible,
   Precio Acordado / Rebajas y Ganancia Real en $ COP
   ============================================= */

window.Modules = window.Modules || {};
window.Modules.sales = {
  _cart: [],
  _editingSaleId: null,
  _periodFilter: 'today',
  _fromDate: '',
  _toDate: '',
  _searchTimer: null,

  render() {
    const settings = DB.getSettings();
    const customers = DB.getAll('customers');
    const custOptions = customers.map(c => `<option value="${Utils.escHtml(c.name)}">`).join('');

    return `
    <!-- Barra Superior de Estadísticas y Filtros -->
    <div class="card mb-24">
      <div class="card-header">
        <span class="card-title">🔍 Consulta de Ventas por Período</span>
        <div class="tabs" id="sales-period-tabs">
          <button class="tab-btn active" data-period="today">Hoy</button>
          <button class="tab-btn" data-period="week">Esta Semana</button>
          <button class="tab-btn" data-period="month">Este Mes</button>
          <button class="tab-btn" data-period="year">Este Año</button>
          <button class="tab-btn" data-period="custom">Personalizado</button>
        </div>
      </div>
      <div class="card-body">
        <div id="sales-custom-range" style="display:none;margin-bottom:16px" class="filters-bar">
          <label class="form-label" style="margin:0">Desde:</label>
          <input type="date" class="form-control" id="sales-from" style="width:160px">
          <label class="form-label" style="margin:0">Hasta:</label>
          <input type="date" class="form-control" id="sales-to" style="width:160px">
          <button class="btn btn-primary btn-sm" id="btn-apply-sales-range">Filtrar</button>
        </div>

        <div class="grid-4" id="sales-stats-grid">
          <!-- Renderizado dinámico en _renderStats() -->
        </div>
      </div>
    </div>

    <!-- Panel Punto de Venta POS -->
    <div class="pos-layout mb-24">
      <!-- Panel Izquierdo: Catálogo de Productos -->
      <div class="pos-left">
        <div class="pos-panel-header">
          <span>📦 Productos Disponibles</span>
          <small class="text-muted" id="pos-count-info">Clic para agregar al carrito</small>
        </div>
        <div class="pos-search">
          <input type="text" id="pos-search" class="form-control" placeholder="Buscar por código, nombre o marca rápidamente...">
        </div>
        <div class="pos-products" id="pos-products-list"></div>
      </div>

      <!-- Panel Derecho: Carrito de Venta y Rebajas -->
      <div class="pos-right">
        <div class="pos-panel-header">
          <span id="pos-cart-title">🛒 Carrito de Venta</span>
          <span class="badge badge-warning" id="pos-invoice-num">${settings.invoicePrefix || 'FAC'}-${Utils.pad(DB.getInvoiceCounter())}</span>
        </div>
        <div class="cart-items" id="cart-items"></div>
        <div class="cart-totals" id="cart-totals"></div>

        <div class="cart-customer">
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">Cliente</label>
            <input class="form-control" id="sale-customer" placeholder="Cliente General / Consumidor Final" list="customer-list-sales">
            <datalist id="customer-list-sales">${custOptions}</datalist>
          </div>
          <div class="form-row" style="gap:10px;margin-bottom:12px">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Método de Pago</label>
              <select class="form-select" id="sale-payment">
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="crédito">Crédito</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Notas / Observación</label>
              <input class="form-control" id="sale-notes" placeholder="Ej: Pago exacto">
            </div>
          </div>
          <button class="btn btn-primary btn-block btn-lg" id="btn-confirm-sale">✅ Confirmar Venta</button>
          <button class="btn btn-warning btn-block btn-sm mt-8" id="btn-save-pending" title="Guardar factura sin cobrar — se registra como PENDIENTE">🕐 Guardar como Pendiente / Cotización</button>
          <button class="btn btn-info btn-block btn-sm mt-8" id="btn-save-advance" title="Guardar con abono inicial y dejar saldo pendiente">💳 Guardar como Abono / Cuota Inicial</button>
          <button class="btn btn-secondary btn-block btn-sm mt-8" id="btn-cancel-edit-sale" style="display:none">Cancelar Edición</button>
        </div>
      </div>
    </div>

    <!-- Registro y Tabla de Ventas -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">📋 Registro de Ventas</span>
        <div class="search-box" style="max-width:280px"><input type="text" id="sales-table-search" placeholder="Buscar factura o cliente..."></div>
      </div>
      <div class="card-body" style="padding:0">
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Factura</th>
                <th>Fecha / Hora</th>
                <th>Cliente</th>
                <th>Productos</th>
                <th>Rebaja/Desc.</th>
                <th>Total Venta</th>
                <th>Ganancia Real</th>
                <th>Pago</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="sales-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Editar Venta Registrada -->
    <div class="modal" id="editSaleModal" style="display:none">
      <div class="modal-content modal-lg">
        <div class="modal-header"><h3 id="editSaleModalTitle">Editar Venta Registrada</h3><button class="modal-close" onclick="Utils.closeModal('editSaleModal')">✕</button></div>
        <div class="modal-body" id="edit-sale-modal-body"></div>
      </div>
    </div>

    <!-- Modal Ver Detalle de Venta -->
    <div class="modal" id="viewSaleModal" style="display:none">
      <div class="modal-content modal-lg">
        <div class="modal-header"><h3>Detalle Completo de la Venta</h3><button class="modal-close" onclick="Utils.closeModal('viewSaleModal')">✕</button></div>
        <div class="modal-body" id="view-sale-modal-body"></div>
      </div>
    </div>`;
  },

  init() {
    this._cart = [];
    this._editingSaleId = null;
    this._periodFilter = 'today';

    this._renderProducts();
    this._renderCart();
    this._renderStats();
    this._renderSalesTable();

    // Periods tabs
    document.querySelectorAll('#sales-period-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#sales-period-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._periodFilter = btn.dataset.period;
        document.getElementById('sales-custom-range').style.display = this._periodFilter === 'custom' ? 'flex' : 'none';
        this._renderStats();
        this._renderSalesTable();
      });
    });

    document.getElementById('btn-apply-sales-range')?.addEventListener('click', () => {
      this._fromDate = document.getElementById('sales-from').value;
      this._toDate = document.getElementById('sales-to').value;
      this._renderStats();
      this._renderSalesTable();
    });

    // Debounced Search for ultra-fast performance
    document.getElementById('pos-search').addEventListener('input', () => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this._renderProducts(), 80);
    });

    document.getElementById('sales-table-search').addEventListener('input', Utils.debounce(() => this._renderSalesTable()));
    document.getElementById('btn-confirm-sale').addEventListener('click', () => this._confirmSale());
    document.getElementById('btn-save-pending')?.addEventListener('click', () => this._savePending());
    document.getElementById('btn-save-advance')?.addEventListener('click', () => this._saveAdvance());
    document.getElementById('btn-cancel-edit-sale')?.addEventListener('click', () => this._cancelEdit());
  },

  _getFilteredSales() {
    const sales = DB.getAll('sales');
    const today = Utils.today();
    const d = new Date(today);

    switch (this._periodFilter) {
      case 'today':
        return sales.filter(s => s.date === today);
      case 'week': {
        const dayOfWeek = d.getDay();
        const monday = new Date(d); monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        const monStr = monday.toISOString().split('T')[0];
        const sunStr = sunday.toISOString().split('T')[0];
        return sales.filter(s => s.date >= monStr && s.date <= sunStr);
      }
      case 'month':
        return sales.filter(s => s.date && s.date.startsWith(today.slice(0, 7)));
      case 'year':
        return sales.filter(s => s.date && s.date.startsWith(today.slice(0, 4)));
      case 'custom':
        return sales.filter(s => Utils.dateInRange(s.date, this._fromDate, this._toDate));
      default:
        return sales;
    }
  },

  _renderStats() {
    const sales = this._getFilteredSales().filter(s => s.status !== 'anulada');
    const totalSold = Utils.sum(sales, 'total');
    const totalProfit = sales.reduce((acc, s) => {
      if (s.realProfit !== undefined) return acc + s.realProfit;
      const cost = (s.items || []).reduce((cAcc, it) => cAcc + ((it.qty || 1) * (it.costPrice || 0)), 0);
      return acc + Math.max(0, s.total - cost);
    }, 0);

    const totalItemsCount = sales.reduce((acc, s) => acc + (s.items || []).reduce((iAcc, it) => iAcc + (it.qty || 1), 0), 0);

    const container = document.getElementById('sales-stats-grid');
    if (!container) return;

    container.innerHTML = `
      <div class="stat-card"><div class="stat-icon yellow">💰</div><div class="stat-info"><div class="stat-label">Total Vendido</div><div class="stat-value accent">${Utils.formatCurrency(totalSold)}</div></div></div>
      <div class="stat-card"><div class="stat-icon green">📈</div><div class="stat-info"><div class="stat-label">Ganancia Real</div><div class="stat-value success">${Utils.formatCurrency(totalProfit)}</div></div></div>
      <div class="stat-card"><div class="stat-icon blue">🧾</div><div class="stat-info"><div class="stat-label">Nº de Ventas</div><div class="stat-value">${sales.length.toLocaleString('es-CO')}</div></div></div>
      <div class="stat-card"><div class="stat-icon purple">📦</div><div class="stat-info"><div class="stat-label">Productos Vendidos</div><div class="stat-value">${totalItemsCount.toLocaleString('es-CO')}</div></div></div>
    `;
  },

  _renderProducts() {
    const search = (document.getElementById('pos-search')?.value || '').toLowerCase().trim();
    const products = DB.searchProducts(search, true);

    const container = document.getElementById('pos-products-list');
    const infoEl = document.getElementById('pos-count-info');

    if (!container) return;

    const totalMatches = products.length;
    if (infoEl) {
      infoEl.textContent = search ? `${totalMatches.toLocaleString('es-CO')} resultados` : `Clic para agregar al carrito`;
    }

    if (totalMatches === 0) {
      container.innerHTML = Utils.emptyState('No hay productos coincidentes', '🔍');
      return;
    }

    // Performance Slice
    const visibleProducts = products.slice(0, 30);

    container.innerHTML = visibleProducts.map(p => `
      <div class="product-row" onclick="Modules.sales._addToCart('${p.id}')" ${p.stock <= 0 ? 'style="opacity:0.4;pointer-events:none"' : ''}>
        <div>
          <div class="prod-name">${Utils.escHtml(p.name)}</div>
          <div class="prod-detail">${Utils.escHtml(p.code||'')} · ${p.brand ? Utils.escHtml(p.brand) + ' · ' : ''}Stock: <strong>${p.stock}</strong> ${Utils.escHtml(p.unit||'und')}</div>
        </div>
        <div style="text-align:right">
          <div class="prod-price">${Utils.formatCurrency(p.salePrice)}</div>
          <div class="prod-stock">${p.stock <= 0 ? '<span class="text-danger font-bold">Agotado</span>' : `Disponible`}</div>
        </div>
      </div>
    `).join('');
  },

  _addToCart(productId) {
    const p = DB.findById('products', productId);
    if (!p || p.stock <= 0) {
      Utils.showToast('⚠️ Producto agotado. No hay unidades disponibles para vender.', 'warning');
      return;
    }

    const existing = this._cart.find(c => c.productId === productId);
    if (existing) {
      if (existing.qty >= p.stock) {
        Utils.showToast(`⚠️ No se pueden agregar más unidades. Solo hay ${p.stock} disponibles de "${p.name}".`, 'error');
        return;
      }
      existing.qty++;
      existing.subtotal = existing.qty * existing.salePrice;
    } else {
      this._cart.push({
        productId: p.id,
        name: p.name,
        code: p.code || '',
        qty: 1,
        normalPrice: p.salePrice,
        salePrice: p.salePrice,
        costPrice: p.costPrice || 0,
        discountAmount: 0,
        subtotal: p.salePrice,
        maxStock: p.stock
      });
    }
    this._renderCart();
  },

  _renderCart() {
    const container = document.getElementById('cart-items');
    const totalsEl = document.getElementById('cart-totals');
    if (!container || !totalsEl) return;

    if (this._cart.length === 0) {
      container.innerHTML = Utils.emptyState('Haz clic en un producto para agregarlo al carrito', '🛒');
      totalsEl.innerHTML = '';
      return;
    }

    container.innerHTML = this._cart.map((item, i) => {
      const isDiscounted = item.salePrice < item.normalPrice;
      const rebajaPerUnit = Math.max(0, item.normalPrice - item.salePrice);

      return `
      <div class="cart-item">
        <div class="cart-item-header">
          <div>
            <div class="cart-item-name">${Utils.escHtml(item.name)}</div>
            <div style="font-size:11.5px;color:var(--text-muted)">
              Precio Lista: <strong>${Utils.formatCurrency(item.normalPrice)}</strong> | Stock Disp: <strong class="text-accent">${item.maxStock}</strong>
            </div>
          </div>
          <button class="btn btn-sm btn-danger" onclick="Modules.sales._removeFromCart(${i})" style="padding:2px 6px">✕</button>
        </div>

        <div class="cart-item-controls">
          <div style="display:flex;align-items:center;gap:6px">
            <button class="qty-btn" onclick="Modules.sales._changeQty(${i}, -1)">−</button>
            <input class="qty-input" type="number" value="${item.qty}" min="1" max="${item.maxStock}" oninput="Modules.sales._setQty(${i}, this.value)">
            <button class="qty-btn" onclick="Modules.sales._changeQty(${i}, 1)">+</button>
          </div>
        </div>

        <!-- Entrada de Precio Acordado / Rebaja Negociada -->
        <div class="cart-item-price-edit">
          <div style="display:flex;align-items:center;gap:8px;flex:1">
            <label style="font-size:11.5px;font-weight:700;color:var(--text-secondary)">Precio Acordado ($ COP):</label>
            <input class="price-input-box" type="number" step="100" min="0" value="${item.salePrice}" onchange="Modules.sales._setAgreedPrice(${i}, this.value)" title="Escribe el precio negociado para este producto (ej: 18000)">
          </div>
          <span class="cart-subtotal">${Utils.formatCurrency(item.subtotal)}</span>
        </div>
        ${isDiscounted ? `<div style="font-size:11px;color:var(--danger);margin-top:4px;text-align:right">Rebaja de -$ ${new Intl.NumberFormat('es-CO').format(rebajaPerUnit)} por unidad</div>` : ''}
      </div>`;
    }).join('');

    const subtotalNormal = this._cart.reduce((a,c) => a + (c.qty * c.normalPrice), 0);
    const totalVentaAcordada = this._cart.reduce((a,c) => a + c.subtotal, 0);
    const totalRebajas = Math.max(0, subtotalNormal - totalVentaAcordada);
    const totalCost = this._cart.reduce((a,c) => a + (c.qty * c.costPrice), 0);
    const realProfit = Math.max(0, totalVentaAcordada - totalCost);

    totalsEl.innerHTML = `
      <div class="total-row"><span>Subtotal Normal</span><span>${Utils.formatCurrency(subtotalNormal)}</span></div>
      ${totalRebajas > 0 ? `<div class="total-row"><span class="text-danger font-bold">Rebaja Total Negociada</span><span class="text-danger font-bold">-${Utils.formatCurrency(totalRebajas)}</span></div>` : ''}
      <div class="total-row"><span style="font-size:12px;color:var(--text-muted)">Ganancia Real de esta venta:</span><span class="text-success font-bold">${Utils.formatCurrency(realProfit)}</span></div>
      <div class="total-row grand"><span>TOTAL A PAGAR</span><span>${Utils.formatCurrency(totalVentaAcordada)}</span></div>
    `;
  },

  _setAgreedPrice(i, val) {
    const item = this._cart[i];
    if (!item) return;

    let newPrice = parseFloat(val);
    if (isNaN(newPrice) || newPrice < 0) newPrice = item.normalPrice;

    item.salePrice = newPrice;
    item.discountAmount = Math.max(0, item.normalPrice - newPrice);
    item.subtotal = item.qty * newPrice;

    this._renderCart();
  },

  _changeQty(i, delta) {
    const item = this._cart[i];
    if (!item) return;
    const nq = item.qty + delta;

    if (nq > item.maxStock) {
      Utils.showToast(`⚠️ No se pueden vender ${nq} unidades. Solo hay ${item.maxStock} disponibles de "${item.name}".`, 'error');
      return;
    }

    if (nq < 1) return;

    item.qty = nq;
    item.subtotal = item.qty * item.salePrice;
    this._renderCart();
  },

  _setQty(i, val) {
    const item = this._cart[i];
    if (!item) return;

    let requested = parseInt(val);
    if (isNaN(requested) || requested < 1) requested = 1;

    // BLOQUEO ESTRICTO SI EXCEDE EL STOCK DISPONIBLE (Ej: Hay 15 e intenta vender 16)
    if (requested > item.maxStock) {
      Utils.showToast(`❌ Stock insuficiente: Intentaste poner ${requested} unidades, pero solo hay ${item.maxStock} disponibles de "${item.name}".`, 'error');
      item.qty = item.maxStock;
    } else {
      item.qty = requested;
    }

    item.subtotal = item.qty * item.salePrice;
    this._renderCart();
  },

  _removeFromCart(i) {
    this._cart.splice(i, 1);
    this._renderCart();
  },

  _confirmSale() {
    if (this._cart.length === 0) { Utils.showToast('El carrito está vacío', 'error'); return; }

    // VALIDACIÓN ESTRICTA DE STOCK ANTES DE PROCESAR LA VENTA
    for (const item of this._cart) {
      const p = DB.findById('products', item.productId);
      const availableStock = p ? p.stock : item.maxStock;

      if (!p || item.qty > availableStock) {
        Utils.showToast(`❌ Venta denegada: Intenta vender ${item.qty} unidades de "${item.name}", pero solo hay ${availableStock} disponibles.`, 'error');
        return;
      }
    }

    const subtotal = this._cart.reduce((a,c) => a + (c.qty * c.normalPrice), 0);
    const total = this._cart.reduce((a,c) => a + c.subtotal, 0);
    const discountTotal = Math.max(0, subtotal - total);

    const costTotal = this._cart.reduce((a,c) => a + (c.qty * c.costPrice), 0);
    const realProfit = Math.max(0, total - costTotal);

    const customerName = document.getElementById('sale-customer').value.trim() || 'Cliente General / Consumidor Final';
    const paymentMethod = document.getElementById('sale-payment').value;
    const notes = document.getElementById('sale-notes').value.trim();

    const customers = DB.getAll('customers');
    const cust = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());

    if (this._editingSaleId) {
      // EDIT EXISTING SALE
      const oldSale = DB.findById('sales', this._editingSaleId);
      if (!oldSale) return;

      // Revert old inventory stock
      oldSale.items.forEach(oldItem => {
        const p = DB.findById('products', oldItem.productId);
        if (p) DB.restoreStock(oldItem.productId, oldItem.qty);
      });

      // Apply new inventory stock
      this._cart.forEach(newItem => {
        const p = DB.findById('products', newItem.productId);
        if (p) DB.deductStock(newItem.productId, newItem.qty);
      });

      // Update Sale
      const updatedSale = {
        ...oldSale,
        customerId: cust ? cust.id : null,
        customerName,
        items: this._cart.map(c => ({
          productId: c.productId,
          name: c.name,
          code: c.code,
          qty: c.qty,
          unitPrice: c.normalPrice,
          agreedPrice: c.salePrice,
          discountAmount: Math.max(0, c.normalPrice - c.salePrice),
          costPrice: c.costPrice,
          subtotal: c.subtotal
        })),
        subtotal,
        discountTotal,
        total,
        realProfit,
        paymentMethod,
        notes,
        status: 'editada',
        editedAt: Utils.nowISO()
      };

      DB.update('sales', this._editingSaleId, updatedSale);

      // Audit movement log
      this._cart.forEach(c => {
        DB.logMovement({ productId: c.productId, productName: c.name, qty: -c.qty, type: 'Edición Venta', reason: `Edición Venta ${oldSale.invoiceNumber}`, value: total });
      });

      Utils.showToast(`Venta ${oldSale.invoiceNumber} modificada correctamente`, 'success');
      this._cancelEdit();
    } else {
      // CREATE NEW SALE
      const invoiceNumber = Utils.buildInvoiceNum();
      const saleId = Utils.generateId('sale');

      const sale = {
        id: saleId,
        invoiceNumber,
        date: Utils.today(),
        datetime: Utils.nowISO(),
        customerId: cust ? cust.id : null,
        customerName,
        items: this._cart.map(c => ({
          productId: c.productId,
          name: c.name,
          code: c.code,
          qty: c.qty,
          unitPrice: c.normalPrice,
          agreedPrice: c.salePrice,
          discountAmount: Math.max(0, c.normalPrice - c.salePrice),
          costPrice: c.costPrice,
          subtotal: c.subtotal
        })),
        subtotal,
        discountTotal,
        taxRate: 0,
        taxAmount: 0,
        total,
        realProfit,
        paymentMethod,
        status: 'pagada',
        payments: [{
          id: Utils.generateId('pay'),
          datetime: Utils.nowISO(),
          date: Utils.today(),
          amount: total,
          method: paymentMethod,
          notes: 'Pago completo al registrar la venta',
          balanceBefore: total,
          balanceAfter: 0
        }],
        totalPaid: total,
        totalPending: 0,
        paidAt: Utils.nowISO(),
        stockDeducted: true,
        notes
      };

      DB.add('sales', sale);

      // Deduct Stock & Log Movement
      for (const item of this._cart) {
        const p = DB.findById('products', item.productId);
        if (p) {
          DB.deductStock(item.productId, item.qty);
          DB.logMovement({ productId: p.id, productName: p.name, qty: -item.qty, type: 'Venta', reason: `Venta ${invoiceNumber}`, value: total });
        }
      }

      // Cash Movement (Registers actual real paid total)
      DB.add('cash_movements', {
        id: Utils.generateId('cash'),
        date: Utils.today(),
        datetime: Utils.nowISO(),
        type: 'ingreso',
        concept: `Venta ${invoiceNumber} (${customerName})`,
        amount: total,
        reference: saleId
      });

      Utils.showToast(`Venta ${invoiceNumber} registrada por ${Utils.formatCurrency(total)}`, 'success');

      if (Utils.confirm('¿Desea imprimir la factura ahora?')) {
        if (window.PrintModule) window.PrintModule.printInvoice(saleId);
      }
    }

    this._cart = [];
    document.getElementById('sale-notes').value = '';
    this._renderCart();
    this._renderProducts();
    this._renderStats();
    this._renderSalesTable();
  },

  _renderSalesTable() {
    const tbody = document.getElementById('sales-tbody');
    if (!tbody) return;

    let sales = this._getFilteredSales();
    const search = (document.getElementById('sales-table-search')?.value || '').toLowerCase();

    if (search) {
      sales = sales.filter(s =>
        s.invoiceNumber.toLowerCase().includes(search) ||
        s.customerName.toLowerCase().includes(search)
      );
    }

    if (sales.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10">${Utils.emptyState('No hay ventas registradas para este filtro', '🧾')}</td></tr>`;
      return;
    }

    tbody.innerHTML = sales.slice().reverse().map(s => {
      const itemsCount = (s.items || []).reduce((acc, it) => acc + (it.qty || 1), 0);
      const discount = s.discountTotal || 0;
      const profit = s.realProfit !== undefined ? s.realProfit : Math.max(0, s.total - (s.items||[]).reduce((a,it)=>a+((it.qty||1)*(it.costPrice||0)),0));

      return `
      <tr>
        <td><strong>${Utils.escHtml(s.invoiceNumber)}</strong></td>
        <td>${Utils.formatDatetime(s.datetime)}</td>
        <td><strong>${Utils.escHtml(s.customerName)}</strong></td>
        <td>${itemsCount} und</td>
        <td class="text-danger font-bold">${discount > 0 ? '-' + Utils.formatCurrency(discount) : '-'}</td>
        <td class="text-accent font-bold">${Utils.formatCurrency(s.total)}</td>
        <td class="text-success font-bold">${Utils.formatCurrency(profit)}</td>
        <td><small>${Utils.escHtml(s.paymentMethod||'efectivo').toUpperCase()}</small></td>
        <td>${Utils.statusBadge(s.status)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-secondary" title="Ver" onclick="Modules.sales._viewSale('${s.id}')">👁️</button>
          ${s.status !== 'anulada' ? `
            <button class="btn btn-sm btn-warning" title="Editar Venta" onclick="Modules.sales._editSale('${s.id}')">✏️</button>
            <button class="btn btn-sm btn-info" title="Imprimir / PDF" onclick="if(window.PrintModule)PrintModule.printInvoice('${s.id}')">🖨️</button>
            <button class="btn btn-sm btn-danger" title="Anular Venta" onclick="Modules.sales._annulSale('${s.id}')">🚫</button>
          ` : ''}
        </td>
      </tr>`;
    }).join('');
  },

  _editSale(saleId) {
    const sale = DB.findById('sales', saleId);
    if (!sale) return;
    this._editingSaleId = saleId;

    document.getElementById('pos-cart-title').textContent = `✏️ Editando ${sale.invoiceNumber}`;
    document.getElementById('pos-invoice-num').textContent = sale.invoiceNumber;
    document.getElementById('sale-customer').value = sale.customerName;
    document.getElementById('sale-payment').value = sale.paymentMethod || 'efectivo';
    document.getElementById('sale-notes').value = sale.notes || '';
    document.getElementById('btn-confirm-sale').textContent = `💾 Guardar Cambios en Venta`;
    document.getElementById('btn-cancel-edit-sale').style.display = 'block';

    // Populate cart with sale items
    this._cart = sale.items.map(it => {
      const p = DB.findById('products', it.productId);
      const agreed = it.agreedPrice || (it.unitPrice - (it.discountAmount||0));
      return {
        productId: it.productId,
        name: it.name,
        code: it.code || '',
        qty: it.qty,
        normalPrice: it.unitPrice || (p ? p.salePrice : 0),
        salePrice: agreed,
        costPrice: it.costPrice || 0,
        discountAmount: it.discountAmount || 0,
        subtotal: it.subtotal,
        maxStock: (p ? p.stock : 0) + it.qty
      };
    });

    this._renderCart();
    window.scrollTo({ top: 300, behavior: 'smooth' });
    Utils.showToast(`Modo edición activado para ${sale.invoiceNumber}`, 'info');
  },

  _cancelEdit() {
    this._editingSaleId = null;
    this._cart = [];
    document.getElementById('pos-cart-title').textContent = `🛒 Carrito de Venta`;
    const settings = DB.getSettings();
    document.getElementById('pos-invoice-num').textContent = `${settings.invoicePrefix || 'FAC'}-${Utils.pad(DB.getInvoiceCounter())}`;
    document.getElementById('btn-confirm-sale').textContent = `✅ Confirmar Venta`;
    document.getElementById('btn-cancel-edit-sale').style.display = 'none';
    document.getElementById('sale-notes').value = '';
    this._renderCart();
  },

  _savePending() {
    if (this._cart.length === 0) { Utils.showToast('El carrito está vacío', 'error'); return; }

    const subtotal = this._cart.reduce((a,c) => a + (c.qty * c.normalPrice), 0);
    const total = this._cart.reduce((a,c) => a + c.subtotal, 0);
    const discountTotal = Math.max(0, subtotal - total);

    const customerName = document.getElementById('sale-customer').value.trim() || 'Cliente General / Consumidor Final';
    const paymentMethod = document.getElementById('sale-payment').value;
    const notes = document.getElementById('sale-notes').value.trim();

    const invoiceNumber = Utils.buildInvoiceNum();
    const saleId = Utils.generateId('sale');

    const sale = {
      id: saleId,
      invoiceNumber,
      date: Utils.today(),
      datetime: Utils.nowISO(),
      customerId: null,
      customerName,
      items: this._cart.map(c => ({
        productId: c.productId,
        name: c.name,
        code: c.code,
        qty: c.qty,
        unitPrice: c.normalPrice,
        agreedPrice: c.salePrice,
        discountAmount: Math.max(0, c.normalPrice - c.salePrice),
        costPrice: c.costPrice,
        subtotal: c.subtotal
      })),
      subtotal,
      discountTotal,
      taxRate: 0,
      taxAmount: 0,
      total,
      realProfit: 0,
      paymentMethod,
      status: 'pendiente',
      payments: [],
      totalPaid: 0,
      totalPending: total,
      stockDeducted: false,
      deliveryStatus: 'no_retirado',
      notes
    };

    DB.add('sales', sale);

    this._cart = [];
    this._renderCart();
    Utils.showToast(`Factura ${invoiceNumber} guardada como PENDIENTE. El stock NO fue descontado.`, 'warning');
    this._renderStats();
    this._renderSalesTable();
  },

  _saveAdvance() {
    if (this._cart.length === 0) { Utils.showToast('El carrito está vacío', 'error'); return; }

    const subtotal = this._cart.reduce((a,c) => a + (c.qty * c.normalPrice), 0);
    const total = this._cart.reduce((a,c) => a + c.subtotal, 0);
    const discountTotal = Math.max(0, subtotal - total);

    const customerName = document.getElementById('sale-customer').value.trim() || 'Cliente General / Consumidor Final';
    const paymentMethod = document.getElementById('sale-payment').value;
    const notes = document.getElementById('sale-notes').value.trim();

    const defaultAdvance = Math.min(total, total * 0.5);
    const advanceInput = window.prompt(`¿Cuánto desea registrar como abono inicial?`, String(defaultAdvance));
    if (advanceInput === null) return;

    const advanceAmount = parseFloat(advanceInput);
    if (!Number.isFinite(advanceAmount) || advanceAmount <= 0) {
      Utils.showToast('Ingresa un abono inicial válido mayor a cero.', 'error');
      return;
    }

    if (advanceAmount > total + 0.01) {
      Utils.showToast(`El abono no puede superar el total de la venta (${Utils.formatCurrency(total)}).`, 'error');
      return;
    }

    const invoiceNumber = Utils.buildInvoiceNum();
    const saleId = Utils.generateId('sale');
    const normalizedPaid = Math.min(total, advanceAmount);
    const normalizedPending = Math.max(0, total - normalizedPaid);
    const isFullyPaid = normalizedPending < 0.01;

    const sale = {
      id: saleId,
      invoiceNumber,
      date: Utils.today(),
      datetime: Utils.nowISO(),
      customerId: null,
      customerName,
      items: this._cart.map(c => ({
        productId: c.productId,
        name: c.name,
        code: c.code,
        qty: c.qty,
        unitPrice: c.normalPrice,
        agreedPrice: c.salePrice,
        discountAmount: Math.max(0, c.normalPrice - c.salePrice),
        costPrice: c.costPrice,
        subtotal: c.subtotal
      })),
      subtotal,
      discountTotal,
      taxRate: 0,
      taxAmount: 0,
      total,
      realProfit: 0,
      paymentMethod,
      status: isFullyPaid ? 'pagada' : 'con_abono',
      payments: [{
        id: Utils.generateId('pay'),
        datetime: Utils.nowISO(),
        date: Utils.today(),
        amount: normalizedPaid,
        method: paymentMethod,
        notes: notes ? `Abono inicial — ${notes}` : 'Abono inicial',
        balanceBefore: total,
        balanceAfter: normalizedPending
      }],
      totalPaid: normalizedPaid,
      totalPending: normalizedPending,
      paidAt: isFullyPaid ? Utils.nowISO() : null,
      stockDeducted: isFullyPaid,
      deliveryStatus: isFullyPaid ? 'retirada' : 'no_retirado',
      notes
    };

    DB.add('sales', sale);

    if (isFullyPaid) {
      for (const item of this._cart) {
        const p = DB.findById('products', item.productId);
        if (p) {
          DB.deductStock(item.productId, item.qty);
          DB.logMovement({ productId: p.id, productName: p.name, qty: -item.qty, type: 'Venta', reason: `Venta ${invoiceNumber} (abono inicial completo)`, value: total });
        }
      }
    }

    DB.add('cash_movements', {
      id: Utils.generateId('cash'),
      date: Utils.today(),
      datetime: Utils.nowISO(),
      type: 'ingreso',
      concept: `${isFullyPaid ? 'Pago completo' : 'Abono inicial'} Factura ${invoiceNumber} — ${customerName}`,
      amount: normalizedPaid,
      method: paymentMethod,
      reference: saleId
    });

    this._cart = [];
    this._renderCart();
    this._renderProducts();
    this._renderStats();
    this._renderSalesTable();
    Utils.showToast(
      isFullyPaid
        ? `Factura ${invoiceNumber} registrada y pagada con abono inicial por ${Utils.formatCurrency(normalizedPaid)}.`
        : `Factura ${invoiceNumber} guardada como ABONO inicial. Saldo pendiente: ${Utils.formatCurrency(normalizedPending)}.`,
      isFullyPaid ? 'success' : 'info'
    );
  },

  _annulSale(saleId) {
    const sale = DB.findById('sales', saleId);
    if (!sale || sale.status === 'anulada') return;

    if (!Utils.confirm(`¿Está seguro de ANULAR la venta ${sale.invoiceNumber}? El inventario y dinero en caja serán revertidos.`)) return;

    const paidAmount = sale.totalPaid != null
      ? sale.totalPaid
      : (sale.status === 'pendiente' ? 0 : sale.total);

    // Restore inventory only when the sale had already reserved stock.
    const stockWasDeducted = sale.stockDeducted ||
      (!['pendiente', 'con_abono'].includes(sale.status) && paidAmount > 0);
    if (stockWasDeducted) sale.items.forEach(it => {
      const p = DB.findById('products', it.productId);
      if (p) {
        DB.restoreStock(it.productId, it.qty);
        DB.logMovement({ productId: it.productId, productName: it.name, qty: it.qty, type: 'Anulación Venta', reason: `Anulación de Venta ${sale.invoiceNumber}`, value: paidAmount });
      }
    });

    // Reverse only the money actually received from this invoice.
    if (paidAmount > 0) DB.add('cash_movements', {
      id: Utils.generateId('cash'),
      date: Utils.today(),
      datetime: Utils.nowISO(),
      type: 'egreso',
      concept: `Anulación Venta ${sale.invoiceNumber}`,
      amount: paidAmount,
      reference: saleId
    });

    DB.update('sales', saleId, { status: 'anulada' });
    Utils.showToast(`Venta ${sale.invoiceNumber} anulada correctamente`, 'warning');

    this._renderStats();
    this._renderSalesTable();
    this._renderProducts();
  },

  _viewSale(saleId) {
    const sale = DB.findById('sales', saleId);
    if (!sale) return;

    let html = `
    <div class="grid-2 mb-16">
      <div>
        <p><strong>Nº Factura:</strong> <strong class="text-accent">${Utils.escHtml(sale.invoiceNumber)}</strong></p>
        <p><strong>Cliente:</strong> ${Utils.escHtml(sale.customerName)}</p>
        <p><strong>Fecha / Hora:</strong> ${Utils.formatDatetime(sale.datetime)}</p>
      </div>
      <div>
        <p><strong>Método de Pago:</strong> ${Utils.escHtml(sale.paymentMethod||'efectivo').toUpperCase()}</p>
        <p><strong>Estado:</strong> ${Utils.statusBadge(sale.status)}</p>
        <p><strong>Ganancia Real:</strong> <strong class="text-success">${Utils.formatCurrency(sale.realProfit||0)}</strong></p>
      </div>
    </div>
    <div class="section-title">Productos Vendidos</div>
    <table class="table mb-16">
      <thead>
        <tr><th>Producto</th><th>Cant</th><th>Precio Normal</th><th>Precio Acordado</th><th>Rebaja</th><th>Subtotal</th></tr>
      </thead>
      <tbody>
        ${(sale.items||[]).map(it => {
          const agreed = it.agreedPrice || (it.unitPrice - (it.discountAmount||0));
          const rebaja = Math.max(0, it.unitPrice - agreed);
          return `
          <tr>
            <td><strong>${Utils.escHtml(it.name)}</strong></td>
            <td>${it.qty}</td>
            <td>${Utils.formatCurrency(it.unitPrice)}</td>
            <td class="font-bold text-accent">${Utils.formatCurrency(agreed)}</td>
            <td class="text-danger">${rebaja > 0 ? '-' + Utils.formatCurrency(rebaja) : '-'}</td>
            <td class="font-bold text-accent">${Utils.formatCurrency(it.subtotal)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="text-align:right;font-size:20px;font-weight:900;color:var(--accent)">
      Total Pagado: ${Utils.formatCurrency(sale.total)}
    </div>`;

    document.getElementById('view-sale-modal-body').innerHTML = html;
    Utils.openModal('viewSaleModal');
  }
};
