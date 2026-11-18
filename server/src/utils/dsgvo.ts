/**
 * Pure helper functions for DSGVO Art. 17 (anonymize) and Art. 20 (export).
 * Route handlers call these; tests exercise these directly.
 */

export interface AnonymizableWorker {
  _id: { toString(): string };
  firstName: string;
  lastName: string;
  email: string;
  phone?: unknown;
  dateOfBirth?: unknown;
  gender?: unknown;
  nationality?: unknown;
  address: Record<string, unknown>;
  steuernummerEncrypted?: unknown;
  sozialversicherungsnummerEncrypted?: unknown;
  ibanEncrypted?: unknown;
  bankName?: unknown;
  steuerklasse?: unknown;
  healthInsuranceProvider?: unknown;
  documents: unknown[];
  skills: unknown[];
  languages: unknown[];
  availability: { exceptions: unknown[]; preferredRadiusKm?: unknown };
  dsgvoConsentAt?: unknown;
  dsgvoConsentIp?: unknown;
  auegTracking: Array<Record<string, unknown>>;
  status: string;
  deletedAt?: unknown;
  statusNote?: unknown;
}

/** Wipes all PII fields on the supplied worker object in-place. */
export function applyAnonymizationFields(
  worker: AnonymizableWorker,
  reason: string
): void {
  const tombstoneId = worker._id.toString().slice(-8);

  worker.firstName   = 'Gelöschter';
  worker.lastName    = `Mitarbeiter (${tombstoneId})`;
  worker.email       = `deleted-${tombstoneId}@anonymized.invalid`;
  worker.phone       = undefined;
  worker.dateOfBirth = undefined;
  worker.gender      = undefined;
  worker.nationality = undefined;
  worker.address     = { country: 'DE' };

  worker.steuernummerEncrypted             = undefined;
  worker.sozialversicherungsnummerEncrypted = undefined;
  worker.ibanEncrypted                     = undefined;
  worker.bankName                          = undefined;
  worker.steuerklasse                      = undefined;
  worker.healthInsuranceProvider           = undefined;

  worker.documents  = [];
  worker.skills     = [];
  worker.languages  = [];
  worker.availability.exceptions        = [];
  worker.availability.preferredRadiusKm = undefined;

  worker.dsgvoConsentAt = undefined;
  worker.dsgvoConsentIp = undefined;

  worker.auegTracking = worker.auegTracking.map((e) => ({
    ...e,
    businessName: '[anonymisiert]',
  }));

  worker.status     = 'anonymized';
  worker.deletedAt  = new Date();
  worker.statusNote = `DSGVO-Anonymisierung: ${reason}`;
}

export interface ExportWorker {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: unknown;
  dateOfBirth?: unknown;
  gender?: unknown;
  nationality?: unknown;
  address?: unknown;
  steuerklasse?: unknown;
  steuernummerEncrypted?: string;
  sozialversicherungsnummerEncrypted?: string;
  ibanEncrypted?: string;
  bankName?: unknown;
  healthInsuranceProvider?: unknown;
  skills?: unknown;
  languages?: unknown;
  status?: string;
  registrationSource?: unknown;
  dsgvoConsentAt?: unknown;
  createdAt?: unknown;
  documents: Array<{ category?: unknown; label?: unknown; expiryDate?: unknown; verified?: unknown; uploadedAt?: unknown }>;
  auegTracking?: unknown;
}

export interface ExportTimesheet {
  shiftDate?: unknown;
  totalHours?: unknown;
  status?: unknown;
  approvedAt?: unknown;
}

export interface ExportShift {
  startTime?: unknown;
  endTime?: unknown;
  title?: unknown;
  businessName?: unknown;
  locationName?: unknown;
  status?: unknown;
}

export interface ExportRating {
  overallRating?: unknown;
  punctuality?: unknown;
  quality?: unknown;
  attitude?: unknown;
  comment?: unknown;
  createdAt?: unknown;
}

/** Builds the Art. 20 data-portability JSON bundle. */
export function buildExportBundle(
  worker: ExportWorker,
  timesheets: ExportTimesheet[],
  shifts: ExportShift[],
  ratings: ExportRating[],
  exportedBy: string,
  safeDecrypt: (v?: string) => string | undefined
) {
  return {
    exportedAt:  new Date().toISOString(),
    exportedBy,
    legalBasis:  'DSGVO Art. 20 — Recht auf Datenübertragbarkeit',
    worker: {
      id:                       worker._id.toString(),
      firstName:                worker.firstName,
      lastName:                 worker.lastName,
      email:                    worker.email,
      phone:                    worker.phone,
      dateOfBirth:              worker.dateOfBirth,
      gender:                   worker.gender,
      nationality:              worker.nationality,
      address:                  worker.address,
      steuerklasse:             worker.steuerklasse,
      steuernummer:             safeDecrypt(worker.steuernummerEncrypted),
      sozialversicherungsnummer: safeDecrypt(worker.sozialversicherungsnummerEncrypted),
      healthInsuranceProvider:  worker.healthInsuranceProvider,
      iban:                     safeDecrypt(worker.ibanEncrypted),
      bankName:                 worker.bankName,
      skills:                   worker.skills,
      languages:                worker.languages,
      status:                   worker.status,
      registrationSource:       worker.registrationSource,
      dsgvoConsentAt:           worker.dsgvoConsentAt,
      createdAt:                worker.createdAt,
    },
    documents: worker.documents.map((d) => ({
      category:   d.category,
      label:      d.label,
      expiryDate: d.expiryDate,
      verified:   d.verified,
      uploadedAt: d.uploadedAt,
    })),
    auegTracking: worker.auegTracking,
    timesheets:   timesheets.map((t) => ({
      shiftDate:  t.shiftDate,
      totalHours: t.totalHours,
      status:     t.status,
      approvedAt: t.approvedAt,
    })),
    assignments: shifts.map((s) => ({
      startTime:    s.startTime,
      endTime:      s.endTime,
      title:        s.title,
      businessName: s.businessName,
      locationName: s.locationName,
      status:       s.status,
    })),
    ratings: ratings.map((r) => ({
      overallRating: r.overallRating,
      punctuality:   r.punctuality,
      quality:       r.quality,
      attitude:      r.attitude,
      comment:       r.comment,
      createdAt:     r.createdAt,
    })),
  };
}
