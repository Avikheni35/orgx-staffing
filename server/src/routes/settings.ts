import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { Worker } from '../models/Worker';
import { verifyPassword, hashPassword } from '../utils/password';
import { logAudit } from '../utils/audit';
import { encryptField, decryptField } from '../utils/crypto';
import { IntegrationSettings } from '../models/IntegrationSettings';
import { peers } from '../utils/serviceClient';

const router = Router();
router.use(requireAuth);

// GET /api/settings/agency  (agency_admin only)
router.get(
  '/agency',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.user!.tenantId).lean();
    if (!tenant) throw new AppError('Tenant not found', 404);
    const ibanRaw = tenant.companyDetails?.ibanEncrypted;
    res.json({
      ...tenant,
      companyDetails: {
        ...tenant.companyDetails,
        iban: ibanRaw ? decryptField(ibanRaw) : undefined,
        ibanEncrypted: undefined,
      },
    });
  })
);

const agencySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  branding: z
    .object({ primaryColor: z.string().optional() })
    .optional(),
  companyDetails: z
    .object({
      address: z.string().optional(),
      hrbNumber: z.string().optional(),
      auegLicenseNumber: z.string().optional(),
      vatId: z.string().optional(),
      iban: z.string().optional(),
    })
    .optional(),
  invoiceSettings: z
    .object({
      prefix: z.string().max(10).optional(),
      vatRate: z.coerce.number().min(0).max(100).optional(),
      paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
    })
    .optional(),
  complianceSettings: z
    .object({
      auegWarnMonths: z.coerce.number().int().min(1).max(18).optional(),
      auegBlockMonths: z.coerce.number().int().min(1).max(24).optional(),
      minRestHoursBetweenShifts: z.coerce.number().min(0).max(24).optional(),
      mindestlohnOverride: z.coerce.number().positive().optional().nullable(),
    })
    .optional(),
  securitySettings: z
    .object({
      require2FA: z.boolean().optional(),
    })
    .optional(),
});

// PATCH /api/settings/agency
router.patch(
  '/agency',
  requireRole('agency_admin'),
  validate(agencySchema),
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.user!.tenantId);
    if (!tenant) throw new AppError('Tenant not found', 404);

    const { name, branding, companyDetails, invoiceSettings, complianceSettings, securitySettings } = req.body;

    if (name) tenant.name = name;

    if (branding?.primaryColor) {
      tenant.branding.primaryColor = branding.primaryColor;
    }

    if (companyDetails) {
      const { iban, ...rest } = companyDetails;
      Object.assign(tenant.companyDetails, rest);
      if (iban !== undefined) {
        tenant.companyDetails.ibanEncrypted = iban ? encryptField(iban) : undefined;
      }
    }

    if (invoiceSettings) {
      Object.assign(tenant.invoiceSettings, invoiceSettings);
    }

    if (complianceSettings) {
      const { mindestlohnOverride, ...rest } = complianceSettings;
      Object.assign(tenant.complianceSettings, rest);
      if (mindestlohnOverride !== undefined) {
        tenant.complianceSettings.mindestlohnOverride =
          mindestlohnOverride == null ? undefined : mindestlohnOverride;
      }
    }

    if (securitySettings?.require2FA !== undefined) {
      // Use Mongoose's set() to safely create the nested path even when
      // securitySettings doesn't exist yet on legacy tenant documents.
      tenant.set('securitySettings.require2FA', securitySettings.require2FA);
    }

    await tenant.save();
    logAudit({
      req,
      action: 'settings.agency_updated',
      targetType: 'Tenant',
      targetId: tenant._id.toString(),
      targetName: tenant.name,
      details: { updatedFields: Object.keys(req.body) },
    });
    res.json(tenant);
  })
);

// GET /api/settings/subscription  (agency_admin only)
router.get(
  '/subscription',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const tenant = await Tenant.findById(tenantId)
      .select('plan status trialEndsAt planLimits')
      .lean();
    if (!tenant) throw new AppError('Tenant not found', 404);

    const [workerCount, disponentCount] = await Promise.all([
      Worker.countDocuments({ tenantId, status: { $in: ['active', 'pending_review'] } }),
      User.countDocuments({ tenantId, role: 'disponent' }),
    ]);

    res.json({
      plan: tenant.plan,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
      planLimits: tenant.planLimits,
      usage: { workers: workerCount, disponents: disponentCount },
    });
  })
);

// GET /api/settings/profile
router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.userId)
      .select('-passwordHash -refreshTokenHashes -inviteTokenHash -emailOtpHash -passwordResetTokenHash -magicLinkTokenHash')
      .lean();
    if (!user) throw new AppError('User not found', 404);
    res.json(user);
  })
);

const profileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().optional(),
  language: z.enum(['de', 'en']).optional(),
  notificationPreferences: z.object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    push: z.boolean().optional(),
  }).optional(),
});

// PATCH /api/settings/profile
router.patch(
  '/profile',
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.userId);
    if (!user) throw new AppError('User not found', 404);

    const { firstName, lastName, phone, language, notificationPreferences } = req.body;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone || undefined;
    if (language !== undefined) user.language = language;
    if (notificationPreferences) {
      Object.assign(user.notificationPreferences, notificationPreferences);
    }

    await user.save();
    res.json({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      language: user.language,
      notificationPreferences: user.notificationPreferences,
    });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Mindestens 8 Zeichen'),
});

// POST /api/settings/profile/change-password
router.post(
  '/profile/change-password',
  requireRole('super_admin', 'agency_admin', 'disponent'),
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.userId);
    if (!user) throw new AppError('User not found', 404);
    if (!user.passwordHash) throw new AppError('Password login not available for this account', 400);

    const valid = await verifyPassword(req.body.currentPassword, user.passwordHash);
    if (!valid) throw new AppError('Aktuelles Passwort ist falsch', 401);

    user.passwordHash = await hashPassword(req.body.newPassword);
    // Revoke all other sessions so the new password takes effect everywhere
    user.refreshTokenHashes = [];
    await user.save();

    res.json({ message: 'Password changed successfully' });
  })
);

// ── Feature Flags ──────────────────────────────────────────────────────────

const m1FeaturesSchema = z.object({
  workerSelfRegistration:    z.boolean().optional(),
  requireDocumentUpload:     z.boolean().optional(),
  enableMagicLink:           z.boolean().optional(),
  enableJobApplicationForm:  z.boolean().optional(),
  attendanceMethod:          z.enum(['manual','qr','gps','nfc']).optional(),
  overtimeThresholdHours:    z.coerce.number().int().min(1).max(24).optional(),
  timesheetApprovalRequired: z.boolean().optional(),
  contractAutoVoidOverlap:   z.boolean().optional(),
  autoInvoiceOnApproval:     z.boolean().optional(),
  datevExportEnabled:        z.boolean().optional(),
  enableClientPortal:        z.boolean().optional(),
  enableWorkerRatings:       z.boolean().optional(),
  smsNotifications:          z.boolean().optional(),
  sessionTimeoutMinutes:     z.coerce.number().int().min(15).max(480).nullable().optional(),
});

const m2FeaturesSchema = z.object({
  publicApplicationFlow:    z.boolean().optional(),
  autoAssignOnAvailability: z.boolean().optional(),
  autoApproveTimesheets:    z.boolean().optional(),
  requireCheckinPhoto:      z.boolean().optional(),
  disputeWindowDays:        z.coerce.number().int().min(1).max(90).optional(),
  invoicingEnabled:         z.boolean().optional(),
  paymentGateway:           z.enum(['none','stripe','sepa']).optional(),
  defaultEventVisibility:   z.enum(['private','public']).optional(),
  eventClientPortal:        z.boolean().optional(),
  staffRatingEnabled:       z.boolean().optional(),
});

// GET /api/settings/features/m1
router.get(
  '/features/m1',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.user!.tenantId).lean();
    if (!tenant) throw new AppError('Tenant not found', 404);
    res.json(tenant.featureFlags ?? {});
  })
);

// PATCH /api/settings/features/m1
router.patch(
  '/features/m1',
  requireRole('agency_admin'),
  validate(m1FeaturesSchema),
  asyncHandler(async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req.body)) {
      patch[`featureFlags.${k}`] = v;
    }
    const tenant = await Tenant.findByIdAndUpdate(
      req.user!.tenantId,
      { $set: patch },
      { new: true, upsert: false }
    );
    if (!tenant) throw new AppError('Tenant not found', 404);
    logAudit({ req, action: 'settings.features_m1_updated', targetType: 'Tenant',
               targetId: tenant._id.toString(), targetName: tenant.name,
               details: { patch: req.body } });
    res.json(tenant.featureFlags);
  })
);

// GET /api/settings/features/m2
router.get(
  '/features/m2',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.user!.tenantId).lean();
    if (!tenant) throw new AppError('Tenant not found', 404);
    res.json((tenant as unknown as Record<string, unknown>).m2FeatureFlags ?? {});
  })
);

// PATCH /api/settings/features/m2
router.patch(
  '/features/m2',
  requireRole('agency_admin'),
  validate(m2FeaturesSchema),
  asyncHandler(async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req.body)) {
      patch[`m2FeatureFlags.${k}`] = v;
    }
    const tenant = await Tenant.findByIdAndUpdate(
      req.user!.tenantId,
      { $set: patch },
      { new: true, upsert: false }
    );
    if (!tenant) throw new AppError('Tenant not found', 404);
    logAudit({ req, action: 'settings.features_m2_updated', targetType: 'Tenant',
               targetId: tenant._id.toString(), targetName: tenant.name,
               details: { patch: req.body } });
    res.json((tenant as unknown as Record<string, unknown>).m2FeatureFlags);
  })
);

// ── Service Integration Settings ──────────────────────────────────────────

// GET /api/settings/integrations
router.get(
  '/integrations',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const settings = await IntegrationSettings.findOneAndUpdate(
      { tenantId },
      { $setOnInsert: { tenantId } },
      { upsert: true, new: true }
    );

    const mask = (token?: string) =>
      token ? `••••••••${token.slice(-8)}` : undefined;

    const cs = settings.connectedServices;
    res.json({
      ownServiceToken: settings.ownServiceToken,
      connectedServices: {
        m2: cs?.m2 ? { url: cs.m2.url, enabled: cs.m2.enabled, lastPingAt: cs.m2.lastPingAt, lastPingOk: cs.m2.lastPingOk, token: mask(cs.m2.token) } : null,
        m3: cs?.m3 ? { url: cs.m3.url, enabled: cs.m3.enabled, lastPingAt: cs.m3.lastPingAt, lastPingOk: cs.m3.lastPingOk, token: mask(cs.m3.token) } : null,
      },
    });
  })
);

// PUT /api/settings/integrations/connections
router.put(
  '/integrations/connections',
  requireRole('agency_admin'),
  validate(z.object({
    module:  z.enum(['m2', 'm3']),
    url:     z.string().url(),
    token:   z.string().min(1),
    enabled: z.boolean().optional().default(true),
  })),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const { module: mod, url, token, enabled } = req.body as {
      module: 'm2' | 'm3'; url: string; token: string; enabled: boolean;
    };

    const update: Record<string, unknown> = {
      [`connectedServices.${mod}.url`]:     url,
      [`connectedServices.${mod}.token`]:   token,
      [`connectedServices.${mod}.enabled`]: enabled,
    };

    const settings = await IntegrationSettings.findOneAndUpdate(
      { tenantId },
      { $set: update },
      { upsert: true, new: true }
    );

    res.json({ ok: true, module: mod, enabled: settings.connectedServices?.[mod]?.enabled });
  })
);

// POST /api/settings/integrations/test/:module
router.post(
  '/integrations/test/:module',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const mod = req.params.module as 'm2' | 'm3';
    if (mod !== 'm2' && mod !== 'm3') {
      throw new AppError('Invalid module', 400);
    }

    const start = Date.now();
    const ok = await peers[mod].ping(tenantId);
    const latencyMs = Date.now() - start;

    await IntegrationSettings.updateOne(
      { tenantId },
      { $set: { [`connectedServices.${mod}.lastPingAt`]: new Date(), [`connectedServices.${mod}.lastPingOk`]: ok } }
    );

    res.json({ ok, latencyMs: ok ? latencyMs : undefined });
  })
);

// POST /api/settings/integrations/regenerate-token
router.post(
  '/integrations/regenerate-token',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const newToken = 'sk_m1_' + randomBytes(24).toString('hex');

    await IntegrationSettings.findOneAndUpdate(
      { tenantId },
      { $set: { ownServiceToken: newToken } },
      { upsert: true }
    );

    logAudit({
      req,
      action: 'settings.integration_token_regenerated',
      targetType: 'Tenant',
      targetId: tenantId,
      targetName: 'IntegrationSettings',
    });

    res.json({ ownServiceToken: newToken });
  })
);

export default router;
