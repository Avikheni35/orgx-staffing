import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Stack,
  Tab,
  Tabs,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArticleIcon from '@mui/icons-material/Article';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GavelIcon from '@mui/icons-material/Gavel';
import BusinessIcon from '@mui/icons-material/Business';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { workersApi } from '../../api/workers';
import { businessesApi } from '../../api/businesses';
import { shiftsApi, Shift, ShiftStatus } from '../../api/shifts';

const SHIFT_STATUS_COLOR: Record<ShiftStatus, 'default' | 'info' | 'success' | 'error'> = {
  draft: 'default',
  published: 'info',
  completed: 'success',
  cancelled: 'error',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function ShiftRow({ shift, onClick }: { shift: Shift; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardActionArea onClick={onClick}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <Typography variant="body2" fontWeight={700}>{fmtDate(shift.startTime)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}
                </Typography>
              </Stack>
              <Typography variant="body2">{shift.title} · {shift.businessName}</Typography>
              {shift.locationName && (
                <Typography variant="caption" color="text.secondary">{shift.locationName}</Typography>
              )}
            </Box>
            <Stack alignItems="flex-end" flexShrink={0} ml={1} spacing={0.5}>
              <Chip
                label={t(`shifts.statusLabel.${shift.status}`)}
                color={SHIFT_STATUS_COLOR[shift.status]}
                size="small"
              />
              <Typography variant="caption" color="text.secondary">
                {shift.assignedWorkers.length}/{shift.requiredWorkers} {t('shifts.workers')}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function UpcomingShiftsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['shifts', 'dashboard-upcoming'],
    queryFn: () => shiftsApi.list({ from: new Date().toISOString(), limit: 20 }),
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>;
  if (error) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const upcoming = (data?.shifts ?? []).filter(
    (s) => s.status === 'draft' || s.status === 'published'
  );

  if (!upcoming.length) return <Alert severity="info">{t('dashboard.noUpcomingShifts')}</Alert>;

  return (
    <Box>
      {upcoming.map((shift) => (
        <ShiftRow key={shift._id} shift={shift} onClick={() => navigate(`/app/shifts/${shift._id}`)} />
      ))}
      <Button
        size="small"
        endIcon={<ArrowForwardIcon />}
        onClick={() => navigate('/app/shifts')}
        sx={{ mt: 1 }}
      >
        {t('dashboard.allShifts')}
      </Button>
    </Box>
  );
}

function CompletedShiftsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['shifts', 'dashboard-completed'],
    queryFn: () => shiftsApi.list({ status: 'completed', limit: 50 }),
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>;
  if (error) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const completed = [...(data?.shifts ?? [])].reverse();
  if (!completed.length) return <Alert severity="info">{t('dashboard.noCompletedShifts')}</Alert>;

  const grouped: Record<string, Shift[]> = {};
  for (const shift of completed) {
    const key = new Date(shift.startTime).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(shift);
  }

  return (
    <Box>
      {Object.entries(grouped).map(([month, shifts]) => (
        <Box key={month} mb={2}>
          <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1}>
            {month}
          </Typography>
          {shifts.map((shift) => (
            <ShiftRow key={shift._id} shift={shift} onClick={() => navigate(`/app/shifts/${shift._id}`)} />
          ))}
        </Box>
      ))}
      <Button
        size="small"
        endIcon={<ArrowForwardIcon />}
        onClick={() => navigate('/app/shifts')}
        sx={{ mt: 1 }}
      >
        {t('dashboard.allShifts')}
      </Button>
    </Box>
  );
}

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  color?: string;
  loading?: boolean;
  onClick?: () => void;
  highlight?: boolean;
}

function StatCard({ label, value, icon, color = 'primary.main', loading, onClick, highlight }: StatCardProps) {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        border: highlight ? '1px solid' : '1px solid transparent',
        borderColor: highlight ? 'warning.main' : 'transparent',
        '&:hover': onClick ? { boxShadow: 4 } : {},
        transition: 'box-shadow 0.2s',
      }}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: `${color}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {label}
            </Typography>
            {loading ? (
              <CircularProgress size={20} />
            ) : (
              <Typography variant="h4" fontWeight={700}>
                {value ?? 0}
              </Typography>
            )}
          </Box>
          {onClick && <ArrowForwardIcon fontSize="small" color="action" />}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [shiftTab, setShiftTab] = useState<'upcoming' | 'completed'>('upcoming');

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['worker-stats'],
    queryFn: () => workersApi.stats(),
    refetchInterval: 30_000,
  });

  const { data: businessData, isLoading: loadingBusinesses } = useQuery({
    queryKey: ['businesses', { limit: 1 }],
    queryFn: () => businessesApi.list({ limit: 1 }),
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('de-DE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            {t('dashboard.greeting', { name: user?.firstName ?? '' })}
          </Typography>
          <Typography variant="body2" color="text.secondary">{dateStr}</Typography>
        </Box>
        <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => navigate('/app/workers/new')}>
          {t('workers.addWorker')}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{t('common.loadError')}</Alert>}

      {/* Stats grid */}
      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label={t('dashboard.totalWorkers')} value={stats?.total} icon={<PeopleIcon />} color="primary.main" loading={isLoading} onClick={() => navigate('/app/workers')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label={t('dashboard.activeWorkers')} value={stats?.active} icon={<PeopleIcon />} color="success.main" loading={isLoading} onClick={() => navigate('/app/workers?status=active')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label={t('dashboard.pendingReview')} value={stats?.pendingReview} icon={<HourglassEmptyIcon />} color="info.main" loading={isLoading} onClick={() => navigate('/app/workers?status=pending_review')} highlight={(stats?.pendingReview ?? 0) > 0} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label={t('dashboard.auegWarnings')} value={stats?.auegWarnings} icon={<WarningAmberIcon />} color="warning.main" loading={isLoading} onClick={() => navigate('/app/compliance/aueg')} highlight={(stats?.auegWarnings ?? 0) > 0} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label={t('dashboard.pendingTimesheets')} value={stats?.pendingTimesheets} icon={<AccessTimeIcon />} color="error.main" loading={isLoading} onClick={() => navigate('/app/timesheets')} highlight={(stats?.pendingTimesheets ?? 0) > 0} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label={t('dashboard.pendingContracts')} value={stats?.pendingContracts} icon={<GavelIcon />} color="warning.main" loading={isLoading} onClick={() => navigate('/app/contracts')} highlight={(stats?.pendingContracts ?? 0) > 0} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label={t('dashboard.clientBusinesses')} value={businessData?.total} icon={<BusinessIcon />} color="secondary.main" loading={loadingBusinesses} onClick={() => navigate('/app/businesses')} />
        </Grid>
      </Grid>

      {/* Shift tabs + Action cards */}
      <Grid container spacing={2}>
        {/* Upcoming / Completed shifts */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Tabs value={shiftTab} onChange={(_, v) => setShiftTab(v)} sx={{ mb: 2 }}>
                <Tab label={t('dashboard.upcomingShifts')} value="upcoming" />
                <Tab label={t('dashboard.completedShifts')} value="completed" />
              </Tabs>
              {shiftTab === 'upcoming' && <UpcomingShiftsTab />}
              {shiftTab === 'completed' && <CompletedShiftsTab />}
            </CardContent>
          </Card>
        </Grid>

        {/* Side panel */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            {/* Expiring documents */}
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {t('dashboard.expiringDocuments')}
                  </Typography>
                  {(stats?.expiringDocs ?? 0) > 0 && (
                    <Chip label={stats?.expiringDocs} color="warning" size="small" />
                  )}
                </Stack>
                <Divider sx={{ mb: 2 }} />
                {isLoading ? (
                  <CircularProgress size={20} />
                ) : (stats?.expiringDocs ?? 0) === 0 ? (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <ArticleIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="text.secondary">
                      {t('dashboard.noExpiringDocs')}
                    </Typography>
                  </Stack>
                ) : (
                  <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/app/workers?expiringDocs=true')}>
                    {t('dashboard.viewExpiringDocs', { count: stats?.expiringDocs })}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} mb={2}>
                  {t('dashboard.quickActions')}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1}>
                  <Button variant="outlined" startIcon={<PersonAddIcon />} fullWidth onClick={() => navigate('/app/workers/new')} sx={{ justifyContent: 'flex-start' }}>
                    {t('workers.addWorker')}
                  </Button>
                  <Button variant="outlined" startIcon={<PeopleIcon />} fullWidth onClick={() => navigate('/app/workers?status=pending_review')} sx={{ justifyContent: 'flex-start' }}>
                    {t('dashboard.reviewPending')}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
