/* =============================================
   FERRETERÍA EL BULE — Módulo Clientes (customers.js)
   Gestión de Clientes e Historial de Compras en $ COP
   ============================================= */

window.Modules = window.Modules || {};
window.Modules.customers = {
  _editId: null,

  render() {
    const customers = DB.getAll('customers');
    const sales = DB.getAll('sales').filter(s => s.status !== 'anulada');

    const totalCustomers = customers.length;
    const activeBuyersCount = customers.filter(c => sales.some(s => s.customerId === c.id)).length;
    const newThisMonth = customers.filter(c => c.createdAt && c.createdAt.startsWith(Utils.today().slice(0, 7))).length;

    return `
    <div class="grid-3 mb-24">
      <div class="stat-card"><div class="stat-icon blue">👥</div><div class="stat-info"><div class="stat-label">Total Clientes</div><div class="stat-value">${totalCustomers}</div></div></div>
      <div class="stat-card"><div class="stat-icon green">🛒</div><div class="stat-info"><div class="stat-label">Clientes Frecuentes</div><div class="stat-value success">${activeBuyersCount}</div></div></div>
      <div class="stat-card"><div class="stat-icon yellow">⭐</div><div class="stat-info"><div class="stat-label">Nuevos Este Mes</div><div class="stat-value accent">${newThisMonth}</div></div></div>
    </div>

    <div class="filters-bar">
      <div class="search-box"><input type="text" id="cust-search" placeholder="Buscar cliente por nombre, documento o teléfono..."></div>
      <button class="btn btn-primary" id="btn-add-customer">+ Agregar Cliente</button>
      <button class="btn btn-secondary" id="btn-export-cust">📤 Exportar CSV</button>
    </div>

    <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Nombre del Cliente</th>
            <th>Documento / NIT</th>
            <th>Teléfono</th>
            <th>Email</th>
            <th>Total Comprado</th>
            <th>Última Compra</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="cust-tbody"></tbody>
      </table>
    </div></div></div>

    <!-- Modal Agregar / Editar Cliente -->
    <div class="modal" id="customerModal" style="display:none">
      <div class="modal-content">
        <div class="modal-header"><h3 id="custModalTitle">Agregar Cliente</h3><button class="modal-close" onclick="Utils.closeModal('customerModal')">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Nombre Completo / Razón Social *</label><input class="form-control" id="cust-name" placeholder="Ej: Pedro Gómez"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Cédula / NIT / DPI</label><input class="form-control" id="cust-nit" placeholder="Ej: 1.020.300.400"></div>
            <div class="form-group"><label class="form-label">Teléfono / Celular</label><input class="form-control" id="cust-phone" placeholder="Ej: 300 123 4567"></div>
          </div>
          <div class="form-group"><label class="form-label">Dirección</label><input class="form-control" id="cust-address" placeholder="Ej: Calle 15 #8-30"></div>
          <div class="form-group"><label class="form-label">Correo Electrónico</label><input class="form-control" id="cust-email" placeholder="cliente@correo.com"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal('customerModal')">Cancelar</button>
          <button class="btn btn-primary" id="btn-save-customer">Guardar Cliente</button>
        </div>
      </div>
    </div>

    <!-- Modal Ver Detalle Cliente -->
    <div class="modal" id="custDetailModal" style="display:none">
      <div class="modal-content modal-lg">
        <div class="modal-header"><h3>Historial y Compras del Cliente</h3><button class="modal-close" onclick="Utils.closeModal('custDetailModal')">✕</button></div>
        <div class="modal-body" id="cust-detail-body"></div>
      </div>
    </div>`;
  },

  init() {
    this._renderTable();
    document.getElementById('btn-add-customer')?.addEventListener('click', () => {
      this._editId = null;
      this._clearForm();
      document.getElementById('custModalTitle').textContent = 'Agregar Cliente';
      Utils.openModal('customerModal');
    });
    document.getElementById('btn-save-customer')?.addEventListener('click', () => this._save());
    document.getElementById('cust-search')?.addEventListener('input', () => this._renderTable());
    document.getElementById('btn-export-cust')?.addEventListener('click', () => this._export());
  },

  _renderTable() {
    const customers = DB.getAll('customers');
    const sales = DB.getAll('sales').filter(s => s.status !== 'anulada');
    const search = (document.getElementById('cust-search')?.value || '').toLowerCase();
    const tbody = document.getElementById('cust-tbody');
    if (!tbody) return;

    let filtered = customers;
    if (search) {
      filtered = filtered.filter(c =>
        (c.name||'').toLowerCase().includes(search) ||
        (c.nit||'').toLowerCase().includes(search) ||
        (c.phone||'').includes(search)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7">${Utils.emptyState('No hay clientes registrados con este criterio', '👥')}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const custSales = sales.filter(s => s.customerId === c.id || (s.customerName && s.customerName.toLowerCase() === c.name.toLowerCase()));
      const totalBought = Utils.sum(custSales, 'total');
      const lastSale = custSales.length > 0 ? custSales.sort((a,b) => b.datetime.localeCompare(a.datetime))[0] : null;

      return `
      <tr>
        <td><strong>${Utils.escHtml(c.name)}</strong></td>
        <td>${Utils.escHtml(c.nit||'-')}</td>
        <td>${Utils.escHtml(c.phone||'-')}</td>
        <td class="muted">${Utils.escHtml(c.email||'-')}</td>
        <td class="text-accent font-bold">${Utils.formatCurrency(totalBought)}</td>
        <td>${lastSale ? Utils.formatDate(lastSale.date) : '<span class="text-muted">Sin compras</span>'}</td>
        <td class="actions">
          <button class="btn btn-sm btn-secondary" title="Ver Historial" onclick="Modules.customers._view('${c.id}')">👁️</button>
          <button class="btn btn-sm btn-secondary" title="Editar" onclick="Modules.customers._edit('${c.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" title="Eliminar" onclick="Modules.customers._del('${c.id}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  },

  _clearForm() {
    ['cust-name','cust-nit','cust-phone','cust-address','cust-email'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  },

  _edit(id) {
    const c = DB.findById('customers', id); if (!c) return;
    this._editId = id;
    document.getElementById('custModalTitle').textContent = 'Editar Cliente';
    document.getElementById('cust-name').value = c.name || '';
    document.getElementById('cust-nit').value = c.nit || '';
    document.getElementById('cust-phone').value = c.phone || '';
    document.getElementById('cust-address').value = c.address || '';
    document.getElementById('cust-email').value = c.email || '';
    Utils.openModal('customerModal');
  },

  _save() {
    const name = document.getElementById('cust-name').value.trim();
    if (!name) { Utils.showToast('El nombre del cliente es obligatorio', 'error'); return; }

    const data = {
      name,
      nit: document.getElementById('cust-nit').value.trim(),
      phone: document.getElementById('cust-phone').value.trim(),
      address: document.getElementById('cust-address').value.trim(),
      email: document.getElementById('cust-email').value.trim()
    };

    if (this._editId) {
      DB.update('customers', this._editId, data);
      Utils.showToast('Cliente actualizado correctamente', 'success');
    } else {
      data.id = Utils.generateId('cust');
      data.createdAt = Utils.today();
      DB.add('customers', data);
      Utils.showToast('Cliente registrado en la base de datos', 'success');
    }

    Utils.closeModal('customerModal');
    this._renderTable();
  },

  _del(id) {
    if (!Utils.confirm('¿Eliminar este cliente de la base de datos?')) return;
    DB.delete('customers', id);
    Utils.showToast('Cliente eliminado', 'success');
    this._renderTable();
  },

  _view(id) {
    const c = DB.findById('customers', id); if (!c) return;
    const sales = DB.getAll('sales').filter(s => s.customerId === id || (s.customerName && s.customerName.toLowerCase() === c.name.toLowerCase()));
    const totalBought = Utils.sum(sales.filter(s => s.status !== 'anulada'), 'total');

    let html = `
    <div class="grid-2 mb-16">
      <div>
        <p><strong>Nombre:</strong> ${Utils.escHtml(c.name)}</p>
        <p><strong>Documento / NIT:</strong> ${Utils.escHtml(c.nit||'-')}</p>
        <p><strong>Dirección:</strong> ${Utils.escHtml(c.address||'-')}</p>
      </div>
      <div>
        <p><strong>Teléfono:</strong> ${Utils.escHtml(c.phone||'-')}</p>
        <p><strong>Email:</strong> ${Utils.escHtml(c.email||'-')}</p>
        <p><strong>Total Comprado:</strong> <strong class="text-accent">${Utils.formatCurrency(totalBought)}</strong></p>
      </div>
    </div>
    <div class="section-title">Historial de Compras (${sales.length})</div>
    ${sales.length === 0 ? '<p style="color:var(--text-muted)">Sin compras registradas para este cliente</p>' : `
      <table class="table">
        <thead><tr><th>Factura</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>
          ${sales.slice().reverse().map(s => `
            <tr>
              <td><strong>${Utils.escHtml(s.invoiceNumber)}</strong></td>
              <td>${Utils.formatDate(s.date)}</td>
              <td class="text-accent font-bold">${Utils.formatCurrency(s.total)}</td>
              <td>${Utils.statusBadge(s.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `}`;

    document.getElementById('cust-detail-body').innerHTML = html;
    Utils.openModal('custDetailModal');
  },

  _export() {
    const customers = DB.getAll('customers');
    const rows = [['Nombre','Documento','Teléfono','Dirección','Email','Registrado']];
    customers.forEach(c => rows.push([c.name, c.nit||'', c.phone||'', c.address||'', c.email||'', c.createdAt||'']));
    Utils.downloadCSV(rows, 'clientes_ferreteria_el_bule.csv');
    Utils.showToast('Clientes exportados a CSV', 'success');
  }
};
