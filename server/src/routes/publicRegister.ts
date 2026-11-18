import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { hashPassword } from '../utils/password';
import { hashToken } from '../utils/crypto';
import { signAccessToken, signRefreshToken } from '../utils/token';
import { sendEmail } from '../utils/email';
import { env } from '../config/env';

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

const registerSchema = z.object({
  agencyName: z.string().min(2).max(100).trim(),
  firstName:  z.string().min(1).max(50).trim(),
  lastName:   z.string().min(1).max(50).trim(),
  email:      z.string().email().toLowerCase().trim(),
  password:   z.string().min(8).max(100),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function uniqueCode(base: string): Promise<string> {
  let candidate = base;
  let i = 1;
  while (await Tenant.exists({ $or: [{ subdomain: candidate }, { loginCode: candidate }] })) {
    candidate = `${base}-${i++}`;
  }
  return candidate;
}

// POST /api/public/register — public agency self-signup (no auth required)
router.post(
  '/',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { agencyName, firstName, lastName, email, password } =
      req.body as z.infer<typeof registerSchema>;

    const existingUser = await User.findOne({ email, role: 'agency_admin' }).lean();
    if (existingUser) throw new AppError('Diese E-Mail-Adresse ist bereits registriert.', 409);

    const code       = await uniqueCode(slugify(agencyName));
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const tenant = await Tenant.create({
      name: agencyName,
      subdomain: code,
      loginCode: code,
      status: 'trial',
      plan: 'starter',
      trialEndsAt,
      planLimits: { maxWorkers: 25, maxDisponents: 2 },
      complianceSettings: {
        auegWarnMonths: 9,
        auegBlockMonths: 18,
        minRestHoursBetweenShifts: 11,
      },
    });

    const passwordHash = await hashPassword(password);
    const user = new User({
      tenantId: new Types.ObjectId(tenant._id),
      email,
      firstName,
      lastName,
      role: 'agency_admin',
      status: 'active',
      passwordHash,
      language: 'de',
    });

    // Issue tokens — same pattern as auth.service.ts issueTokens
    const accessToken  = signAccessToken({ userId: user._id.toString(), tenantId: tenant._id.toString(), role: 'agency_admin' });
    const refreshToken = signRefreshToken({ userId: user._id.toString(), tokenFamily: crypto.randomUUID() });
    user.refreshTokenHashes = [hashToken(refreshToken)];
    user.lastLoginAt = new Date();
    await user.save();

    // Welcome email (fire-and-forget)
    sendEmail({
      to: email,
      subject: `Willkommen bei OrgX — Ihre 14-tägige Testphase hat begonnen`,
      html: `
        <h2>Willkommen, ${firstName}!</h2>
        <p>Ihr OrgX-Konto für <strong>${agencyName}</strong> wurde erfolgreich erstellt.</p>
        <p>Sie haben jetzt <strong>14 Tage kostenlos</strong> vollen Zugriff auf alle Starter-Funktionen.</p>
        <p><strong>Login-Code:</strong> ${code}</p>
        <p><a href="${env.CLIENT_URL}/login">Jetzt anmelden →</a></p>
        <hr/>
        <p style="color:#888;font-size:12px;">
          Testphase endet am ${trialEndsAt.toLocaleDateString('de-DE')}.
          Kein automatischer Kauf — wir kontaktieren Sie vorher.
        </p>
      `,
    }).catch(() => {});

    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.status(201).json({
      accessToken,
      user: {
        id:        user._id.toString(),
        email:     user.email,
        firstName: user.firstName,
        lastName:  user.lastName,
        role:      'agency_admin' as const,
        tenantId:  tenant._id.toString(),
        language:  'de' as const,
      },
      tenantCode: code,
    });
  })
);

export default router;
