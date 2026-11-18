/**
 * DSGVO utility tests:
 *  - applyAnonymizationFields: Art. 17 field-wiping
 *  - buildExportBundle: Art. 20 export bundle structure
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { applyAnonymizationFields, buildExportBundle } from '../utils/dsgvo';
import type { AnonymizableWorker, ExportWorker, ExportTimesheet, ExportShift, ExportRating } from '../utils/dsgvo';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeWorker(overrides: Partial<AnonymizableWorker> = {}): AnonymizableWorker {
  return {
    _id: { toString: () => 'aaaaaaaabbbbcccc12345678' },
    firstName: 'Max',
    lastName: 'Mustermann',
    email: 'max@example.de',
    phone: '+4915112345678',
    dateOfBirth: new Date('1990-01-15'),
    gender: 'male',
    nationality: 'DE',
    address: { street: 'Hauptstr. 1', city: 'Berlin', country: 'DE' },
    steuernummerEncrypted: 'enc:iv:tag:cipher',
    sozialversicherungsnummerEncrypted: 'enc:iv:tag:cipher2',
    ibanEncrypted: 'enc:iv:tag:cipher3',
    bankName: 'Deutsche Bank',
    steuerklasse: '1',
    healthInsuranceProvider: 'TK',
    documents: [{ label: 'Pass' }, { label: 'Arbeitserlaubnis' }],
    skills: ['driving', 'forklift'],
    languages: ['de', 'en'],
    availability: {
      exceptions: [{ date: '2025-12-24', available: false }],
      preferredRadiusKm: 30,
    },
    dsgvoConsentAt: new Date('2024-03-01'),
    dsgvoConsentIp: '192.168.0.1',
    auegTracking: [
      { businessId: 'biz1', businessName: 'ACME GmbH', startDate: new Date('2024-01-01') },
    ],
    status: 'active',
    ...overrides,
  };
}

// ── applyAnonymizationFields ──────────────────────────────────────────────────
describe('applyAnonymizationFields', () => {
  let worker: AnonymizableWorker;

  beforeEach(() => {
    worker = makeWorker();
    applyAnonymizationFields(worker, 'Worker requested deletion');
  });

  it('replaces firstName with "Gelöschter"', () => {
    expect(worker.firstName).toBe('Gelöschter');
  });

  it('replaces lastName with tombstone ID suffix', () => {
    const tombstoneId = 'aaaaaaaabbbbcccc12345678'.slice(-8);
    expect(worker.lastName).toBe(`Mitarbeiter (${tombstoneId})`);
  });

  it('replaces email with anonymized address', () => {
    const tombstoneId = 'aaaaaaaabbbbcccc12345678'.slice(-8);
    expect(worker.email).toBe(`deleted-${tombstoneId}@anonymized.invalid`);
  });

  it('wipes phone, dateOfBirth, gender, nationality', () => {
    expect(worker.phone).toBeUndefined();
    expect(worker.dateOfBirth).toBeUndefined();
    expect(worker.gender).toBeUndefined();
    expect(worker.nationality).toBeUndefined();
  });

  it('replaces address with country-only object', () => {
    expect(worker.address).toEqual({ country: 'DE' });
  });

  it('wipes all encrypted sensitive fields', () => {
    expect(worker.steuernummerEncrypted).toBeUndefined();
    expect(worker.sozialversicherungsnummerEncrypted).toBeUndefined();
    expect(worker.ibanEncrypted).toBeUndefined();
  });

  it('wipes bankName, steuerklasse, healthInsuranceProvider', () => {
    expect(worker.bankName).toBeUndefined();
    expect(worker.steuerklasse).toBeUndefined();
    expect(worker.healthInsuranceProvider).toBeUndefined();
  });

  it('clears documents array', () => {
    expect(worker.documents).toHaveLength(0);
  });

  it('clears skills and languages', () => {
    expect(worker.skills).toHaveLength(0);
    expect(worker.languages).toHaveLength(0);
  });

  it('clears availability.exceptions and preferredRadiusKm', () => {
    expect(worker.availability.exceptions).toHaveLength(0);
    expect(worker.availability.preferredRadiusKm).toBeUndefined();
  });

  it('wipes DSGVO consent metadata', () => {
    expect(worker.dsgvoConsentAt).toBeUndefined();
    expect(worker.dsgvoConsentIp).toBeUndefined();
  });

  it('sets status to "anonymized"', () => {
    expect(worker.status).toBe('anonymized');
  });

  it('sets deletedAt to a recent date', () => {
    expect(worker.deletedAt).toBeInstanceOf(Date);
    const diff = Date.now() - (worker.deletedAt as Date).getTime();
    expect(diff).toBeLessThan(5000);
  });

  it('sets statusNote with the provided reason', () => {
    expect(worker.statusNote).toContain('Worker requested deletion');
    expect(worker.statusNote).toContain('DSGVO-Anonymisierung');
  });

  it('anonymizes businessName in auegTracking entries', () => {
    expect(worker.auegTracking[0].businessName).toBe('[anonymisiert]');
  });

  it('retains other auegTracking fields (legal compliance)', () => {
    expect(worker.auegTracking[0].businessId).toBe('biz1');
    expect(worker.auegTracking[0].startDate).toBeDefined();
  });
});

// ── buildExportBundle ─────────────────────────────────────────────────────────
describe('buildExportBundle', () => {
  const baseWorker: ExportWorker = {
    _id: { toString: () => 'worker-id-1' },
    firstName: 'Anna',
    lastName: 'Schmidt',
    email: 'anna@example.de',
    phone: '+491711234567',
    dateOfBirth: new Date('1985-06-20'),
    gender: 'female',
    nationality: 'DE',
    address: { city: 'Hamburg', country: 'DE' },
    steuerklasse: '3',
    steuernummerEncrypted: 'enc:steur',
    sozialversicherungsnummerEncrypted: 'enc:sv',
    ibanEncrypted: 'enc:iban',
    bankName: 'Sparkasse',
    skills: ['cashier'],
    languages: ['de'],
    status: 'active',
    registrationSource: 'web',
    dsgvoConsentAt: new Date('2023-01-01'),
    createdAt: new Date('2023-01-01'),
    documents: [
      { category: 'id', label: 'Personalausweis', expiryDate: new Date('2030-01-01'), verified: true, uploadedAt: new Date() },
    ],
    auegTracking: [],
  };

  const timesheets: ExportTimesheet[] = [
    { shiftDate: new Date('2025-03-01'), totalHours: 8, status: 'approved', approvedAt: new Date('2025-03-02') },
    { shiftDate: new Date('2025-03-08'), totalHours: 7.5, status: 'approved', approvedAt: new Date('2025-03-09') },
  ];

  const shifts: ExportShift[] = [
    { startTime: new Date('2025-03-01T08:00Z'), endTime: new Date('2025-03-01T16:00Z'), title: 'Lager', businessName: 'ACME', locationName: 'Berlin', status: 'completed' },
  ];

  const ratings: ExportRating[] = [
    { overallRating: 5, punctuality: 5, quality: 4, attitude: 5, comment: 'Super!', createdAt: new Date('2025-03-03') },
  ];

  const safeDecrypt = (v?: string) => v ? `DECRYPTED(${v})` : undefined;

  let bundle: ReturnType<typeof buildExportBundle>;

  beforeEach(() => {
    bundle = buildExportBundle(baseWorker, timesheets, shifts, ratings, 'user-admin-1', safeDecrypt);
  });

  it('includes legalBasis for Art. 20', () => {
    expect(bundle.legalBasis).toBe('DSGVO Art. 20 — Recht auf Datenübertragbarkeit');
  });

  it('sets exportedBy to the supplied userId', () => {
    expect(bundle.exportedBy).toBe('user-admin-1');
  });

  it('includes exportedAt as an ISO string', () => {
    expect(typeof bundle.exportedAt).toBe('string');
    expect(() => new Date(bundle.exportedAt)).not.toThrow();
  });

  it('includes worker identity fields', () => {
    expect(bundle.worker.firstName).toBe('Anna');
    expect(bundle.worker.lastName).toBe('Schmidt');
    expect(bundle.worker.email).toBe('anna@example.de');
    expect(bundle.worker.id).toBe('worker-id-1');
  });

  it('calls safeDecrypt for sensitive encrypted fields', () => {
    expect(bundle.worker.steuernummer).toBe('DECRYPTED(enc:steur)');
    expect(bundle.worker.sozialversicherungsnummer).toBe('DECRYPTED(enc:sv)');
    expect(bundle.worker.iban).toBe('DECRYPTED(enc:iban)');
  });

  it('returns undefined for sensitive fields when value is missing', () => {
    const w = { ...baseWorker, steuernummerEncrypted: undefined };
    const b = buildExportBundle(w, [], [], [], 'uid', safeDecrypt);
    expect(b.worker.steuernummer).toBeUndefined();
  });

  it('maps documents with correct shape', () => {
    expect(bundle.documents).toHaveLength(1);
    expect(bundle.documents[0]).toMatchObject({ category: 'id', label: 'Personalausweis', verified: true });
  });

  it('maps timesheets with correct count and shape', () => {
    expect(bundle.timesheets).toHaveLength(2);
    expect(bundle.timesheets[0].totalHours).toBe(8);
    expect(bundle.timesheets[0].status).toBe('approved');
  });

  it('maps assignments (shifts) correctly', () => {
    expect(bundle.assignments).toHaveLength(1);
    expect(bundle.assignments[0].businessName).toBe('ACME');
    expect(bundle.assignments[0].status).toBe('completed');
  });

  it('maps ratings correctly', () => {
    expect(bundle.ratings).toHaveLength(1);
    expect(bundle.ratings[0].overallRating).toBe(5);
    expect(bundle.ratings[0].comment).toBe('Super!');
  });

  it('returns empty arrays when no timesheets/shifts/ratings', () => {
    const b = buildExportBundle(baseWorker, [], [], [], 'uid', safeDecrypt);
    expect(b.timesheets).toHaveLength(0);
    expect(b.assignments).toHaveLength(0);
    expect(b.ratings).toHaveLength(0);
  });
});
