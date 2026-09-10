/* =============================================
   FERRETERÍA EL BULE — Módulo Configuración (settings.js)
   Configuración de Empresa, Logo, Moneda $ COP y Copias de Seguridad
   ============================================= */

window.Modules = window.Modules || {};
window.Modules.settings = {
  render() {
    const s = DB.getSettings();
    return `
    <div class="settings-section">
      <div class="settings-section-header">🏢 Datos de la Empresa (FERRO PINTURAS EL BULE)</div>
      <div class="settings-section-body">
        <div class="form-group" style="text-align:center;margin-bottom:20px">
          ${s.logo ? `<img src="${s.logo}" class="logo-preview" id="logo-preview">` : `<div class="logo-preview" id="logo-preview" style="display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--text-muted)">🏪</div>`}
          <div class="file-upload" id="logo-upload" style="margin-top:10px;max-width:320px;margin-left:auto;margin-right:auto">📁 Clic para cargar o cambiar logo</div>
          <input type="file" id="logo-input" accept="image/*" style="display:none">
          ${s.logo ? `<button class="btn btn-sm btn-danger mt-8" id="btn-remove-logo">Eliminar Logo Actual</button>` : ''}
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Nombre del Negocio *</label><input class="form-control" id="set-name" value="${Utils.escHtml(s.companyName || 'FERRO PINTURAS EL BULE')}"></div>
          <div class="form-group"><label class="form-label">NIT / Rut / Documento</label><input class="form-control" id="set-nit" value="${Utils.escHtml(s.nit||'')}"></div>
        </div>
        <div class="form-group"><label class="form-label">Dirección Comercial</label><input class="form-control" id="set-address" value="${Utils.escHtml(s.address||'')}"></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Teléfonos de Contacto</label><input class="form-control" id="set-phone" value="${Utils.escHtml(s.phone||'')}"></div>
          <div class="form-group"><label class="form-label">Correo Electrónico</label><input class="form-control" id="set-email" value="${Utils.escHtml(s.email||'')}"></div>
        </div>
        <div class="form-group"><label class="form-label">Información Adicional / Pie de Factura</label><textarea class="form-control form-textarea" id="set-notes" rows="3">${Utils.escHtml(s.invoiceNotes||'')}</textarea></div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-header">💰 Configuración de Moneda y Facturación</div>
      <div class="settings-section-body">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Símbolo de Moneda</label><input class="form-control font-bold text-accent" id="set-currency" value="${Utils.escHtml(s.currency || '$')}" style="width:120px"></div>
          <div class="form-group"><label class="form-label">Prefijo de Facturas</label><input class="form-control" id="set-prefix" value="${Utils.escHtml(s.invoicePrefix || 'FAC')}" style="width:140px"></div>
          <div class="form-group"><label class="form-label">Número de Contador de Factura Actual</label><input class="form-control" type="number" id="set-inv-num" min="1" value="${DB.getInvoiceCounter()}"></div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-header">💾 Respaldos y Seguridad de Datos</div>
      <div class="settings-section-body">
        <div class="grid-3" style="gap:14px">
          <button class="btn btn-info btn-block" id="btn-export-backup">📥 Descargar Respaldo JSON</button>
          <div>
            <button class="btn btn-warning btn-block" id="btn-import-backup">📤 Cargar Respaldo JSON</button>
            <input type="file" id="import-input" accept=".json" style="display:none">
          </div>
          <button class="btn btn-danger btn-block" id="btn-clear-all">🗑️ Borrar Datos y Reiniciar</button>
        </div>
        <p style="margin-top:14px;font-size:12.5px;color:var(--text-muted)">El respaldo guarda todos los productos, ventas, rebajas, compras, clientes, proveedores, caja, gastos y movimientos.</p>
      </div>
    </div>

    <div style="text-align:right;margin-top:20px">
      <button class="btn btn-primary btn-lg" id="btn-save-settings">💾 Guardar Configuración</button>
    </div>`;
  },

  init() {
    document.getElementById('btn-save-settings')?.addEventListener('click', () => this._save());

    // Logo upload
    document.getElementById('logo-upload')?.addEventListener('click', () => document.getElementById('logo-input').click());
    document.getElementById('logo-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const s = DB.getSettings();
        s.logo = ev.target.result;
        DB.saveSettings(s);
        Utils.showToast('Logo actualizado correctamente', 'success');
        const content = document.getElementById('content');
        if (content) { content.innerHTML = this.render(); this.init(); }
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('btn-remove-logo')?.addEventListener('click', () => {
      const s = DB.getSettings();
      s.logo = null;
      DB.saveSettings(s);
      Utils.showToast('Logo eliminado', 'success');
      const content = document.getElementById('content');
      if (content) { content.innerHTML = this.render(); this.init(); }
    });

    // Backup & Restore
    document.getElementById('btn-export-backup')?.addEventListener('click', () => {
      Utils.downloadJSON(DB.exportAll(), `respaldo_ferreteria_el_bule_${Utils.today()}.json`);
      Utils.showToast('Copia de seguridad descargada', 'success');
    });

    document.getElementById('btn-import-backup')?.addEventListener('click', () => document.getElementById('import-input').click());
    document.getElementById('import-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (Utils.confirm('¿Importar este archivo de respaldo? Todos los datos se actualizarán sin perder archivos compatibles.')) {
            DB.importAll(data);
            Utils.showToast('Respaldo restaurado con éxito. Recargando...', 'success');
            setTimeout(() => location.reload(), 1500);
          }
        } catch (err) {
          Utils.showToast('Archivo JSON de respaldo inválido', 'error');
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('btn-clear-all')?.addEventListener('click', () => {
      if (!Utils.confirm('⚠️ ¿BORRAR TODOS LOS DATOS? Esta acción no se puede deshacer.')) return;
      if (!Utils.confirm('¿Está COMPLETAMENTE seguro? Se borrará todo el inventario, ventas y registros.')) return;
      localStorage.clear();
      Utils.showToast('Base de datos limpiada. Recargando...', 'warning');
      setTimeout(() => location.reload(), 1500);
    });
  },

  _save() {
    const s = DB.getSettings();
    s.companyName = document.getElementById('set-name').value.trim() || 'FERRO PINTURAS EL BULE';
    s.nit = document.getElementById('set-nit').value.trim();
    s.address = document.getElementById('set-address').value.trim();
    s.phone = document.getElementById('set-phone').value.trim();
    s.email = document.getElementById('set-email').value.trim();
    s.invoiceNotes = document.getElementById('set-notes').value.trim();
    s.currency = document.getElementById('set-currency').value.trim() || '$';
    s.invoicePrefix = document.getElementById('set-prefix').value.trim() || 'FAC';

    DB.saveSettings(s);

    const newNum = parseInt(document.getElementById('set-inv-num').value);
    if (newNum > 0) localStorage.setItem('fb_inv_counter', JSON.stringify(newNum));

    if (window.updateCompanyDisplay) window.updateCompanyDisplay();

    Utils.showToast('Configuración guardada correctamente', 'success');
  }
};
