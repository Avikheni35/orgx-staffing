import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { User } from '../models/User';
import { Tenant } from '../models/Tenant';
import { inviteUser } from '../services/auth.service';
import { logAudit } from '../utils/audit';

const router = Router();
router.use(requireAuth);
router.use(requireRole('agency_admin'));

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['agency_admin', 'disponent']),
});

const statusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended']),
});

// GET /api/staff
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const staff = await User.find({
      tenantId,
      role: { $in: ['agency_admin', 'disponent'] },
    })
      .select('-passwordHash -refreshTokenHashes -inviteTokenHash -emailOtpHash -passwordResetTokenHash -magicLinkTokenHash')
      .sort({ createdAt: 1 })
      .lean();
    res.json(staff);
  })
);

// POST /api/staff — invite a new staff member
router.post(
  '/',
  validate(inviteSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const { email, role } = req.body as { email: string; role: 'agency_admin' | 'disponent' };

    const tenant = await Tenant.findById(tenantId).select('planLimits').lean();
    const staffCount = await User.countDocuments({ tenantId, role: { $in: ['agency_admin', 'disponent'] } });
    const maxDisponents = (tenant as { planLimits?: { maxDisponents?: number } } | null)?.planLimits?.maxDisponents ?? 9999;
    if (staffCount >= maxDisponents)
      throw new AppError(`Ihr Plan erlaubt maximal ${maxDisponents} Disponenten. Bitte upgraden Sie Ihren Plan.`, 403);

    const inviter = await User.findById(req.user!.userId).lean();
    const invitedByName = inviter
      ? `${inviter.firstName} ${inviter.lastName}`.trim() || 'Administrator'
      : 'Administrator';

    await inviteUser(email, role, tenantId, invitedByName);

    const created = await User.findOne({ email: email.toLowerCase(), tenantId })
      .select('-passwordHash -refreshTokenHashes -inviteTokenHash -emailOtpHash -passwordResetTokenHash -magicLinkTokenHash')
      .lean();

    logAudit({
      req,
      action: 'staff.invited',
      targetType: 'User',
      targetId: created?._id.toString(),
      targetName: email,
      details: { role, invitedBy: invitedByName },
    });
    res.status(201).json(created);
  })
);

// POST /api/staff/:id/resend-invite
router.post(
  '/:id/resend-invite',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const member = await User.findOne({ _id: req.params.id, tenantId });
    if (!member) throw new AppError('Staff member not found', 404);
    if (member.status === 'active' && member.emailVerified) {
      throw new AppError('User has already accepted the invitation', 400);
    }

    const inviter = await User.findById(req.user!.userId).lean();
    const invitedByName = inviter
      ? `${inviter.firstName} ${inviter.lastName}`.trim() || 'Administrator'
      : 'Administrator';

    // Re-use inviteUser — it throws 409 if email exists, so delete first then re-invite
    // Instead, regenerate the token directly
    const { signSpecialToken } = await import('../utils/token');
    const { hashToken } = await import('../utils/crypto');
    const { sendEmail, inviteHtml } = await import('../utils/email');
    const { Tenant } = await import('../models/Tenant');
    const { env } = await import('../config/env');

    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) throw new AppError('Tenant not found', 404);

    const token = signSpecialToken(member._id.toString(), 'invite');
    member.inviteTokenHash = hashToken(token);
    member.inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await member.save();

    const url = `${env.CLIENT_URL}/invite/${token}`;
    sendEmail({
      to: member.email,
      subject: `Einladung zu ${tenant.name}`,
      html: inviteHtml(url, tenant.name, member.language ?? 'de'),
    }).catch(() => {});

    res.json({ message: 'Invite resent', invitedByName });
  })
);

// PATCH /api/staff/:id/status
router.patch(
  '/:id/status',
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const member = await User.findOne({ _id: req.params.id, tenantId });
    if (!member) throw new AppError('Staff member not found', 404);
    if (member._id.toString() === req.user!.userId) {
      throw new AppError('You cannot change your own status', 400);
    }
    const prevStatus = member.status;
    member.status = req.body.status;
    await member.save();
    logAudit({
      req,
      action: 'staff.status_changed',
      targetType: 'User',
      targetId: member._id.toString(),
      targetName: `${member.firstName} ${member.lastName}`,
      details: { from: prevStatus, to: req.body.status },
    });
    res.json(member);
  })
);

// DELETE /api/staff/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const member = await User.findOne({ _id: req.params.id, tenantId });
    if (!member) throw new AppError('Staff member not found', 404);
    if (member._id.toString() === req.user!.userId) {
      throw new AppError('You cannot delete your own account', 400);
    }
    logAudit({
      req,
      action: 'staff.removed',
      targetType: 'User',
      targetId: member._id.toString(),
      targetName: `${member.firstName} ${member.lastName}`,
      details: { email: member.email, role: member.role },
    });
    await member.deleteOne();
    res.json({ message: 'Staff member removed' });
  })
);

export default router;
