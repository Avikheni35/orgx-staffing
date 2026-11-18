import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../utils/AppError';

// ── Module mocks (hoisted before imports of the module under test) ────────────
vi.mock('../models/User');
vi.mock('../models/Tenant');
vi.mock('../utils/password');
vi.mock('../utils/crypto');
vi.mock('../utils/token');
vi.mock('../utils/email', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined), passwordResetHtml: vi.fn(), magicLinkHtml: vi.fn(), inviteHtml: vi.fn(), otpHtml: vi.fn() }));
vi.mock('../utils/sms',   () => ({ sendSms: vi.fn().mockResolvedValue(undefined) }));

import { User }   from '../models/User';
import { Tenant } from '../models/Tenant';
import { verifyPassword }  from '../utils/password';
import { hashToken }       from '../utils/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/token';
import {
  loginWithPassword,
  refreshTokens,
  revokeRefreshToken,
} from '../services/auth.service';

// ── Typed mock helpers ────────────────────────────────────────────────────────
const mockUser   = vi.mocked(User);
const mockTenant = vi.mocked(Tenant);
const mockVerifyPassword  = vi.mocked(verifyPassword);
const mockHashToken       = vi.mocked(hashToken);
const mockSignAccessToken = vi.mocked(signAccessToken);
const mockSignRefreshToken = vi.mocked(signRefreshToken);
const mockVerifyRefreshToken = vi.mocked(verifyRefreshToken);

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id:                  { toString: () => 'user-id-123' },
    email:                'test@demo.de',
    firstName:            'Max',
    lastName:             'Mustermann',
    role:                 'agency_admin',
    tenantId:             { toString: () => 'tenant-id-456' },
    language:             'de',
    status:               'active',
    passwordHash:         'hashed-pw',
    failedLoginAttempts:  0,
    lockedUntil:          undefined,
    refreshTokenHashes:   [] as string[],
    emailOtpHash:         undefined,
    emailOtpExpires:      undefined,
    lastLoginAt:          undefined,
    save:                 vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── loginWithPassword ─────────────────────────────────────────────────────────
describe('loginWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignAccessToken.mockReturnValue('access-token');
    mockSignRefreshToken.mockReturnValue('refresh-token');
    mockHashToken.mockReturnValue('hashed-refresh-token');
  });

  it('returns tokens and user data for valid credentials', async () => {
    const user = makeUserDoc();
    mockUser.findOne = vi.fn().mockResolvedValue(user);
    mockUser.findById = vi.fn().mockResolvedValue(null);
    mockTenant.findById = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ securitySettings: { require2FA: false } }) }),
    });
    mockVerifyPassword.mockResolvedValue(true);

    const result = await loginWithPassword('test@demo.de', 'correctPw', 'tenant-id-456');

    expect(result).toMatchObject({
      accessToken:  'access-token',
      refreshToken: 'refresh-token',
      user: {
        id:        'user-id-123',
        email:     'test@demo.de',
        firstName: 'Max',
        lastName:  'Mustermann',
        role:      'agency_admin',
      },
    });
    expect(user.save).toHaveBeenCalled();
    expect(user.refreshTokenHashes).toContain('hashed-refresh-token');
  });

  it('throws 401 when user is not found', async () => {
    mockUser.findOne = vi.fn().mockResolvedValue(null);

    await expect(loginWithPassword('nobody@demo.de', 'pw', null))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 423 when account is locked', async () => {
    const user = makeUserDoc({ lockedUntil: new Date(Date.now() + 60_000) });
    mockUser.findOne = vi.fn().mockResolvedValue(user);

    await expect(loginWithPassword('test@demo.de', 'pw', null))
      .rejects.toMatchObject({ statusCode: 423 });
  });

  it('throws 403 when account is not active', async () => {
    const user = makeUserDoc({ status: 'inactive' });
    mockUser.findOne = vi.fn().mockResolvedValue(user);

    await expect(loginWithPassword('test@demo.de', 'pw', null))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 when user has no passwordHash', async () => {
    const user = makeUserDoc({ passwordHash: undefined });
    mockUser.findOne = vi.fn().mockResolvedValue(user);

    await expect(loginWithPassword('test@demo.de', 'pw', null))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 401 and increments failedLoginAttempts on wrong password', async () => {
    const user = makeUserDoc({ failedLoginAttempts: 0 });
    mockUser.findOne = vi.fn().mockResolvedValue(user);
    mockVerifyPassword.mockResolvedValue(false);

    await expect(loginWithPassword('test@demo.de', 'wrongPw', null))
      .rejects.toMatchObject({ statusCode: 401 });

    expect(user.failedLoginAttempts).toBe(1);
    expect(user.save).toHaveBeenCalled();
  });

  it('locks account after MAX_FAILED_LOGINS consecutive failures', async () => {
    // env.MAX_FAILED_LOGINS defaults to 5
    const user = makeUserDoc({ failedLoginAttempts: 4 });
    mockUser.findOne = vi.fn().mockResolvedValue(user);
    mockVerifyPassword.mockResolvedValue(false);

    await expect(loginWithPassword('test@demo.de', 'wrongPw', null))
      .rejects.toMatchObject({ statusCode: 401 });

    expect(user.lockedUntil).toBeDefined();
    expect(user.failedLoginAttempts).toBe(0);
  });

  it('returns { requiresOtp: true } when tenant has 2FA enabled for staff roles', async () => {
    const user = makeUserDoc({ role: 'agency_admin' });
    mockUser.findOne = vi.fn().mockResolvedValue(user);
    mockTenant.findById = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ securitySettings: { require2FA: true } }) }),
    });
    mockVerifyPassword.mockResolvedValue(true);

    const result = await loginWithPassword('test@demo.de', 'correctPw', 'tenant-id-456');

    expect(result).toEqual({ requiresOtp: true });
    expect(user.emailOtpHash).toBeDefined();
    expect(user.save).toHaveBeenCalled();
  });

  it('does NOT require OTP for worker role even when tenant has 2FA enabled', async () => {
    const user = makeUserDoc({ role: 'worker' });
    mockUser.findOne = vi.fn().mockResolvedValue(user);
    mockTenant.findById = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ securitySettings: { require2FA: true } }) }),
    });
    mockVerifyPassword.mockResolvedValue(true);

    const result = await loginWithPassword('test@demo.de', 'correctPw', 'tenant-id-456') as { accessToken: string };

    expect(result).toHaveProperty('accessToken');
  });
});

// ── refreshTokens ─────────────────────────────────────────────────────────────
describe('refreshTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignAccessToken.mockReturnValue('new-access-token');
    mockSignRefreshToken.mockReturnValue('new-refresh-token');
  });

  it('returns new token pair and rotates the refresh token', async () => {
    const existingHash = 'old-hash';
    const user = makeUserDoc({ refreshTokenHashes: [existingHash] });

    mockVerifyRefreshToken.mockReturnValue({ userId: 'user-id-123', tokenFamily: 'fam-1' });
    mockUser.findById = vi.fn().mockResolvedValue(user);
    mockHashToken
      .mockReturnValueOnce(existingHash)   // hash of incoming token → found in array
      .mockReturnValueOnce('new-hash');    // hash of newly issued token

    const result = await refreshTokens('old-refresh-token');

    expect(result).toEqual({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
    // Old hash removed, new hash added
    expect(user.refreshTokenHashes).not.toContain(existingHash);
    expect(user.refreshTokenHashes).toContain('new-hash');
    expect(user.save).toHaveBeenCalled();
  });

  it('throws 401 when the JWT is invalid or expired', async () => {
    mockVerifyRefreshToken.mockImplementation(() => { throw new Error('jwt expired'); });

    await expect(refreshTokens('expired-token'))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('revokes all sessions and throws 401 on token reuse', async () => {
    const user = makeUserDoc({ refreshTokenHashes: ['some-other-hash'] });

    mockVerifyRefreshToken.mockReturnValue({ userId: 'user-id-123', tokenFamily: 'fam-1' });
    mockUser.findById = vi.fn().mockResolvedValue(user);
    mockHashToken.mockReturnValue('hash-not-in-array'); // hash doesn't match any stored token

    await expect(refreshTokens('stolen-token'))
      .rejects.toMatchObject({ statusCode: 401, message: expect.stringContaining('reuse') });

    expect(user.refreshTokenHashes).toHaveLength(0);
    expect(user.save).toHaveBeenCalled();
  });

  it('throws 401 when user no longer exists', async () => {
    mockVerifyRefreshToken.mockReturnValue({ userId: 'ghost-id', tokenFamily: 'fam-1' });
    mockUser.findById = vi.fn().mockResolvedValue(null);

    await expect(refreshTokens('valid-jwt-but-user-gone'))
      .rejects.toMatchObject({ statusCode: 401 });
  });
});

// ── revokeRefreshToken ────────────────────────────────────────────────────────
describe('revokeRefreshToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes the matching hash from user.refreshTokenHashes', async () => {
    const targetHash = 'hash-to-remove';
    const user = makeUserDoc({ refreshTokenHashes: ['other-hash', targetHash] });

    mockUser.findById = vi.fn().mockResolvedValue(user);
    mockHashToken.mockReturnValue(targetHash);

    await revokeRefreshToken('user-id-123', 'the-refresh-token');

    expect(user.refreshTokenHashes).toEqual(['other-hash']);
    expect(user.save).toHaveBeenCalled();
  });

  it('is a silent no-op when user does not exist', async () => {
    mockUser.findById = vi.fn().mockResolvedValue(null);

    await expect(revokeRefreshToken('ghost-id', 'any-token'))
      .resolves.toBeUndefined();
  });
});
