import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WorkIcon from '@mui/icons-material/Work';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workerPortalApi, WorkerShift } from '../../api/workerPortal';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function durationH(start: string, end: string, breakMin: number) {
  return ((new Date(end).getTime() - new Date(start).getTime()) / 3_600_000 - breakMin / 60).toFixed(1);
}

function ShiftCard({ shift, onClick }: { shift: WorkerShift; onClick: () => void }) {
  const { t } = useTranslation();
  const isCompleted = shift.myStatus === 'completed';
  const isConfirmed = shift.myStatus === 'confirmed';
  const borderColor = isCompleted ? 'primary.main' : isConfirmed ? 'success.main' : 'warning.main';
  const chipColor: 'primary' | 'success' | 'warning' = isCompleted ? 'primary' : isConfirmed ? 'success' : 'warning';

  return (
    <Card sx={{ borderLeft: 4, borderColor }}>
      <CardActionArea onClick={onClick}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <Typography variant="body1" fontWeight={700}>{fmtDate(shift.startTime)}</Typography>
                <Typography variant="body2">{fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">{shift.title} · {shift.businessName}</Typography>
            </Box>
            <Stack alignItems="flex-end" flexShrink={0} ml={1}>
              <Chip
                label={t(`workerPortal.statusLabel.${shift.myStatus}`)}
                color={chipColor}
                size="small"
              />
              <Typography variant="caption" color="text.secondary" mt={0.5}>
                {durationH(shift.startTime, shift.endTime, shift.breakMinutes)} h
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function UpcomingTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: shifts, isLoading, error } = useQuery({
    queryKey: ['worker-shifts', 'upcoming'],
    queryFn: () => workerPortalApi.getMyShifts('upcoming'),
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>;
  if (error) return <Alert severity="error">{t('common.loadError')}</Alert>;
  if (!shifts?.length) return <Alert severity="info">{t('workerPortal.noUpcoming')}</Alert>;

  return (
    <Stack spacing={1.5}>
      {shifts.map((shift) => (
        <ShiftCard key={shift._id} shift={shift} onClick={() => navigate(`/worker/shifts/${shift._id}`)} />
      ))}
    </Stack>
  );
}

function CompletedTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: shifts, isLoading, error } = useQuery({
    queryKey: ['worker-shifts', 'completed'],
    queryFn: () => workerPortalApi.getMyShifts('completed'),
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>;
  if (error) return <Alert severity="error">{t('common.loadError')}</Alert>;
  if (!shifts?.length) return <Alert severity="info">{t('workerPortal.noCompleted')}</Alert>;

  const grouped: Record<string, WorkerShift[]> = {};
  for (const shift of shifts) {
    const key = new Date(shift.startTime).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(shift);
  }

  return (
    <Box>
      {Object.entries(grouped).map(([month, monthShifts]) => (
        <Box key={month} mb={2}>
          <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1}>
            {month}
          </Typography>
          <Stack spacing={1.5}>
            {monthShifts.map((shift) => (
              <ShiftCard key={shift._id} shift={shift} onClick={() => navigate(`/worker/shifts/${shift._id}`)} />
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

export default function WorkerHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');

  const { data, isLoading, error } = useQuery({
    queryKey: ['worker-me'],
    queryFn: workerPortalApi.me,
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const { worker, upcomingConfirmed, pendingTimesheets, pendingApplications, pendingOffers } = data;

  // Document verification checks
  const now = new Date();
  const docs = worker.documents ?? [];

  const REQUIRED_CATEGORIES = [
    { category: 'identity', label: 'Ausweis / Reisepass' },
  ] as const;

  const RECOMMENDED_CATEGORIES = [
    { category: 'work_permit', label: 'Arbeitserlaubnis' },
    { category: 'health_certificate', label: 'Gesundheitszeugnis' },
  ] as const;

  const missingRequired = REQUIRED_CATEGORIES.filter(
    (r) => !docs.some((d) => d.category === r.category)
  );

  const expiredDocs = docs.filter(
    (d) => d.expiryDate && new Date(d.expiryDate) < now
  );

  const expiringSoon = docs.filter((d) => {
    if (!d.expiryDate) return false;
    const daysLeft = (new Date(d.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysLeft >= 0 && daysLeft <= 30;
  });

  const missingRecommended = RECOMMENDED_CATEGORIES.filter(
    (r) => !docs.some((d) => d.category === r.category)
  );

  const hasUrgentIssues = missingRequired.length > 0 || expiredDocs.length > 0;
  const hasWarnings = expiringSoon.length > 0 || missingRecommended.length > 0;
  const showDocCard = hasUrgentIssues || hasWarnings;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        {t('workerPortal.greeting', { name: worker.firstName })}
      </Typography>

      {/* Document verification prompt */}
      {showDocCard && (
        <Card
          sx={{
            mb: 3,
            borderLeft: 4,
            borderColor: hasUrgentIssues ? 'error.main' : 'warning.main',
          }}
        >
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {hasUrgentIssues
                  ? <ErrorOutlineIcon color="error" />
                  : <WarningAmberIcon color="warning" />
                }
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {hasUrgentIssues ? 'Dokumente erforderlich' : 'Dokumente vervollständigen'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {hasUrgentIssues
                      ? 'Fehlende oder abgelaufene Dokumente können Ihren Einsatz verhindern.'
                      : 'Einige empfohlene Dokumente fehlen noch.'}
                  </Typography>
                </Box>
              </Stack>
              <Button
                variant={hasUrgentIssues ? 'contained' : 'outlined'}
                color={hasUrgentIssues ? 'error' : 'warning'}
                size="small"
                startIcon={<UploadFileIcon />}
                onClick={() => navigate('/worker/documents')}
                sx={{ flexShrink: 0 }}
              >
                Dokumente hochladen
              </Button>
            </Stack>

            <Stack spacing={0.75} mt={2}>
              {missingRequired.map((r) => (
                <Stack key={r.category} direction="row" spacing={1} alignItems="center">
                  <ErrorOutlineIcon fontSize="small" color="error" />
                  <Typography variant="body2">
                    <strong>{r.label}</strong> — fehlt (Pflichtdokument)
                  </Typography>
                </Stack>
              ))}
              {expiredDocs.map((d) => (
                <Stack key={d.label} direction="row" spacing={1} alignItems="center">
                  <ErrorOutlineIcon fontSize="small" color="error" />
                  <Typography variant="body2">
                    <strong>{d.label}</strong> — abgelaufen am {new Date(d.expiryDate!).toLocaleDateString('de-DE')}
                  </Typography>
                </Stack>
              ))}
              {expiringSoon.map((d) => {
                const days = Math.ceil((new Date(d.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <Stack key={d.label} direction="row" spacing={1} alignItems="center">
                    <WarningAmberIcon fontSize="small" color="warning" />
                    <Typography variant="body2">
                      <strong>{d.label}</strong> — läuft in {days} Tag{days !== 1 ? 'en' : ''} ab
                    </Typography>
                  </Stack>
                );
              })}
              {missingRecommended.map((r) => (
                <Stack key={r.category} direction="row" spacing={1} alignItems="center">
                  <WarningAmberIcon fontSize="small" color="warning" />
                  <Typography variant="body2">
                    <strong>{r.label}</strong> — empfohlen, noch nicht hochgeladen
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Stats cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CalendarMonthIcon color="primary" />
                <Box>
                  <Typography variant="h4" fontWeight={700}>{upcomingConfirmed}</Typography>
                  <Typography variant="body2" color="text.secondary">{t('workerPortal.upcomingShifts')}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card
            sx={{ height: '100%', cursor: 'pointer', border: pendingOffers > 0 ? '2px solid' : undefined, borderColor: 'warning.main' }}
            onClick={() => navigate('/worker/offers')}
          >
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <LocalOfferIcon color={pendingOffers > 0 ? 'warning' : 'action'} />
                <Box>
                  <Typography variant="h4" fontWeight={700}>{pendingOffers}</Typography>
                  <Typography variant="body2" color="text.secondary">Angebote</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => navigate('/worker/available-shifts')}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CheckCircleIcon color={pendingApplications > 0 ? 'warning' : 'action'} />
                <Box>
                  <Typography variant="h4" fontWeight={700}>{pendingApplications}</Typography>
                  <Typography variant="body2" color="text.secondary">{t('workerPortal.pendingApplications')}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <AccessTimeIcon color={pendingTimesheets > 0 ? 'warning' : 'action'} />
                <Box>
                  <Typography variant="h4" fontWeight={700}>{pendingTimesheets}</Typography>
                  <Typography variant="body2" color="text.secondary">{t('workerPortal.pendingTimesheets')}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Shift tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('workerPortal.upcoming')} value="upcoming" />
        <Tab label={t('workerPortal.completedShifts')} value="completed" />
      </Tabs>

      {tab === 'upcoming' && <UpcomingTab />}
      {tab === 'completed' && <CompletedTab />}

      {/* Quick nav */}
      <Stack direction="row" spacing={2} mt={4} flexWrap="wrap">
        <Button variant="contained" startIcon={<WorkIcon />} onClick={() => navigate('/worker/available-shifts')}>
          {t('workerPortal.shiftOffers')}
        </Button>
        <Button variant="outlined" startIcon={<HourglassEmptyIcon />} onClick={() => navigate('/worker/timesheets')}>
          {t('workerPortal.myTimesheets')}
        </Button>
      </Stack>
    </Box>
  );
}
