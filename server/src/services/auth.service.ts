import crypto from 'crypto';
import { User } from '../models/User';
import { Tenant } from '../models/Tenant';
import { hashPassword, verifyPassword } from '../utils/password';
import { hashToken, compareTokenHash } from '../utils/crypto';
import {
  signAccessToken,
  signRefreshToken,
  signSpecialToken,
  verifyRefreshToken,
  verifySpecialToken,
} from '../utils/token';
import { sendEmail, passwordResetHtml, magicLinkHtml, inviteHtml, otpHtml } from '../utils/email';
import { sendSms } from '../utils/sms';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import type { UserRole } from '../types';

// Roles that are subject to 2FA when the tenant has it enabled
const OTP_ROLES: UserRole[] = ['agency_admin', 'disponent'];

export type LoginPasswordResult = AuthResult | { requiresOtp: true };

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId: string | null;
    language: 'de' | 'en';
  };
}

function buildAuthResult(user: InstanceType<typeof User>, accessToken: string, refreshToken: string): AuthResult {
  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId?.toString() ?? null,
      language: user.language,
    },
  };
}

async function issueTokens(user: InstanceType<typeof User>): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({
    userId: user._id.toString(),
    tenantId: user.tenantId?.toString() ?? null,
    role: user.role,
  });

  const refreshToken = signRefreshToken({
    userId: user._id.toString(),
    tokenFamily: crypto.randomUUID(),
  });

  const hash = hashToken(refreshToken);
  user.refreshTokenHashes.push(hash);
  if (user.refreshTokenHashes.length > 5) {
    user.refreshTokenHashes = user.refreshTokenHashes.slice(-5);
  }

  return { accessToken, refreshToken };
}

export async function loginWithPassword(
  email: string,
  password: string,
  tenantId: string | null
): Promise<LoginPasswordResult> {
  const query = tenantId
    ? { email: email.toLowerCase(), tenantId }
    : { email: email.toLowerCase() };

  const user = await User.findOne(query);

  if (!user) throw new AppError('Invalid email or password', 401);

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new AppError(`Account locked. Try again in ${mins} minutes.`, 423);
  }

  if (user.status !== 'active') throw new AppError('Account is not active', 403);
  if (!user.passwordHash) throw new AppError('Password login not available for this account', 400);

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= env.MAX_FAILED_LOGINS) {
      user.lockedUntil = new Date(Date.now() + env.ACCOUNT_LOCK_MINUTES * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    throw new AppError('Invalid email or password', 401);
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;

  // Check if this tenant requires 2FA for staff roles
  const needs2FA =
    OTP_ROLES.includes(user.role) &&
    user.tenantId != null &&
    (await Tenant.findById(user.tenantId).select('securitySettings').lean())
      ?.securitySettings?.require2FA !== false;

  if (needs2FA) {
    const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    user.emailOtpHash = hashToken(otp);
    user.emailOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    if (!env.SMTP_HOST) {
      console.log('\n─────────────────────────────────────────');
      console.log(`[EMAIL DEV] To:      ${user.email}`);
      console.log(`[EMAIL DEV] Subject: OTP`);
      console.log(`[EMAIL DEV] OTP:     ${otp}`);
      console.log('─────────────────────────────────────────\n');
    } else {
      await sendEmail({
        to: user.email,
        subject: user.language === 'de' ? 'Ihr Anmeldecode' : 'Your login code',
        html: otpHtml(otp, user.language),
      });
    }

    return { requiresOtp: true };
  }

  user.lastLoginAt = new Date();
  const tokens = await issueTokens(user);
  await user.save();

  return buildAuthResult(user, tokens.accessToken, tokens.refreshToken);
}

export async function verifyEmailOtp(
  email: string,
  otp: string,
  tenantId: string | null
): Promise<AuthResult> {
  const query = tenantId
    ? { email: email.toLowerCase(), tenantId }
    : { email: email.toLowerCase() };

  const user = await User.findOne(query);

  if (
    !user ||
    !user.emailOtpHash ||
    !user.emailOtpExpires ||
    user.emailOtpExpires < new Date() ||
    user.emailOtpHash !== hashToken(otp)
  ) {
    throw new AppError('Invalid or expired code', 401);
  }

  user.emailOtpHash = undefined;
  user.emailOtpExpires = undefined;
  user.lastLoginAt = new Date();

  const tokens = await issueTokens(user);
  await user.save();

  return buildAuthResult(user, tokens.accessToken, tokens.refreshToken);
}

export async function refreshTokens(
  incomingRefreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  let payload: { userId: string; tokenFamily: string };
  try {
    payload = verifyRefreshToken(incomingRefreshToken);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await User.findById(payload.userId);
  if (!user) throw new AppError('User not found', 401);

  const incomingHash = hashToken(incomingRefreshToken);
  const idx = user.refreshTokenHashes.indexOf(incomingHash);

  if (idx === -1) {
    // Possible token reuse — revoke all sessions
    user.refreshTokenHashes = [];
    await user.save();
    throw new AppError('Token reuse detected — all sessions revoked', 401);
  }

  user.refreshTokenHashes.splice(idx, 1);

  const tokens = await issueTokens(user);
  await user.save();

  return tokens;
}

export async function revokeRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  const hash = hashToken(refreshToken);
  user.refreshTokenHashes = user.refreshTokenHashes.filter((h) => h !== hash);
  await user.save();
}

export async function requestPasswordReset(email: string, tenantId: string | null): Promise<void> {
  const query = tenantId
    ? { email: email.toLowerCase(), tenantId }
    : { email: email.toLowerCase() };

  const user = await User.findOne(query);
  if (!user) return; // silent to prevent email enumeration

  const token = signSpecialToken(user._id.toString(), 'reset');
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  const url = `${env.CLIENT_URL}/reset-password/${token}`;
  await sendEmail({
    to: user.email,
    subject: user.language === 'de' ? 'Passwort zurücksetzen' : 'Reset your password',
    html: passwordResetHtml(url, user.language),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  let payload: { userId: string; type: string };
  try {
    payload = verifySpecialToken(token);
  } catch {
    throw new AppError('Invalid or expired reset link', 400);
  }
  if (payload.type !== 'reset') throw new AppError('Invalid token type', 400);

  const user = await User.findById(payload.userId);
  const tokenHash = hashToken(token);

  if (
    !user ||
    user.passwordResetTokenHash !== tokenHash ||
    !user.passwordResetExpires ||
    user.passwordResetExpires < new Date()
  ) {
    throw new AppError('Invalid or expired reset link', 400);
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.refreshTokenHashes = [];
  await user.save();
}

export async function sendMagicLink(email: string, tenantId: string | null): Promise<void> {
  const query = tenantId
    ? { email: email.toLowerCase(), tenantId }
    : { email: email.toLowerCase() };

  const user = await User.findOne(query);
  if (!user) return;

  const token = signSpecialToken(user._id.toString(), 'magic');
  user.magicLinkTokenHash = hashToken(token);
  user.magicLinkExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  // Embed the tenant's loginCode so the client knows which agency portal to scope to
  let url = `${env.CLIENT_URL}/magic-login/${token}`;
  if (tenantId) {
    const tenant = await Tenant.findById(tenantId).select('loginCode').lean();
    if (tenant) url += `?tenant=${tenant.loginCode}`;
  }

  await sendEmail({
    to: user.email,
    subject: user.language === 'de' ? 'Ihr Anmelde-Link' : 'Your login link',
    html: magicLinkHtml(url, user.language),
  });

  if (user.phone) {
    sendSms(user.phone, `Ihr Login-Link: ${url}`).catch(console.error);
  }
}

export async function loginWithMagicLink(token: string): Promise<AuthResult> {
  let payload: { userId: string; type: string };
  try {
    payload = verifySpecialToken(token);
  } catch {
    throw new AppError('Invalid or expired magic link', 401);
  }
  if (payload.type !== 'magic') throw new AppError('Invalid token', 401);

  const user = await User.findById(payload.userId);
  const tokenHash = hashToken(token);

  if (
    !user ||
    user.magicLinkTokenHash !== tokenHash ||
    !user.magicLinkExpires ||
    user.magicLinkExpires < new Date()
  ) {
    throw new AppError('Invalid or expired magic link', 401);
  }

  user.magicLinkTokenHash = undefined;
  user.magicLinkExpires = undefined;
  user.emailVerified = true;
  user.lastLoginAt = new Date();

  const tokens = await issueTokens(user);
  await user.save();

  return buildAuthResult(user, tokens.accessToken, tokens.refreshToken);
}

export async function acceptInvite(
  token: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<AuthResult> {
  let payload: { userId: string; type: string };
  try {
    payload = verifySpecialToken(token);
  } catch {
    throw new AppError('Invalid or expired invitation', 400);
  }
  if (payload.type !== 'invite') throw new AppError('Invalid token', 400);

  const user = await User.findById(payload.userId);
  const tokenHash = hashToken(token);

  if (
    !user ||
    user.inviteTokenHash !== tokenHash ||
    !user.inviteExpires ||
    user.inviteExpires < new Date()
  ) {
    throw new AppError('Invalid or expired invitation', 400);
  }

  user.passwordHash = await hashPassword(password);
  user.firstName = firstName;
  user.lastName = lastName;
  user.inviteTokenHash = undefined;
  user.inviteExpires = undefined;
  user.emailVerified = true;
  user.status = 'active';
  user.lastLoginAt = new Date();

  const tokens = await issueTokens(user);
  await user.save();

  return buildAuthResult(user, tokens.accessToken, tokens.refreshToken);
}

export async function inviteUser(
  email: string,
  role: UserRole,
  tenantId: string,
  invitedByName: string
): Promise<void> {
  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) throw new AppError('Tenant not found', 404);

  const existing = await User.findOne({ email: email.toLowerCase(), tenantId });
  if (existing) throw new AppError('User with this email already exists', 409);

  const token = signSpecialToken(
    // We create a placeholder user first so we have an ID
    'placeholder',
    'invite'
  );

  const user = await User.create({
    tenantId,
    role,
    email: email.toLowerCase(),
    firstName: '',
    lastName: '',
    status: 'inactive',
    inviteTokenHash: hashToken(token),
    inviteExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // Re-issue token with correct userId
  const realToken = signSpecialToken(user._id.toString(), 'invite');
  user.inviteTokenHash = hashToken(realToken);
  await user.save();

  const url = `${env.CLIENT_URL}/invite/${realToken}`;
  await sendEmail({
    to: email,
    subject:
      user.language === 'de'
        ? `Einladung zu ${tenant.name}`
        : `Invitation to ${tenant.name}`,
    html: inviteHtml(url, tenant.name, user.language),
  });
}
