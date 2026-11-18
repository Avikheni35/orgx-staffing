/**
 * Comprehensive M1 demo data seed.
 * Creates workers, businesses, shifts, timesheets, and an invoice
 * for the 'demo' tenant so the platform looks alive for customer demos.
 *
 * Run: npx tsx src/scripts/seed_demo_data.ts
 * Idempotent: clears and rebuilds all M1 demo data each run.
 */
import mongoose, { Types } from 'mongoose';
import { connectDB } from '../config/db';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { Worker } from '../models/Worker';
import { Business } from '../models/Business';
import { Shift } from '../models/Shift';
import { Timesheet } from '../models/Timesheet';

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysAhead(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function setHour(base: Date, h: number, m = 0): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function calcHours(start: Date, end: Date, breakMin: number): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 3_600_000 - breakMin / 60);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function seed() {
  await connectDB();
  console.log('[M1 Demo Seed] Connected');

  const tenant = await Tenant.findOne({ loginCode: 'demo' });
  if (!tenant) {
    console.error('[M1 Demo Seed] Demo tenant not found — run seed.ts first');
    process.exit(1);
  }
  const tenantId = tenant._id as Types.ObjectId;

  const admin = await User.findOne({ tenantId, role: 'agency_admin' });
  if (!admin) {
    console.error('[M1 Demo Seed] Agency admin not found');
    process.exit(1);
  }
  const createdBy = admin._id as Types.ObjectId;

  // ── Wipe existing demo data ──────────────────────────────────────────────
  await Promise.all([
    Worker.deleteMany({ tenantId }),
    Business.deleteMany({ tenantId }),
    Shift.deleteMany({ tenantId }),
    Timesheet.deleteMany({ tenantId }),
  ]);
  console.log('[M1 Demo Seed] Cleared previous demo data');

  // ── Businesses ───────────────────────────────────────────────────────────
  const businesses = await Business.insertMany([
    {
      tenantId, createdBy,
      name: 'Logistik AG Frankfurt',
      industry: 'Logistik & Transport',
      vatNumber: 'DE129478623',
      hrbNumber: 'HRB 54321',
      defaultBillingRatePerHour: 24,
      address: { street: 'Mainzer Landstr. 50', city: 'Frankfurt am Main', postalCode: '60325', country: 'DE' },
      status: 'active',
      moduleSource: 'workforce',
      externalRefs: [],
      contacts: [
        { _id: new Types.ObjectId(), firstName: 'Klaus', lastName: 'Berger', role: 'Personalleiter', email: 'k.berger@logistik-ag.de', phone: '+49 69 111 200', hasPortalAccess: false },
        { _id: new Types.ObjectId(), firstName: 'Petra', lastName: 'Lange', role: 'Disponentin', email: 'p.lange@logistik-ag.de', phone: '+49 69 111 201', hasPortalAccess: false },
      ],
      locations: [
        { _id: new Types.ObjectId(), name: 'Lager West', street: 'Mainzer Landstr. 50', city: 'Frankfurt am Main', postalCode: '60325', country: 'DE' },
        { _id: new Types.ObjectId(), name: 'Lager Ost', street: 'Hanauer Landstr. 300', city: 'Frankfurt am Main', postalCode: '60314', country: 'DE' },
      ],
    },
    {
      tenantId, createdBy,
      name: 'Rhein-Main Catering GmbH',
      industry: 'Gastronomie & Catering',
      vatNumber: 'DE278430192',
      defaultBillingRatePerHour: 22,
      address: { street: 'Gutleutstraße 82', city: 'Frankfurt am Main', postalCode: '60329', country: 'DE' },
      status: 'active',
      moduleSource: 'workforce',
      externalRefs: [],
      contacts: [
        { _id: new Types.ObjectId(), firstName: 'Sabine', lastName: 'Müller', role: 'Geschäftsführerin', email: 'sabine.mueller@rm-catering.de', phone: '+49 69 242 40', hasPortalAccess: false },
      ],
      locations: [
        { _id: new Types.ObjectId(), name: 'Zentralküche', street: 'Gutleutstraße 82', city: 'Frankfurt am Main', postalCode: '60329', country: 'DE' },
      ],
    },
    {
      tenantId, createdBy,
      name: 'Produktionswerk Hoechst GmbH',
      industry: 'Fertigung & Produktion',
      vatNumber: 'DE114200841',
      hrbNumber: 'HRB 98765',
      defaultBillingRatePerHour: 26,
      address: { street: 'Industriepark Hoechst, Geb. C 770', city: 'Frankfurt am Main', postalCode: '65929', country: 'DE' },
      status: 'active',
      moduleSource: 'workforce',
      externalRefs: [],
      contacts: [
        { _id: new Types.ObjectId(), firstName: 'Heinrich', lastName: 'Fuchs', role: 'Werkleiter', email: 'h.fuchs@pw-hoechst.de', phone: '+49 69 305 200', hasPortalAccess: false },
        { _id: new Types.ObjectId(), firstName: 'Renate', lastName: 'Krämer', role: 'HR-Managerin', email: 'r.kraemer@pw-hoechst.de', phone: '+49 69 305 201', hasPortalAccess: false },
      ],
      locations: [
        { _id: new Types.ObjectId(), name: 'Halle 1 – Montage', street: 'Industriepark Hoechst, Geb. C 770', city: 'Frankfurt am Main', postalCode: '65929', country: 'DE' },
        { _id: new Types.ObjectId(), name: 'Halle 2 – Verpackung', street: 'Industriepark Hoechst, Geb. C 780', city: 'Frankfurt am Main', postalCode: '65929', country: 'DE' },
      ],
    },
  ]);

  const [logistikAG, rmCatering, prodHoechst] = businesses;
  console.log(`[M1 Demo Seed] Created ${businesses.length} businesses`);

  // ── Workers ──────────────────────────────────────────────────────────────
  const availability = {
    weeklyPattern: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false },
    exceptions: [],
    preferredRadiusKm: 30,
  };

  const workers = await Worker.insertMany([
    {
      tenantId, createdBy,
      firstName: 'Thomas', lastName: 'Müller',
      dateOfBirth: new Date('1988-03-14'), gender: 'male', nationality: 'DE',
      address: { street: 'Berger Str. 45', city: 'Frankfurt am Main', postalCode: '60316', country: 'DE' },
      phone: '+49 151 23456701', email: 'thomas.mueller@demo.de',
      steuerklasse: '1', healthInsuranceProvider: 'AOK Hessen',
      skills: ['Gabelstapler', 'Lagerhaltung', 'Qualitätskontrolle', 'MS Office'],
      languages: [{ language: 'Deutsch', level: 'native' }, { language: 'Englisch', level: 'conversational' }],
      status: 'active', registrationSource: 'manual', moduleSource: 'workforce', externalRefs: [],
      dsgvoConsentAt: daysAgo(90),
      availability,
      auegTracking: [{ businessId: logistikAG._id, businessName: logistikAG.name, startDate: daysAgo(180), monthsWorked: 6, lastAssignmentDate: daysAgo(3) }],
      rating: { average: 4.7, count: 14 }, totalHoursWorked: 312,
      documents: [
        { _id: new Types.ObjectId(), category: 'identity', label: 'Personalausweis', fileUrl: '/uploads/documents/placeholder.pdf', expiryDate: new Date('2030-03-14'), verified: true, uploadedAt: daysAgo(90) },
      ],
    },
    {
      tenantId, createdBy,
      firstName: 'Maria', lastName: 'Santos',
      dateOfBirth: new Date('1994-07-22'), gender: 'female', nationality: 'BR',
      address: { street: 'Sachsenhäuser Ufer 12', city: 'Frankfurt am Main', postalCode: '60594', country: 'DE' },
      phone: '+49 151 23456702', email: 'maria.santos@demo.de',
      steuerklasse: '1', healthInsuranceProvider: 'TK',
      skills: ['Catering', 'Küche', 'HACCP', 'Lebensmittelhygiene'],
      languages: [{ language: 'Deutsch', level: 'fluent' }, { language: 'Englisch', level: 'fluent' }, { language: 'Portugiesisch', level: 'native' }],
      status: 'active', registrationSource: 'manual', moduleSource: 'workforce', externalRefs: [],
      dsgvoConsentAt: daysAgo(60),
      availability,
      auegTracking: [{ businessId: rmCatering._id, businessName: rmCatering.name, startDate: daysAgo(60), monthsWorked: 2, lastAssignmentDate: daysAgo(5) }],
      rating: { average: 4.9, count: 22 }, totalHoursWorked: 198,
      documents: [
        { _id: new Types.ObjectId(), category: 'identity', label: 'Reisepass', fileUrl: '/uploads/documents/placeholder.pdf', expiryDate: new Date('2028-07-22'), verified: true, uploadedAt: daysAgo(60) },
        { _id: new Types.ObjectId(), category: 'health_certificate', label: 'Gesundheitszeugnis', fileUrl: '/uploads/documents/placeholder.pdf', expiryDate: daysAhead(300), verified: true, uploadedAt: daysAgo(60) },
        { _id: new Types.ObjectId(), category: 'work_permit', label: 'Niederlassungserlaubnis', fileUrl: '/uploads/documents/placeholder.pdf', verified: true, uploadedAt: daysAgo(60) },
      ],
    },
    {
      tenantId, createdBy,
      firstName: 'Kevin', lastName: 'Hoffmann',
      dateOfBirth: new Date('1991-11-05'), gender: 'male', nationality: 'DE',
      address: { street: 'Römerberg 8', city: 'Frankfurt am Main', postalCode: '60311', country: 'DE' },
      phone: '+49 151 23456703', email: 'kevin.hoffmann@demo.de',
      steuerklasse: '3', healthInsuranceProvider: 'Barmer',
      skills: ['Gabelstapler', 'Staplerführerschein', 'Lagerhaltung', 'Kommissionierung', 'LKW-Führerschein Klasse C'],
      languages: [{ language: 'Deutsch', level: 'native' }],
      status: 'active', registrationSource: 'manual', moduleSource: 'workforce', externalRefs: [],
      dsgvoConsentAt: daysAgo(120),
      availability: { ...availability, weeklyPattern: { ...availability.weeklyPattern, saturday: true } },
      auegTracking: [{ businessId: logistikAG._id, businessName: logistikAG.name, startDate: daysAgo(270), monthsWorked: 9, lastAssignmentDate: daysAgo(1) }],
      rating: { average: 4.4, count: 18 }, totalHoursWorked: 428,
      documents: [
        { _id: new Types.ObjectId(), category: 'identity', label: 'Personalausweis', fileUrl: '/uploads/documents/placeholder.pdf', expiryDate: new Date('2027-11-05'), verified: true, uploadedAt: daysAgo(120) },
      ],
    },
    {
      tenantId, createdBy,
      firstName: 'Aisha', lastName: 'Diallo',
      dateOfBirth: new Date('1996-02-18'), gender: 'female', nationality: 'SN',
      address: { street: 'Kaiserstr. 60', city: 'Frankfurt am Main', postalCode: '60329', country: 'DE' },
      phone: '+49 151 23456704', email: 'aisha.diallo@demo.de',
      steuerklasse: '1', healthInsuranceProvider: 'DAK',
      skills: ['Montage', 'Qualitätskontrolle', 'Maschinenbedienung', 'ISO 9001'],
      languages: [{ language: 'Deutsch', level: 'conversational' }, { language: 'Englisch', level: 'basic' }, { language: 'Französisch', level: 'native' }],
      status: 'active', registrationSource: 'manual', moduleSource: 'workforce', externalRefs: [],
      dsgvoConsentAt: daysAgo(45),
      availability,
      auegTracking: [{ businessId: prodHoechst._id, businessName: prodHoechst.name, startDate: daysAgo(45), monthsWorked: 1, lastAssignmentDate: daysAgo(2) }],
      rating: { average: 4.8, count: 6 }, totalHoursWorked: 96,
      documents: [
        { _id: new Types.ObjectId(), category: 'identity', label: 'Reisepass', fileUrl: '/uploads/documents/placeholder.pdf', expiryDate: new Date('2031-02-18'), verified: true, uploadedAt: daysAgo(45) },
        { _id: new Types.ObjectId(), category: 'work_permit', label: 'Aufenthaltserlaubnis', fileUrl: '/uploads/documents/placeholder.pdf', expiryDate: daysAhead(180), verified: true, uploadedAt: daysAgo(45) },
      ],
    },
    {
      tenantId, createdBy,
      firstName: 'Stefan', lastName: 'Bauer',
      dateOfBirth: new Date('1985-09-30'), gender: 'male', nationality: 'DE',
      address: { street: 'Bornheimer Landstr. 95', city: 'Frankfurt am Main', postalCode: '60385', country: 'DE' },
      phone: '+49 151 23456705', email: 'stefan.bauer@demo.de',
      steuerklasse: '4', healthInsuranceProvider: 'IKK',
      skills: ['Gabelstapler', 'Lagerhaltung', 'Bestandsverwaltung', 'SAP WM'],
      languages: [{ language: 'Deutsch', level: 'native' }, { language: 'Polnisch', level: 'conversational' }],
      status: 'active', registrationSource: 'manual', moduleSource: 'workforce', externalRefs: [],
      dsgvoConsentAt: daysAgo(200),
      availability: { ...availability, weeklyPattern: { ...availability.weeklyPattern, saturday: true, sunday: true } },
      auegTracking: [{ businessId: logistikAG._id, businessName: logistikAG.name, startDate: daysAgo(540), monthsWorked: 18, lastAssignmentDate: daysAgo(7) }],
      rating: { average: 4.2, count: 30 }, totalHoursWorked: 726,
      documents: [
        { _id: new Types.ObjectId(), category: 'identity', label: 'Personalausweis', fileUrl: '/uploads/documents/placeholder.pdf', expiryDate: new Date('2032-09-30'), verified: true, uploadedAt: daysAgo(200) },
      ],
    },
    {
      tenantId, createdBy,
      firstName: 'Yuki', lastName: 'Tanaka',
      dateOfBirth: new Date('1999-06-12'), gender: 'female', nationality: 'JP',
      address: { street: 'Friedberger Anlage 14', city: 'Frankfurt am Main', postalCode: '60316', country: 'DE' },
      phone: '+49 151 23456706', email: 'yuki.tanaka@demo.de',
      steuerklasse: '1', healthInsuranceProvider: 'TK',
      skills: ['Küche', 'Anrichten', 'Hygiene', 'HACCP'],
      languages: [{ language: 'Deutsch', level: 'conversational' }, { language: 'Englisch', level: 'fluent' }, { language: 'Japanisch', level: 'native' }],
      status: 'active', registrationSource: 'manual', moduleSource: 'workforce', externalRefs: [],
      dsgvoConsentAt: daysAgo(30),
      availability,
      auegTracking: [{ businessId: rmCatering._id, businessName: rmCatering.name, startDate: daysAgo(30), monthsWorked: 1, lastAssignmentDate: daysAgo(6) }],
      rating: { average: 5.0, count: 4 }, totalHoursWorked: 48,
      documents: [
        { _id: new Types.ObjectId(), category: 'identity', label: 'Reisepass', fileUrl: '/uploads/documents/placeholder.pdf', expiryDate: new Date('2029-06-12'), verified: true, uploadedAt: daysAgo(30) },
        { _id: new Types.ObjectId(), category: 'work_permit', label: 'Niederlassungserlaubnis', fileUrl: '/uploads/documents/placeholder.pdf', verified: true, uploadedAt: daysAgo(30) },
        { _id: new Types.ObjectId(), category: 'health_certificate', label: 'Gesundheitszeugnis', fileUrl: '/uploads/documents/placeholder.pdf', expiryDate: daysAhead(340), verified: true, uploadedAt: daysAgo(30) },
      ],
    },
    {
      tenantId, createdBy,
      firstName: 'Daniel', lastName: 'Krause',
      dateOfBirth: new Date('1982-04-20'), gender: 'male', nationality: 'DE',
      address: { street: 'Eschenheimer Anlage 28', city: 'Frankfurt am Main', postalCode: '60318', country: 'DE' },
      phone: '+49 151 23456707', email: 'daniel.krause@demo.de',
      steuerklasse: '2',
      skills: ['Montage', 'Schweißen', 'Maschinenbedienung', 'CNC', 'Qualitätssicherung'],
      languages: [{ language: 'Deutsch', level: 'native' }, { language: 'Englisch', level: 'basic' }],
      status: 'active', registrationSource: 'manual', moduleSource: 'workforce', externalRefs: [],
      dsgvoConsentAt: daysAgo(150),
      availability: { ...availability, weeklyPattern: { ...availability.weeklyPattern, saturday: true } },
      auegTracking: [{ businessId: prodHoechst._id, businessName: prodHoechst.name, startDate: daysAgo(365), monthsWorked: 12, lastAssignmentDate: daysAgo(4) }],
      rating: { average: 4.6, count: 25 }, totalHoursWorked: 560,
      documents: [
        { _id: new Types.ObjectId(), category: 'identity', label: 'Personalausweis', fileUrl: '/uploads/documents/placeholder.pdf', expiryDate: new Date('2026-04-20'), verified: true, uploadedAt: daysAgo(150) },
      ],
    },
    {
      tenantId, createdBy,
      firstName: 'Fatima', lastName: 'El-Amrani',
      dateOfBirth: new Date('2001-01-09'), gender: 'female', nationality: 'MA',
      address: { street: 'Textorstr. 12', city: 'Frankfurt am Main', postalCode: '60594', country: 'DE' },
      phone: '+49 151 23456708', email: 'fatima.elamrani@demo.de',
      steuerklasse: '1', healthInsuranceProvider: 'BKK',
      skills: ['Kommissionierung', 'Wareneingang', 'Scannen', 'Verpackung'],
      languages: [{ language: 'Deutsch', level: 'fluent' }, { language: 'Arabisch', level: 'native' }, { language: 'Französisch', level: 'conversational' }],
      status: 'active', registrationSource: 'self_registration', moduleSource: 'workforce', externalRefs: [],
      dsgvoConsentAt: daysAgo(20),
      availability,
      auegTracking: [],
      rating: { average: 4.5, count: 3 }, totalHoursWorked: 32,
      documents: [
        { _id: new Types.ObjectId(), category: 'identity', label: 'Reisepass', fileUrl: '/uploads/documents/placeholder.pdf', expiryDate: new Date('2030-01-09'), verified: false, uploadedAt: daysAgo(20) },
        { _id: new Types.ObjectId(), category: 'work_permit', label: 'Niederlassungserlaubnis', fileUrl: '/uploads/documents/placeholder.pdf', verified: true, uploadedAt: daysAgo(20) },
      ],
    },
    {
      tenantId, createdBy,
      firstName: 'Björn', lastName: 'Lindqvist',
      dateOfBirth: new Date('1978-12-03'), gender: 'male', nationality: 'SE',
      address: { street: 'Westendstr. 55', city: 'Frankfurt am Main', postalCode: '60325', country: 'DE' },
      phone: '+49 151 23456709', email: 'bjorn.lindqvist@demo.de',
      steuerklasse: '1',
      skills: ['Gabelstapler', 'Staplerführerschein', 'Lagerhaltung', 'Führungserfahrung', 'Schichtleitung'],
      languages: [{ language: 'Deutsch', level: 'fluent' }, { language: 'Englisch', level: 'fluent' }, { language: 'Schwedisch', level: 'native' }],
      status: 'inactive', statusNote: 'Elternzeit bis Q3 2026',
      registrationSource: 'manual', moduleSource: 'workforce', externalRefs: [],
      dsgvoConsentAt: daysAgo(400),
      availability,
      auegTracking: [],
      rating: { average: 4.8, count: 40 }, totalHoursWorked: 890,
      documents: [],
    },
    {
      tenantId, createdBy,
      firstName: 'Olga', lastName: 'Petrova',
      dateOfBirth: new Date('1993-08-17'), gender: 'female', nationality: 'RU',
      address: { street: 'Hanauer Landstr. 45', city: 'Frankfurt am Main', postalCode: '60314', country: 'DE' },
      phone: '+49 151 23456710', email: 'olga.petrova@demo.de',
      steuerklasse: '1', healthInsuranceProvider: 'AOK',
      skills: ['Montage', 'Bestückung', 'Löten', 'Elektronik', 'SMD'],
      languages: [{ language: 'Deutsch', level: 'basic' }, { language: 'Englisch', level: 'conversational' }, { language: 'Russisch', level: 'native' }],
      status: 'pending_review', registrationSource: 'self_registration', moduleSource: 'workforce', externalRefs: [],
      dsgvoConsentAt: daysAgo(3),
      availability,
      auegTracking: [],
      rating: { average: 0, count: 0 }, totalHoursWorked: 0,
      documents: [
        { _id: new Types.ObjectId(), category: 'identity', label: 'Reisepass', fileUrl: '/uploads/documents/placeholder.pdf', expiryDate: new Date('2028-08-17'), verified: false, uploadedAt: daysAgo(3) },
      ],
    },
  ]);

  const [mueller, santos, hoffmann, diallo, bauer, tanaka, krause, elamrani] = workers;
  console.log(`[M1 Demo Seed] Created ${workers.length} workers`);

  // ── Shifts ───────────────────────────────────────────────────────────────
  // Past completed shifts (for timesheets)
  const s1Date = daysAgo(12);
  const s1Start = setHour(s1Date, 7);
  const s1End   = setHour(s1Date, 15);
  const shift1 = await Shift.create({
    tenantId, createdBy, businessId: logistikAG._id, businessName: logistikAG.name,
    locationName: 'Lager West',
    title: 'Lagerist – Frühschicht',
    startTime: s1Start, endTime: s1End, breakMinutes: 30, requiredWorkers: 3,
    payRatePerHour: 14.5, billingRatePerHour: 22, status: 'completed',
    completedAt: s1End, isInstantBooking: false, moduleSource: 'workforce', externalRefs: [],
    assignedWorkers: [
      { workerId: mueller._id, workerName: `${mueller.firstName} ${mueller.lastName}`, status: 'completed', completedAt: s1End, checkInTime: setHour(s1Date, 7, 2), checkOutTime: setHour(s1Date, 15, 5) },
      { workerId: hoffmann._id, workerName: `${hoffmann.firstName} ${hoffmann.lastName}`, status: 'completed', completedAt: s1End, checkInTime: setHour(s1Date, 7, 0), checkOutTime: setHour(s1Date, 15, 0) },
      { workerId: bauer._id, workerName: `${bauer.firstName} ${bauer.lastName}`, status: 'completed', completedAt: s1End, checkInTime: setHour(s1Date, 6, 58), checkOutTime: setHour(s1Date, 15, 3) },
    ],
  });

  const s2Date = daysAgo(8);
  const s2Start = setHour(s2Date, 10);
  const s2End   = setHour(s2Date, 18);
  const shift2 = await Shift.create({
    tenantId, createdBy, businessId: rmCatering._id, businessName: rmCatering.name,
    locationName: 'Zentralküche',
    title: 'Küchenhelfer/in – Mittagsdienst',
    startTime: s2Start, endTime: s2End, breakMinutes: 30, requiredWorkers: 2,
    payRatePerHour: 13.5, billingRatePerHour: 20, status: 'completed',
    completedAt: s2End, isInstantBooking: false, moduleSource: 'workforce', externalRefs: [],
    assignedWorkers: [
      { workerId: santos._id, workerName: `${santos.firstName} ${santos.lastName}`, status: 'completed', completedAt: s2End, checkInTime: setHour(s2Date, 10, 1), checkOutTime: setHour(s2Date, 18, 0) },
      { workerId: tanaka._id, workerName: `${tanaka.firstName} ${tanaka.lastName}`, status: 'completed', completedAt: s2End, checkInTime: setHour(s2Date, 9, 58), checkOutTime: setHour(s2Date, 18, 2) },
    ],
  });

  const s3Date = daysAgo(5);
  const s3Start = setHour(s3Date, 6);
  const s3End   = setHour(s3Date, 14);
  const shift3 = await Shift.create({
    tenantId, createdBy, businessId: prodHoechst._id, businessName: prodHoechst.name,
    locationName: 'Halle 1 – Montage',
    title: 'Montagekraft – Frühschicht',
    startTime: s3Start, endTime: s3End, breakMinutes: 30, requiredWorkers: 2,
    payRatePerHour: 15.5, billingRatePerHour: 26, status: 'completed',
    completedAt: s3End, isInstantBooking: false, moduleSource: 'workforce', externalRefs: [],
    assignedWorkers: [
      { workerId: diallo._id, workerName: `${diallo.firstName} ${diallo.lastName}`, status: 'completed', completedAt: s3End, checkInTime: setHour(s3Date, 6, 0), checkOutTime: setHour(s3Date, 14, 0) },
      { workerId: krause._id, workerName: `${krause.firstName} ${krause.lastName}`, status: 'completed', completedAt: s3End, checkInTime: setHour(s3Date, 5, 58), checkOutTime: setHour(s3Date, 14, 5) },
    ],
  });

  // Active/running shift (today)
  const todayDate = new Date();
  const shift4 = await Shift.create({
    tenantId, createdBy, businessId: logistikAG._id, businessName: logistikAG.name,
    locationName: 'Lager Ost',
    title: 'Gabelstaplerfahrer – Spätschicht',
    startTime: setHour(todayDate, 14), endTime: setHour(todayDate, 22), breakMinutes: 30,
    requiredWorkers: 2, payRatePerHour: 15, billingRatePerHour: 23,
    status: 'published', isInstantBooking: false, moduleSource: 'workforce', externalRefs: [],
    assignedWorkers: [
      { workerId: hoffmann._id, workerName: `${hoffmann.firstName} ${hoffmann.lastName}`, status: 'confirmed', checkInTime: setHour(todayDate, 14, 3) },
      { workerId: mueller._id, workerName: `${mueller.firstName} ${mueller.lastName}`, status: 'confirmed', checkInTime: setHour(todayDate, 14, 1) },
    ],
  });

  // Upcoming shifts
  const shift5 = await Shift.create({
    tenantId, createdBy, businessId: rmCatering._id, businessName: rmCatering.name,
    locationName: 'Zentralküche',
    title: 'Küchenhilfe – Frühschicht',
    startTime: setHour(daysAhead(2), 7), endTime: setHour(daysAhead(2), 15), breakMinutes: 30,
    requiredWorkers: 3, payRatePerHour: 13.5, billingRatePerHour: 20,
    status: 'published', isInstantBooking: false, moduleSource: 'workforce', externalRefs: [],
    assignedWorkers: [
      { workerId: santos._id, workerName: `${santos.firstName} ${santos.lastName}`, status: 'confirmed' },
      { workerId: tanaka._id, workerName: `${tanaka.firstName} ${tanaka.lastName}`, status: 'assigned' },
    ],
  });

  const shift6 = await Shift.create({
    tenantId, createdBy, businessId: prodHoechst._id, businessName: prodHoechst.name,
    locationName: 'Halle 2 – Verpackung',
    title: 'Verpackungshelfer/in',
    startTime: setHour(daysAhead(3), 6), endTime: setHour(daysAhead(3), 14), breakMinutes: 30,
    requiredWorkers: 4, payRatePerHour: 14, billingRatePerHour: 21,
    status: 'published', isInstantBooking: false, moduleSource: 'workforce', externalRefs: [],
    assignedWorkers: [
      { workerId: diallo._id, workerName: `${diallo.firstName} ${diallo.lastName}`, status: 'confirmed' },
      { workerId: krause._id, workerName: `${krause.firstName} ${krause.lastName}`, status: 'confirmed' },
      { workerId: elamrani._id, workerName: `${elamrani.firstName} ${elamrani.lastName}`, status: 'assigned' },
    ],
  });

  const shift7 = await Shift.create({
    tenantId, createdBy, businessId: logistikAG._id, businessName: logistikAG.name,
    locationName: 'Lager West',
    title: 'Lagerist – Nachtschicht',
    startTime: setHour(daysAhead(5), 22), endTime: setHour(daysAhead(6), 6), breakMinutes: 30,
    requiredWorkers: 2, payRatePerHour: 17, billingRatePerHour: 26,
    status: 'published', isInstantBooking: false, moduleSource: 'workforce', externalRefs: [],
    assignedWorkers: [
      { workerId: bauer._id, workerName: `${bauer.firstName} ${bauer.lastName}`, status: 'confirmed' },
    ],
    notes: 'Zugang über Tor 3. Sicherheitsausweis am Empfang abholen.',
  });

  // Draft shift
  const shift8 = await Shift.create({
    tenantId, createdBy, businessId: prodHoechst._id, businessName: prodHoechst.name,
    locationName: 'Halle 1 – Montage',
    title: 'Montagekraft – Wochenendschicht',
    startTime: setHour(daysAhead(10), 8), endTime: setHour(daysAhead(10), 16), breakMinutes: 30,
    requiredWorkers: 5, payRatePerHour: 16, billingRatePerHour: 25,
    status: 'draft', isInstantBooking: false, moduleSource: 'workforce', externalRefs: [],
    assignedWorkers: [],
  });

  console.log('[M1 Demo Seed] Created 8 shifts');

  // ── Timesheets ────────────────────────────────────────────────────────────
  // Shift 1 timesheets — 2 approved, 1 disputed
  const ts1Hours = calcHours(s1Start, s1End, 30);
  await Timesheet.insertMany([
    {
      tenantId, shiftId: shift1._id, workerId: mueller._id,
      workerName: `${mueller.firstName} ${mueller.lastName}`,
      businessId: logistikAG._id, businessName: logistikAG.name,
      shiftDate: s1Date,
      plannedStart: s1Start, plannedEnd: s1End, plannedBreakMinutes: 30,
      actualStart: setHour(s1Date, 7, 2), actualEnd: setHour(s1Date, 15, 5), actualBreakMinutes: 30,
      payRatePerHour: 14.5, billingRatePerHour: 22,
      totalHours: ts1Hours, grossPay: ts1Hours * 14.5,
      status: 'approved', approvedBy: createdBy, approvedAt: daysAgo(10),
      moduleSource: 'workforce', externalRefs: [],
    },
    {
      tenantId, shiftId: shift1._id, workerId: hoffmann._id,
      workerName: `${hoffmann.firstName} ${hoffmann.lastName}`,
      businessId: logistikAG._id, businessName: logistikAG.name,
      shiftDate: s1Date,
      plannedStart: s1Start, plannedEnd: s1End, plannedBreakMinutes: 30,
      actualStart: s1Start, actualEnd: s1End, actualBreakMinutes: 30,
      payRatePerHour: 14.5, billingRatePerHour: 22,
      totalHours: ts1Hours, grossPay: ts1Hours * 14.5,
      status: 'approved', approvedBy: createdBy, approvedAt: daysAgo(10),
      moduleSource: 'workforce', externalRefs: [],
    },
    {
      tenantId, shiftId: shift1._id, workerId: bauer._id,
      workerName: `${bauer.firstName} ${bauer.lastName}`,
      businessId: logistikAG._id, businessName: logistikAG.name,
      shiftDate: s1Date,
      plannedStart: s1Start, plannedEnd: s1End, plannedBreakMinutes: 30,
      actualStart: setHour(s1Date, 6, 58), actualEnd: setHour(s1Date, 15, 45), actualBreakMinutes: 30,
      payRatePerHour: 14.5, billingRatePerHour: 22,
      totalHours: calcHours(setHour(s1Date, 6, 58), setHour(s1Date, 15, 45), 30),
      grossPay: calcHours(setHour(s1Date, 6, 58), setHour(s1Date, 15, 45), 30) * 14.5,
      status: 'disputed',
      disputeReason: 'Tatsächliche Schichtzeit war kürzer. Mitarbeiter hat früher Feierabend gemacht.',
      moduleSource: 'workforce', externalRefs: [],
    },
  ]);

  // Shift 2 timesheets — both pending
  const ts2Hours = calcHours(s2Start, s2End, 30);
  await Timesheet.insertMany([
    {
      tenantId, shiftId: shift2._id, workerId: santos._id,
      workerName: `${santos.firstName} ${santos.lastName}`,
      businessId: rmCatering._id, businessName: rmCatering.name,
      shiftDate: s2Date,
      plannedStart: s2Start, plannedEnd: s2End, plannedBreakMinutes: 30,
      actualStart: setHour(s2Date, 10, 1), actualEnd: s2End, actualBreakMinutes: 30,
      payRatePerHour: 13.5, billingRatePerHour: 20,
      totalHours: ts2Hours, grossPay: ts2Hours * 13.5,
      status: 'pending', moduleSource: 'workforce', externalRefs: [],
    },
    {
      tenantId, shiftId: shift2._id, workerId: tanaka._id,
      workerName: `${tanaka.firstName} ${tanaka.lastName}`,
      businessId: rmCatering._id, businessName: rmCatering.name,
      shiftDate: s2Date,
      plannedStart: s2Start, plannedEnd: s2End, plannedBreakMinutes: 30,
      actualStart: setHour(s2Date, 9, 58), actualEnd: setHour(s2Date, 18, 2), actualBreakMinutes: 30,
      payRatePerHour: 13.5, billingRatePerHour: 20,
      totalHours: ts2Hours, grossPay: ts2Hours * 13.5,
      status: 'pending', moduleSource: 'workforce', externalRefs: [],
    },
  ]);

  // Shift 3 timesheets — 1 approved, 1 pending
  const ts3Hours = calcHours(s3Start, s3End, 30);
  await Timesheet.insertMany([
    {
      tenantId, shiftId: shift3._id, workerId: diallo._id,
      workerName: `${diallo.firstName} ${diallo.lastName}`,
      businessId: prodHoechst._id, businessName: prodHoechst.name,
      shiftDate: s3Date,
      plannedStart: s3Start, plannedEnd: s3End, plannedBreakMinutes: 30,
      actualStart: s3Start, actualEnd: s3End, actualBreakMinutes: 30,
      payRatePerHour: 15.5, billingRatePerHour: 26,
      totalHours: ts3Hours, grossPay: ts3Hours * 15.5,
      status: 'approved', approvedBy: createdBy, approvedAt: daysAgo(3),
      moduleSource: 'workforce', externalRefs: [],
    },
    {
      tenantId, shiftId: shift3._id, workerId: krause._id,
      workerName: `${krause.firstName} ${krause.lastName}`,
      businessId: prodHoechst._id, businessName: prodHoechst.name,
      shiftDate: s3Date,
      plannedStart: s3Start, plannedEnd: s3End, plannedBreakMinutes: 30,
      actualStart: setHour(s3Date, 5, 58), actualEnd: setHour(s3Date, 14, 5), actualBreakMinutes: 30,
      payRatePerHour: 15.5, billingRatePerHour: 26,
      totalHours: ts3Hours, grossPay: ts3Hours * 15.5,
      status: 'pending', moduleSource: 'workforce', externalRefs: [],
    },
  ]);

  console.log('[M1 Demo Seed] Created 7 timesheets (2 pending, 3 approved, 1 disputed, 1 approved)');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✓ M1 demo data seeded successfully');
  console.log(`  Businesses : 3`);
  console.log(`  Workers    : ${workers.length} (8 active, 1 inactive, 1 pending_review)`);
  console.log(`  Shifts     : 8 (3 completed, 1 running, 3 upcoming, 1 draft)`);
  console.log(`  Timesheets : 7 (3 approved, 2 pending, 1 disputed)`);
  console.log('\nAÜG alerts:');
  console.log(`  Stefan Bauer      — 18 months at Logistik AG (BLOCKED)`);
  console.log(`  Daniel Krause     — 12 months at Produktionswerk Hoechst (warning)`);
  console.log(`  Kevin Hoffmann    —  9 months at Logistik AG (warning)`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('[M1 Demo Seed] Failed:', err);
  process.exit(1);
});
