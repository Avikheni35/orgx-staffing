import Stripe from 'stripe';
import { env } from '../config/env';
import { Tenant, ITenant } from '../models/Tenant';
import { AppError } from '../utils/AppError';

if (env.NODE_ENV === 'production' && !env.STRIPE_SECRET_KEY) {
  console.error('[M1] FATAL: STRIPE_SECRET_KEY must be set in production');
  process.exit(1);
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-07-29.dahlia',
});

export type BillingPlan = 'starter' | 'growth' | 'pro' | 'enterprise';

const PLAN_PRICE_MAP: Record<BillingPlan, string> = {
  starter:    env.STRIPE_PRICE_STARTER_MONTHLY,
  growth:     env.STRIPE_PRICE_GROWTH_MONTHLY,
  pro:        env.STRIPE_PRICE_PRO_MONTHLY,
  enterprise: env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
};

// Monthly prices shown on the billing page (€)
export const PLAN_PRICES: Record<BillingPlan, number> = {
  starter:    69,
  growth:     149,
  pro:        299,
  enterprise: 599,
};

async function getOrCreateCustomer(tenant: ITenant): Promise<string> {
  if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

  const customer = await stripe.customers.create({
    name: tenant.name,
    metadata: { tenantId: tenant._id.toString(), subdomain: tenant.subdomain },
  });

  await Tenant.findByIdAndUpdate(tenant._id, { stripeCustomerId: customer.id });
  return customer.id;
}

export async function createCheckoutSession(
  tenant: ITenant,
  plan: BillingPlan,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const priceId = PLAN_PRICE_MAP[plan];
  const customerId = await getOrCreateCustomer(tenant);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { tenantId: tenant._id.toString(), plan },
    },
    allow_promotion_codes: true,
  });

  return session.url!;
}

export async function createBillingPortalSession(
  tenant: ITenant,
  returnUrl: string
): Promise<string> {
  const customerId = await getOrCreateCustomer(tenant);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

export async function changePlan(tenantId: string, newPlan: BillingPlan): Promise<void> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new AppError('Tenant not found', 404);
  if (!tenant.stripeSubscriptionId) throw new AppError('No active subscription', 400);

  const priceId = PLAN_PRICE_MAP[newPlan];
  const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
  const itemId = subscription.items.data[0].id;

  await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'always_invoice',
    metadata: { plan: newPlan },
  });

  tenant.plan = newPlan;
  await tenant.save();
}

export async function cancelSubscription(tenantId: string): Promise<void> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new AppError('Tenant not found', 404);
  if (!tenant.stripeSubscriptionId) throw new AppError('No active subscription', 400);

  await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  tenant.cancelAtPeriodEnd = true;
  await tenant.save();
}

export async function reactivateSubscription(tenantId: string): Promise<void> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new AppError('Tenant not found', 404);
  if (!tenant.stripeSubscriptionId) throw new AppError('No active subscription', 400);

  await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  tenant.cancelAtPeriodEnd = false;
  await tenant.save();
}

export function constructWebhookEvent(payload: Buffer, sig: string): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, sig, env.STRIPE_WEBHOOK_SECRET);
}

export async function syncSubscriptionToTenant(sub: Stripe.Subscription): Promise<void> {
  const tenantId = sub.metadata?.tenantId;
  if (!tenantId) return;

  const plan = (sub.metadata?.plan ?? 'starter') as BillingPlan;
  const status = sub.status;
  // billing_cycle_anchor is the closest equivalent to current_period_end in Stripe v22
  const periodEnd = sub.cancel_at
    ? new Date(sub.cancel_at * 1000)
    : new Date(sub.billing_cycle_anchor * 1000);
  const cancelAtEnd = sub.cancel_at_period_end;

  const tenantStatus: ITenant['status'] =
    status === 'active' || status === 'trialing' ? 'active'
    : status === 'canceled' ? 'suspended'
    : 'trial';

  await Tenant.findByIdAndUpdate(tenantId, {
    stripeSubscriptionId: sub.id,
    stripeSubscriptionStatus: status,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: cancelAtEnd,
    plan,
    status: tenantStatus,
  });
}
