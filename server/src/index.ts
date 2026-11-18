import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { connectDB } from './config/db';
import { env } from './config/env';
import apiRoutes from './routes';
import billingRoutes, { webhookRouter } from './routes/billing';
import { AppError } from './utils/AppError';
import { initSentry, captureException } from './utils/sentry';
import { startOutboxRetry } from './jobs/outboxRetry';
import { startPaymentReminderCron } from './jobs/paymentReminderCron';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'documents');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

app.use(helmet({
  hsts: env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  },
}));
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// Credential endpoints always rate-limited regardless of environment
const credentialLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many requests' });
app.use('/api/auth/login', credentialLimiter);
app.use('/api/auth/magic-link', credentialLimiter);
app.use('/api/auth/forgot-password', credentialLimiter);

if (env.NODE_ENV === 'production') {
  app.use(
    '/api',
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
}

// Stripe webhook needs raw body — register before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }), webhookRouter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/api', apiRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const isAppError = err instanceof AppError;
  const status = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : 'Internal server error';

  if (!isAppError) {
    console.error(err);
    captureException(err);
  }

  res.status(status).json({
    message,
    ...(env.NODE_ENV === 'development' && err instanceof Error ? { stack: err.stack } : {}),
  });
});

initSentry().then(() => connectDB())
  .then(() => {
    startOutboxRetry();
    startPaymentReminderCron();
    const server = app.listen(env.PORT, () => {
      console.log(`[M1] Server on :${env.PORT} [${env.NODE_ENV}]`);
    });

    const shutdown = (signal: string) => {
      console.log(`[M1] ${signal} received — shutting down gracefully`);
      server.close(() => {
        mongoose.disconnect().then(() => process.exit(0));
      });
      setTimeout(() => { console.error('[M1] Forced exit after timeout'); process.exit(1); }, 10_000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('[M1] Failed to start:', err);
    process.exit(1);
  });
