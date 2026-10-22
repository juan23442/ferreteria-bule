/* =============================================
   FERRETERÍA EL BULE — Módulo Caja (cash.js)
   Control de Ingresos, Egresos y Arqueo de Caja en $ COP
   ============================================= */

window.Modules = window.Modules || {};
window.Modules.cash = {
  _cashType: 'ingreso',

  render() {
    const movs = DB.getAll('cash_movements');
    const today = Utils.today();
    const todayMovs = movs.filter(m => Utils.isToday(m.date || m.datetime));
    const todayIn = todayMovs.filter(m => m.type === 'ingreso').reduce((a,m) => a + m.amount, 0);
    const todayOut = todayMovs.filter(m => m.type === 'egreso').reduce((a,m) => a + m.amount, 0);
    const balance = DB.getCashBalance();

    return `
    <div class="balance-display">
      <div class="balance-label">💰 Saldo Actual Disponible en Caja</div>
      <div class="balance-amount">${Utils.formatCurrency(balance)}</div>
    </div>

    <div class="grid-4 mb-24">
      <div class="stat-card"><div class="stat-icon green">📥</div><div class="stat-info"><div class="stat-label">Ingresos Hoy</div><div class="stat-value success">${Utils.formatCurrency(todayIn)}</div></div></div>
      <div class="stat-card"><div class="stat-icon red">📤</div><div class="stat-info"><div class="stat-label">Egresos Hoy</div><div class="stat-value danger">${Utils.formatCurrency(todayOut)}</div></div></div>
      <div class="stat-card"><div class="stat-icon blue">📊</div><div class="stat-info"><div class="stat-label">Balance Neto Hoy</div><div class="stat-value ${todayIn-todayOut>=0?'success':'danger'}">${Utils.formatCurrency(todayIn - todayOut)}</div></div></div>
      <div class="stat-card"><div class="stat-icon yellow">🔢</div><div class="stat-info"><div class="stat-label">Movimientos Hoy</div><div class="stat-value">${todayMovs.length}</div></div></div>
    </div>

    <div class="filters-bar">
      <button class="btn btn-success" id="btn-cash-in">📥 Registrar Ingreso Manual</button>
      <button class="btn btn-danger" id="btn-cash-out">📤 Registrar Egreso / Retiro</button>
      <button class="btn btn-warning" id="btn-cash-arqueo">⚖️ Arqueo de Caja</button>
      <div style="flex:1"></div>
      <input type="date" class="form-control" id="cash-from" style="width:150px" title="Desde">
      <input type="date" class="form-control" id="cash-to" style="width:150px" title="Hasta">
      <button class="btn btn-secondary" id="btn-export-cash">📤 CSV</button>
    </div>

    <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Fecha / Hora</th>
            <th>Tipo</th>
            <th>Concepto / Referencia</th>
            <th>Monto ($ COP)</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="cash-tbody"></tbody>
      </table>
    </div></div></div>

    <!-- Modal Movimiento Manual de Caja -->
    <div class="modal" id="cashModal" style="display:none">
      <div class="modal-content">
        <div class="modal-header"><h3 id="cashModalTitle">Registrar Movimiento en Caja</h3><button class="modal-close" onclick="Utils.closeModal('cashModal')">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Fecha</label><input class="form-control" type="date" id="cash-date" value="${today}"></div>
          <div class="form-group"><label class="form-label">Concepto / Descripción *</label><input class="form-control" id="cash-concept" placeholder="Ej: Base de caja inicial, Retiro para depósito bancario"></div>
          <div class="form-group"><label class="form-label">Monto ($ COP) *</label><input class="form-control" type="number" id="cash-amount" step="100" min="100" placeholder="50000"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal('cashModal')">Cancelar</button>
          <button class="btn btn-primary" id="btn-save-cash">Guardar Movimiento</button>
        </div>
      </div>
    </div>

    <!-- Modal Arqueo de Caja -->
    <div class="modal" id="arqueoModal" style="display:none">
      <div class="modal-content">
        <div class="modal-header"><h3>⚖️ Arqueo y Cierre de Caja</h3><button class="modal-close" onclick="Utils.closeModal('arqueoModal')">✕</button></div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Saldo Esperado en Sistema</label>
            <input class="form-control font-bold text-accent" readonly value="${Utils.formatCurrency(balance)}">
          </div>
          <div class="form-group">
            <label class="form-label">Dinero Físico en Caja ($ COP) *</label>
            <input class="form-control" type="number" id="arqueo-real" step="100" placeholder="Ingrese monto contado" oninput="Modules.cash._calcDiferencia(this.value)">
          </div>
          <div class="form-group">
            <label class="form-label">Diferencia (Sobrante / Faltante)</label>
            <div id="arqueo-dif" class="font-bold" style="font-size:18px">$ 0</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal('arqueoModal')">Cerrar</button>
        </div>
      </div>
    </div>`;
  },

  init() {
    this._renderTable();
    document.getElementById('btn-cash-in')?.addEventListener('click', () => {
      this._cashType = 'ingreso';
      document.getElementById('cashModalTitle').textContent = '📥 Registrar Ingreso Manual a Caja';
      Utils.openModal('cashModal');
    });
    document.getElementById('btn-cash-out')?.addEventListener('click', () => {
      this._cashType = 'egreso';
      document.getElementById('cashModalTitle').textContent = '📤 Registrar Egreso / Retiro de Caja';
      Utils.openModal('cashModal');
    });
    document.getElementById('btn-cash-arqueo')?.addEventListener('click', () => {
      Utils.openModal('arqueoModal');
    });
    document.getElementById('btn-save-cash')?.addEventListener('click', () => this._saveMov());
    document.getElementById('cash-from')?.addEventListener('change', () => this._renderTable());
    document.getElementById('cash-to')?.addEventListener('change', () => this._renderTable());
    document.getElementById('btn-export-cash')?.addEventListener('click', () => this._export());
  },

  _renderTable() {
    let movs = DB.getAll('cash_movements').slice().reverse();
    const from = document.getElementById('cash-from')?.value || '';
    const to = document.getElementById('cash-to')?.value || '';
    if (from) movs = movs.filter(m => m.date >= from);
    if (to)   movs = movs.filter(m => m.date <= to);
    const tbody = document.getElementById('cash-tbody');
    if (!tbody) return;

    if (movs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">${Utils.emptyState('Sin movimientos de caja en este período', '💰')}</td></tr>`;
      return;
    }

    tbody.innerHTML = movs.map(m => {
      const ref = m.reference || '';
      // Etiqueta de origen
      let sourceTag = '';
      if (ref.startsWith('sale_'))  sourceTag = '<span class="badge badge-success"  style="font-size:10px">🧾 Venta</span>';
      else if (ref.startsWith('purch_')) sourceTag = '<span class="badge badge-info"    style="font-size:10px">📦 Compra</span>';
      else if (m.expenseId || ref.startsWith('exp_')) sourceTag = '<span class="badge badge-warning" style="font-size:10px">💸 Gasto</span>';
      else sourceTag = '<span class="badge badge-gray"    style="font-size:10px">✍️ Manual</span>';

      return `
      <tr>
        <td><small>${Utils.formatDatetime(m.datetime)}</small></td>
        <td>
          ${m.type === 'ingreso'
            ? '<span class="badge badge-success">📥 Ingreso</span>'
            : '<span class="badge badge-danger">📤 Egreso</span>'}
          <br><small>${sourceTag}</small>
        </td>
        <td><strong>${Utils.escHtml(m.concept)}</strong></td>
        <td class="${m.type==='ingreso'?'text-success':'text-danger'} font-bold">${m.type==='ingreso'?'+':'-'}${Utils.formatCurrency(m.amount)}</td>
        <td><button class="btn btn-sm btn-danger" title="Eliminar — borra registro, historial y revierte stock si aplica" onclick="Modules.cash._del('${m.id}')">🗑️</button></td>
      </tr>`;
    }).join('');
  },


  _del(id) {
    const movement = DB.findById('cash_movements', id) || DB.getAll('cash_movements').find(item => item.id === id);
    if (!movement) return;

    const ref = movement.reference || '';
    const concept = (movement.concept || '').toLowerCase();

    // Determinar el tipo de movimiento por el prefijo del ID de referencia o por el concepto
    const isSaleRef    = ref.startsWith('sale_');
    const isPurchRef   = ref.startsWith('purch_');
    const isExpenseRef = !!movement.expenseId || ref.startsWith('exp_');

    // Construir descripción detallada para el confirm
    let confirmMsg = `¿Eliminar el movimiento "${movement.concept}"?\n\n`;
    if (isSaleRef)    confirmMsg += '⚠️ Esto ANULARÁ la venta asociada y devolverá el stock al inventario.\n';
    if (isPurchRef)   confirmMsg += '⚠️ Esto ELIMINARÁ la compra asociada y restará el stock que ingresó.\n';
    if (isExpenseRef) confirmMsg += '⚠️ Esto también eliminará el gasto asociado.\n';
    confirmMsg += '\nEl registro desaparecerá por completo de reportes, historial y Dashboard.';

    if (!Utils.confirm(confirmMsg)) return;

    // 1. Eliminar siempre el movimiento de caja
    DB.delete('cash_movements', id);

    // 2. Si referencia a una VENTA → anularla y devolver stock
    if (isSaleRef) {
      const sale = DB.findById('sales', ref);
      if (sale && sale.status !== 'anulada') {
        // Restaurar stock de cada ítem
        (sale.items || []).forEach(it => {
          const p = DB.findById('products', it.productId);
          if (p && sale.stockDeducted !== false) {
            DB.restoreStock(it.productId, it.qty);
            DB.logMovement({
              productId: it.productId,
              productName: it.name,
              qty: it.qty,
              type: 'Anulación desde Caja',
              reason: `Venta ${sale.invoiceNumber} eliminada desde Caja (Stock restaurado)`,
              value: sale.totalPaid || 0
            });
          }
        });
        // Borrar por completo (skipStockRestore=true porque ya restauramos arriba)
        DB.delete('sales', ref, true);
        Utils.showToast(`✅ Venta ${sale.invoiceNumber} eliminada por completo. Stock restaurado.`, 'warning');
      } else if (sale && sale.status === 'anulada') {
        // Si ya estaba anulada solo borramos el registro
        DB.delete('sales', ref);
        Utils.showToast('Movimiento y venta eliminados de Caja.', 'success');
      } else {
        Utils.showToast('Movimiento eliminado de Caja.', 'success');
      }
      const content = document.getElementById('content');
      if (content) { content.innerHTML = this.render(); this.init(); }
      return;
    }

    // 3. Si referencia a una COMPRA → revertir stock y borrar compra
    if (isPurchRef) {
      const purchase = DB.findById('purchases', ref);
      if (purchase) {
        (purchase.items || []).forEach(it => {
          const p = DB.findById('products', it.productId);
          if (p && it.qty > 0) {
            DB.restoreStockReverse(it.productId, it.qty, it.unitCost);
            DB.logMovement({
              productId: it.productId,
              productName: it.name,
              qty: -it.qty,
              type: 'Eliminación Compra desde Caja',
              reason: `Compra eliminada — ${purchase.supplierName} (Stock revertido)`,
              value: it.subtotal || 0
            });
          }
        });
        DB.delete('purchases', ref);
        Utils.showToast('✅ Compra eliminada por completo. Stock revertido.', 'warning');
      } else {
        Utils.showToast('Movimiento de caja eliminado.', 'success');
      }
      const content = document.getElementById('content');
      if (content) { content.innerHTML = this.render(); this.init(); }
      return;
    }

    // 4. Si referencia a un GASTO → borrar el gasto también
    if (isExpenseRef) {
      if (movement.expenseId) DB.delete('expenses', movement.expenseId);
      else if (ref) DB.delete('expenses', ref);
      Utils.showToast('Gasto y movimiento de caja eliminados.', 'success');
      const content = document.getElementById('content');
      if (content) { content.innerHTML = this.render(); this.init(); }
      return;
    }

    // 5. Movimiento manual (sin referencia) → solo borrar el movimiento de caja
    Utils.showToast('Movimiento manual eliminado de Caja.', 'success');
    const content = document.getElementById('content');
    if (content) { content.innerHTML = this.render(); this.init(); }
  },

  _saveMov() {
    const concept = document.getElementById('cash-concept').value.trim();
    const amount = parseFloat(document.getElementById('cash-amount').value);
    if (!concept) { Utils.showToast('El concepto es obligatorio', 'error'); return; }
    if (!amount || amount <= 0) { Utils.showToast('El monto debe ser mayor a $ 0', 'error'); return; }

    DB.add('cash_movements', {
      id: Utils.generateId('cash'),
      date: document.getElementById('cash-date').value || Utils.today(),
      datetime: Utils.nowISO(),
      type: this._cashType,
      concept,
      amount
    });

    Utils.showToast(`${this._cashType === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado en caja`, 'success');
    Utils.closeModal('cashModal');
    document.getElementById('cash-concept').value = '';
    document.getElementById('cash-amount').value = '';

    const content = document.getElementById('content');
    if (content) { content.innerHTML = this.render(); this.init(); }
  },

  _calcDiferencia(val) {
    const real = parseFloat(val) || 0;
    const expected = DB.getCashBalance();
    const dif = real - expected;
    const difEl = document.getElementById('arqueo-dif');
    if (!difEl) return;

    if (dif === 0) {
      difEl.innerHTML = `<span class="text-success">Exacto ($ 0)</span>`;
    } else if (dif > 0) {
      difEl.innerHTML = `<span class="text-warning">Sobrante: +${Utils.formatCurrency(dif)}</span>`;
    } else {
      difEl.innerHTML = `<span class="text-danger">Faltante: -${Utils.formatCurrency(Math.abs(dif))}</span>`;
    }
  },

  _export() {
    const movs = DB.getAll('cash_movements');
    const rows = [['Fecha','Hora','Tipo','Concepto','Monto']];
    movs.forEach(m => rows.push([m.date, Utils.formatDatetime(m.datetime), m.type, m.concept, m.amount]));
    Utils.downloadCSV(rows, 'movimientos_caja_ferreteria_el_bule.csv');
    Utils.showToast('Movimientos de caja exportados a CSV', 'success');
  }
};
