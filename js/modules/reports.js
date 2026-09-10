/* =============================================
   FERRETERÍA EL BULE — Módulo Reportes y Estadísticas (reports.js)
   Generación de reportes detallados en $ COP con gráficos y exportación
   ============================================= */

window.Modules = window.Modules || {};
window.Modules.reports = {
  _period: 'month',
  _from: '',
  _to: '',

  render() {
    return `
    <div class="tabs" id="report-tabs">
      <button class="tab-btn" data-period="today">Hoy</button>
      <button class="tab-btn" data-period="week">Esta Semana</button>
      <button class="tab-btn active" data-period="month">Este Mes</button>
      <button class="tab-btn" data-period="year">Este Año</button>
      <button class="tab-btn" data-period="custom">Personalizado</button>
    </div>

    <div id="custom-range" style="display:none;margin-bottom:20px" class="filters-bar">
      <label class="form-label" style="margin:0">Desde:</label>
      <input type="date" class="form-control" id="rep-from" style="width:160px">
      <label class="form-label" style="margin:0">Hasta:</label>
      <input type="date" class="form-control" id="rep-to" style="width:160px">
      <button class="btn btn-primary btn-sm" id="btn-apply-range">Aplicar Filtro</button>
    </div>

    <div id="report-content"></div>`;
  },

  init() {
    this._period = 'month';

    document.querySelectorAll('#report-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#report-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._period = btn.dataset.period;
        document.getElementById('custom-range').style.display = this._period === 'custom' ? 'flex' : 'none';
        if (this._period !== 'custom') this._generateReport();
      });
    });

    document.getElementById('btn-apply-range')?.addEventListener('click', () => {
      this._from = document.getElementById('rep-from').value;
      this._to = document.getElementById('rep-to').value;
      this._generateReport();
    });

    this._generateReport();
  },

  _getDateRange() {
    const today = Utils.today();
    const d = new Date(today);
    switch (this._period) {
      case 'today': return [today, today];
      case 'week': {
        const dayOfWeek = d.getDay();
        const monday = new Date(d); monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        return [monday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]];
      }
      case 'month': return [today.slice(0, 7) + '-01', today];
      case 'year': return [today.slice(0, 4) + '-01-01', today.slice(0, 4) + '-12-31'];
      case 'custom': return [this._from || today.slice(0, 4) + '-01-01', this._to || today];
    }
  },

  _generateReport() {
    const [from, to] = this._getDateRange();

    const sales = DB.getAll('sales').filter(s => s.status !== 'anulada' && Utils.dateInRange(s.date, from, to));
    const purchases = DB.getAll('purchases').filter(p => Utils.dateInRange(p.date, from, to));
    const expenses = DB.getAll('expenses').filter(e => Utils.dateInRange(e.date, from, to));
    const cashMovs = DB.getAll('cash_movements').filter(m => Utils.dateInRange(m.date, from, to));

    const totalRevenue = sales.reduce((a, s) => a + (s.totalPaid != null ? s.totalPaid : s.total), 0);
    const totalCost = sales.reduce((a,s) => {
      const saleCost = (s.items||[]).reduce((b,it) => b + ((it.qty||1) * (it.costPrice||0)), 0);
      const paidRatio = s.total > 0 ? Math.min(1, (s.totalPaid != null ? s.totalPaid : s.total) / s.total) : 0;
      return a + saleCost * paidRatio;
    }, 0);
    const grossProfit = Math.max(0, totalRevenue - totalCost);
    const totalExpenses = Utils.sum(expenses, 'amount');
    const netProfit = grossProfit - totalExpenses;

    const totalPurchases = Utils.sum(purchases, 'total');
    const cashIn = cashMovs.filter(m => m.type === 'ingreso').reduce((a,m) => a + m.amount, 0);
    const cashOut = cashMovs.filter(m => m.type === 'egreso').reduce((a,m) => a + m.amount, 0);

    // Top products
    const prodMap = {};
    sales.forEach(s => (s.items||[]).forEach(it => {
      if (!prodMap[it.name]) prodMap[it.name] = { name: it.name, qty: 0, revenue: 0 };
      const paidRatio = s.total > 0 ? Math.min(1, (s.totalPaid != null ? s.totalPaid : s.total) / s.total) : 0;
      prodMap[it.name].qty += (it.qty || 1) * paidRatio;
      prodMap[it.name].revenue += (it.subtotal || 0) * paidRatio;
    }));

    const topProducts = Object.values(prodMap).sort((a,b) => b.revenue - a.revenue).slice(0, 10);

    const container = document.getElementById('report-content');
    if (!container) return;

    let html = `
    <!-- Tarjetas Financieras Principal -->
    <div class="grid-4 mb-24">
      <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><div class="stat-label">Ingresos por Ventas</div><div class="stat-value success">${Utils.formatCurrency(totalRevenue)}</div></div></div>
      <div class="stat-card"><div class="stat-icon yellow">📦</div><div class="stat-info"><div class="stat-label">Costo de Mercancía</div><div class="stat-value accent">${Utils.formatCurrency(totalCost)}</div></div></div>
      <div class="stat-card"><div class="stat-icon red">💸</div><div class="stat-info"><div class="stat-label">Gastos Operativos</div><div class="stat-value danger">${Utils.formatCurrency(totalExpenses)}</div></div></div>
      <div class="stat-card"><div class="stat-icon ${netProfit>=0?'green':'red'}">📈</div><div class="stat-info"><div class="stat-label">Ganancia Neta Real</div><div class="stat-value ${netProfit>=0?'success':'danger'}">${Utils.formatCurrency(netProfit)}</div></div></div>
    </div>

    <div class="grid-2 mb-24">
      <!-- Resumen Consolidado -->
      <div class="card">
        <div class="card-header"><span class="card-title">📊 Resumen Financiero del Período</span></div>
        <div class="card-body">
          <div class="total-row"><span>Período Seleccionado</span><span>${Utils.formatDate(from)} → ${Utils.formatDate(to)}</span></div>
          <div class="total-row"><span>Ventas Realizadas</span><span>${sales.length} factura(s)</span></div>
          <div class="total-row"><span>Ticket Promedio de Venta</span><span>${Utils.formatCurrency(sales.length ? totalRevenue / sales.length : 0)}</span></div>
          <div class="total-row"><span>Ganancia Bruta (Ventas - Costos)</span><span class="text-success font-bold">${Utils.formatCurrency(grossProfit)}</span></div>
          <div class="total-row"><span>Margen de Ganancia Neta</span><span class="font-bold">${totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) + '%' : '0%'}</span></div>
          <div class="total-row"><span>Compras a Proveedores</span><span>${Utils.formatCurrency(totalPurchases)}</span></div>
          <hr class="divider">
          <div style="display:flex;gap:10px">
            <button class="btn btn-secondary flex-1" onclick="window.print()">🖨️ Imprimir Reporte</button>
            <button class="btn btn-primary flex-1" onclick="Modules.reports._exportReport()">📤 Exportar CSV</button>
          </div>
        </div>
      </div>

      <!-- Resumen de Caja -->
      <div class="card">
        <div class="card-header"><span class="card-title">💵 Resumen de Movimientos en Caja</span></div>
        <div class="card-body">
          <div class="total-row"><span>Total Ingresos en Caja</span><span class="text-success font-bold">${Utils.formatCurrency(cashIn)}</span></div>
          <div class="total-row"><span>Total Egresos en Caja</span><span class="text-danger font-bold">${Utils.formatCurrency(cashOut)}</span></div>
          <div class="total-row grand"><span>Balance Neto Caja</span><span>${Utils.formatCurrency(cashIn - cashOut)}</span></div>
          <hr class="divider">
          <p style="font-size:12.5px;color:var(--text-muted)">Saldo acumulado total disponible en caja: <strong class="text-accent font-bold">${Utils.formatCurrency(DB.getCashBalance())}</strong></p>
        </div>
      </div>
    </div>

    <!-- Top Productos Más Vendidos -->
    <div class="card">
      <div class="card-header"><span class="card-title">🏆 Top 10 Productos Más Vendidos</span></div>
      <div class="card-body" style="padding:0">
        ${topProducts.length === 0 ? Utils.emptyState('Sin datos de ventas en este período', '📊') : `
          <table class="table">
            <thead><tr><th>#</th><th>Producto</th><th>Unidades Vendidas</th><th>Total Generado ($ COP)</th></tr></thead>
            <tbody>
              ${topProducts.map((p, i) => `
                <tr>
                  <td><strong>${i+1}</strong></td>
                  <td><strong>${Utils.escHtml(p.name)}</strong></td>
                  <td>${p.qty} und</td>
                  <td class="text-accent font-bold">${Utils.formatCurrency(p.revenue)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>`;

    container.innerHTML = html;
  },

  _exportReport() {
    const [from, to] = this._getDateRange();
    const sales = DB.getAll('sales').filter(s => s.status !== 'anulada' && Utils.dateInRange(s.date, from, to));

    const rows = [['Nº Factura','Fecha','Cliente','Subtotal','Rebaja / Descuento','Total Facturado','Costo Mercancía','Ganancia Real']];
    sales.forEach(s => {
      const cost = (s.items||[]).reduce((a,it) => a + ((it.qty||1) * (it.costPrice||0)), 0);
      const profit = s.realProfit !== undefined ? s.realProfit : Math.max(0, s.total - cost);
      rows.push([s.invoiceNumber, s.date, s.customerName, s.subtotal, s.discountTotal||0, s.total, cost, profit]);
    });

    Utils.downloadCSV(rows, `reporte_financiero_${from}_a_${to}.csv`);
    Utils.showToast('Reporte exportado a CSV', 'success');
  }
};
