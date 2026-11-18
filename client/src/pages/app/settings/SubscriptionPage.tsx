import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import apiClient from '../../../api/client';

interface SubscriptionData {
  plan: 'starter' | 'growth' | 'pro' | 'enterprise';
  status: 'trial' | 'active' | 'suspended';
  trialEndsAt?: string;
  planLimits: { maxWorkers: number; maxDisponents: number };
  usage: { workers: number; disponents: number };
}

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const STATUS_COLOR: Record<string, 'warning' | 'success' | 'error'> = {
  trial: 'warning',
  active: 'success',
  suspended: 'error',
};

const STATUS_LABEL: Record<string, string> = {
  trial: 'Testphase',
  active: 'Aktiv',
  suspended: 'Gesperrt',
};

interface PlanFeature {
  label: string;
  starter: boolean | string;
  growth: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

const FEATURES: PlanFeature[] = [
  { label: 'Mitarbeiter',          starter: '25',        growth: '100',       pro: '500',         enterprise: 'Unbegrenzt' },
  { label: 'Disponenten',          starter: '2',         growth: '10',        pro: '50',          enterprise: 'Unbegrenzt' },
  { label: 'Kundenbetriebe',       starter: '10',        growth: '50',        pro: '250',         enterprise: 'Unbegrenzt' },
  { label: 'Schichtplanung',       starter: true,        growth: true,        pro: true,          enterprise: true },
  { label: 'Zeiterfassung',        starter: true,        growth: true,        pro: true,          enterprise: true },
  { label: 'Rechnungsstellung',    starter: true,        growth: true,        pro: true,          enterprise: true },
  { label: 'Kundenportal',         starter: false,       growth: true,        pro: true,          enterprise: true },
  { label: 'AÜG-Compliance',       starter: false,       growth: true,        pro: true,          enterprise: true },
  { label: 'Dokument-Report',      starter: false,       growth: true,        pro: true,          enterprise: true },
  { label: 'DATEV-Export',         starter: false,       growth: false,       pro: true,          enterprise: true },
  { label: 'API-Zugang',           starter: false,       growth: false,       pro: false,         enterprise: true },
  { label: 'SLA / Support',        starter: 'E-Mail',    growth: 'E-Mail',    pro: 'Priority',    enterprise: 'Dediziert' },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircleIcon color="success" fontSize="small" />;
  if (value === false) return <RemoveCircleOutlineIcon color="disabled" fontSize="small" />;
  return <Typography variant="body2" fontWeight={500}>{value}</Typography>;
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min((used / max) * 100, 100);
  const color = pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'primary';

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" mb={0.5}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {used} / {max}
        </Typography>
      </Stack>
      <Tooltip title={`${Math.round(pct)}% belegt`}>
        <LinearProgress
          variant="determinate"
          value={pct}
          color={color}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Tooltip>
      {pct >= 90 && (
        <Typography variant="caption" color="error.main" mt={0.5} display="block">
          Limit fast erreicht — bitte upgraden
        </Typography>
      )}
    </Box>
  );
}

export default function SubscriptionPage() {
  const { data, isLoading, error } = useQuery<SubscriptionData>({
    queryKey: ['subscription'],
    queryFn: () => apiClient.get('/settings/subscription').then((r) => r.data),
  });

  if (isLoading) return <CircularProgress />;
  if (error || !data) return <Alert severity="error">Fehler beim Laden.</Alert>;

  const trialDaysLeft = data.trialEndsAt
    ? Math.ceil((new Date(data.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const currentPlan = data.plan;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Abonnement</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Ihr aktueller Plan und Verbrauch
      </Typography>

      {/* Trial banner */}
      {data.status === 'trial' && trialDaysLeft !== null && (
        <Alert
          severity={trialDaysLeft <= 7 ? 'error' : 'warning'}
          sx={{ mb: 3 }}
        >
          {trialDaysLeft > 0
            ? `Ihre Testphase läuft noch ${trialDaysLeft} Tag${trialDaysLeft === 1 ? '' : 'e'} — bis ${new Date(data.trialEndsAt!).toLocaleDateString('de-DE')}.`
            : 'Ihre Testphase ist abgelaufen. Bitte wählen Sie einen Plan, um die Plattform weiter zu nutzen.'}
          {' '}Kontaktieren Sie uns unter support@platform.de für ein Upgrade.
        </Alert>
      )}

      {data.status === 'suspended' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Ihr Konto ist gesperrt. Bitte wenden Sie sich an support@platform.de.
        </Alert>
      )}

      {/* Current plan card */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="overline" color="text.secondary">Aktueller Plan</Typography>
                  <Typography variant="h4" fontWeight={800}>
                    {PLAN_LABEL[currentPlan]}
                  </Typography>
                </Box>
                <Chip
                  label={STATUS_LABEL[data.status]}
                  color={STATUS_COLOR[data.status]}
                  size="small"
                />
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={2}>
                <UsageBar
                  label="Mitarbeiter"
                  used={data.usage.workers}
                  max={data.planLimits.maxWorkers}
                />
                <UsageBar
                  label="Disponenten"
                  used={data.usage.disponents}
                  max={data.planLimits.maxDisponents}
                />
              </Stack>

              <Typography variant="caption" color="text.secondary" display="block" mt={2}>
                Für Änderungen oder ein Upgrade wenden Sie sich an support@platform.de
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Plan comparison */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%', overflow: 'auto' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 2, pb: 1 }}>
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                  PLANVERGLEICH
                </Typography>
              </Box>
              <Box sx={{ overflowX: 'auto' }}>
                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                  <Box component="thead">
                    <Box component="tr">
                      <Box component="th" sx={{ p: 1.5, textAlign: 'left', width: '40%' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          FUNKTION
                        </Typography>
                      </Box>
                      {(['starter', 'growth', 'pro', 'enterprise'] as const).map((plan) => (
                        <Box
                          component="th"
                          key={plan}
                          sx={{
                            p: 1.5,
                            textAlign: 'center',
                            bgcolor: plan === currentPlan ? 'primary.50' : 'inherit',
                            borderBottom: plan === currentPlan ? '2px solid' : '1px solid',
                            borderColor: plan === currentPlan ? 'primary.main' : 'divider',
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={plan === currentPlan ? 700 : 400}
                            color={plan === currentPlan ? 'primary.main' : 'text.secondary'}
                          >
                            {PLAN_LABEL[plan]}
                            {plan === currentPlan && ' ✓'}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {FEATURES.map((f, i) => (
                      <Box
                        component="tr"
                        key={f.label}
                        sx={{ bgcolor: i % 2 === 0 ? 'action.hover' : 'inherit' }}
                      >
                        <Box component="td" sx={{ p: 1.5 }}>
                          <Typography variant="body2">{f.label}</Typography>
                        </Box>
                        {(['starter', 'growth', 'pro', 'enterprise'] as const).map((plan) => (
                          <Box
                            component="td"
                            key={plan}
                            sx={{
                              p: 1.5,
                              textAlign: 'center',
                              bgcolor: plan === currentPlan ? 'primary.50' : 'inherit',
                            }}
                          >
                            <FeatureValue value={f[plan]} />
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
