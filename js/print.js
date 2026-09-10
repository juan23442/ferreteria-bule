/* =============================================
   FERRETERÍA EL BULE — Print & PDF Module (print.js)
   Genera la factura profesional imprimible / guardable en PDF
   ============================================= */

window.PrintModule = {
  printInvoice(saleId) {
    const sale = DB.findById('sales', saleId);
    if (!sale) { Utils.showToast('Factura no encontrada', 'error'); return; }
    const s = DB.getSettings();

    const logoHtml = s.logo ? `<img src="${s.logo}" style="max-height:70px;max-width:160px;object-fit:contain;margin-bottom:8px">` : '';

    const itemsHtml = sale.items.map((it, i) => {
      const origSubtotal = it.qty * it.unitPrice;
      const discountVal = it.discountAmount || (it.discount ? (origSubtotal * it.discount / 100) : 0);
      return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${i+1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:500">${Utils.escHtml(it.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${it.qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${Utils.formatCurrency(it.unitPrice)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#dc2626">${discountVal > 0 ? '-' + Utils.formatCurrency(discountVal) : '-'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700">${Utils.formatCurrency(it.subtotal)}</td>
      </tr>`;
    }).join('');

    const totalRebaja = sale.discountTotal || 0;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura ${sale.invoiceNumber} - ${s.companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; font-size: 13px; padding: 24px; max-width: 800px; margin: 0 auto; background: #fff; }
    .invoice-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #f59e0b; padding-bottom: 20px; margin-bottom: 24px; }
    .company-name { font-size: 24px; font-weight: 800; color: #d97706; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .company-info { font-size: 12px; color: #475569; line-height: 1.6; }
    .invoice-info { text-align: right; }
    .invoice-num { font-size: 20px; font-weight: 800; color: #0f172a; background: #fef3c7; padding: 6px 14px; border-radius: 8px; display: inline-block; margin-bottom: 8px; border: 1px solid #fde68a; }
    .invoice-date { font-size: 12px; color: #64748b; }
    .customer-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 10px; margin-bottom: 24px; display: flex; justify-content: space-between; gap: 16px; }
    .customer-box strong { color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { background: #1e293b; color: white; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
    .totals-box { margin-left: auto; width: 320px; margin-bottom: 24px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #475569; }
    .total-row.grand { font-size: 20px; font-weight: 800; color: #0f172a; border-top: 2px solid #f59e0b; padding-top: 10px; margin-top: 6px; }
    .rebaja-row { color: #dc2626; font-weight: 600; }
    .footer { text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6; }
    .print-actions { text-align: center; margin-bottom: 20px; }
    .btn-print { background: #f59e0b; color: #000; font-weight: 700; border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; margin: 0 6px; }
    .btn-pdf { background: #3b82f6; color: #fff; font-weight: 700; border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; margin: 0 6px; }
    @media print {
      .print-actions { display: none !important; }
      body { padding: 0; }
      .invoice-card { border: none; box-shadow: none; padding: 0; }
      @page { margin: 12mm; }
    }
  </style>
</head>
<body>

  <div class="print-actions">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir Factura</button>
    <button class="btn-pdf" onclick="window.print()">📄 Guardar como PDF</button>
  </div>

  <div class="invoice-card">
    <div class="header">
      <div class="company">
        ${logoHtml}
        <div class="company-name">${Utils.escHtml(s.companyName)}</div>
        <div class="company-info">
          ${s.nit ? `<strong>NIT:</strong> ${Utils.escHtml(s.nit)}<br>` : ''}
          ${s.address ? `<strong>Dirección:</strong> ${Utils.escHtml(s.address)}<br>` : ''}
          ${s.phone ? `<strong>Teléfono:</strong> ${Utils.escHtml(s.phone)}<br>` : ''}
          ${s.email ? `<strong>Email:</strong> ${Utils.escHtml(s.email)}` : ''}
        </div>
      </div>
      <div class="invoice-info">
        <div class="invoice-num">${Utils.escHtml(sale.invoiceNumber)}</div>
        <div class="invoice-date">
          <strong>Fecha:</strong> ${Utils.formatDate(sale.date)}<br>
          <strong>Hora:</strong> ${Utils.formatDatetime(sale.datetime).split(' ')[1] || ''}<br>
          <strong>Estado:</strong> ${sale.status === 'editada' ? 'Editada' : (sale.status === 'anulada' ? 'Anulada' : 'Pagada')}
        </div>
      </div>
    </div>

    <div class="customer-box">
      <div>
        <strong>Cliente:</strong> ${Utils.escHtml(sale.customerName)}<br>
        <strong>Método de Pago:</strong> ${Utils.escHtml(sale.paymentMethod || 'Efectivo').toUpperCase()}
      </div>
      <div style="text-align:right">
        ${sale.notes ? `<strong>Notas:</strong> ${Utils.escHtml(sale.notes)}` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align:center">#</th>
          <th style="text-align:left">Producto</th>
          <th style="text-align:center">Cant.</th>
          <th style="text-align:right">Precio Unit.</th>
          <th style="text-align:right">Descuento/Rebaja</th>
          <th style="text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="totals-box">
      <div class="total-row"><span>Subtotal:</span><span>${Utils.formatCurrency(sale.subtotal + totalRebaja)}</span></div>
      ${totalRebaja > 0 ? `<div class="total-row rebaja-row"><span>Descuento / Rebaja:</span><span>-${Utils.formatCurrency(totalRebaja)}</span></div>` : ''}
      ${sale.taxAmount > 0 ? `<div class="total-row"><span>IVA (${sale.taxRate}%):</span><span>${Utils.formatCurrency(sale.taxAmount)}</span></div>` : ''}
      <div class="total-row grand"><span>TOTAL A PAGAR:</span><span>${Utils.formatCurrency(sale.total)}</span></div>
    </div>

    <div class="footer">
      ${s.invoiceNotes ? Utils.escHtml(s.invoiceNotes).replace(/\n/g, '<br>') : `Gracias por su compra en ${Utils.escHtml(s.companyName)}`}<br>
      <small style="color:#94a3b8;margin-top:6px;display:block">Sistema Administrativo — ${Utils.escHtml(s.companyName)}</small>
    </div>
  </div>

</body>
</html>`;

    const w = window.open('', '_blank');
    if (!w) { Utils.showToast('No se pudo abrir la ventana de impresión. Permita ventanas emergentes.', 'error'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }
};
