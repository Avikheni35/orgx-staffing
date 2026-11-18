import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hashToken, compareTokenHash, encryptField, decryptField } from '../utils/crypto';

// ── hashToken / compareTokenHash ──────────────────────────────────────────────

describe('hashToken', () => {
  it('returns a 64-char hex string', () => {
    expect(hashToken('hello')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(hashToken('token-abc')).toBe(hashToken('token-abc'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});

describe('compareTokenHash', () => {
  it('returns true for the correct token', () => {
    const hash = hashToken('my-secret-token');
    expect(compareTokenHash('my-secret-token', hash)).toBe(true);
  });

  it('returns false for a wrong token', () => {
    const hash = hashToken('correct');
    expect(compareTokenHash('wrong', hash)).toBe(false);
  });
});

// ── AES-256-GCM field encryption ──────────────────────────────────────────────

describe('encryptField / decryptField', () => {
  const TEST_KEY = 'a'.repeat(64); // valid 32-byte hex key

  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.FIELD_ENCRYPTION_KEY;
  });

  it('round-trips a plaintext value', () => {
    const original = 'DE89370400440532013000';
    const encrypted = encryptField(original);
    expect(decryptField(encrypted)).toBe(original);
  });

  it('produces ciphertext starting with "enc:"', () => {
    expect(encryptField('secret')).toMatch(/^enc:/);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const a = encryptField('same-value');
    const b = encryptField('same-value');
    expect(a).not.toBe(b);
    // but both decrypt to the same plaintext
    expect(decryptField(a)).toBe('same-value');
    expect(decryptField(b)).toBe('same-value');
  });

  it('does not double-encrypt an already-encrypted value', () => {
    const once = encryptField('hello');
    const twice = encryptField(once);
    expect(once).toBe(twice);
  });

  it('passes through an empty string unchanged', () => {
    expect(encryptField('')).toBe('');
    expect(decryptField('')).toBe('');
  });

  it('passes through a legacy plaintext value (no "enc:" prefix)', () => {
    expect(decryptField('DE89370400440532013000')).toBe('DE89370400440532013000');
  });

  it('encrypts and decrypts multi-byte UTF-8 correctly', () => {
    const value = 'Müller & Söhne GmbH — Steuernummer';
    expect(decryptField(encryptField(value))).toBe(value);
  });
});
