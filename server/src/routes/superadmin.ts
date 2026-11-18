import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { Tenant } from '../models/Tenant';
import { PLAN_PRICES } from '../services/stripe.service';
import { User } from '../models/User';
import { Worker } from '../models/Worker';
import { AuditLog } from '../models/AuditLog';
import { hashPassword } from '../utils/password';
import { signAccessToken } from '../utils/token';
import { logAudit } from '../utils/audit';
import mongoose from 'mongoose';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin'));

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  subdomain: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  loginCode: z.string().min(2).max(20).regex(/^[a-z0-9]+$/, 'Lowercase letters and numbers only'),
  plan: z.enum(['starter', 'growth', 'pro', 'enterprise']).optional(),
  module: z.enum(['m1', 'm2', 'm3']),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: z.enum(['trial', 'active', 'suspended']).optional(),
  plan: z.enum(['starter', 'growth', 'pro', 'enterprise']).optional(),
  trialEndsAt: z.string().optional(),
  companyDetails: z.object({
    address: z.string().optional(),
    hrbNumber: z.string().optional(),
    auegLicenseNumber: z.string().optional(),
    vatId: z.string().optional(),
  }).optional(),
  invoiceSettings: z.object({
    prefix: z.string().optional(),
    vatRate: z.coerce.number().optional(),
    paymentTermsDays: z.coerce.number().optional(),
  }).optional(),
  complianceSettings: z.object({
    auegWarnMonths: z.coerce.number().optional(),
    auegBlockMonths: z.coerce.number().optional(),
    minRestHoursBetweenShifts: z.coerce.number().optional(),
    mindestlohnOverride: z.coerce.number().optional(),
  }).optional(),
  planLimits: z.object({
    maxWorkers: z.coerce.number().optional(),
    maxDisponents: z.coerce.number().optional(),
  }).optional(),
  enabledModules: z.array(z.enum(['m1', 'm2', 'm3'])).optional(),
});

// GET /api/superadmin/tenants
// GET /api/superadmin/dashboard
// Returns only platform-health metrics — no agency business data (invoices, revenue, shifts)
router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      tenantStats,
      totalWorkers,
      staffUsers,
      trialsExpiringSoon,
      recentTenants,
    ] = await Promise.all([
      // Tenant breakdown by status — needed for billing/plan management
      Tenant.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Total registered workers across platform — for capacity planning only
      Worker.countDocuments(),
      // Staff users (admins + disponents) — for seat/license tracking
      User.countDocuments({ role: { $in: ['agency_admin', 'disponent'] } }),
      // Trial tenants whose trial ends within 7 days — requires action
      Tenant.find({
        status: 'trial',
        trialEndsAt: { $lte: sevenDaysFromNow, $gte: now },
      })
        .select('name loginCode trialEndsAt plan')
        .sort({ trialEndsAt: 1 })
        .lean(),
      // 5 most recently onboarded tenants — for quick navigation
      Tenant.find()
        .select('name loginCode status plan createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const sumByKey = (arr: Array<{ _id: string; count: number }>, key: string) =>
      arr.find((x) => x._id === key)?.count ?? 0;

    const totalTenants = tenantStats.reduce((s, x) => s + x.count, 0);

    res.json({
      tenants: {
        total: totalTenants,
        trial: sumByKey(tenantStats, 'trial'),
        active: sumByKey(tenantStats, 'active'),
        suspended: sumByKey(tenantStats, 'suspended'),
      },
      // Aggregate counts only — no per-agency breakdown
      platform: {
        totalWorkers,
        staffUsers,
      },
      trialsExpiringSoon,
      recentTenants,
    });
  })
);

router.get(
  '/tenants',
  asyncHandler(async (_req, res) => {
    const tenants = await Tenant.find().sort({ createdAt: -1 }).lean();

    const tenantIds = tenants.map((t) => t._id);
    const [userCounts, workerCounts] = await Promise.all([
      User.aggregate([
        { $match: { tenantId: { $in: tenantIds } } },
        { $group: { _id: '$tenantId', count: { $sum: 1 } } },
      ]),
      Worker.aggregate([
        { $match: { tenantId: { $in: tenantIds } } },
        { $group: { _id: '$tenantId', count: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } },
      ]),
    ]);

    const userMap = Object.fromEntries(userCounts.map((u) => [u._id.toString(), u.count]));
    const workerMap = Object.fromEntries(workerCounts.map((w) => [w._id.toString(), { total: w.count, active: w.active }]));

    const result = tenants.map((t) => ({
      ...t,
      _stats: {
        userCount: userMap[t._id.toString()] ?? 0,
        workerCount: workerMap[t._id.toString()]?.total ?? 0,
        activeWorkers: workerMap[t._id.toString()]?.active ?? 0,
      },
    }));

    res.json(result);
  })
);

// GET /api/superadmin/tenants/:id
router.get(
  '/tenants/:id',
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id).lean();
    if (!tenant) throw new AppError('Tenant not found', 404);

    const [users, workerStats] = await Promise.all([
      User.find({ tenantId: tenant._id })
        .select('firstName lastName email role status lastLoginAt createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      Worker.aggregate([
        { $match: { tenantId: tenant._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const workerByStatus = Object.fromEntries(workerStats.map((s) => [s._id, s.count]));

    res.json({ tenant, users, workerByStatus });
  })
);

// POST /api/superadmin/tenants
router.post(
  '/tenants',
  validate(createTenantSchema),
  asyncHandler(async (req, res) => {
    const { name, subdomain, loginCode, plan, module, adminFirstName, adminLastName, adminEmail, adminPassword } = req.body;

    const existing = await Tenant.findOne({ $or: [{ subdomain }, { loginCode }] });
    if (existing) {
      throw new AppError(
        existing.subdomain === subdomain ? 'Subdomain already in use' : 'Login code already in use',
        409
      );
    }

    const adminRole = module === 'm3' ? 'erp_admin' : 'agency_admin';

    const tenant = await Tenant.create({
      name,
      subdomain,
      loginCode,
      plan: plan ?? 'starter',
      status: 'trial',
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      enabledModules: [module],
    });

    const passwordHash = await hashPassword(adminPassword);
    const adminUser = await User.create({
      tenantId: tenant._id,
      role: adminRole,
      email: adminEmail,
      passwordHash,
      firstName: adminFirstName,
      lastName: adminLastName,
      emailVerified: true,
    });

    res.status(201).json({ tenant, adminUser: { _id: adminUser._id, email: adminUser.email } });
  })
);

// PATCH /api/superadmin/tenants/:id
router.patch(
  '/tenants/:id',
  validate(updateTenantSchema),
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) throw new AppError('Tenant not found', 404);

    const { name, status, plan, trialEndsAt, companyDetails, invoiceSettings, complianceSettings, planLimits } = req.body;

    if (name) tenant.name = name;
    if (status) tenant.status = status;
    if (plan) tenant.plan = plan;
    if (trialEndsAt) tenant.trialEndsAt = new Date(trialEndsAt);

    if (companyDetails) {
      tenant.companyDetails = { ...tenant.companyDetails, ...companyDetails };
    }
    if (invoiceSettings) {
      tenant.invoiceSettings = { ...tenant.invoiceSettings, ...invoiceSettings };
    }
    if (complianceSettings) {
      tenant.complianceSettings = { ...tenant.complianceSettings, ...complianceSettings };
    }
    if (planLimits) {
      tenant.planLimits = { ...tenant.planLimits, ...planLimits };
    }
    if (req.body.enabledModules) {
      tenant.enabledModules = req.body.enabledModules;
    }

    await tenant.save();
    res.json(tenant);
  })
);

// GET /api/superadmin/audit-log
router.get(
  '/audit-log',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const action = req.query.action as string | undefined;
    const tenantId = req.query.tenantId as string | undefined;

    const filter: Record<string, unknown> = {};
    if (action) filter.action = action;
    if (tenantId) filter.tenantId = tenantId;

    const [entries, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    // Attach tenant names
    const tenantIds = [...new Set(entries.map((e) => e.tenantId?.toString()).filter(Boolean))];
    const tenants = await Tenant.find({ _id: { $in: tenantIds } }).select('name loginCode').lean();
    const tenantMap = Object.fromEntries(tenants.map((t) => [t._id.toString(), t.name]));

    const result = entries.map((e) => ({
      ...e,
      tenantName: e.tenantId ? (tenantMap[e.tenantId.toString()] ?? 'Unknown') : 'Platform',
    }));

    res.json({ entries: result, total, page, pages: Math.ceil(total / limit) });
  })
);

// GET /api/superadmin/monitor
router.get(
  '/monitor',
  asyncHandler(async (_req, res) => {
    const mem = process.memoryUsage();
    const uptimeSeconds = process.uptime();

    // Quick DB connectivity check
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';

    const [
      totalTenants,
      activeTenants,
      totalWorkers,
      totalUsers,
      recentAuditCount,
    ] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({ status: 'active' }),
      Worker.countDocuments(),
      User.countDocuments(),
      AuditLog.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    ]);

    res.json({
      server: {
        uptime: uptimeSeconds,
        nodeVersion: process.version,
        memoryMb: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        },
      },
      database: {
        status: dbStatus,
        totalTenants,
        activeTenants,
        totalWorkers,
        totalUsers,
      },
      activity: {
        auditEventsLast24h: recentAuditCount,
      },
    });
  })
);

// POST /api/superadmin/tenants/:tenantId/impersonate
// Issues a 60-minute access token for a target agency_admin or disponent user so the super admin
// can view the platform from that user's perspective without knowing their password.
// No refresh token is created — impersonation sessions are intentionally short-lived.
router.post(
  '/tenants/:tenantId/impersonate',
  validate(z.object({ userId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const { tenantId } = req.params;
    const { userId } = req.body as { userId: string };

    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) throw new AppError('Tenant nicht gefunden.', 404);
    if (tenant.status === 'suspended') throw new AppError('Tenant ist gesperrt.', 403);

    const targetUser = await User.findOne({
      _id: userId,
      tenantId,
      role: { $in: ['agency_admin', 'disponent'] },
      status: 'active',
    }).lean();
    if (!targetUser) throw new AppError('Benutzer nicht gefunden oder nicht impersonierbar.', 404);

    // Issue a short-lived token stamped with who initiated the impersonation
    const accessToken = signAccessToken({
      userId: targetUser._id.toString(),
      tenantId: targetUser.tenantId?.toString() ?? null,
      role: targetUser.role as import('../types/index').UserRole,
      impersonatedBy: req.user!.userId,
    });

    logAudit({
      req,
      action: 'tenant.impersonated',
      targetType: 'User',
      targetId: targetUser._id.toString(),
      targetName: `${targetUser.firstName} ${targetUser.lastName}`,
      details: {
        tenantName: tenant.name,
        targetRole: targetUser.role,
        targetEmail: targetUser.email,
      },
    });

    res.json({
      accessToken,
      user: {
        id: targetUser._id.toString(),
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        role: targetUser.role,
        tenantId: targetUser.tenantId?.toString() ?? null,
        language: targetUser.language ?? 'de',
      },
      tenantName: tenant.name,
    });
  })
);

// GET /api/superadmin/mrr — MRR/ARR aggregation for the billing dashboard
router.get(
  '/mrr',
  asyncHandler(async (_req, res) => {
    const activeTenants = await Tenant.find({ status: 'active' })
      .select('plan name loginCode createdAt')
      .lean();

    const trialTenants = await Tenant.find({ status: 'trial' })
      .select('plan name loginCode trialEndsAt')
      .lean();

    const byPlan: Record<string, number> = { starter: 0, growth: 0, pro: 0, enterprise: 0 };
    let totalMrr = 0;

    for (const t of activeTenants) {
      const plan = (t.plan ?? 'starter') as keyof typeof PLAN_PRICES;
      const price = PLAN_PRICES[plan] ?? 0;
      byPlan[plan] = (byPlan[plan] ?? 0) + 1;
      totalMrr += price;
    }

    res.json({
      totalMrr,
      totalArr: totalMrr * 12,
      activeCount: activeTenants.length,
      trialCount: trialTenants.length,
      byPlan,
      planPrices: PLAN_PRICES,
    });
  })
);

export default router;
