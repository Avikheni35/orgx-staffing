import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import apiClient from '../../api/client';

interface DashboardData {
  tenants: { total: number; trial: number; active: number; suspended: number };
  platform: { totalWorkers: number; staffUsers: number };
  trialsExpiringSoon: Array<{
    _id: string; name: string; loginCode: string; plan: string; trialEndsAt: string;
  }>;
  recentTenants: Array<{
    _id: string; name: string; loginCode: string; status: string; plan: string; createdAt: string;
  }>;
}

const STATUS_COLOR: Record<string, 'default' | 'success' | 'error' | 'warning'> = {
  trial: 'warning',
  active: 'success',
  suspended: 'error',
};

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

function StatCard({
  label, value, sub, icon, onClick, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  color?: string;
}) {
  const inner = (
    <CardContent>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Box sx={{ color: color ?? 'primary.main', mt: 0.5 }}>{icon}</Box>
        <Box>
          <Typography variant="h4" fontWeight={700} lineHeight={1}>{value}</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>{label}</Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </Box>
      </Stack>
    </CardContent>
  );

  return (
    <Card>
      {onClick ? <CardActionArea onClick={onClick}>{inner}</CardActionArea> : inner}
    </Card>
  );
}

function daysLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['superadmin-dashboard'],
    queryFn: () => apiClient.get('/superadmin/dashboard').then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <CircularProgress />;
  if (error || !data) return <Alert severity="error">Fehler beim Laden.</Alert>;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Plattform-Übersicht</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Betriebskennzahlen — keine Einsicht in agenturspezifische Geschäftsdaten
      </Typography>

      {/* Trial expiry alerts */}
      {data.trialsExpiringSoon.length > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 3 }}
        >
          <Typography variant="body2" fontWeight={600} gutterBottom>
            {data.trialsExpiringSoon.length} Trial-Agentur{data.trialsExpiringSoon.length > 1 ? 'en laufen' : ' läuft'} in Kürze ab
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} mt={0.5}>
            {data.trialsExpiringSoon.map((t) => (
              <Chip
                key={t._id}
                label={`${t.name} · noch ${daysLeft(t.trialEndsAt)} Tage`}
                size="small"
                color="warning"
                variant="outlined"
                onClick={() => navigate(`/superadmin/tenants/${t._id}`)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Stack>
        </Alert>
      )}

      {/* Tenant stats */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
        Agenturen
      </Typography>
      <Grid container spacing={2} mb={3} mt={0}>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Gesamt"
            value={data.tenants.total}
            icon={<BusinessIcon />}
            onClick={() => navigate('/superadmin/tenants')}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Aktiv"
            value={data.tenants.active}
            icon={<BusinessIcon />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Trial"
            value={data.tenants.trial}
            icon={<BusinessIcon />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Gesperrt"
            value={data.tenants.suspended}
            icon={<BusinessIcon />}
            color={data.tenants.suspended > 0 ? 'error.main' : 'text.disabled'}
          />
        </Grid>
      </Grid>

      {/* Platform-wide user counts — aggregate only */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
        Nutzer (plattformweit, aggregiert)
      </Typography>
      <Alert severity="info" sx={{ mb: 1.5 }} variant="outlined">
        Nur Gesamtzahlen — keine agenturspezifischen Nutzerdaten sichtbar
      </Alert>
      <Grid container spacing={2} mb={4}>
        <Grid item xs={6} sm={4}>
          <StatCard
            label="Registrierte Mitarbeiter"
            value={data.platform.totalWorkers}
            sub="Alle Agenturen zusammen"
            icon={<PeopleIcon />}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard
            label="Admins & Disponenten"
            value={data.platform.staffUsers}
            sub="Alle Agenturen zusammen"
            icon={<ManageAccountsIcon />}
            color="text.secondary"
          />
        </Grid>
      </Grid>

      {/* Recently onboarded tenants */}
      {data.recentTenants.length > 0 && (
        <Card>
          <CardContent sx={{ pb: '8px !important' }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
              ZULETZT ONGEBOARDETE AGENTUREN
            </Typography>
          </CardContent>
          <Divider />
          {data.recentTenants.map((t, i) => (
            <Box key={t._id}>
              <Box
                sx={{ px: 2, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => navigate(`/superadmin/tenants/${t._id}`)}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={500}>{t.name}</Typography>
                      <Typography variant="caption" color="text.secondary">· {t.loginCode}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Erstellt: {new Date(t.createdAt).toLocaleDateString('de-DE')}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Chip label={PLAN_LABEL[t.plan] ?? t.plan} size="small" variant="outlined" />
                    <Chip
                      label={t.status}
                      size="small"
                      color={STATUS_COLOR[t.status] ?? 'default'}
                    />
                  </Stack>
                </Stack>
              </Box>
              {i < data.recentTenants.length - 1 && <Divider />}
            </Box>
          ))}
        </Card>
      )}
    </Box>
  );
}
