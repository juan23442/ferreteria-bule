/* =============================================
   FERRETERÍA EL BULE — Utilities (utils.js)
   Formato de Moneda Colombiana ($ COP) y Funciones Auxiliares
   ============================================= */

const Utils = {

  // Formato estándar Pesos Colombianos ($ 50.000)
  formatCurrency(amount) {
    const n = parseFloat(amount) || 0;
    const isInteger = Math.abs(n - Math.round(n)) < 0.001;
    const formatted = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: isInteger ? 0 : 2,
      maximumFractionDigits: isInteger ? 0 : 2
    }).format(n);

    return `$ ${formatted}`;
  },

  formatDate(d) {
    if (!d) return '';
    const parts = String(d).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  },

  formatDatetime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  },

  today() { return new Date().toISOString().split('T')[0]; },

  nowISO() { return new Date().toISOString(); },

  generateId(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  },

  pad(n, w = 4) { return String(n).padStart(w, '0'); },

  debounce(fn, delay = 120) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  buildInvoiceNum() {
    const s = DB.getSettings();
    const n = DB.nextInvoiceNumber();
    return `${s.invoicePrefix || 'FAC'}-${this.pad(n)}`;
  },

  dateInRange(dateStr, from, to) {
    if (!dateStr) return false;
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
  },

  sum(arr, key) {
    return arr.reduce((a, x) => a + (parseFloat(x[key]) || 0), 0);
  },

  escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  // ---- Notificaciones Toast ----
  showToast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    const icons = { success:'✓', error:'✕', warning:'⚠️', info:'ℹ️' };
    t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span>${this.escHtml(msg)}</span>`;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3200);
  },

  confirm(msg) { return window.confirm(msg); },

  // ---- Descargas de archivos ----
  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this._download(blob, filename);
  },

  downloadCSV(rows, filename) {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8;' });
    this._download(blob, filename);
  },

  _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href:url, download:filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // ---- Manejo de Modales ----
  openModal(id) {
    const m = document.getElementById(id);
    if (m) { m.style.display = 'flex'; requestAnimationFrame(() => m.classList.add('active')); }
  },

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.remove('active'); setTimeout(() => { m.style.display = 'none'; }, 300); }
  },

  closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => {
      m.classList.remove('active');
      setTimeout(() => { m.style.display = 'none'; }, 300);
    });
  },

  // ---- Insignias de Stock ----
  stockBadge(stock, minStock) {
    const st = parseInt(stock) || 0;
    const min = parseInt(minStock) || 3;
    if (st <= 0) return `<span class="badge badge-danger">🔴 Agotado</span>`;
    if (st <= min) return `<span class="badge badge-warning">🟡 Stock bajo</span>`;
    return `<span class="badge badge-success">🟢 Disponible</span>`;
  },

  // ---- Insignias de Estado ----
  statusBadge(status) {
    const map = {
      pagada:           { class: 'success',  icon: '🟢', text: 'Pagada' },
      completada:       { class: 'success',  icon: '🟢', text: 'Pagada' },
      editada:          { class: 'info',     icon: '🔵', text: 'Editada' },
      pendiente:        { class: 'warning',  icon: '🟡', text: 'Pendiente' },
      con_abono:        { class: 'orange',   icon: '🟠', text: 'Con Abono' },
      pagada_no_retirada: { class: 'info',   icon: '🔵', text: 'Pagada · No retirada' },
      retirada:         { class: 'gray',     icon: '⚫', text: 'Retirada' },
      anulada:          { class: 'danger',   icon: '🔴', text: 'Anulada' }
    };
    const s = map[status] || { class: 'info', icon: '❓', text: status || 'Desconocido' };
    return `<span class="badge badge-${s.class}">${s.icon} ${s.text}</span>`;
  },

  // ---- Estado vacío ----
  emptyState(msg = 'Sin registros', icon = '📋') {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${msg}</p></div>`;
  }
};
