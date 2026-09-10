/* =============================================
   FERRETERÍA EL BULE — App Controller (app.js)
   Router, navegación lateral, selector de tema claro/oscuro
   ============================================= */

(() => {
  'use strict';

  const NAV_ITEMS = [
    { id: 'dashboard',  label: 'Dashboard',     icon: '🏠', section: 'principal' },
    { id: 'sales',      label: 'Ventas',         icon: '🛒', section: 'operaciones' },
    { id: 'invoices',   label: 'Facturación',    icon: '🧾', section: 'operaciones' },
    { id: 'inventory',  label: 'Inventario',     icon: '📦', section: 'operaciones' },
    { id: 'purchases',  label: 'Compras',        icon: '📥', section: 'operaciones' },
    { id: 'customers',  label: 'Clientes',       icon: '👥', section: 'operaciones' },
    { id: 'suppliers',  label: 'Proveedores',    icon: '🤝', section: 'operaciones' },
    { id: 'movements',  label: 'Devoluciones / Movs', icon: '🔄', section: 'operaciones' },
    { id: 'cash',       label: 'Caja',           icon: '💰', section: 'finanzas' },
    { id: 'expenses',   label: 'Gastos',         icon: '💸', section: 'finanzas' },
    { id: 'reports',    label: 'Reportes',       icon: '📊', section: 'finanzas' },
    { id: 'settings',   label: 'Configuración',  icon: '⚙️', section: 'sistema' },
  ];

  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    sales: 'Punto de Venta (POS)',
    inventory: 'Inventario de Productos',
    invoices: 'Facturación y Recibos',
    purchases: 'Compras a Proveedores',
    customers: 'Directorio de Clientes',
    suppliers: 'Directorio de Proveedores',
    movements: 'Historial de Movimientos y Devoluciones',
    cash: 'Caja y Arqueo',
    expenses: 'Gastos Operativos',
    reports: 'Reportes Financieros',
    settings: 'Configuración de Ferro Pinturas El Bule',
  };

  let currentPage = null;

  function updateCompanyDisplay() {
    const s = DB.getSettings();
    const nameEl = document.getElementById('brand-name');
    if (nameEl) nameEl.textContent = s.companyName || 'FERRO PINTURAS EL BULE';
    const logoEl = document.getElementById('brand-logo-content');
    if (logoEl) {
      logoEl.innerHTML = s.logo
        ? `<img src="${s.logo}" alt="Logo">`
        : '🛒';
    }
  }

  window.updateCompanyDisplay = updateCompanyDisplay;

  function renderSidebar() {
    const sections = { principal: '', operaciones: 'OPERACIONES', finanzas: 'FINANZAS', sistema: 'CONFIGURACIÓN' };
    let html = '';
    let currentSection = null;

    NAV_ITEMS.forEach(item => {
      if (item.section !== currentSection) {
        currentSection = item.section;
        if (sections[currentSection]) {
          html += `<div class="nav-section-title">${sections[currentSection]}</div>`;
        }
      }
      html += `<button class="nav-item" data-page="${item.id}">
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </button>`;
    });
    return html;
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('fb_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('fb_theme', next);
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
    Utils.showToast(`Modo ${next === 'dark' ? 'Oscuro' : 'Claro'} activado`, 'info');
  }

  function getSystemNotifications() {
    const lowStock = DB.getAll('products').filter(product =>
      product.active !== false && Number(product.stock || 0) <= Number(product.minStock || 0)
    );
    const pendingSales = DB.getAll('sales').filter(sale =>
      !['anulada', 'pagada', 'pagada_no_retirada', 'retirada'].includes(sale.status) && Number(sale.totalPending || 0) > 0
    );

    return [
      ...lowStock.map(product => ({
        title: 'Stock bajo',
        text: `${product.name}: quedan ${product.stock || 0} unidades.`,
        page: 'inventory'
      })),
      ...pendingSales.map(sale => ({
        title: 'Pago pendiente',
        text: `${sale.invoiceNumber || sale.id}: ${Utils.formatCurrency(sale.totalPending)} pendientes.`,
        page: 'invoices'
      }))
    ];
  }

  function renderNotifications() {
    const notifications = getSystemNotifications();
    const count = document.getElementById('notifications-count');
    const body = document.getElementById('notifications-body');
    if (count) {
      count.textContent = notifications.length > 99 ? '99+' : String(notifications.length);
      count.hidden = notifications.length === 0;
    }
    if (!body) return;
    body.innerHTML = notifications.length
      ? notifications.map(notification => `<button class="notification-item" data-page="${notification.page}"><strong>${notification.title}</strong><span>${Utils.escHtml(notification.text)}</span></button>`).join('')
      : '<div class="empty-state"><div class="empty-icon">✅</div><p>No hay notificaciones pendientes.</p></div>';
  }

  function toggleNotifications() {
    renderNotifications();
    const modal = document.getElementById('notificationsModal');
    const button = document.getElementById('notifications-btn');
    const isOpen = modal?.classList.contains('active');
    if (isOpen) {
      Utils.closeModal('notificationsModal');
      button?.setAttribute('aria-expanded', 'false');
    } else {
      Utils.openModal('notificationsModal');
      button?.setAttribute('aria-expanded', 'true');
    }
  }

  function navigate(page) {
    // Map suppliers module alias if needed
    if (page === 'suppliers') page = 'purchases';

    if (!window.Modules || !window.Modules[page]) {
      console.warn(`Module "${page}" not found.`);
      page = 'dashboard';
    }

    if (page === currentPage) return;
    currentPage = page;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Update page title & subtitle
    document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
    const subTitle = document.getElementById('page-subtitle');
    if (subTitle) {
      subTitle.textContent = page === 'dashboard' ? 'Bienvenido de nuevo, Administrador' : 'Gestión y control — Ferro Pinturas El Bule';
    }

    // Render content
    const content = document.getElementById('content');
    content.innerHTML = window.Modules[page].render();

    // Init module
    if (window.Modules[page].init) window.Modules[page].init();

    // Update hash
    if (location.hash !== `#${page}`) {
      history.pushState(null, '', `#${page}`);
    }

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
  }

  async function init() {
    // Seed initial data and migrate if needed
    await DB.seed();

    // Build sidebar nav
    document.getElementById('sidebar-nav').innerHTML = renderSidebar();

    // Update company display
    updateCompanyDisplay();

    // Init theme
    initTheme();

    // Theme toggle button
    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
    document.getElementById('notifications-btn')?.addEventListener('click', toggleNotifications);
    document.getElementById('notifications-close')?.addEventListener('click', () => {
      Utils.closeModal('notificationsModal');
      document.getElementById('notifications-btn')?.setAttribute('aria-expanded', 'false');
    });
    document.getElementById('notifications-body')?.addEventListener('click', (event) => {
      const item = event.target.closest('.notification-item');
      if (!item) return;
      Utils.closeModal('notificationsModal');
      document.getElementById('notifications-btn')?.setAttribute('aria-expanded', 'false');
      navigate(item.dataset.page);
    });
    renderNotifications();

    // Display current date
    const dateEl = document.getElementById('header-date-str');
    if (dateEl) {
      const now = new Date();
      dateEl.textContent = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    // One delegated listener avoids rebinding navigation handlers on every visit.
    document.getElementById('sidebar-nav')?.addEventListener('click', (event) => {
      const btn = event.target.closest('.nav-item');
      if (btn) navigate(btn.dataset.page);
    });

    // Sidebar toggle (mobile)
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('overlay').classList.toggle('active');
    });

    document.getElementById('overlay')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('overlay').classList.remove('active');
    });

    // Close modals on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Utils.closeAllModals();
    });

    // Hash-based routing
    const page = (location.hash || '#dashboard').replace('#', '');
    navigate(page);
  }

  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    const page = (location.hash || '#dashboard').replace('#', '');
    navigate(page);
  });

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
