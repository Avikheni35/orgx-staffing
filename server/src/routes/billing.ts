import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { Tenant } from '../models/Tenant';
import { env } from '../config/env';
import {
  createCheckoutSession,
  createBillingPortalSession,
  changePlan,
  cancelSubscription,
  reactivateSubscription,
  constructWebhookEvent,
  syncSubscriptionToTenant,
  PLAN_PRICES,
  BillingPlan,
} from '../services/stripe.service';
import { logAudit } from '../utils/audit';
import { notify } from '../utils/notify';
import Stripe from 'stripe';

const router = Router();

// ── Webhook (no auth — raw body required, registered before express.json()) ──
// This route is mounted directly on the app in index.ts before body parsing.
export const webhookRouter = Router();
webhookRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) throw new AppError('Missing stripe-signature header', 400);

    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(req.body as Buffer, sig);
    } catch {
      throw new AppError('Webhook signature verification failed', 400);
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await syncSubscriptionToTenant(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscriptionToTenant(sub);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const tenant = await Tenant.findOneAndUpdate(
            { stripeCustomerId: customerId },
            { stripeSubscriptionStatus: 'past_due' },
            { new: true }
          );
          if (tenant) {
            notify({
              tenantId: tenant._id.toString(),
              type: 'billing',
              title: 'Zahlungsfehler',
              body: 'Die Zahlung für Ihr Abonnement ist fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode.',
              link: '/app/settings/billing',
              recipientRoles: ['agency_admin'],
            }).catch(console.error);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          await Tenant.findOneAndUpdate(
            { stripeCustomerId: customerId },
            { stripeSubscriptionStatus: 'active', status: 'active' }
          );
        }
        break;
      }
    }

    res.json({ received: true });
  })
);

// ── Authenticated billing routes ────────────────────────────────────────────
router.use(requireAuth);

// GET /api/billing/status
router.get(
  '/status',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.user!.tenantId)
      .select('plan status stripeSubscriptionId stripeSubscriptionStatus currentPeriodEnd cancelAtPeriodEnd trialEndsAt planLimits')
      .lean();
    if (!tenant) throw new AppError('Tenant not found', 404);
    res.json({
      plan: tenant.plan,
      status: tenant.status,
      stripeSubscriptionStatus: tenant.stripeSubscriptionStatus,
      currentPeriodEnd: tenant.currentPeriodEnd,
      cancelAtPeriodEnd: tenant.cancelAtPeriodEnd ?? false,
      trialEndsAt: tenant.trialEndsAt,
      planLimits: tenant.planLimits,
      prices: PLAN_PRICES,
    });
  })
);

// POST /api/billing/checkout  — start Stripe Checkout for a plan
const checkoutSchema = z.object({
  plan: z.enum(['starter', 'growth', 'pro', 'enterprise']),
});
router.post(
  '/checkout',
  requireRole('agency_admin'),
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.user!.tenantId);
    if (!tenant) throw new AppError('Tenant not found', 404);

    const { plan } = req.body as { plan: BillingPlan };
    const baseUrl = env.CLIENT_URL;
    const url = await createCheckoutSession(
      tenant,
      plan,
      `${baseUrl}/app/settings/billing?checkout=success`,
      `${baseUrl}/app/settings/billing?checkout=cancel`
    );

    res.json({ url });
  })
);

// POST /api/billing/portal  — Stripe billing portal (manage payment method, invoices)
router.post(
  '/portal',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.user!.tenantId);
    if (!tenant) throw new AppError('Tenant not found', 404);

    const returnUrl = `${env.CLIENT_URL}/app/settings/billing`;
    const url = await createBillingPortalSession(tenant, returnUrl);
    res.json({ url });
  })
);

// POST /api/billing/change-plan
const changePlanSchema = z.object({
  plan: z.enum(['starter', 'growth', 'pro', 'enterprise']),
});
router.post(
  '/change-plan',
  requireRole('agency_admin'),
  validate(changePlanSchema),
  asyncHandler(async (req, res) => {
    const { plan } = req.body as { plan: BillingPlan };
    await changePlan(req.user!.tenantId!.toString(), plan);

    logAudit({
      req,
      action: 'billing.plan_changed',
      targetType: 'Tenant',
      targetId: req.user!.tenantId!.toString(),
      targetName: plan,
      details: { newPlan: plan },
    });

    res.json({ message: 'Plan updated' });
  })
);

// POST /api/billing/cancel
router.post(
  '/cancel',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    await cancelSubscription(req.user!.tenantId!.toString());

    logAudit({
      req,
      action: 'billing.subscription_cancelled',
      targetType: 'Tenant',
      targetId: req.user!.tenantId!.toString(),
      targetName: 'subscription',
    });

    res.json({ message: 'Subscription will cancel at period end' });
  })
);

// POST /api/billing/reactivate
router.post(
  '/reactivate',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    await reactivateSubscription(req.user!.tenantId!.toString());

    logAudit({
      req,
      action: 'billing.subscription_reactivated',
      targetType: 'Tenant',
      targetId: req.user!.tenantId!.toString(),
      targetName: 'subscription',
    });

    res.json({ message: 'Subscription reactivated' });
  })
);

export default router;
