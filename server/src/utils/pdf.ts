import puppeteer from 'puppeteer';
import type { IInvoice } from '../models/Invoice';

// Shared Puppeteer browser instance (lazy-initialized, reused across requests)
let _browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

async function getBrowser() {
  if (!_browser || !_browser.connected) {
    _browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return _browser;
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

// ── Invoice HTML builder ───────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function buildInvoiceHtml(invoice: IInvoice): string {
  const statusLabel: Record<string, string> = {
    draft: 'Entwurf', sent: 'Gesendet', paid: 'Bezahlt', overdue: 'Überfällig', cancelled: 'Storniert',
  };

  const lineRows = invoice.lineItems.map((li) => `
    <tr>
      <td>${li.description}</td>
      <td style="text-align:right">${li.hours.toFixed(2)}</td>
      <td style="text-align:right">${fmtEur(li.ratePerHour)}</td>
      <td style="text-align:right;font-weight:600">${fmtEur(li.amount)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #333; line-height: 1.5; }
  .page { padding: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 3px solid #1976d2; }
  .logo-area h1 { font-size: 22px; color: #1976d2; font-weight: 700; }
  .logo-area p { color: #666; font-size: 12px; margin-top: 2px; }
  .invoice-meta { text-align: right; }
  .invoice-meta .invoice-number { font-size: 18px; font-weight: 700; color: #1976d2; }
  .invoice-meta .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-top: 4px;
    background: ${invoice.status === 'paid' ? '#e8f5e9' : invoice.status === 'overdue' ? '#ffebee' : '#e3f2fd'};
    color: ${invoice.status === 'paid' ? '#2e7d32' : invoice.status === 'overdue' ? '#c62828' : '#1565c0'};
  }
  .addresses { display: flex; gap: 32px; margin-bottom: 28px; }
  .address-block { flex: 1; }
  .address-block .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #888; margin-bottom: 4px; }
  .address-block p { font-size: 13px; }
  .dates-row { display: flex; gap: 24px; margin-bottom: 28px; background: #f5f5f5; padding: 12px 16px; border-radius: 4px; }
  .date-item { flex: 1; }
  .date-item .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #888; }
  .date-item .value { font-size: 13px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { background: #1976d2; color: #fff; padding: 10px 12px; text-align: left; font-size: 12px; }
  thead th:not(:first-child) { text-align: right; }
  tbody tr:nth-child(even) { background: #f9f9f9; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
  .totals { margin-left: auto; width: 260px; }
  .totals table { margin-bottom: 0; }
  .totals td { padding: 6px 12px; }
  .totals .total-row td { font-size: 15px; font-weight: 700; border-top: 2px solid #1976d2; color: #1976d2; padding-top: 10px; }
  .notes { margin-top: 28px; padding: 12px 16px; background: #f5f5f5; border-radius: 4px; font-size: 12px; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; color: #888; display: flex; justify-content: space-between; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo-area">
      <h1>${invoice.agencyName}</h1>
      <p>${invoice.agencyAddress ?? ''}</p>
      ${invoice.agencyVatId ? `<p>USt-IdNr.: ${invoice.agencyVatId}</p>` : ''}
    </div>
    <div class="invoice-meta">
      <div class="invoice-number">Rechnung ${invoice.invoiceNumber}</div>
      <div class="status-badge">${statusLabel[invoice.status] ?? invoice.status}</div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <div class="label">Rechnungsempfänger</div>
      <p><strong>${invoice.businessName}</strong></p>
      <p>${invoice.businessAddress ?? ''}</p>
      ${invoice.businessVatId ? `<p>USt-IdNr.: ${invoice.businessVatId}</p>` : ''}
    </div>
  </div>

  <div class="dates-row">
    <div class="date-item"><div class="label">Rechnungsdatum</div><div class="value">${fmtDate(new Date(invoice.invoiceDate))}</div></div>
    <div class="date-item"><div class="label">Fälligkeitsdatum</div><div class="value">${fmtDate(new Date(invoice.dueDate))}</div></div>
    <div class="date-item"><div class="label">Leistungszeitraum</div><div class="value">${fmtDate(new Date(invoice.periodFrom))} – ${fmtDate(new Date(invoice.periodTo))}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Beschreibung</th>
        <th style="text-align:right;width:80px">Stunden</th>
        <th style="text-align:right;width:100px">Stundensatz</th>
        <th style="text-align:right;width:100px">Betrag</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Nettobetrag</td><td style="text-align:right">${fmtEur(invoice.subtotal)}</td></tr>
      <tr><td>MwSt. (${invoice.vatRate}%)</td><td style="text-align:right">${fmtEur(invoice.vatAmount)}</td></tr>
      <tr class="total-row"><td>Gesamtbetrag</td><td style="text-align:right">${fmtEur(invoice.total)}</td></tr>
    </table>
  </div>

  ${invoice.notes ? `<div class="notes"><strong>Hinweise:</strong> ${invoice.notes}</div>` : ''}

  <div class="footer">
    <span>Rechnung ${invoice.invoiceNumber}</span>
    <span>Erstellt am ${fmtDate(new Date())}</span>
  </div>
</div>
</body>
</html>`;
}

// ── Payslip HTML builder ───────────────────────────────────────────────────────

export interface PayslipData {
  agencyName: string;
  agencyAddress?: string;
  workerName: string;
  workerAddress?: string;
  steuerklasse?: string;
  steuernummer?: string;
  sozialversicherungsnummer?: string;
  monthLabel: string;         // e.g. "Juni 2025"
  generatedAt: string;
  rows: Array<{
    date: string;
    businessName: string;
    hours: number;
    rate: number;
    gross: number;
  }>;
  totalHours: number;
  totalGross: number;
}

export function buildPayslipHtml(data: PayslipData): string {
  const rowsHtml = data.rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.businessName}</td>
      <td style="text-align:right">${r.hours.toFixed(2)}</td>
      <td style="text-align:right">${fmtEur(r.rate)}</td>
      <td style="text-align:right;font-weight:600">${fmtEur(r.gross)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #333; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 3px solid #1976d2; }
  .header h1 { font-size: 20px; color: #1976d2; font-weight: 700; }
  .header p { color: #666; font-size: 12px; }
  .title-block { text-align: right; }
  .title-block .payslip-label { font-size: 18px; font-weight: 700; color: #1976d2; }
  .title-block .month { font-size: 13px; color: #555; margin-top: 2px; }
  .info-row { display: flex; gap: 32px; margin-bottom: 24px; background: #f5f5f5; padding: 12px 16px; border-radius: 4px; }
  .info-block .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #888; margin-bottom: 2px; }
  .info-block p { font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { background: #1976d2; color: #fff; padding: 9px 12px; text-align: left; font-size: 12px; }
  thead th:not(:first-child):not(:nth-child(2)) { text-align: right; }
  tbody tr:nth-child(even) { background: #f9f9f9; }
  tbody td { padding: 9px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
  .totals { margin-left: auto; width: 280px; border-top: 2px solid #1976d2; margin-top: 4px; }
  .totals td { padding: 7px 12px; }
  .totals .grand-total td { font-weight: 700; font-size: 14px; background: #e3f2fd; }
  .footer { margin-top: 32px; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 8px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>${data.agencyName}</h1>
    ${data.agencyAddress ? `<p>${data.agencyAddress}</p>` : ''}
  </div>
  <div class="title-block">
    <div class="payslip-label">Lohnnachweis</div>
    <div class="month">${data.monthLabel}</div>
  </div>
</div>

<div class="info-row">
  <div class="info-block">
    <div class="label">Mitarbeiter</div>
    <p><strong>${data.workerName}</strong></p>
    ${data.workerAddress ? `<p>${data.workerAddress}</p>` : ''}
  </div>
  ${data.steuerklasse ? `<div class="info-block"><div class="label">Steuerklasse</div><p>${data.steuerklasse}</p></div>` : ''}
  ${data.steuernummer ? `<div class="info-block"><div class="label">Steuernummer</div><p>${data.steuernummer}</p></div>` : ''}
  ${data.sozialversicherungsnummer ? `<div class="info-block"><div class="label">SV-Nummer</div><p>${data.sozialversicherungsnummer}</p></div>` : ''}
</div>

<table>
  <thead>
    <tr>
      <th>Datum</th>
      <th>Einsatzort</th>
      <th>Stunden</th>
      <th>Stundenlohn</th>
      <th>Brutto</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>

<table class="totals">
  <tr><td>Gesamtstunden</td><td style="text-align:right">${data.totalHours.toFixed(2)} h</td></tr>
  <tr class="grand-total"><td>Bruttogehalt</td><td style="text-align:right">${fmtEur(data.totalGross)}</td></tr>
</table>

<p class="footer">Erstellt am ${data.generatedAt} — Dieses Dokument dient als Lohnnachweis für den genannten Abrechnungszeitraum.</p>
</body>
</html>`;
}

// ── Contract HTML wrapper (adds print-ready shell around contract body) ─────────

export function buildContractPdfHtml(contractHtml: string, signatureData?: string, signedAt?: Date): string {
  const signatureSection = signatureData
    ? `<div style="margin-top:32px;padding-top:16px;border-top:2px solid #1976d2;page-break-inside:avoid;">
        <p style="font-size:12px;color:#555;margin-bottom:8px;">Digitale Signatur (einfache elektronische Signatur gemäß eIDAS)</p>
        <img src="${signatureData}" style="max-width:200px;max-height:80px;border:1px solid #ccc;border-radius:4px;" alt="Signatur"/>
        ${signedAt ? `<p style="font-size:11px;color:#888;margin-top:4px;">Unterzeichnet am: ${signedAt.toLocaleString('de-DE')}</p>` : ''}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #333; line-height: 1.6; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
${contractHtml}
${signatureSection}
</body>
</html>`;
}
