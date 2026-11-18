import puppeteer from 'puppeteer';
import type { IInvoice } from '../models/Invoice';

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtEur(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function buildHtml(invoice: IInvoice): string {
  const lineItemRows = invoice.lineItems
    .map(
      (item) => `
      <tr>
        <td>${item.description}</td>
        <td class="right">${item.hours.toFixed(2)}</td>
        <td class="right">${fmtEur(item.ratePerHour)}</td>
        <td class="right">${fmtEur(item.amount)}</td>
      </tr>`
    )
    .join('');

  const notesBlock = invoice.notes
    ? `<div class="notes"><span class="label">Hinweise</span><p>${invoice.notes}</p></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    color: #222;
    padding: 40px 48px;
    line-height: 1.5;
  }

  /* ── Header ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
  .agency-name { font-size: 16pt; font-weight: 700; margin-bottom: 4px; }
  .agency-meta { font-size: 9pt; color: #666; white-space: pre-line; }
  .invoice-meta { text-align: right; }
  .invoice-number { font-size: 18pt; font-weight: 700; color: #1565C0; margin-bottom: 6px; }
  .invoice-meta p { font-size: 10pt; margin-bottom: 2px; }

  /* ── Bill To ── */
  .bill-to { margin-bottom: 24px; }
  .bill-to .label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: #888; display: block; margin-bottom: 4px; }
  .bill-to .name { font-size: 12pt; font-weight: 600; }
  .bill-to .address { font-size: 10pt; color: #555; }

  /* ── Period ── */
  .period { font-size: 10pt; color: #555; margin-bottom: 24px; }

  hr { border: none; border-top: 1px solid #ddd; margin: 0 0 16px; }

  /* ── Line items table ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  thead tr { background: #f5f5f5; }
  th {
    text-align: left;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #666;
    padding: 8px 10px;
    border-bottom: 2px solid #ddd;
  }
  th.right, td.right { text-align: right; }
  td { padding: 8px 10px; font-size: 10pt; border-bottom: 1px solid #eee; vertical-align: top; }

  /* ── Totals ── */
  .totals { display: flex; justify-content: flex-end; margin-top: 16px; }
  .totals-table { min-width: 260px; }
  .totals-table .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 10pt; }
  .totals-table .row .label-col { color: #666; }
  .totals-table hr { margin: 8px 0; }
  .totals-table .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13pt; font-weight: 700; }

  /* ── Notes ── */
  .notes { margin-top: 32px; background: #f9f9f9; padding: 12px 16px; border-radius: 4px; }
  .notes .label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: #888; display: block; margin-bottom: 4px; }
  .notes p { font-size: 10pt; color: #444; }

  /* ── Footer ── */
  .footer {
    margin-top: 48px;
    padding-top: 12px;
    border-top: 1px solid #eee;
    font-size: 8pt;
    color: #aaa;
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="agency-name">${invoice.agencyName}</div>
    <div class="agency-meta">${[invoice.agencyAddress, invoice.agencyVatId ? `USt-ID: ${invoice.agencyVatId}` : ''].filter(Boolean).join('\n')}</div>
  </div>
  <div class="invoice-meta">
    <div class="invoice-number">${invoice.invoiceNumber}</div>
    <p>Rechnungsdatum: ${fmtDate(invoice.invoiceDate)}</p>
    <p><strong>Fällig am: ${fmtDate(invoice.dueDate)}</strong></p>
  </div>
</div>

<div class="bill-to">
  <span class="label">Rechnungsempfänger</span>
  <div class="name">${invoice.businessName}</div>
  ${invoice.businessAddress ? `<div class="address">${invoice.businessAddress}</div>` : ''}
  ${invoice.businessVatId ? `<div class="address">USt-ID: ${invoice.businessVatId}</div>` : ''}
</div>

<div class="period">Leistungszeitraum: ${fmtDate(invoice.periodFrom)} – ${fmtDate(invoice.periodTo)}</div>

<hr>

<table>
  <thead>
    <tr>
      <th>Beschreibung</th>
      <th class="right">Stunden</th>
      <th class="right">Stundensatz</th>
      <th class="right">Betrag</th>
    </tr>
  </thead>
  <tbody>
    ${lineItemRows}
  </tbody>
</table>

<hr style="margin-top:16px">

<div class="totals">
  <div class="totals-table">
    <div class="row">
      <span class="label-col">Nettobetrag</span>
      <span>${fmtEur(invoice.subtotal)}</span>
    </div>
    <div class="row">
      <span class="label-col">MwSt. (${invoice.vatRate} %)</span>
      <span>${fmtEur(invoice.vatAmount)}</span>
    </div>
    <hr>
    <div class="total-row">
      <span>Gesamtbetrag</span>
      <span>${fmtEur(invoice.total)}</span>
    </div>
  </div>
</div>

${notesBlock}

<div class="footer">
  <span>${invoice.agencyName}${invoice.agencyVatId ? ` · USt-ID: ${invoice.agencyVatId}` : ''}</span>
  <span>Rechnung ${invoice.invoiceNumber}</span>
</div>

</body>
</html>`;
}

export async function generateInvoicePdf(invoice: IInvoice): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(invoice), { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
