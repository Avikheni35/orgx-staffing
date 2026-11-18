import dotenv from 'dotenv';
dotenv.config();

function opt(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function validateProductionEnv() {
  // Run for any environment that isn't explicitly development or test
  const env = process.env.NODE_ENV ?? 'development';
  if (env === 'development' || env === 'test') return;
  const errors: string[] = [];
  if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.includes('dev-')) errors.push('JWT_ACCESS_SECRET must be set to a strong secret');
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.includes('dev-')) errors.push('JWT_REFRESH_SECRET must be set to a strong secret');
  if (!process.env.FIELD_ENCRYPTION_KEY || process.env.FIELD_ENCRYPTION_KEY.length !== 64) errors.push('FIELD_ENCRYPTION_KEY must be a 64-char hex string');
  if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('localhost')) errors.push('MONGODB_URI must point to a production MongoDB instance');
  if (errors.length) {
    console.error('[M1] FATAL: Missing required production environment variables:');
    errors.forEach(e => console.error('  •', e));
    process.exit(1);
  }
}
validateProductionEnv();

export const env = {
  NODE_ENV: opt('NODE_ENV', 'development'),
  PORT: parseInt(opt('PORT', '5000')),
  APP_NAME: opt('APP_NAME', 'OrgX'),
  MONGODB_URI: opt('MONGODB_URI', 'mongodb://localhost:27017/orgx'),

  JWT_ACCESS_SECRET: opt('JWT_ACCESS_SECRET', 'dev-access-secret-change-in-production'),
  JWT_REFRESH_SECRET: opt('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production'),
  JWT_ACCESS_EXPIRES: opt('JWT_ACCESS_EXPIRES', '15m'),
  JWT_REFRESH_EXPIRES: opt('JWT_REFRESH_EXPIRES', '7d'),
  JWT_MAGIC_EXPIRES: opt('JWT_MAGIC_EXPIRES', '1h'),
  JWT_RESET_EXPIRES: opt('JWT_RESET_EXPIRES', '30m'),
  JWT_INVITE_EXPIRES: opt('JWT_INVITE_EXPIRES', '7d'),

  CLIENT_URL: opt('CLIENT_URL', 'http://localhost:3000'),

  SMTP_HOST: opt('SMTP_HOST', ''),
  SMTP_PORT: parseInt(opt('SMTP_PORT', '587')),
  SMTP_USER: opt('SMTP_USER', ''),
  SMTP_PASS: opt('SMTP_PASS', ''),
  EMAIL_FROM: opt('EMAIL_FROM', 'noreply@platform.de'),

  STRIPE_SECRET_KEY: opt('STRIPE_SECRET_KEY', ''),
  STRIPE_WEBHOOK_SECRET: opt('STRIPE_WEBHOOK_SECRET', ''),
  STRIPE_PRICE_STARTER_MONTHLY: opt('STRIPE_PRICE_STARTER_MONTHLY', ''),
  STRIPE_PRICE_GROWTH_MONTHLY: opt('STRIPE_PRICE_GROWTH_MONTHLY', ''),
  STRIPE_PRICE_PRO_MONTHLY: opt('STRIPE_PRICE_PRO_MONTHLY', ''),
  STRIPE_PRICE_ENTERPRISE_MONTHLY: opt('STRIPE_PRICE_ENTERPRISE_MONTHLY', ''),

  FIELD_ENCRYPTION_KEY: opt('FIELD_ENCRYPTION_KEY', ''),

  TWILIO_ACCOUNT_SID: opt('TWILIO_ACCOUNT_SID', ''),
  TWILIO_AUTH_TOKEN: opt('TWILIO_AUTH_TOKEN', ''),
  TWILIO_FROM_NUMBER: opt('TWILIO_FROM_NUMBER', ''),

  BCRYPT_ROUNDS: parseInt(opt('BCRYPT_ROUNDS', '12')),
  MAX_FAILED_LOGINS: parseInt(opt('MAX_FAILED_LOGINS', '5')),
  ACCOUNT_LOCK_MINUTES: parseInt(opt('ACCOUNT_LOCK_MINUTES', '30')),
  RATE_LIMIT_WINDOW_MS: parseInt(opt('RATE_LIMIT_WINDOW_MS', '900000')),
  RATE_LIMIT_MAX: parseInt(opt('RATE_LIMIT_MAX', '100')),

  SENTRY_DSN: opt('SENTRY_DSN', ''),

  PUSH_VAPID_PUBLIC_KEY:  opt('PUSH_VAPID_PUBLIC_KEY', ''),
  PUSH_VAPID_PRIVATE_KEY: opt('PUSH_VAPID_PRIVATE_KEY', ''),
  PUSH_VAPID_SUBJECT:     opt('PUSH_VAPID_SUBJECT', 'mailto:admin@orgx.de'),
};
