import { ContractTemplate } from '../models/ContractTemplate';
import type { Types } from 'mongoose';

// ── Placeholder map ────────────────────────────────────────────────────────────

export interface ContractPlaceholderData {
  worker_name: string;
  worker_firstname: string;
  worker_lastname: string;
  worker_email: string;
  agency_name: string;
  agency_address: string;
  business_name: string;
  shift_title: string;
  shift_start_time: string;
  shift_end_time: string;
  shift_break_minutes: string;
  shift_net_hours: string;
  shift_pay_rate: string;
  shift_gross_pay: string;
  contract_date: string;
}

export const PLACEHOLDER_LABELS: Record<keyof ContractPlaceholderData, string> = {
  worker_name:          'Mitarbeiter (vollständiger Name)',
  worker_firstname:     'Mitarbeiter (Vorname)',
  worker_lastname:      'Mitarbeiter (Nachname)',
  worker_email:         'Mitarbeiter (E-Mail)',
  agency_name:          'Agentur (Name)',
  agency_address:       'Agentur (Adresse)',
  business_name:        'Kundenbetrieb (Name)',
  shift_title:          'Schicht / Tätigkeit',
  shift_start_time:     'Einsatzbeginn (Datum & Uhrzeit)',
  shift_end_time:       'Einsatzende (Datum & Uhrzeit)',
  shift_break_minutes:  'Pause (Minuten)',
  shift_net_hours:      'Nettostunden',
  shift_pay_rate:       'Stundenlohn (€/h)',
  shift_gross_pay:      'Gesamtvergütung (€)',
  contract_date:        'Vertragsdatum',
};

export function resolvePlaceholders(html: string, data: ContractPlaceholderData): string {
  let resolved = html;
  for (const [key, value] of Object.entries(data)) {
    resolved = resolved.split(`{{${key}}}`).join(value ?? '');
  }
  return resolved;
}

export function buildPlaceholderData(params: {
  workerFirstName: string;
  workerLastName: string;
  workerEmail: string;
  agencyName: string;
  agencyAddress?: string;
  businessName: string;
  shiftTitle: string;
  startTime: Date;
  endTime: Date;
  breakMinutes: number;
  payRatePerHour: number;
}): ContractPlaceholderData {
  const fmt = (d: Date) =>
    d.toLocaleString('de-DE', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const netHours = (
    (params.endTime.getTime() - params.startTime.getTime()) / 3_600_000 -
    params.breakMinutes / 60
  );

  return {
    worker_name:         `${params.workerFirstName} ${params.workerLastName}`,
    worker_firstname:    params.workerFirstName,
    worker_lastname:     params.workerLastName,
    worker_email:        params.workerEmail,
    agency_name:         params.agencyName,
    agency_address:      params.agencyAddress ?? '',
    business_name:       params.businessName,
    shift_title:         params.shiftTitle,
    shift_start_time:    fmt(params.startTime),
    shift_end_time:      fmt(params.endTime),
    shift_break_minutes: String(params.breakMinutes),
    shift_net_hours:     netHours.toFixed(2),
    shift_pay_rate:      params.payRatePerHour.toFixed(2),
    shift_gross_pay:     (netHours * params.payRatePerHour).toFixed(2),
    contract_date:       new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  };
}

// ── Default template HTML ──────────────────────────────────────────────────────

export const DEFAULT_TEMPLATE_HTML = `<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#333;">
  <h1 style="border-bottom:2px solid #1976d2;padding-bottom:12px;color:#1976d2;">Arbeitnehmerüberlassungsvertrag (AÜV)</h1>
  <h2 style="color:#555;">Einsatzauftrag</h2>

  <table style="width:100%;margin:24px 0;border-collapse:collapse;">
    <tr><td style="padding:8px;width:220px;color:#666;font-weight:bold;">Verleiher (Agentur)</td><td style="padding:8px;">{{agency_name}}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;font-weight:bold;">Entleiher (Kundenbetrieb)</td><td style="padding:8px;">{{business_name}}</td></tr>
    <tr><td style="padding:8px;color:#666;font-weight:bold;">Arbeitnehmer</td><td style="padding:8px;">{{worker_name}}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;font-weight:bold;">Tätigkeit / Position</td><td style="padding:8px;">{{shift_title}}</td></tr>
    <tr><td style="padding:8px;color:#666;font-weight:bold;">Einsatzbeginn</td><td style="padding:8px;">{{shift_start_time}}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;font-weight:bold;">Einsatzende</td><td style="padding:8px;">{{shift_end_time}}</td></tr>
    <tr><td style="padding:8px;color:#666;font-weight:bold;">Pause</td><td style="padding:8px;">{{shift_break_minutes}} Minuten</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;font-weight:bold;">Nettostunden</td><td style="padding:8px;">{{shift_net_hours}} Stunden</td></tr>
    <tr><td style="padding:8px;color:#666;font-weight:bold;">Stundenlohn (brutto)</td><td style="padding:8px;">{{shift_pay_rate}} €/h</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;font-weight:bold;">Gesamtvergütung (brutto)</td><td style="padding:8px;font-weight:bold;">{{shift_gross_pay}} €</td></tr>
  </table>

  <h3>Vertragsbedingungen</h3>
  <ol style="line-height:1.8;">
    <li>Der Verleiher stellt dem Entleiher den oben genannten Arbeitnehmer für den vereinbarten Einsatzzeitraum zur Verfügung.</li>
    <li>Der Einsatz erfolgt gemäß den Bestimmungen des Arbeitnehmerüberlassungsgesetzes (AÜG) in der jeweils gültigen Fassung.</li>
    <li>Die Vergütung entspricht mindestens dem gesetzlichen Mindestlohn gemäß MiLoG.</li>
    <li>Arbeitszeiten werden gemäß ArbZG eingehalten. Die gesetzliche Mindestruhezeit von 11 Stunden zwischen zwei Einsätzen wird gewährleistet.</li>
    <li>Der Arbeitnehmer verpflichtet sich, die vereinbarte Tätigkeit pünktlich und gewissenhaft auszuführen.</li>
    <li>Krankheit oder Verhinderung ist unverzüglich dem Verleiher mitzuteilen.</li>
    <li>Die Verarbeitung personenbezogener Daten erfolgt gemäß DSGVO und der Datenschutzerklärung des Verleihers.</li>
  </ol>

  <p style="margin-top:32px;color:#666;font-size:13px;">
    Vertragsdatum: {{contract_date}}<br>
    Durch die digitale Unterzeichnung bestätigt der Arbeitnehmer, diesen Vertrag gelesen und akzeptiert zu haben.
    Die digitale Signatur ist gemäß eIDAS-Verordnung (einfache elektronische Signatur) rechtsgültig.
  </p>
</div>`;

// ── Service helpers ────────────────────────────────────────────────────────────

export async function getDefaultTemplate(tenantId: string | Types.ObjectId) {
  return ContractTemplate.findOne({ tenantId, isDefault: true }).lean();
}

export async function resolveContractHtml(
  tenantId: string | Types.ObjectId,
  data: ContractPlaceholderData
): Promise<string> {
  const template = await getDefaultTemplate(tenantId);
  const html = template?.html ?? DEFAULT_TEMPLATE_HTML;
  return resolvePlaceholders(html, data);
}
