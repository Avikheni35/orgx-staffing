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
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import apiClient from '../../api/client';

interface MonitorData {
  server: {
    uptime: number;
    nodeVersion: string;
    memoryMb: { rss: number; heapUsed: number; heapTotal: number };
  };
  database: {
    status: string;
    totalTenants: number;
    activeTenants: number;
    totalWorkers: number;
    totalUsers: number;
  };
  activity: {
    auditEventsLast24h: number;
  };
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="overline" color="text.secondary">{title}</Typography>
        <Divider sx={{ my: 1 }} />
        {children}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" py={0.5}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}{unit && <Typography component="span" variant="caption" color="text.secondary" ml={0.5}>{unit}</Typography>}
      </Typography>
    </Stack>
  );
}

export default function SuperAdminMonitorPage() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery<MonitorData>({
    queryKey: ['superadmin-monitor'],
    queryFn: () => apiClient.get('/superadmin/monitor').then((r) => r.data),
    refetchInterval: 30000,
  });

  const lastRefreshed = dataUpdatedAt
    ? new Intl.DateTimeFormat('de-DE', { timeStyle: 'medium' }).format(new Date(dataUpdatedAt))
    : null;

  if (isLoading) return <CircularProgress />;
  if (error || !data) return <Alert severity="error">Monitor nicht erreichbar</Alert>;

  const heapPct = Math.round((data.server.memoryMb.heapUsed / data.server.memoryMb.heapTotal) * 100);
  const dbOk = data.database.status === 'connected';

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>System Monitor</Typography>
          <Typography variant="body2" color="text.secondary">Aktualisiert automatisch alle 30 Sekunden</Typography>
        </Box>
        {lastRefreshed && (
          <Typography variant="caption" color="text.secondary">Letzte Aktualisierung: {lastRefreshed}</Typography>
        )}
      </Stack>

      <Grid container spacing={3}>
        {/* DB status */}
        <Grid item xs={12} md={4}>
          <StatCard title="Datenbankstatus">
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              {dbOk
                ? <CheckCircleIcon color="success" />
                : <ErrorIcon color="error" />}
              <Typography variant="h6" color={dbOk ? 'success.main' : 'error.main'}>
                {dbOk ? 'Verbunden' : 'Getrennt'}
              </Typography>
            </Stack>
            <Metric label="Mandanten gesamt" value={data.database.totalTenants} />
            <Metric label="Aktive Mandanten" value={data.database.activeTenants} />
            <Metric label="Mitarbeiter gesamt" value={data.database.totalWorkers.toLocaleString('de-DE')} />
            <Metric label="Benutzer gesamt" value={data.database.totalUsers.toLocaleString('de-DE')} />
          </StatCard>
        </Grid>

        {/* Server */}
        <Grid item xs={12} md={4}>
          <StatCard title="Server">
            <Metric label="Laufzeit" value={formatUptime(data.server.uptime)} />
            <Metric label="Node.js" value={data.server.nodeVersion} />
            <Metric label="RSS-Speicher" value={data.server.memoryMb.rss} unit="MB" />
            <Box mt={1.5}>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">Heap-Auslastung</Typography>
                <Typography variant="caption" fontWeight={600}>
                  {data.server.memoryMb.heapUsed} / {data.server.memoryMb.heapTotal} MB ({heapPct}%)
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={heapPct}
                color={heapPct > 80 ? 'error' : heapPct > 60 ? 'warning' : 'primary'}
              />
            </Box>
          </StatCard>
        </Grid>

        {/* Activity */}
        <Grid item xs={12} md={4}>
          <StatCard title="Aktivität (letzte 24h)">
            <Stack alignItems="center" justifyContent="center" sx={{ py: 2 }}>
              <Typography variant="h2" fontWeight={700} color="primary.main">
                {data.activity.auditEventsLast24h}
              </Typography>
              <Typography variant="body2" color="text.secondary">Audit-Ereignisse</Typography>
            </Stack>
          </StatCard>
        </Grid>

        {/* Integrations placeholder */}
        <Grid item xs={12}>
          <StatCard title="Integrationen">
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} mt={0.5}>
              {[
                { label: 'E-Mail (SMTP)', ok: true },
                { label: 'SMS (Twilio)', ok: false },
                { label: 'Push (FCM)', ok: false },
                { label: 'Datei-Storage (S3)', ok: false },
                { label: 'PDF (Puppeteer)', ok: false },
                { label: 'Stripe', ok: false },
              ].map(({ label, ok }) => (
                <Chip
                  key={label}
                  label={label}
                  size="small"
                  color={ok ? 'success' : 'default'}
                  icon={ok ? <CheckCircleIcon /> : undefined}
                  variant={ok ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Nicht konfigurierte Integrationen sind noch nicht angebunden (Phase 2).
            </Typography>
          </StatCard>
        </Grid>
      </Grid>
    </Box>
  );
}
