/* =============================================
   FERRETERÍA EL BULE — Módulo Reportes y Estadísticas (reports.js)
   Generación de reportes detallados en $ COP con gráficos y exportación
   ============================================= */

window.Modules = window.Modules || {};
window.Modules.reports = {
  _period: 'month',
  _from: '',
  _to: '',
  _selectedClosureMonth: '',

  render() {
    return `
    <div class="tabs" id="report-tabs">
      <button class="tab-btn" data-period="today">Hoy</button>
      <button class="tab-btn" data-period="week">Esta Semana</button>
      <button class="tab-btn active" data-period="month">Este Mes</button>
      <button class="tab-btn" data-period="year">Este Año</button>
      <button class="tab-btn" data-period="custom">Personalizado</button>
      <button class="tab-btn" data-period="closures" style="background:var(--bg-card);border:1.5px solid #2563eb;color:#2563eb;font-weight:800">🔒 Cierre Mensual y Optimización</button>
    </div>

    <div id="custom-range" style="display:none;margin-bottom:20px" class="filters-bar">
      <label class="form-label" style="margin:0">Desde:</label>
      <input type="date" class="form-control" id="rep-from" style="width:160px">
      <label class="form-label" style="margin:0">Hasta:</label>
      <input type="date" class="form-control" id="rep-to" style="width:160px">
      <button class="btn btn-primary btn-sm" id="btn-apply-range">Aplicar Filtro</button>
    </div>

    <div id="report-content"></div>

    <!-- Modal Detalle de Cierre Mensual -->
    <div class="modal" id="closureDetailModal" style="display:none">
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3 id="closure-detail-title">Detalle de Cierre Mensual</h3>
          <button class="modal-close" onclick="Utils.closeModal('closureDetailModal')">✕</button>
        </div>
        <div class="modal-body" id="closure-detail-body"></div>
        <div class="modal-footer" id="closure-detail-footer"></div>
      </div>
    </div>`;
  },

  init() {
    this._period = 'month';

    document.querySelectorAll('#report-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#report-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._period = btn.dataset.period;
        const customBox = document.getElementById('custom-range');
        if (customBox) customBox.style.display = this._period === 'custom' ? 'flex' : 'none';
        if (this._period === 'closures') {
          this._renderClosuresPanel();
        } else if (this._period !== 'custom') {
          this._generateReport();
        }
      });
    });

    document.getElementById('btn-apply-range')?.addEventListener('click', () => {
      this._from = document.getElementById('rep-from').value;
      this._to = document.getElementById('rep-to').value;
      this._generateReport();
    });

    this._generateReport();
  },

  _goToClosures() {
    const tab = document.querySelector('#report-tabs [data-period="closures"]');
    if (tab) tab.click();
  },

  _getDateRange() {
    const today = Utils.today();
    switch (this._period) {
      case 'today': return [today, today];
      case 'week': return Utils.getCurrentWeekRange();
      case 'month': return [today.slice(0, 7) + '-01', today];
      case 'year': return [today.slice(0, 4) + '-01-01', today.slice(0, 4) + '-12-31'];
      case 'custom': return [this._from || today.slice(0, 4) + '-01-01', this._to || today];
    }
  },

  _generateReport() {
    const [from, to] = this._getDateRange();

    // Solo se contabilizan ventas 100% saldadas en la fecha exacta en la que se completó el pago
    const sales = DB.getAll('sales').filter(s => {
      const settledDate = Utils.getSaleSettledDate(s);
      return settledDate && Utils.dateInRange(settledDate, from, to);
    });
    const purchases = DB.getAll('purchases').filter(p => Utils.dateInRange(Utils.extractDate(p.date || p.datetime), from, to));
    const expenses = DB.getAll('expenses').filter(e => Utils.dateInRange(Utils.extractDate(e.date || e.datetime), from, to));
    const cashMovs = DB.getAll('cash_movements').filter(m => Utils.dateInRange(Utils.extractDate(m.date || m.datetime), from, to));

    const totalRevenue = Utils.sum(sales, 'total');
    const totalCost = sales.reduce((a, s) => {
      const saleCost = (s.items || []).reduce((b, it) => b + ((it.qty || 1) * (it.costPrice || 0)), 0);
      return a + saleCost;
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
      prodMap[it.name].qty += (it.qty || 1);
      prodMap[it.name].revenue += (it.subtotal || 0);
    }));

    const topProducts = Object.values(prodMap).sort((a,b) => b.revenue - a.revenue).slice(0, 10);

    const container = document.getElementById('report-content');
    if (!container) return;

    const pendingMonth = DB.getPendingClosedMonth();
    let bannerHtml = '';
    if (pendingMonth) {
      bannerHtml = `
      <div class="card mb-24" style="background:linear-gradient(135deg, rgba(37,99,235,0.08), rgba(245,158,11,0.08));border:1.5px solid #3b82f6;border-radius:10px;padding:12px 18px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:24px">🔒</span>
            <div>
              <strong style="color:var(--text);font-size:13.5px">Cierre Mensual Pendiente: ${Utils.getMonthLabel(pendingMonth)}</strong>
              <div style="font-size:12px;color:var(--text-muted)">El período anterior ha finalizado. Puedes consolidar el reporte oficial en PDF y optimizar la base de datos de Supabase.</div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="Modules.reports._selectAndCloseMonth('${pendingMonth}')">⚡ Cerrar ${Utils.getMonthLabel(pendingMonth)} Ahora</button>
        </div>
      </div>`;
    }

    let html = `
    ${bannerHtml}
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
  },

  _getAvailableMonthsToClose() {
    const monthsSet = new Set();
    const todayMonth = Utils.today().slice(0, 7);
    const prevMonth = Utils.getPreviousMonth();

    monthsSet.add(prevMonth);
    monthsSet.add(todayMonth);

    // Agregar meses existentes en los registros
    DB.getAll('sales').forEach(s => {
      const d = Utils.getSaleSettledDate(s) || Utils.extractDate(s.date || s.datetime);
      if (d && d.length >= 7) monthsSet.add(d.slice(0, 7));
    });
    DB.getAll('purchases').forEach(p => {
      const d = Utils.extractDate(p.date || p.createdAt);
      if (d && d.length >= 7) monthsSet.add(d.slice(0, 7));
    });
    DB.getAll('expenses').forEach(e => {
      const d = Utils.extractDate(e.date || e.datetime);
      if (d && d.length >= 7) monthsSet.add(d.slice(0, 7));
    });
    DB.getAll('monthly_closures').forEach(c => {
      if (c.month) monthsSet.add(c.month);
    });

    return Array.from(monthsSet).sort().reverse();
  },

  _renderClosuresPanel() {
    const container = document.getElementById('report-content');
    if (!container) return;

    const availableMonths = this._getAvailableMonthsToClose();
    const prevMonth = Utils.getPreviousMonth();
    if (!this._selectedClosureMonth) {
      this._selectedClosureMonth = DB.isMonthClosed(prevMonth) ? (availableMonths[0] || prevMonth) : prevMonth;
    }

    const currentMonth = this._selectedClosureMonth;
    const isClosed = DB.isMonthClosed(currentMonth);
    const previewData = DB.getMonthlyClosureData(currentMonth);
    const closuresHistory = DB.getAll('monthly_closures').slice().reverse();
    const pendingMonth = DB.getPendingClosedMonth();

    const monthOptions = availableMonths.map(ym => {
      const closed = DB.isMonthClosed(ym);
      const label = Utils.getMonthLabel(ym);
      return `<option value="${ym}" ${ym === currentMonth ? 'selected' : ''}>${label} ${closed ? '✅ (Cerrado)' : '⏳ (Pendiente)'}</option>`;
    }).join('');

    let pendingAlert = '';
    if (pendingMonth && !DB.isMonthClosed(pendingMonth)) {
      pendingAlert = `
      <div class="card mb-20" style="background:#eff6ff;border:1.5px solid #3b82f6;border-radius:10px;padding:14px 18px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-weight:800;font-size:14px;color:#1e3a8a">🔔 Cierre Automático Pendiente: ${Utils.getMonthLabel(pendingMonth)}</div>
            <div style="font-size:12.5px;color:#3b82f6;margin-top:2px">El período anterior ya finalizó. Realiza el cierre mensual para consolidar el reporte oficial en PDF y limpiar las operaciones pasadas de Supabase.</div>
          </div>
          <button class="btn btn-primary" onclick="Modules.reports._selectAndCloseMonth('${pendingMonth}')">⚡ Cerrar ${Utils.getMonthLabel(pendingMonth)} Ahora</button>
        </div>
      </div>`;
    }

    const html = `
    ${pendingAlert}

    <!-- Panel de Control de Cierre Mensual -->
    <div class="card mb-24">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <span class="card-title">🔒 Cierre Mensual y Consolidación de Operaciones</span>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
            Genera el reporte oficial en PDF y optimiza la base de datos de Supabase archivando movimientos cerrados pasados.
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <label style="font-size:12.5px;font-weight:700">Seleccionar Mes:</label>
          <select id="closure-month-select" class="form-select" style="width:230px;font-weight:700">
            ${monthOptions}
          </select>
        </div>
      </div>
      <div class="card-body">

        <!-- Estado del mes seleccionado -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;background:var(--bg-input);padding:12px 16px;border-radius:8px;border:1px solid var(--border)">
          <div>
            <strong>Mes seleccionado:</strong> <span class="text-accent font-bold">${Utils.getMonthLabel(currentMonth)}</span>
            <span style="margin-left:12px">${isClosed ? '<span class="badge badge-success">✅ Mes Cerrado y Archivado</span>' : '<span class="badge badge-warning">⏳ Pendiente de Cierre</span>'}</span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm" id="btn-preview-closure-pdf" title="Previsualizar o descargar el reporte en PDF">
              📄 Previsualizar Reporte PDF
            </button>
            ${!isClosed ? `
              <button class="btn btn-primary btn-sm" id="btn-execute-closure" style="font-weight:800;background:#16a34a;border-color:#16a34a" title="Ejecutar cierre mensual, descargar PDF y optimizar la base de datos">
                🔒 Cerrar Mes y Optimizar Base de Datos
              </button>
            ` : `
              <button class="btn btn-info btn-sm" onclick="Modules.reports._rePrintClosure('${currentMonth}')" title="Descargar nuevamente el reporte oficial en PDF">
                📄 Descargar Reporte PDF
              </button>
            `}
          </div>
        </div>

        <!-- Previsualización de Métricas del Mes -->
        <div class="grid-4 mb-16">
          <div class="stat-card">
            <div class="stat-icon green">💰</div>
            <div class="stat-info">
              <div class="stat-label">Ventas Netas Saldadas</div>
              <div class="stat-value success">${Utils.formatCurrency(previewData.totalSales)}</div>
              <div class="stat-subtext">${previewData.settledSales.length} factura(s) saldada(s)</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon yellow">📦</div>
            <div class="stat-info">
              <div class="stat-label">Costo de Mercancía</div>
              <div class="stat-value accent">${Utils.formatCurrency(previewData.totalCost)}</div>
              <div class="stat-subtext">Ganancia Bruta: ${Utils.formatCurrency(previewData.grossProfit)}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon red">💸</div>
            <div class="stat-info">
              <div class="stat-label">Gastos Operativos</div>
              <div class="stat-value danger">${Utils.formatCurrency(previewData.totalExpenses)}</div>
              <div class="stat-subtext">${previewData.expenses.length} gasto(s)</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon ${previewData.netProfit >= 0 ? 'green' : 'red'}">📈</div>
            <div class="stat-info">
              <div class="stat-label">Ganancia Neta Real</div>
              <div class="stat-value ${previewData.netProfit >= 0 ? 'success' : 'danger'}">${Utils.formatCurrency(previewData.netProfit)}</div>
              <div class="stat-subtext">Compras: ${Utils.formatCurrency(previewData.totalPurchases)}</div>
            </div>
          </div>
        </div>

        <!-- Cajas de Auditoría e Integridad del Stock -->
        <div class="grid-2" style="gap:14px">
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-size:12.5px">
            <div style="font-weight:700;color:var(--text);margin-bottom:6px">🧹 Optimización de Base de Datos para este mes:</div>
            <div style="color:var(--text-muted);line-height:1.6">
              • <strong>${previewData.settledSales.length + previewData.annulledSales.length}</strong> facturas saldadas/cerradas se consolidarán.<br>
              • <strong>${previewData.purchases.length}</strong> compras a proveedores archivadas en el resumen.<br>
              • <strong>${previewData.expenses.length}</strong> gastos operativos y <strong>${previewData.cashMovements.length}</strong> movimientos de caja consolidados.<br>
              • <em>El saldo neto de caja de <strong>${Utils.formatCurrency(previewData.cashNet)}</strong> se transfiere intacto al siguiente mes.</em>
            </div>
          </div>

          <div style="background:rgba(22,163,74,0.06);border:1px solid rgba(22,163,74,0.3);border-radius:8px;padding:12px 14px;font-size:12.5px">
            <div style="font-weight:700;color:#16a34a;margin-bottom:6px">🛡️ Garantía de Integridad de Stock y Clientes:</div>
            <div style="color:var(--text);line-height:1.6">
              • <strong>${previewData.inventoryIntegrity.productsCount} productos en catálogo</strong> (${previewData.inventoryIntegrity.totalStockUnits} unds en stock) <strong>NUNCA se tocan ni se borran</strong>.<br>
              • <strong>${previewData.inventoryIntegrity.customersCount} clientes registrados</strong> se mantienen 100% intactos.<br>
              • <strong>${previewData.pendingSalesCount} ventas a crédito pendientes</strong> (${Utils.formatCurrency(previewData.pendingSalesBalance)}) <strong>se conservan activas</strong> para su cobro.
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Historial de Cierres Mensuales Realizados -->
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <span class="card-title">📜 Historial de Cierres Mensuales y Descarga de PDF</span>
        <span class="badge badge-info">${closuresHistory.length} cierre(s) registrado(s)</span>
      </div>
      <div class="card-body" style="padding:0">
        ${closuresHistory.length === 0 ? Utils.emptyState('Todavía no se ha realizado ningún cierre mensual', '🔒') : `
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Mes Cerrado</th>
                  <th>Fecha de Cierre</th>
                  <th>Ventas Netas</th>
                  <th>Compras</th>
                  <th>Gastos</th>
                  <th>Ganancia Neta</th>
                  <th>Caja Neta</th>
                  <th>Registros Optimizados</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${closuresHistory.map(c => {
                  const s = c.summary || {};
                  const cleanedCount = (s.itemsCleaned?.sales || 0) + (s.itemsCleaned?.purchases || 0) + (s.itemsCleaned?.expenses || 0) + (s.itemsCleaned?.cashMovements || 0);
                  return `
                  <tr>
                    <td><strong>${Utils.escHtml(c.monthLabel || c.month)}</strong></td>
                    <td><small>${Utils.formatDatetime(c.closedAt)}</small></td>
                    <td class="text-success font-bold">${Utils.formatCurrency(s.totalSales || 0)}</td>
                    <td>${Utils.formatCurrency(s.totalPurchases || 0)}</td>
                    <td class="text-danger">${Utils.formatCurrency(s.totalExpenses || 0)}</td>
                    <td class="${(s.netProfit || 0) >= 0 ? 'text-success' : 'text-danger'} font-bold">${Utils.formatCurrency(s.netProfit || 0)}</td>
                    <td class="font-bold">${Utils.formatCurrency(s.cashNet || 0)}</td>
                    <td><span class="badge badge-info" style="font-size:11px">${cleanedCount} registros</span></td>
                    <td class="actions">
                      <button class="btn btn-sm btn-primary" onclick="Modules.reports._rePrintClosure('${c.month}')" title="Descargar Reporte Oficial en PDF">
                        📄 Descargar PDF
                      </button>
                      <button class="btn btn-sm btn-secondary" onclick="Modules.reports._openClosureDetail('${c.id}')" title="Ver Detalle Completo">
                        👁️
                      </button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>`;

    container.innerHTML = html;

    // Listeners del panel de cierre
    document.getElementById('closure-month-select')?.addEventListener('change', (e) => {
      this._selectedClosureMonth = e.target.value;
      this._renderClosuresPanel();
    });

    document.getElementById('btn-preview-closure-pdf')?.addEventListener('click', () => {
      if (window.PrintModule && window.PrintModule.printMonthlyClosure) {
        window.PrintModule.printMonthlyClosure(previewData);
      }
    });

    document.getElementById('btn-execute-closure')?.addEventListener('click', () => {
      this._confirmAndExecuteClosure(currentMonth);
    });
  },

  _selectAndCloseMonth(ym) {
    this._selectedClosureMonth = ym;
    this._renderClosuresPanel();
    this._confirmAndExecuteClosure(ym);
  },

  _confirmAndExecuteClosure(yearMonth) {
    const data = DB.getMonthlyClosureData(yearMonth);
    const msg = `¿Confirmas el Cierre Mensual de ${data.monthLabel}?\n\n` +
      `📊 RESUMEN A CONSOLIDAR:\n` +
      `• Ventas Netas Saldadas: ${Utils.formatCurrency(data.totalSales)} (${data.settledSales.length} facturas)\n` +
      `• Compras a Proveedores: ${Utils.formatCurrency(data.totalPurchases)}\n` +
      `• Gastos Operativos: ${Utils.formatCurrency(data.totalExpenses)}\n` +
      `• Ganancia Neta Real: ${Utils.formatCurrency(data.netProfit)}\n` +
      `• Balance Neto de Caja: ${Utils.formatCurrency(data.cashNet)}\n\n` +
      `🛡️ SEGURIDAD DE LA BASE DE DATOS:\n` +
      `• Se descargará el reporte oficial en PDF.\n` +
      `• Se limpiarán los registros operativos pasados cerrados para optimizar Supabase.\n` +
      `• El inventario de productos (stock actual) y los clientes NO se eliminarán.\n\n` +
      `¿Deseas continuar?`;

    if (!Utils.confirm(msg)) return;

    try {
      const closure = DB.executeMonthlyClosure(yearMonth, 'Administrador');

      // Descargar/Imprimir automáticamente el reporte en PDF
      if (window.PrintModule && window.PrintModule.printMonthlyClosure) {
        setTimeout(() => {
          window.PrintModule.printMonthlyClosure(closure);
        }, 300);
      }

      Utils.showToast(`✅ Cierre de ${closure.monthLabel} completado y base de datos optimizada exitosamente.`, 'success');
      this._renderClosuresPanel();
    } catch (err) {
      console.error(err);
      Utils.showToast('Error al ejecutar el cierre mensual: ' + err.message, 'error');
    }
  },

  _rePrintClosure(month) {
    const closure = DB.getAll('monthly_closures').find(c => c.month === month);
    if (!closure) {
      Utils.showToast('No se encontró el registro de cierre', 'error');
      return;
    }
    if (window.PrintModule && window.PrintModule.printMonthlyClosure) {
      window.PrintModule.printMonthlyClosure(closure);
    }
  },

  _openClosureDetail(id) {
    const closure = DB.findById('monthly_closures', id) || DB.getAll('monthly_closures').find(c => c.id === id);
    if (!closure) return;

    const s = closure.summary || {};
    const integrity = s.inventoryIntegrity || {};
    const cleaned = s.itemsCleaned || {};

    const html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
      <div style="background:var(--bg-input);padding:12px 14px;border-radius:8px">
        <p><strong>Mes Cerrado:</strong> <span class="text-accent font-bold">${Utils.escHtml(closure.monthLabel || closure.month)}</span></p>
        <p><strong>Fecha de Cierre:</strong> ${Utils.formatDatetime(closure.closedAt)}</p>
        <p><strong>Responsable:</strong> ${Utils.escHtml(closure.closedBy || 'Administrador')}</p>
        <p><strong>Rango de Fechas:</strong> ${closure.dateRange ? `${Utils.formatDate(closure.dateRange[0])} al ${Utils.formatDate(closure.dateRange[1])}` : '—'}</p>
      </div>
      <div style="background:var(--bg-input);padding:12px 14px;border-radius:8px">
        <p><strong>Ventas Netas:</strong> <span class="text-success font-bold">${Utils.formatCurrency(s.totalSales || 0)}</span> (${s.salesCount || 0} facturas)</p>
        <p><strong>Costo de Mercancía:</strong> <span class="text-danger">-${Utils.formatCurrency(s.totalCost || 0)}</span></p>
        <p><strong>Gastos Operativos:</strong> <span class="text-danger">-${Utils.formatCurrency(s.totalExpenses || 0)}</span></p>
        <p><strong>Ganancia Neta Real:</strong> <span class="${(s.netProfit||0)>=0?'text-success':'text-danger'} font-bold" style="font-size:16px">${Utils.formatCurrency(s.netProfit || 0)}</span></p>
      </div>
    </div>

    <div class="section-title mb-8" style="font-size:13px;font-weight:800">📦 Verificación de Integridad de Inventario y Clientes</div>
    <div style="background:rgba(22,163,74,0.06);border:1px solid rgba(22,163,74,0.3);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12.5px">
      ✅ <strong>100% Preservado:</strong> El inventario físico (${integrity.productsCount || 0} productos, ${integrity.totalStockUnits || 0} unds en stock) y los ${integrity.customersCount || 0} clientes no sufrieron ninguna eliminación ni alteración durante este cierre contable.
    </div>

    <div class="section-title mb-8" style="font-size:13px;font-weight:800">🧹 Registros Consolidados y Optimizados de Supabase</div>
    <table class="table mb-16">
      <thead><tr><th>Tipo de Registro</th><th>Cantidad Optimizada</th><th>Impacto en Base de Datos</th></tr></thead>
      <tbody>
        <tr><td>Facturas Saldadas</td><td>${cleaned.sales || 0}</td><td>Archivadas del histórico principal</td></tr>
        <tr><td>Compras a Proveedores</td><td>${cleaned.purchases || 0}</td><td>Consolidadas en el reporte mensual</td></tr>
        <tr><td>Gastos Operativos</td><td>${cleaned.expenses || 0}</td><td>Consolidados en el balance financiero</td></tr>
        <tr><td>Movimientos de Caja</td><td>${cleaned.cashMovements || 0}</td><td>Reemplazados por saldo inicial de apertura</td></tr>
        <tr><td>Movimientos de Kardex</td><td>${cleaned.movements || 0}</td><td>Archivados con éxito</td></tr>
      </tbody>
    </table>`;

    document.getElementById('closure-detail-title').textContent = `Cierre Contable — ${closure.monthLabel || closure.month}`;
    document.getElementById('closure-detail-body').innerHTML = html;
    document.getElementById('closure-detail-footer').innerHTML = `
      <button class="btn btn-primary" onclick="Modules.reports._rePrintClosure('${closure.month}')">📄 Descargar Reporte en PDF</button>
      <button class="btn btn-secondary" onclick="Utils.closeModal('closureDetailModal')">Cerrar</button>
    `;

    Utils.openModal('closureDetailModal');
  }
};
