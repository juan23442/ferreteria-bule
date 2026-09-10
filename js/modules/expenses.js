/* =============================================
   FERRETERÍA EL BULE — Módulo Gastos (expenses.js)
   Control de Gastos Operativos en $ COP
   ============================================= */

window.Modules = window.Modules || {};
window.Modules.expenses = {
  render() {
    const expenses = DB.getAll('expenses');
    const today = Utils.today();
    const month = today.slice(0, 7);
    const year = today.slice(0, 4);

    const todayExp = expenses.filter(e => e.date === today);
    const monthExp = expenses.filter(e => e.date && e.date.startsWith(month));
    const yearExp = expenses.filter(e => e.date && e.date.startsWith(year));

    const todayTotal = Utils.sum(todayExp, 'amount');
    const monthTotal = Utils.sum(monthExp, 'amount');
    const yearTotal = Utils.sum(yearExp, 'amount');

    // Main category
    const catCounts = {};
    monthExp.forEach(e => { catCounts[e.category] = (catCounts[e.category]||0) + e.amount; });
    const topCat = Object.entries(catCounts).sort((a,b) => b[1]-a[1])[0];

    return `
    <div class="grid-4 mb-24">
      <div class="stat-card"><div class="stat-icon red">💸</div><div class="stat-info"><div class="stat-label">Gastos Hoy</div><div class="stat-value danger">${Utils.formatCurrency(todayTotal)}</div></div></div>
      <div class="stat-card"><div class="stat-icon yellow">📅</div><div class="stat-info"><div class="stat-label">Gastos del Mes</div><div class="stat-value accent">${Utils.formatCurrency(monthTotal)}</div></div></div>
      <div class="stat-card"><div class="stat-icon blue">📊</div><div class="stat-info"><div class="stat-label">Gastos del Año</div><div class="stat-value">${Utils.formatCurrency(yearTotal)}</div></div></div>
      <div class="stat-card"><div class="stat-icon purple">🏷️</div><div class="stat-info"><div class="stat-label">Categoría Mayor Gasto</div><div class="stat-value" style="font-size:14px">${topCat ? topCat[0] : '-'}</div></div></div>
    </div>

    <div class="filters-bar">
      <button class="btn btn-primary" id="btn-add-expense">+ Registrar Gasto</button>
      <div style="flex:1"></div>
      <input type="date" class="form-control" id="exp-from" style="width:150px" title="Desde">
      <input type="date" class="form-control" id="exp-to" style="width:150px" title="Hasta">
      <select class="form-select" id="exp-cat-filter" style="width:180px">
        <option value="">Todas las categorías</option>
        <option>Arriendo / Alquiler</option>
        <option>Servicios Básicos</option>
        <option>Nómina / Salarios</option>
        <option>Transporte / Fletes</option>
        <option>Papelería / Oficina</option>
        <option>Mantenimiento</option>
        <option>Publicidad</option>
        <option>Otros</option>
      </select>
      <button class="btn btn-secondary" id="btn-export-exp">📤 CSV</button>
    </div>

    <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Categoría</th>
            <th>Descripción</th>
            <th>Monto ($ COP)</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="exp-tbody"></tbody>
      </table>
    </div></div></div>

    <!-- Modal Registrar Gasto -->
    <div class="modal" id="expenseModal" style="display:none">
      <div class="modal-content">
        <div class="modal-header"><h3>Registrar Gasto Operativo</h3><button class="modal-close" onclick="Utils.closeModal('expenseModal')">✕</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Fecha</label><input class="form-control" type="date" id="exp-date" value="${today}"></div>
            <div class="form-group"><label class="form-label">Categoría</label>
              <select class="form-select" id="exp-category">
                <option>Arriendo / Alquiler</option>
                <option>Servicios Básicos</option>
                <option>Nómina / Salarios</option>
                <option>Transporte / Fletes</option>
                <option>Papelería / Oficina</option>
                <option>Mantenimiento</option>
                <option>Publicidad</option>
                <option>Otros</option>
              </select>
            </div>
          </div>
          <div class="form-group"><label class="form-label">Descripción del Gasto *</label><input class="form-control" id="exp-desc" placeholder="Ej: Pago servicio de energía del local"></div>
          <div class="form-group"><label class="form-label">Monto ($ COP) *</label><input class="form-control" type="number" id="exp-amount" step="500" min="100" placeholder="150000"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal('expenseModal')">Cancelar</button>
          <button class="btn btn-primary" id="btn-save-expense">Guardar Gasto</button>
        </div>
      </div>
    </div>`;
  },

  init() {
    this._renderTable();
    document.getElementById('btn-add-expense')?.addEventListener('click', () => Utils.openModal('expenseModal'));
    document.getElementById('btn-save-expense')?.addEventListener('click', () => this._save());
    document.getElementById('exp-from')?.addEventListener('change', () => this._renderTable());
    document.getElementById('exp-to')?.addEventListener('change', () => this._renderTable());
    document.getElementById('exp-cat-filter')?.addEventListener('change', () => this._renderTable());
    document.getElementById('btn-export-exp')?.addEventListener('click', () => this._export());
  },

  _renderTable() {
    let expenses = DB.getAll('expenses').slice().reverse();
    const from = document.getElementById('exp-from')?.value || '';
    const to = document.getElementById('exp-to')?.value || '';
    const cat = document.getElementById('exp-cat-filter')?.value || '';

    if (from) expenses = expenses.filter(e => e.date >= from);
    if (to) expenses = expenses.filter(e => e.date <= to);
    if (cat) expenses = expenses.filter(e => e.category === cat);

    const tbody = document.getElementById('exp-tbody');
    if (!tbody) return;

    if (expenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">${Utils.emptyState('Sin gastos registrados', '💸')}</td></tr>`;
      return;
    }

    tbody.innerHTML = expenses.map(e => `
      <tr>
        <td>${Utils.formatDate(e.date)}</td>
        <td><span class="badge badge-warning">${Utils.escHtml(e.category)}</span></td>
        <td><strong>${Utils.escHtml(e.description)}</strong></td>
        <td class="text-danger font-bold">${Utils.formatCurrency(e.amount)}</td>
        <td><button class="btn btn-sm btn-danger" onclick="Modules.expenses._del('${e.id}')">🗑️</button></td>
      </tr>
    `).join('');
  },

  _save() {
    const dateInput = document.getElementById('exp-date');
    const categoryInput = document.getElementById('exp-category');
    const descInput = document.getElementById('exp-desc');
    const amountInput = document.getElementById('exp-amount');
    if (!dateInput || !categoryInput || !descInput || !amountInput) {
      Utils.showToast('No se pudo cargar el formulario de gastos', 'error');
      return;
    }

    const date = dateInput.value || Utils.today();
    const category = categoryInput.value.trim();
    const desc = descInput.value.trim();
    const amount = Number.parseFloat(amountInput.value);

    if (!date) { Utils.showToast('La fecha del gasto es obligatoria', 'error'); return; }
    if (!category) { Utils.showToast('La categoría del gasto es obligatoria', 'error'); return; }
    if (!desc) { Utils.showToast('La descripción del gasto es obligatoria', 'error'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { Utils.showToast('El monto debe ser mayor a 0', 'error'); return; }

    try {
      DB.add('expenses', { id: Utils.generateId('exp'), date, category, description: desc, amount, createdAt: Utils.nowISO() });
      DB.add('cash_movements', { id: Utils.generateId('cash'), date, datetime: Utils.nowISO(), type: 'egreso', concept: `Gasto: ${desc}`, amount });
    } catch (error) {
      console.error('No se pudo guardar el gasto:', error);
      Utils.showToast('No se pudo guardar el gasto. Intenta nuevamente.', 'error');
      return;
    }

    Utils.showToast('Gasto operativo registrado', 'success');
    Utils.closeModal('expenseModal');
    document.getElementById('exp-desc').value = '';
    document.getElementById('exp-amount').value = '';

    const content = document.getElementById('content');
    if (content) { content.innerHTML = this.render(); this.init(); }
  },

  _del(id) {
    if (!Utils.confirm('¿Eliminar este gasto registrado?')) return;
    DB.delete('expenses', id);
    Utils.showToast('Gasto eliminado', 'success');
    this._renderTable();
  },

  _export() {
    const expenses = DB.getAll('expenses');
    const rows = [['Fecha','Categoría','Descripción','Monto']];
    expenses.forEach(e => rows.push([e.date, e.category, e.description, e.amount]));
    Utils.downloadCSV(rows, 'gastos_ferreteria_el_bule.csv');
    Utils.showToast('Gastos exportados a CSV', 'success');
  }
};
