/* =============================================
   FERRETERÍA EL BULE — Módulo Dashboard (dashboard.js)
   Rediseño visual idéntico a la captura de referencia
   ============================================= */

window.Modules = window.Modules || {};
window.Modules.dashboard = {
  _salesPeriod: 'today',

  render() {
    const sales = DB.getAll('sales').filter(s => s.status !== 'anulada');
    const products = DB.getAll('products').filter(p => p.active !== false);
    const cashBalance = DB.getCashBalance();

    const today = Utils.today();
    const d = new Date(today);

    // Week range
    const dayOfWeek = d.getDay();
    const monday = new Date(d); monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const monStr = monday.toISOString().split('T')[0];
    const sunStr = sunday.toISOString().split('T')[0];

    // Month & Year
    const monthStr = today.slice(0, 7);
    const yearStr = today.slice(0, 4);

    // Sales Metrics
    const todaySales = sales.filter(s => s.date === today);
    const weekSales  = sales.filter(s => s.date >= monStr && s.date <= sunStr);
    const monthSales = sales.filter(s => s.date && s.date.startsWith(monthStr));
    const yearSales  = sales.filter(s => s.date && s.date.startsWith(yearStr));

    const todayTotal = Utils.sum(todaySales, 'total');
    const weekTotal  = Utils.sum(weekSales, 'total');
    const monthTotal = Utils.sum(monthSales, 'total');
    const yearTotal  = Utils.sum(yearSales, 'total');

    // Real profit
    const getRealProfit = (arr) => arr.reduce((acc, s) => {
      if (s.realProfit !== undefined) return acc + s.realProfit;
      const cost = (s.items || []).reduce((cAcc, it) => cAcc + ((it.qty || 1) * (it.costPrice || 0)), 0);
      return acc + Math.max(0, s.total - cost);
    }, 0);

    const todayProfit = getRealProfit(todaySales);
    const profitMargin = todayTotal > 0 ? ((todayProfit / todayTotal) * 100).toFixed(1) : '0';

    // Products & Values
    const totalProductsCount = products.length;
    const invCostValue = products.reduce((a,p) => a + ((p.stock||0) * (p.costPrice||0)), 0);

    const lowStockList = products.filter(p => p.stock <= (p.minStock || 5));

    return `
    <!-- Fila 1: Tarjetas Principales de Ventas (4 tarjetas) -->
    <div class="grid-4 mb-24">
      <div class="stat-card">
        <div class="stat-icon green">💵</div>
        <div class="stat-info">
          <div class="stat-label">Ventas del día</div>
          <div class="stat-value">${Utils.formatCurrency(todayTotal)}</div>
          <div class="stat-subtext">${todaySales.length} ventas</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon blue">💳</div>
        <div class="stat-info">
          <div class="stat-label">Ventas de la semana</div>
          <div class="stat-value">${Utils.formatCurrency(weekTotal)}</div>
          <div class="stat-subtext">${weekSales.length} ventas</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon purple">👛</div>
        <div class="stat-info">
          <div class="stat-label">Ventas del mes</div>
          <div class="stat-value">${Utils.formatCurrency(monthTotal)}</div>
          <div class="stat-subtext">${monthSales.length} ventas</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon orange">💰</div>
        <div class="stat-info">
          <div class="stat-label">Ventas del año</div>
          <div class="stat-value">${Utils.formatCurrency(yearTotal)}</div>
          <div class="stat-subtext">${yearSales.length} ventas</div>
        </div>
      </div>
    </div>

    <!-- Fila 2: Ganancia, Inventario, Valor y Caja (4 tarjetas) -->
    <div class="grid-4 mb-24">
      <div class="stat-card">
        <div class="stat-icon green">📈</div>
        <div class="stat-info">
          <div class="stat-label">Ganancia del día</div>
          <div class="stat-value">${Utils.formatCurrency(todayProfit)}</div>
          <div class="stat-subtext text-success">${profitMargin}% del total</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon blue">📦</div>
        <div class="stat-info">
          <div class="stat-label">Productos en inventario</div>
          <div class="stat-value">${totalProductsCount.toLocaleString('es-CO')}</div>
          <div class="stat-subtext">Productos registrados</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon purple">🏷️</div>
        <div class="stat-info">
          <div class="stat-label">Valor del inventario</div>
          <div class="stat-value">${Utils.formatCurrency(invCostValue)}</div>
          <div class="stat-subtext">Costo total</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon orange">🏦</div>
        <div class="stat-info">
          <div class="stat-label">Caja actual</div>
          <div class="stat-value">${Utils.formatCurrency(cashBalance)}</div>
          <div class="stat-subtext">Dinero en caja</div>
        </div>
      </div>
    </div>

    <!-- Fila 3: Gráficos de Ventas y Categorías (Lado a Lado) -->
    <div class="grid-2 mb-24">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Ventas</span>
          <select class="form-select" id="dash-chart-filter" style="width:140px;font-size:12px;padding:4px 10px">
            <option value="mes">Ventas del mes</option>
            <option value="semana">Últimos 7 días</option>
          </select>
        </div>
        <div class="card-body">
          <div class="chart-container"><canvas id="dashMainChart"></canvas></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Ventas por categoría (mes)</span>
        </div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:20px;height:240px">
            <div style="width:180px;height:180px;position:relative">
              <canvas id="dashDoughnutChart"></canvas>
            </div>
            <div id="dash-category-legend" style="flex:1;overflow-y:auto;max-height:220px;font-size:12px"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fila 4: Ventas Recientes y Productos Bajo Stock (Lado a Lado) -->
    <div class="grid-2">
      <!-- Ventas Recientes -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Ventas recientes</span>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="tabs" id="dash-sales-tabs" style="margin-bottom:0;padding:3px;gap:2px">
              <button class="tab-btn active" data-tab="today" style="padding:4px 10px;font-size:11.5px">Hoy</button>
              <button class="tab-btn" data-tab="week" style="padding:4px 10px;font-size:11.5px">Semana</button>
              <button class="tab-btn" data-tab="month" style="padding:4px 10px;font-size:11.5px">Mes</button>
              <button class="tab-btn" data-tab="year" style="padding:4px 10px;font-size:11.5px">Año</button>
            </div>
            <a href="#sales" class="btn btn-primary btn-sm">+ Nueva venta</a>
          </div>
        </div>
        <div class="card-body" style="padding:0">
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Método de pago</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="dash-recent-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Productos con bajo stock -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Productos con bajo stock</span>
          <a href="#inventory" style="font-size:12px;color:var(--accent);font-weight:600;text-decoration:none">Ver todos</a>
        </div>
        <div class="card-body" style="padding:12px 18px" id="dash-lowstock-list">
          <!-- Rendered in _renderLowStockList() -->
        </div>
      </div>
    </div>`;
  },

  init() {
    this._salesPeriod = 'today';
    this._renderRecentSalesTable();
    this._renderLowStockList();

    // Tabs listener
    document.querySelectorAll('#dash-sales-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#dash-sales-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._salesPeriod = btn.dataset.tab;
        this._renderRecentSalesTable();
      });
    });

    document.getElementById('dash-chart-filter')?.addEventListener('change', () => this._drawMainChart());

    setTimeout(() => {
      this._drawMainChart();
      this._drawDoughnutChart();
    }, 100);
  },

  _renderRecentSalesTable() {
    const tbody = document.getElementById('dash-recent-tbody');
    if (!tbody) return;

    const sales = DB.getAll('sales').filter(s => s.status !== 'anulada');
    const today = Utils.today();
    const d = new Date(today);

    let filtered = sales;
    if (this._salesPeriod === 'today') {
      filtered = sales.filter(s => s.date === today);
    } else if (this._salesPeriod === 'week') {
      const dayOfWeek = d.getDay();
      const monday = new Date(d); monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
      const monStr = monday.toISOString().split('T')[0];
      filtered = sales.filter(s => s.date >= monStr);
    } else if (this._salesPeriod === 'month') {
      filtered = sales.filter(s => s.date && s.date.startsWith(today.slice(0,7)));
    } else if (this._salesPeriod === 'year') {
      filtered = sales.filter(s => s.date && s.date.startsWith(today.slice(0,4)));
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7">${Utils.emptyState('No hay ventas en este período', '🧾')}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.slice(-6).reverse().map(s => {
      const itemsCount = (s.items||[]).reduce((a,it)=>a+(it.qty||1),0);
      return `
      <tr>
        <td><strong>${Utils.escHtml(s.invoiceNumber)}</strong></td>
        <td class="muted"><small>${Utils.formatDatetime(s.datetime)}</small></td>
        <td>${Utils.escHtml(s.customerName)}</td>
        <td style="text-align:center">${itemsCount}</td>
        <td class="text-success font-bold">${Utils.formatCurrency(s.total)}</td>
        <td><small>${Utils.escHtml(s.paymentMethod||'efectivo').toUpperCase()}</small></td>
        <td class="actions">
          <button class="btn btn-sm btn-ghost" title="Ver" onclick="Modules.sales._viewSale('${s.id}')">👁️</button>
          <button class="btn btn-sm btn-ghost" title="Editar" onclick="Modules.sales._editSale('${s.id}')">✏️</button>
          <button class="btn btn-sm btn-ghost" title="Imprimir" onclick="if(window.PrintModule)PrintModule.printInvoice('${s.id}')">🖨️</button>
        </td>
      </tr>`;
    }).join('');
  },

  _renderLowStockList() {
    const container = document.getElementById('dash-lowstock-list');
    if (!container) return;

    const products = DB.getAll('products').filter(p => p.active !== false);
    const lowStock = products.filter(p => p.stock <= (p.minStock || 5)).slice(0, 5);

    if (lowStock.length === 0) {
      container.innerHTML = Utils.emptyState('Inventario con stock óptimo', '✅');
      return;
    }

    container.innerHTML = lowStock.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:36px;height:36px;border-radius:8px;background:var(--bg-input);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px">
            🔧
          </div>
          <div>
            <div style="font-weight:700;font-size:13px">${Utils.escHtml(p.name)}</div>
            <div style="font-size:11.5px;color:var(--text-muted)">Stock: <strong>${p.stock}</strong> ${Utils.escHtml(p.unit||'und')}</div>
          </div>
        </div>
        <div style="text-align:right">
          <span class="badge badge-danger">⚠️ Mín: ${p.minStock||5}</span>
        </div>
      </div>
    `).join('');
  },

  _drawMainChart() {
    const canvas = document.getElementById('dashMainChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const filter = document.getElementById('dash-chart-filter')?.value || 'mes';
    const sales = DB.getAll('sales').filter(s => s.status !== 'anulada');

    const points = [];
    const now = new Date();

    if (filter === 'semana') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        const daySales = sales.filter(s => s.date === dStr);
        const label = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        points.push({ label, total: Utils.sum(daySales, 'total') });
      }
    } else {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day += 3) {
        const mStr = now.toISOString().slice(0, 7);
        const dStr = `${mStr}-${String(day).padStart(2, '0')}`;
        const daySales = sales.filter(s => s.date === dStr);
        const label = `${String(day).padStart(2, '0')} ${now.toLocaleDateString('es-CO', { month: 'short' })}`;
        points.push({ label, total: Utils.sum(daySales, 'total') });
      }
    }

    const maxVal = Math.max(...points.map(p => p.total), 300000);
    const padding = { top: 20, right: 20, bottom: 40, left: 65 };
    const chartW = canvas.width - padding.left - padding.right;
    const chartH = canvas.height - padding.top - padding.bottom;

    // Grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(canvas.width - padding.right, y); ctx.stroke();
      ctx.fillStyle = '#94a3b8'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
      ctx.fillText(Utils.formatCurrency(maxVal - (maxVal / 4) * i), padding.left - 8, y + 4);
    }

    const pts = points.map((p, i) => {
      const x = padding.left + (chartW / (points.length - 1 || 1)) * i;
      const y = padding.top + chartH - ((p.total / maxVal) * chartH);
      return { x, y, label: p.label, total: p.total };
    });

    // Smooth Bezier Curve & Fill
    if (pts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.lineTo(pts[pts.length - 1].x, padding.top + chartH);
      ctx.lineTo(pts[0].x, padding.top + chartH);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
      grad.addColorStop(0, 'rgba(37, 99, 235, 0.35)');
      grad.addColorStop(1, 'rgba(37, 99, 235, 0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke Line
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }

    // Points
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2563eb'; ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

      ctx.fillStyle = '#64748b'; ctx.font = '10px Inter'; ctx.textAlign = 'center';
      ctx.fillText(p.label, p.x, canvas.height - padding.bottom + 18);
    });
  },

  _drawDoughnutChart() {
    const canvas = document.getElementById('dashDoughnutChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const sales = DB.getAll('sales').filter(s => s.status !== 'anulada');
    const monthStr = Utils.today().slice(0, 7);
    const monthSales = sales.filter(s => s.date && s.date.startsWith(monthStr));

    const catTotals = {};
    monthSales.forEach(s => (s.items||[]).forEach(it => {
      const p = DB.findById('products', it.productId);
      const cat = (p && p.category) ? p.category : 'Otros';
      catTotals[cat] = (catTotals[cat] || 0) + (it.subtotal || 0);
    }));

    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#94a3b8', '#ec4899', '#06b6d4'];
    const entries = Object.entries(catTotals).sort((a,b) => b[1] - a[1]);
    const totalMonthRev = entries.reduce((a,e) => a + e[1], 0);

    const legendEl = document.getElementById('dash-category-legend');
    if (legendEl) {
      if (entries.length === 0) {
        legendEl.innerHTML = `<p style="color:var(--text-muted)">Sin ventas este mes</p>`;
      } else {
        legendEl.innerHTML = entries.map(([cat, val], i) => {
          const pct = totalMonthRev > 0 ? ((val / totalMonthRev) * 100).toFixed(1) : '0';
          const col = colors[i % colors.length];
          return `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="width:10px;height:10px;border-radius:50%;background:${col};display:inline-block"></span>
              <strong>${Utils.escHtml(cat)}</strong>
            </div>
            <div style="color:var(--text-muted)">${Utils.formatCurrency(val)} (${pct}%)</div>
          </div>`;
        }).join('');
      }
    }

    // Draw Doughnut Ring
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const outerRadius = Math.min(centerX, centerY) - 10;
    const innerRadius = outerRadius * 0.65;

    let startAngle = -Math.PI / 2;

    if (entries.length === 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, true);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
    } else {
      entries.forEach(([cat, val], i) => {
        const sliceAngle = (val / totalMonthRev) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
        ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        startAngle += sliceAngle;
      });
    }

    // Center text
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Total Mes', centerX, centerY - 6);

    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 13px Inter';
    ctx.fillText(Utils.formatCurrency(totalMonthRev), centerX, centerY + 14);
  }
};
