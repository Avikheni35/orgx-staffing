import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { billingApi, BillingPlan } from '../../../api/billing';
import { workersApi } from '../../../api/workers';

const PLAN_COLOR: Record<string, 'default' | 'info' | 'primary' | 'success'> = {
  starter: 'default', growth: 'info', pro: 'primary', enterprise: 'success',
};
const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  active: 'success', trial: 'warning', suspended: 'error',
};
const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter', growth: 'Growth', pro: 'Pro', enterprise: 'Enterprise',
};
const PLAN_FEATURES: Record<string, string[]> = {
  starter:    ['25 Mitarbeiter', '2 Disponenten', 'Schichtverwaltung', 'Rechnungsstellung', 'Basis-Berichte'],
  growth:     ['100 Mitarbeiter', '10 Disponenten', 'Alle Starter-Features', 'Kundenportal', 'AÜG-Compliance', 'Dokument-Report'],
  pro:        ['500 Mitarbeiter', '50 Disponenten', 'Alle Growth-Features', 'DATEV-Export', 'Priority Support'],
  enterprise: ['Unbegrenzte Mitarbeiter', 'Unbegrenzte Disponenten', 'Alle Pro-Features', 'API-Zugang', 'SLA', 'Dedizierter Support'],
};

const ALL_PLANS: BillingPlan[] = ['starter', 'growth', 'pro', 'enterprise'];

export default function BillingSettingsPage() {
  const qc = useQueryClient();
  const [cancelDialog, setCancelDialog] = useState(false);

  const { data: billing, isLoading, error } = useQuery({
    queryKey: ['billing-status'],
    queryFn: billingApi.getStatus,
  });

  const { data: stats } = useQuery({
    queryKey: ['worker-stats'],
    queryFn: workersApi.stats,
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan: BillingPlan) => billingApi.startCheckout(plan),
    onSuccess: ({ url }) => { window.location.href = url; },
  });

  const portalMutation = useMutation({
    mutationFn: billingApi.openPortal,
    onSuccess: ({ url }) => { window.open(url, '_blank'); },
  });

  const cancelMutation = useMutation({
    mutationFn: billingApi.cancel,
    onSuccess: () => {
      setCancelDialog(false);
      qc.invalidateQueries({ queryKey: ['billing-status'] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: billingApi.reactivate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-status'] }),
  });

  if (isLoading) return <CircularProgress />;
  if (error || !billing) return <Alert severity="error">Fehler beim Laden</Alert>;

  const maxWorkers = billing.planLimits?.maxWorkers ?? 50;
  const workerCount = stats?.total ?? 0;
  const workerPct = Math.min(100, Math.round((workerCount / maxWorkers) * 100));

  const trialFmt = billing.trialEndsAt
    ? new Intl.DateTimeFormat('de-DE').format(new Date(billing.trialEndsAt))
    : null;
  const periodEndFmt = billing.currentPeriodEnd
    ? new Intl.DateTimeFormat('de-DE').format(new Date(billing.currentPeriodEnd))
    : null;
  const isTrialExpired =
    billing.status === 'trial' && billing.trialEndsAt && new Date(billing.trialEndsAt) < new Date();

  const hasStripeSubscription = !!billing.stripeSubscriptionStatus;
  const features = PLAN_FEATURES[billing.plan] ?? PLAN_FEATURES.starter;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Abonnement & Abrechnung</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Ihr aktueller Plan und Nutzungsübersicht
      </Typography>

      {billing.status === 'suspended' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Ihr Konto ist gesperrt. Bitte kontaktieren Sie den Support.
        </Alert>
      )}
      {isTrialExpired && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Ihre Testphase ist abgelaufen. Wählen Sie einen Plan, um fortzufahren.
        </Alert>
      )}
      {billing.cancelAtPeriodEnd && periodEndFmt && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => reactivateMutation.mutate()}
              disabled={reactivateMutation.isPending}
            >
              Reaktivieren
            </Button>
          }
        >
          Abonnement endet am <strong>{periodEndFmt}</strong>. Danach wird Ihr Konto gesperrt.
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start" mb={4}>
        {/* Current Plan Card */}
        <Paper sx={{ p: 3, flex: 1, minWidth: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box>
              <Typography variant="overline" color="text.secondary">Aktueller Plan</Typography>
              <Typography variant="h4" fontWeight={800} mt={0.5}>
                {PLAN_LABEL[billing.plan]}
              </Typography>
              {billing.prices && (
                <Typography variant="body2" color="text.secondary">
                  €{billing.prices[billing.plan]}/Monat
                </Typography>
              )}
            </Box>
            <Stack spacing={0.75} alignItems="flex-end">
              <Chip
                label={PLAN_LABEL[billing.plan]}
                color={PLAN_COLOR[billing.plan] ?? 'default'}
                size="small"
              />
              <Chip
                label={billing.status === 'trial' ? 'Testphase' : billing.status === 'active' ? 'Aktiv' : 'Gesperrt'}
                color={STATUS_COLOR[billing.status] ?? 'default'}
                size="small"
              />
            </Stack>
          </Stack>

          {billing.status === 'trial' && trialFmt && (
            <Alert severity={isTrialExpired ? 'error' : 'warning'} sx={{ mb: 2, py: 0.5 }}>
              Testphase {isTrialExpired ? 'abgelaufen am' : 'endet am'}: <strong>{trialFmt}</strong>
            </Alert>
          )}

          {periodEndFmt && !billing.cancelAtPeriodEnd && (
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Nächste Abrechnung: {periodEndFmt}
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight={700} mb={1}>Enthaltene Leistungen</Typography>
          <Stack spacing={0.75} mb={3}>
            {features.map((f) => (
              <Stack key={f} direction="row" alignItems="center" spacing={1}>
                <CheckCircleIcon fontSize="small" color="success" />
                <Typography variant="body2">{f}</Typography>
              </Stack>
            ))}
          </Stack>

          <Stack spacing={1}>
            {hasStripeSubscription ? (
              <>
                <Button
                  variant="outlined"
                  startIcon={<CreditCardIcon />}
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  fullWidth
                >
                  {portalMutation.isPending ? 'Weiterleitung...' : 'Zahlungsmethode & Rechnungen verwalten'}
                </Button>
                {!billing.cancelAtPeriodEnd && (
                  <Button
                    variant="text"
                    color="error"
                    size="small"
                    onClick={() => setCancelDialog(true)}
                  >
                    Abonnement kündigen
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="contained"
                onClick={() => checkoutMutation.mutate(billing.plan)}
                disabled={checkoutMutation.isPending}
                fullWidth
              >
                {checkoutMutation.isPending ? 'Weiterleitung...' : 'Jetzt abonnieren'}
              </Button>
            )}
          </Stack>
        </Paper>

        {/* Usage Card */}
        <Paper sx={{ p: 3, width: { xs: '100%', md: 280 }, flexShrink: 0 }}>
          <Typography variant="overline" color="text.secondary">Nutzung</Typography>

          <Box mt={2}>
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography variant="body2">Mitarbeiter</Typography>
              <Typography variant="body2" fontWeight={600}>
                {workerCount} / {maxWorkers === 999999 ? '∞' : maxWorkers}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={maxWorkers === 999999 ? 0 : workerPct}
              color={workerPct > 90 ? 'error' : workerPct > 70 ? 'warning' : 'primary'}
              sx={{ mb: 0.5 }}
            />
            {workerPct > 80 && maxWorkers !== 999999 && (
              <Typography variant="caption" color="warning.main">
                Kapazität fast erschöpft
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="caption" color="text.secondary">
            Fragen zur Abrechnung:{' '}
            <Box component="span" fontWeight={600}>support@platform.de</Box>
          </Typography>
        </Paper>
      </Stack>

      {/* Plan upgrade grid */}
      <Typography variant="h6" fontWeight={700} mb={2}>Plan wechseln</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
        {ALL_PLANS.map((plan) => {
          const isCurrent = plan === billing.plan;
          return (
            <Paper
              key={plan}
              variant={isCurrent ? 'elevation' : 'outlined'}
              sx={{
                p: 2.5,
                flex: 1,
                minWidth: 160,
                border: isCurrent ? '2px solid' : undefined,
                borderColor: isCurrent ? 'primary.main' : undefined,
              }}
            >
              <Typography variant="subtitle1" fontWeight={700}>{PLAN_LABEL[plan]}</Typography>
              <Typography variant="h6" fontWeight={800} mb={1}>
                €{billing.prices?.[plan] ?? '—'}<Typography component="span" variant="caption">/Mo</Typography>
              </Typography>
              {isCurrent ? (
                <Chip label="Aktuell" size="small" color="primary" />
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() =>
                    hasStripeSubscription
                      ? checkoutMutation.mutate(plan)
                      : checkoutMutation.mutate(plan)
                  }
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? '...' : 'Wechseln'}
                </Button>
              )}
            </Paper>
          );
        })}
      </Stack>

      {/* Cancel dialog */}
      <Dialog open={cancelDialog} onClose={() => setCancelDialog(false)}>
        <DialogTitle>Abonnement kündigen?</DialogTitle>
        <DialogContent>
          <Typography>
            Ihr Abonnement bleibt bis zum Ende der aktuellen Abrechnungsperiode aktiv.
            Danach wird Ihr Konto gesperrt. Sie können jederzeit reaktivieren.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog(false)}>Abbrechen</Button>
          <Button
            color="error"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? 'Wird gekündigt...' : 'Ja, kündigen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
