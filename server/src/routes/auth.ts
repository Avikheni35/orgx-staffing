import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import * as authService from '../services/auth.service';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { Worker } from '../models/Worker';
import { encryptField } from '../utils/crypto';

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

// POST /api/auth/login
router.post(
  '/login',
  validate(
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
    })
  ),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const tenantId = req.tenantId ?? null;

    const result = await authService.loginWithPassword(email, password, tenantId);
    if ('requiresOtp' in result) {
      res.json({ requiresOtp: true });
      return;
    }
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTS);
    res.json({ accessToken: result.accessToken, user: result.user });
  })
);

// POST /api/auth/verify-otp
router.post(
  '/verify-otp',
  validate(z.object({ email: z.string().email(), otp: z.string().length(6) })),
  asyncHandler(async (req, res) => {
    const { email, otp } = req.body as { email: string; otp: string };
    const result = await authService.verifyEmailOtp(email, otp, req.tenantId ?? null);
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTS);
    res.json({ accessToken: result.accessToken, user: result.user });
  })
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (!refreshToken) {
      res.status(401).json({ message: 'No refresh token' });
      return;
    }
    const tokens = await authService.refreshTokens(refreshToken);
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTS);
    res.json({ accessToken: tokens.accessToken });
  })
);

// POST /api/auth/logout
router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (refreshToken && req.user) {
      await authService.revokeRefreshToken(req.user.userId, refreshToken);
    }
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ message: 'Logged out' });
  })
);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  validate(z.object({ email: z.string().email() })),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId ?? null;
    await authService.requestPasswordReset(req.body.email, tenantId);
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  })
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  validate(z.object({ token: z.string().min(1), password: z.string().min(8).max(100) })),
  asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ message: 'Password reset successfully.' });
  })
);

// POST /api/auth/magic-link  — send link
router.post(
  '/magic-link',
  validate(z.object({ email: z.string().email() })),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId ?? null;
    await authService.sendMagicLink(req.body.email, tenantId);
    res.json({ message: 'If that email exists, a magic link has been sent.' });
  })
);

// POST /api/auth/magic-login  — consume link token
router.post(
  '/magic-login',
  validate(z.object({ token: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const result = await authService.loginWithMagicLink(req.body.token);
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTS);
    res.json({ accessToken: result.accessToken, user: result.user });
  })
);

// POST /api/auth/accept-invite
router.post(
  '/accept-invite',
  validate(
    z.object({
      token: z.string().min(1),
      password: z.string().min(8).max(100),
      firstName: z.string().min(1).max(50),
      lastName: z.string().min(1).max(50),
    })
  ),
  asyncHandler(async (req, res) => {
    const result = await authService.acceptInvite(
      req.body.token,
      req.body.password,
      req.body.firstName,
      req.body.lastName
    );
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTS);
    res.json({ accessToken: result.accessToken, user: result.user });
  })
);

// GET /api/auth/register-info/:loginCode — public, validates agency registration link
router.get(
  '/register-info/:loginCode',
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findOne({ loginCode: req.params.loginCode })
      .select('name loginCode status')
      .lean();
    if (!tenant || tenant.status === 'suspended') {
      throw new AppError('Registrierung nicht verfügbar', 404);
    }
    res.json({ tenantName: tenant.name, loginCode: tenant.loginCode });
  })
);

const registerSchema = z.object({
  loginCode: z.string().min(2),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'diverse', 'not_specified']).optional(),
  nationality: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().default('DE'),
    })
    .optional(),
  steuerklasse: z.string().optional(),
  steuernummer: z.string().optional(),
  sozialversicherungsnummer: z.string().optional(),
  healthInsuranceProvider: z.string().optional(),
  iban: z.string().optional(),
  skills: z.array(z.string()).default([]),
  languages: z
    .array(z.object({ language: z.string(), level: z.enum(['basic', 'conversational', 'fluent', 'native']) }))
    .default([]),
  dsgvoConsent: z.literal(true),
});

// POST /api/auth/register — public, creates worker + user in pending_review state
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const {
      loginCode, firstName, lastName, email, phone, dateOfBirth, gender, nationality, address,
      steuerklasse, steuernummer, sozialversicherungsnummer, healthInsuranceProvider, iban,
      skills, languages,
    } = req.body as z.infer<typeof registerSchema>;

    const tenant = await Tenant.findOne({ loginCode }).lean();
    if (!tenant || tenant.status === 'suspended') {
      throw new AppError('Ungültiger Registrierungslink', 404);
    }

    const existingUser = await User.findOne({ email: email.toLowerCase(), tenantId: tenant._id });
    if (existingUser) {
      throw new AppError('Diese E-Mail-Adresse ist bereits registriert.', 409);
    }

    const worker = await Worker.create({
      tenantId: tenant._id,
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender,
      nationality,
      address: address ?? { country: 'DE' },
      steuerklasse,
      steuernummerEncrypted: steuernummer ? encryptField(steuernummer) : undefined,
      sozialversicherungsnummerEncrypted: sozialversicherungsnummer ? encryptField(sozialversicherungsnummer) : undefined,
      healthInsuranceProvider,
      ibanEncrypted: iban ? encryptField(iban) : undefined,
      skills: skills ?? [],
      languages: languages ?? [],
      status: 'pending_review',
      registrationSource: 'self_registration',
      dsgvoConsentAt: new Date(),
      dsgvoConsentIp: req.ip,
    });

    const user = await User.create({
      tenantId: tenant._id,
      role: 'worker',
      email: email.toLowerCase(),
      firstName,
      lastName,
      emailVerified: false,
      status: 'active',
    });

    worker.userId = user._id;
    await worker.save();

    res.status(201).json({ success: true, workerName: `${firstName} ${lastName}` });
  })
);

// GET /api/auth/me
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

export default router;
