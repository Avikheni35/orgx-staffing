import crypto from 'crypto';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function compareTokenHash(token: string, hash: string): boolean {
  return hashToken(token) === hash;
}

// AES-256-GCM field encryption for DSGVO-sensitive Worker fields
// (IBAN, Steuernummer, SV-Nummer) and Tenant IBAN.
// Stored format: enc:<12-byte iv hex>:<16-byte authTag hex>:<ciphertext hex>
// Plaintext values (legacy / dev) are returned unchanged by decryptField.

function getFieldKey(): Buffer {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FIELD_ENCRYPTION_KEY must be a 64-character hex string in production');
    }
    return Buffer.alloc(32, 0); // dev-only zero key
  }
  return Buffer.from(hex, 'hex');
}

export function encryptField(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith('enc:')) return plaintext; // already encrypted
  const key = getFieldKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptField(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  if (!ciphertext.startsWith('enc:')) return ciphertext; // plaintext legacy value
  const parts = ciphertext.split(':');
  if (parts.length !== 4) return ciphertext;
  const [, ivHex, authTagHex, encHex] = parts;
  const key = getFieldKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
}
