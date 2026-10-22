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
    // Buscar el movimiento de caja (en índice y en array completo por seguridad)
    const movement = DB.findById('cash_movements', id)
      || DB.getAll('cash_movements').find(m => m.id === id);
    if (!movement) return;

    const ref = movement.reference || '';

    // ─── Detectar qué está vinculado buscando DIRECTAMENTE en cada colección ───
    // (No dependemos del prefijo del ID — funciona con datos viejos y nuevos)
    const linkedSale     = ref ? (DB.findById('sales', ref)     || null) : null;
    const linkedPurchase = ref ? (DB.findById('purchases', ref)  || null) : null;
    const linkedExpense  = movement.expenseId
      ? (DB.findById('expenses', movement.expenseId) || null)
      : (ref ? (DB.findById('expenses', ref) || null) : null);

    // ─── Construir mensaje de confirmación según lo que se va a eliminar ───
    let confirmMsg = `¿Eliminar este movimiento?\n\n📋 "${movement.concept}"\n💵 ${Utils.formatCurrency(movement.amount)}\n\n`;
    if (linkedSale)     confirmMsg += `⚠️ Se ELIMINARÁ la venta ${linkedSale.invoiceNumber} y se DEVOLVERÁN ${(linkedSale.items||[]).reduce((a,it)=>a+it.qty,0)} unidades al inventario.\n`;
    if (linkedPurchase) confirmMsg += `⚠️ Se ELIMINARÁ la compra a "${linkedPurchase.supplierName}" y se RESTARÁN las unidades compradas del inventario.\n`;
    if (linkedExpense)  confirmMsg += `⚠️ Se ELIMINARÁ el gasto "${linkedExpense.description || linkedExpense.concept || ''}" asociado.\n`;
    if (!linkedSale && !linkedPurchase && !linkedExpense) confirmMsg += 'ℹ️ Movimiento manual — solo se elimina de Caja.\n';
    confirmMsg += '\n❌ Esta acción no se puede deshacer.';

    if (!Utils.confirm(confirmMsg)) return;

    // ─── PASO 1: Siempre eliminar el movimiento de caja ───
    DB.delete('cash_movements', id);

    // ─── PASO 2: Eliminar VENTA vinculada + restaurar stock ───
    if (linkedSale) {
      // Restaurar stock de todos los ítems si el stock fue descontado
      if (linkedSale.stockDeducted !== false) {
        (linkedSale.items || []).forEach(it => {
          const p = DB.findById('products', it.productId);
          if (p) {
            DB.restoreStock(it.productId, it.qty);
            DB.logMovement({
              productId: it.productId,
              productName: it.name,
              qty: it.qty,
              type: 'Eliminación desde Caja',
              reason: `Venta ${linkedSale.invoiceNumber} borrada desde Caja (Stock restaurado)`,
              value: linkedSale.totalPaid || 0
            });
          }
        });
      }
      // Borrar TODOS los movimientos de caja vinculados a esta venta (abonos, etc.)
      DB.getAll('cash_movements')
        .filter(m => m.reference === ref && m.id !== id)
        .forEach(m => DB.delete('cash_movements', m.id));
      // Borrar la venta (skipStockRestore=true porque ya restauramos arriba)
      DB.delete('sales', ref, true);
      Utils.showToast(`✅ Venta ${linkedSale.invoiceNumber} eliminada por completo. Stock restaurado al inventario.`, 'warning');
      const content = document.getElementById('content');
      if (content) { content.innerHTML = this.render(); this.init(); }
      return;
    }

    // ─── PASO 3: Eliminar COMPRA vinculada + revertir stock ───
    if (linkedPurchase) {
      let totalUnitsReverted = 0;
      (linkedPurchase.items || []).forEach(it => {
        const p = DB.findById('products', it.productId);
        if (p && it.qty > 0) {
          DB.restoreStockReverse(it.productId, it.qty, it.unitCost);
          DB.logMovement({
            productId: it.productId,
            productName: it.name,
            qty: -it.qty,
            type: 'Eliminación Compra desde Caja',
            reason: `Compra a "${linkedPurchase.supplierName}" borrada desde Caja (Stock revertido)`,
            value: it.subtotal || 0
          });
          totalUnitsReverted += it.qty;
        }
      });
      // Borrar otros movimientos de caja vinculados a esta compra
      DB.getAll('cash_movements')
        .filter(m => m.reference === ref && m.id !== id)
        .forEach(m => DB.delete('cash_movements', m.id));
      DB.delete('purchases', ref);
      Utils.showToast(`✅ Compra eliminada. Se revirtieron ${totalUnitsReverted} unidades del inventario.`, 'warning');
      const content = document.getElementById('content');
      if (content) { content.innerHTML = this.render(); this.init(); }
      return;
    }

    // ─── PASO 4: Eliminar GASTO vinculado ───
    if (linkedExpense) {
      const expId = movement.expenseId || ref;
      DB.delete('expenses', expId);
      Utils.showToast('✅ Gasto y movimiento de caja eliminados.', 'success');
      const content = document.getElementById('content');
      if (content) { content.innerHTML = this.render(); this.init(); }
      return;
    }

    // ─── PASO 5: Movimiento manual — ya fue borrado en el paso 1 ───
    Utils.showToast('✅ Movimiento eliminado de Caja.', 'success');
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
