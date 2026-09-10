/* =============================================
   FERRETERÍA EL BULE — Módulo Facturación (invoices.js)
   Estados: pendiente, con_abono, pagada, pagada_no_retirada, retirada, anulada
   Abonos parciales, historial completo, filtros, exportar CSV
   ============================================= */

window.Modules = window.Modules || {};
window.Modules.invoices = {

  render() {
    const sales = DB.getAll('sales');
    const totalInvoices = sales.length;
    const totalRevenue = sales.filter(s => s.status !== 'anulada' && s.status !== 'pendiente').reduce((a,s) => a + (s.totalPaid || s.total), 0);
    const pending = sales.filter(s => s.status === 'pendiente' || s.status === 'con_abono').length;
    const annulled = sales.filter(s => s.status === 'anulada').length;
    const pendingBalance = sales
      .filter(s => s.status === 'pendiente' || s.status === 'con_abono')
      .reduce((a, s) => a + (s.totalPending != null ? s.totalPending : s.total), 0);

    return `
    <!-- Tarjetas de Resumen -->
    <div class="grid-4 mb-24">
      <div class="stat-card">
        <div class="stat-icon blue">📄</div>
        <div class="stat-info"><div class="stat-label">Total Facturas</div><div class="stat-value">${totalInvoices}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">💰</div>
        <div class="stat-info"><div class="stat-label">Total Recaudado</div><div class="stat-value success">${Utils.formatCurrency(totalRevenue)}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">🕐</div>
        <div class="stat-info"><div class="stat-label">Pendientes / Abonadas</div><div class="stat-value warning">${pending}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">⚠️</div>
        <div class="stat-info"><div class="stat-label">Saldo Pendiente Total</div><div class="stat-value danger">${Utils.formatCurrency(pendingBalance)}</div></div>
      </div>
    </div>

    <!-- Filtros Rápidos por Estado -->
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;align-items:center">
      <span style="font-weight:700;font-size:13px;color:var(--text-muted)">Filtrar por estado:</span>
      <button class="btn btn-sm btn-secondary inv-status-filter active" data-status="">📋 Todos</button>
      <button class="btn btn-sm btn-secondary inv-status-filter" data-status="pendiente">🟡 Pendientes</button>
      <button class="btn btn-sm btn-secondary inv-status-filter" data-status="con_abono">🟠 Con Abono</button>
      <button class="btn btn-sm btn-secondary inv-status-filter" data-status="pagada">🟢 Pagadas</button>
      <button class="btn btn-sm btn-secondary inv-status-filter" data-status="pagada_no_retirada">🔵 Pagadas · No Retiradas</button>
      <button class="btn btn-sm btn-secondary inv-status-filter" data-status="retirada">⚫ Retiradas</button>
      <button class="btn btn-sm btn-secondary inv-status-filter" data-status="anulada">🔴 Anuladas</button>
    </div>

    <!-- Filtros de Búsqueda y Fecha -->
    <div class="filters-bar mb-16">
      <div class="search-box"><input type="text" id="inv-search" placeholder="Buscar por # factura o cliente..."></div>
      <input type="date" class="form-control" id="inv-from" style="width:150px" title="Desde">
      <input type="date" class="form-control" id="inv-to" style="width:150px" title="Hasta">
      <button class="btn btn-secondary" id="btn-export-invoices">📤 Exportar CSV</button>
    </div>

    <!-- Tabla Principal -->
    <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Nº Factura</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Productos</th>
            <th>Total</th>
            <th>Abonado</th>
            <th>Saldo</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="invoices-tbody"></tbody>
      </table>
    </div></div></div>

    <!-- Modal Detalle de Factura -->
    <div class="modal" id="invoiceDetailModal" style="display:none">
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3 id="invoice-detail-title">Detalle de Factura</h3>
          <button class="modal-close" onclick="Utils.closeModal('invoiceDetailModal')">✕</button>
        </div>
        <div class="modal-body" id="invoice-detail-body"></div>
        <div class="modal-footer" id="invoice-detail-footer"></div>
      </div>
    </div>

    <!-- Modal Registrar Abono -->
    <div class="modal" id="abonoModal" style="display:none">
      <div class="modal-content" style="max-width:480px">
        <div class="modal-header">
          <h3>💵 Registrar Abono / Pago</h3>
          <button class="modal-close" onclick="Utils.closeModal('abonoModal')">✕</button>
        </div>
        <div class="modal-body" id="abono-modal-body">
          <input type="hidden" id="abono-sale-id">
          <div class="form-group mb-12">
            <label class="form-label">Monto del Abono ($ COP) *</label>
            <input type="number" class="form-control" id="abono-amount" min="1" step="100" placeholder="Ej: 50000">
          </div>
          <div class="form-group mb-12">
            <label class="form-label">Método de Pago</label>
            <select class="form-select" id="abono-method">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>
          <div class="form-group mb-12">
            <label class="form-label">Observación (opcional)</label>
            <input class="form-control" id="abono-notes" placeholder="Ej: Primer abono">
          </div>
          <div id="abono-summary" style="background:var(--bg-input);border-radius:8px;padding:12px;font-size:13px"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal('abonoModal')">Cancelar</button>
          <button class="btn btn-primary" id="btn-confirm-abono">✅ Registrar Abono</button>
        </div>
      </div>
    </div>`;
  },

  _currentStatusFilter: '',

  init() {
    this._currentStatusFilter = '';
    this._renderTable();

    document.getElementById('inv-search')?.addEventListener('input', Utils.debounce(() => this._renderTable()));
    document.getElementById('inv-from')?.addEventListener('change', () => this._renderTable());
    document.getElementById('inv-to')?.addEventListener('change', () => this._renderTable());
    document.getElementById('btn-export-invoices')?.addEventListener('click', () => this._export());

    // Filtros rápidos de estado
    document.querySelectorAll('.inv-status-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.inv-status-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._currentStatusFilter = btn.dataset.status;
        this._renderTable();
      });
    });
  },

  _renderTable() {
    let sales = DB.getAll('sales');
    const search = (document.getElementById('inv-search')?.value || '').toLowerCase();
    const from   = document.getElementById('inv-from')?.value || '';
    const to     = document.getElementById('inv-to')?.value || '';
    const status = this._currentStatusFilter;

    if (search) sales = sales.filter(s =>
      (s.invoiceNumber || '').toLowerCase().includes(search) ||
      (s.customerName || '').toLowerCase().includes(search)
    );
    if (from) sales = sales.filter(s => s.date >= from);
    if (to)   sales = sales.filter(s => s.date <= to);
    if (status) sales = sales.filter(s => s.status === status);

    const tbody = document.getElementById('invoices-tbody');
    if (!tbody) return;

    if (sales.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9">${Utils.emptyState('No se encontraron facturas con los filtros seleccionados', '📄')}</td></tr>`;
      return;
    }

    tbody.innerHTML = sales.slice().reverse().map(s => {
      const totalPaid    = s.totalPaid != null ? s.totalPaid : (s.status === 'pendiente' ? 0 : s.total);
      const totalPending = s.totalPending != null ? s.totalPending : (s.status === 'pendiente' ? s.total : 0);
      const isPending    = s.status === 'pendiente' || s.status === 'con_abono';
      const canAnnul     = s.status !== 'anulada' && s.status !== 'retirada';

      return `
      <tr>
        <td><strong>${Utils.escHtml(s.invoiceNumber)}</strong></td>
        <td style="white-space:nowrap;font-size:12px">${Utils.formatDatetime(s.datetime)}</td>
        <td><strong>${Utils.escHtml(s.customerName)}</strong></td>
        <td style="font-size:12px">${(s.items||[]).reduce((a,it) => a+(it.qty||1), 0)} und<br><small style="color:var(--text-muted)">${(s.items||[]).length} prod.</small></td>
        <td class="text-accent font-bold">${Utils.formatCurrency(s.total)}</td>
        <td class="${totalPaid >= s.total ? 'text-success' : 'text-warning'} font-bold">${Utils.formatCurrency(totalPaid)}</td>
        <td class="${totalPending > 0 ? 'text-danger' : 'text-success'} font-bold">${totalPending > 0 ? Utils.formatCurrency(totalPending) : '—'}</td>
        <td>${Utils.statusBadge(s.status)}</td>
        <td class="actions" style="min-width:200px">
          <button class="btn btn-sm btn-secondary" onclick="Modules.invoices._viewDetail('${s.id}')" title="Ver detalle completo">👁️</button>
          ${s.status !== 'anulada' ? `<button class="btn btn-sm btn-info" onclick="if(window.PrintModule)PrintModule.printInvoice('${s.id}')" title="Imprimir / PDF">🖨️</button>` : ''}
          ${isPending ? `<button class="btn btn-sm btn-success" onclick="Modules.invoices._openAbono('${s.id}')" title="Registrar abono o pago">💵 Abonar</button>` : ''}
          ${s.status === 'pagada' ? `<button class="btn btn-sm btn-warning" onclick="Modules.invoices._markNotPickedUp('${s.id}')" title="Marcar como pagada pero no retirada">📦 No retirada</button>` : ''}
          ${s.status === 'pagada_no_retirada' ? `<button class="btn btn-sm btn-success" onclick="Modules.invoices._markDelivered('${s.id}')" title="Marcar como retirada/entregada">✅ Entregar</button>` : ''}
          ${canAnnul ? `<button class="btn btn-sm btn-danger" onclick="Modules.invoices._annul('${s.id}')" title="Anular factura">🚫</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  },

  _viewDetail(id) {
    const s = DB.findById('sales', id);
    if (!s) return;

    const totalPaid    = s.totalPaid != null ? s.totalPaid : (s.status === 'pendiente' ? 0 : s.total);
    const totalPending = s.totalPending != null ? s.totalPending : (s.status === 'pendiente' ? s.total : 0);
    const payments     = s.payments || [];
    const isPending    = s.status === 'pendiente' || s.status === 'con_abono';
    const canAnnul     = s.status !== 'anulada' && s.status !== 'retirada';

    let html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px">
      <div>
        <p><strong>Nº Factura:</strong> ${Utils.escHtml(s.invoiceNumber)}</p>
        <p><strong>Fecha:</strong> ${Utils.formatDatetime(s.datetime)}</p>
        ${s.paidAt ? `<p><strong>Último pago:</strong> ${Utils.formatDatetime(s.paidAt)}</p>` : ''}
        <p><strong>Cliente:</strong> ${Utils.escHtml(s.customerName)}</p>
        <p><strong>Pago:</strong> ${Utils.escHtml(s.paymentMethod || 'efectivo').toUpperCase()}</p>
      </div>
      <div>
        <p><strong>Estado:</strong> ${Utils.statusBadge(s.status)}</p>
        <p><strong>Total Factura:</strong> <span style="font-size:18px;font-weight:900;color:var(--accent)">${Utils.formatCurrency(s.total)}</span></p>
        <p><strong>Total Abonado:</strong> <span style="font-size:16px;font-weight:800;color:${totalPaid >= s.total ? 'var(--success)' : '#f59e0b'}">${Utils.formatCurrency(totalPaid)}</span></p>
        ${totalPending > 0 ? `<p><strong>Saldo Pendiente:</strong> <span style="font-size:16px;font-weight:800;color:var(--danger)">${Utils.formatCurrency(totalPending)}</span></p>` : '<p style="color:var(--success);font-weight:800">✅ Factura 100% pagada</p>'}
        ${s.notes ? `<p><strong>Notas:</strong> ${Utils.escHtml(s.notes)}</p>` : ''}
      </div>
    </div>

    <div class="section-title mb-8">📦 Productos en la Factura</div>
    <table class="table mb-16">
      <thead><tr><th>Producto</th><th>Código</th><th>Cant.</th><th>Precio Unit.</th><th>Precio Acordado</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${(s.items||[]).map(it => `
          <tr>
            <td><strong>${Utils.escHtml(it.name)}</strong></td>
            <td>${Utils.escHtml(it.code||'—')}</td>
            <td>${it.qty}</td>
            <td>${Utils.formatCurrency(it.unitPrice||it.agreedPrice)}</td>
            <td class="${(it.agreedPrice < it.unitPrice) ? 'text-warning' : ''} font-bold">${Utils.formatCurrency(it.agreedPrice)}</td>
            <td class="text-accent font-bold">${Utils.formatCurrency(it.subtotal)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;gap:20px;padding:10px 0 16px;border-top:1px solid var(--border);font-size:13px">
      ${(s.discountTotal||0) > 0 ? `<span>Rebaja: <strong class="text-danger">-${Utils.formatCurrency(s.discountTotal)}</strong></span>` : ''}
      <span>Total: <strong class="text-accent" style="font-size:18px">${Utils.formatCurrency(s.total)}</strong></span>
    </div>`;

    if (payments.length > 0) {
      html += `
      <div class="section-title mb-8">💵 Historial de Pagos y Abonos</div>
      <table class="table mb-16">
        <thead><tr><th>Fecha/Hora</th><th>Monto</th><th>Método</th><th>Saldo Anterior</th><th>Saldo Restante</th><th>Nota</th></tr></thead>
        <tbody>
          ${payments.map(p => `
            <tr>
              <td style="font-size:12px">${Utils.formatDatetime(p.datetime)}</td>
              <td class="text-success font-bold">+${Utils.formatCurrency(p.amount)}</td>
              <td>${Utils.escHtml(p.method||'efectivo').toUpperCase()}</td>
              <td class="text-danger">${Utils.formatCurrency(p.balanceBefore)}</td>
              <td class="${p.balanceAfter <= 0 ? 'text-success' : 'text-warning'} font-bold">${p.balanceAfter <= 0 ? '✅ Saldado' : Utils.formatCurrency(p.balanceAfter)}</td>
              <td style="font-size:11px">${Utils.escHtml(p.notes||'—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    } else if (s.status === 'pendiente') {
      html += `<div style="background:#fef3c7;border:1px solid #f59e0b;padding:12px 16px;border-radius:8px;color:#92400e;font-size:13px;margin-bottom:12px">
        🕐 <strong>Factura pendiente:</strong> No se ha registrado ningún pago todavía.
        El stock del inventario <strong>NO ha sido descontado</strong> hasta completar el pago.
      </div>`;
    }

    document.getElementById('invoice-detail-title').textContent = `Factura ${s.invoiceNumber}`;
    document.getElementById('invoice-detail-body').innerHTML = html;

    // Footer con acciones contextuales
    let footerHtml = '';
    if (s.status !== 'anulada') {
      footerHtml += `<button class="btn btn-info" onclick="if(window.PrintModule)PrintModule.printInvoice('${s.id}')">🖨️ Imprimir</button>`;
    }
    if (isPending) {
      footerHtml += `<button class="btn btn-success" onclick="Utils.closeModal('invoiceDetailModal');Modules.invoices._openAbono('${s.id}')">💵 Registrar Abono</button>`;
    }
    if (s.status === 'pagada') {
      footerHtml += `<button class="btn btn-warning" onclick="Modules.invoices._markNotPickedUp('${s.id}');Utils.closeModal('invoiceDetailModal')">📦 Marcar No Retirada</button>`;
    }
    if (s.status === 'pagada_no_retirada') {
      footerHtml += `<button class="btn btn-success" onclick="Modules.invoices._markDelivered('${s.id}');Utils.closeModal('invoiceDetailModal')">✅ Marcar Entregada</button>`;
    }
    if (canAnnul) {
      footerHtml += `<button class="btn btn-danger" onclick="Utils.closeModal('invoiceDetailModal');Modules.invoices._annul('${s.id}')">🚫 Anular Factura</button>`;
    }
    footerHtml += `<button class="btn btn-secondary" onclick="Utils.closeModal('invoiceDetailModal')">Cerrar</button>`;
    document.getElementById('invoice-detail-footer').innerHTML = footerHtml;

    Utils.openModal('invoiceDetailModal');
  },

  _openAbono(saleId) {
    const s = DB.findById('sales', saleId);
    if (!s) return;

    const totalPending = s.totalPending != null ? s.totalPending : s.total;

    document.getElementById('abono-sale-id').value = saleId;
    document.getElementById('abono-amount').value = '';
    document.getElementById('abono-notes').value = '';
    document.getElementById('abono-summary').innerHTML = `
      <div style="margin-bottom:6px"><strong>Factura:</strong> ${Utils.escHtml(s.invoiceNumber)} — ${Utils.escHtml(s.customerName)}</div>
      <div style="margin-bottom:6px"><strong>Total factura:</strong> ${Utils.formatCurrency(s.total)}</div>
      <div style="margin-bottom:6px"><strong>Total abonado:</strong> ${Utils.formatCurrency(s.totalPaid || 0)}</div>
      <div style="font-size:15px;font-weight:900;color:var(--danger)"><strong>Saldo pendiente:</strong> ${Utils.formatCurrency(totalPending)}</div>
    `;

    // Bind confirm button fresh each time
    const btn = document.getElementById('btn-confirm-abono');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => this._confirmAbono());

    Utils.openModal('abonoModal');
  },

  _confirmAbono() {
    const saleId = document.getElementById('abono-sale-id').value;
    const amount = parseFloat(document.getElementById('abono-amount').value) || 0;
    const method = document.getElementById('abono-method').value;
    const notes  = document.getElementById('abono-notes').value.trim();

    if (!amount || amount <= 0) {
      Utils.showToast('Ingresa un monto válido para el abono', 'error');
      return;
    }

    const s = DB.findById('sales', saleId);
    if (!s) return;

    const previousBalance = s.totalPending != null ? s.totalPending : s.total;

    if (amount > previousBalance + 0.01) {
      Utils.showToast(`El abono (${Utils.formatCurrency(amount)}) supera el saldo pendiente (${Utils.formatCurrency(previousBalance)})`, 'error');
      return;
    }

    const prevPaid    = s.totalPaid || 0;
    const newTotalPaid = prevPaid + amount;
    const newPending   = Math.max(0, previousBalance - amount);
    const isFullyPaid  = newPending < 0.01;

    if (isFullyPaid && (s.status === 'pendiente' || s.status === 'con_abono')) {
      const unavailable = (s.items || []).find(item => {
        const product = DB.findById('products', item.productId);
        return !product || product.stock < item.qty;
      });
      if (unavailable) {
        const product = DB.findById('products', unavailable.productId);
        Utils.showToast(`Stock insuficiente para "${unavailable.name}" (hay ${product ? product.stock : 0}, necesita ${unavailable.qty}). Ajusta el inventario antes de completar el pago.`, 'error');
        return;
      }
    }

    const payments = s.payments || [];
    payments.push({
      id: Utils.generateId('pay'),
      datetime: Utils.nowISO(),
      date: Utils.today(),
      amount,
      method,
      notes,
      balanceBefore: previousBalance,
      balanceAfter: newPending
    });

    let newStatus = s.status;
    let stockDiscounted = false;

    if (isFullyPaid) {
      newStatus = 'pagada';
      // Al pagar completo: descontar stock del inventario y registrar en caja
      if (s.status === 'pendiente' || s.status === 'con_abono') {
        (s.items || []).forEach(it => {
          const p = DB.findById('products', it.productId);
          if (p) {
            DB.deductStock(it.productId, it.qty);
            DB.logMovement({ productId: p.id, productName: p.name, qty: -it.qty, type: 'Venta', reason: `Venta ${s.invoiceNumber} (pago completado)`, value: s.total });
          }
        });
        stockDiscounted = true;
      }
    } else {
      newStatus = 'con_abono';
    }

    DB.update('sales', saleId, {
      status: newStatus,
      payments,
      totalPaid: newTotalPaid,
      totalPending: newPending,
      realProfit: Math.max(0, newTotalPaid - (s.items||[]).reduce((a,it) => a + (it.qty*(it.costPrice||0)), 0) * (newTotalPaid / s.total)),
      ...(isFullyPaid ? { paidAt: Utils.nowISO(), stockDeducted: true } : {})
    });

    // Registrar en caja
    DB.add('cash_movements', {
      id: Utils.generateId('cash'),
      date: Utils.today(),
      datetime: Utils.nowISO(),
      type: 'ingreso',
      concept: `${isFullyPaid ? 'Pago completo' : 'Abono'} Factura ${s.invoiceNumber} — ${s.customerName}`,
      amount,
      method,
      reference: saleId
    });

    Utils.closeModal('abonoModal');

    if (isFullyPaid) {
      Utils.showToast(`✅ Pago completo registrado. Factura ${s.invoiceNumber} ahora está PAGADA.${stockDiscounted ? ' Stock descontado del inventario.' : ''}`, 'success');
    } else {
      Utils.showToast(`💵 Abono de ${Utils.formatCurrency(amount)} registrado. Saldo pendiente: ${Utils.formatCurrency(newPending)}`, 'info');
    }

    this._renderTable();
  },

  _markNotPickedUp(id) {
    DB.update('sales', id, { status: 'pagada_no_retirada', deliveryStatus: 'no_retirado', notPickedUpAt: Utils.nowISO() });
    Utils.showToast('Factura marcada como PAGADA — Pendiente de retiro por el cliente', 'info');
    this._renderTable();
  },

  _markDelivered(id) {
    DB.update('sales', id, { status: 'retirada', deliveryStatus: 'entregada', deliveredAt: Utils.nowISO() });
    Utils.showToast('Mercancía marcada como ENTREGADA / RETIRADA ✅', 'success');
    this._renderTable();
  },

  _annul(id) {
    if (window.Modules.sales && window.Modules.sales._annulSale) {
      window.Modules.sales._annulSale(id);
      this._renderTable();
    }
  },

  _export() {
    const sales = DB.getAll('sales');
    const rows = [['Factura','Fecha','Cliente','Total','Abonado','Saldo','Pago','Estado']];
    sales.forEach(s => rows.push([
      s.invoiceNumber,
      s.date,
      s.customerName,
      s.total,
      s.totalPaid != null ? s.totalPaid : (s.status === 'pendiente' ? 0 : s.total),
      s.totalPending != null ? s.totalPending : 0,
      s.paymentMethod,
      s.status
    ]));
    Utils.downloadCSV(rows, 'facturas_ferreteria_el_bule.csv');
    Utils.showToast('Facturas exportadas a CSV', 'success');
  }
};
