/* =============================================
   FERRETERÍA EL BULE — Módulo Historial de Movimientos (movements.js)
   Registro completo de Entradas, Salidas, Ventas, Compras y Ajustes
   ============================================= */

window.Modules = window.Modules || {};
window.Modules.movements = {
  render() {
    const movs = DB.getAll('movements');

    return `
    <div class="grid-3 mb-24">
      <div class="stat-card"><div class="stat-icon blue">📊</div><div class="stat-info"><div class="stat-label">Total Movimientos</div><div class="stat-value">${movs.length}</div></div></div>
      <div class="stat-card"><div class="stat-icon green">📥</div><div class="stat-info"><div class="stat-label">Entradas / Compras</div><div class="stat-value success">${movs.filter(m => m.qty > 0).length}</div></div></div>
      <div class="stat-card"><div class="stat-icon red">📤</div><div class="stat-info"><div class="stat-label">Salidas / Ventas</div><div class="stat-value danger">${movs.filter(m => m.qty < 0).length}</div></div></div>
    </div>

    <div class="filters-bar">
      <div class="search-box"><input type="text" id="mov-search" placeholder="Buscar por producto, tipo o motivo..."></div>
      <input type="date" class="form-control" id="mov-from" style="width:150px" title="Desde">
      <input type="date" class="form-control" id="mov-to" style="width:150px" title="Hasta">
      <select class="form-select" id="mov-type-filter" style="width:170px">
        <option value="">Todos los tipos</option>
        <option value="Venta">Venta</option>
        <option value="Compra">Compra</option>
        <option value="Ajuste Stock">Ajuste Stock</option>
        <option value="Edición Venta">Edición Venta</option>
        <option value="Anulación Venta">Anulación Venta</option>
      </select>
      <button class="btn btn-secondary" id="btn-export-movs">📤 Exportar CSV</button>
    </div>

    <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Fecha / Hora</th>
            <th>Producto</th>
            <th>Tipo Movimiento</th>
            <th>Cantidad</th>
            <th>Motivo / Referencia</th>
            <th>Usuario</th>
          </tr>
        </thead>
        <tbody id="movs-tbody"></tbody>
      </table>
    </div></div></div>`;
  },

  init() {
    this._renderTable();
    document.getElementById('mov-search')?.addEventListener('input', () => this._renderTable());
    document.getElementById('mov-from')?.addEventListener('change', () => this._renderTable());
    document.getElementById('mov-to')?.addEventListener('change', () => this._renderTable());
    document.getElementById('mov-type-filter')?.addEventListener('change', () => this._renderTable());
    document.getElementById('btn-export-movs')?.addEventListener('click', () => this._export());
  },

  _renderTable() {
    let movs = DB.getAll('movements').slice().reverse();
    const search = (document.getElementById('mov-search')?.value || '').toLowerCase();
    const from = document.getElementById('mov-from')?.value || '';
    const to = document.getElementById('mov-to')?.value || '';
    const typeFilter = document.getElementById('mov-type-filter')?.value || '';

    if (search) {
      movs = movs.filter(m =>
        (m.productName||'').toLowerCase().includes(search) ||
        (m.type||'').toLowerCase().includes(search) ||
        (m.reason||'').toLowerCase().includes(search)
      );
    }
    if (from) movs = movs.filter(m => m.date >= from);
    if (to) movs = movs.filter(m => m.date <= to);
    if (typeFilter) movs = movs.filter(m => m.type === typeFilter);

    const tbody = document.getElementById('movs-tbody');
    if (!tbody) return;

    if (movs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">${Utils.emptyState('No hay movimientos de inventario registrados', '📊')}</td></tr>`;
      return;
    }

    tbody.innerHTML = movs.map(m => `
      <tr>
        <td>${Utils.formatDatetime(m.datetime)}</td>
        <td><strong>${Utils.escHtml(m.productName)}</strong></td>
        <td><span class="badge badge-info">${Utils.escHtml(m.type)}</span></td>
        <td class="${m.qty > 0 ? 'text-success' : 'text-danger'} font-bold">${m.qty > 0 ? '+' + m.qty : m.qty}</td>
        <td>${Utils.escHtml(m.reason)}</td>
        <td><small class="text-muted">${Utils.escHtml(m.user || 'Sistema')}</small></td>
      </tr>
    `).join('');
  },

  _export() {
    const movs = DB.getAll('movements');
    const rows = [['Fecha Hora','Producto','Tipo','Cantidad','Motivo','Usuario']];
    movs.forEach(m => rows.push([Utils.formatDatetime(m.datetime), m.productName, m.type, m.qty, m.reason, m.user||'Sistema']));
    Utils.downloadCSV(rows, 'movimientos_inventario_ferreteria_el_bule.csv');
    Utils.showToast('Historial de movimientos exportado a CSV', 'success');
  }
};
