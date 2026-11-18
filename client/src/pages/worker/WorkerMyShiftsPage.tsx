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
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workerPortalApi, WorkerShift } from '../../api/workerPortal';
import type { ShiftApplicationWithShift } from '../../api/workerPortal';

type TabVal = 'applications' | 'to-confirm' | 'upcoming' | 'completed' | 'timeline';

const APP_COLOR: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function durationH(start: string, end: string, breakMin: number) {
  return ((new Date(end).getTime() - new Date(start).getTime()) / 3_600_000 - breakMin / 60).toFixed(1);
}


function ApplicationsTab() {
  const { t } = useTranslation();
  const { data: applications, isLoading, error } = useQuery({
    queryKey: ['worker-applications'],
    queryFn: workerPortalApi.getApplications,
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{t('common.loadError')}</Alert>;
  if (!applications?.length) return <Alert severity="info">{t('workerPortal.noApplications')}</Alert>;

  return (
    <Stack spacing={2}>
      {applications.map((app: ShiftApplicationWithShift) => (
        <Card key={app._id}>
          <CardContent>
            {app.shift ? (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Typography variant="subtitle1" fontWeight={700}>{app.shift.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{app.shift.businessName}</Typography>
                    <Stack direction="row" spacing={2} mt={0.5} flexWrap="wrap">
                      <Typography variant="body2" fontWeight={600}>{fmtDate(app.shift.startTime)}</Typography>
                      <Typography variant="body2">{fmtTime(app.shift.startTime)} – {fmtTime(app.shift.endTime)}</Typography>
                    </Stack>
                  </Box>
                  <Chip
                    label={t(`workerPortal.applicationStatus.${app.status}`)}
                    color={APP_COLOR[app.status]}
                    size="small"
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  {t('workerPortal.appliedOn')}: {fmtDate(app.appliedAt)}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">{t('workerPortal.shiftNoLongerAvailable')}</Typography>
            )}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function ToConfirmTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: shifts, isLoading, error } = useQuery({
    queryKey: ['worker-shifts', 'to-confirm'],
    queryFn: () => workerPortalApi.getMyShifts('to-confirm'),
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{t('common.loadError')}</Alert>;
  if (!shifts?.length) return <Alert severity="success" icon={<CheckCircleIcon />}>{t('workerPortal.noPendingConfirms')}</Alert>;

  return (
    <Stack spacing={2}>
      {shifts.map((shift) => (
        <Card key={shift._id}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box flex={1} sx={{ cursor: 'pointer' }} onClick={() => navigate(`/worker/shifts/${shift._id}`)}>
                <Typography variant="subtitle1" fontWeight={700}>{shift.title}</Typography>
                <Typography variant="body2" color="text.secondary">{shift.businessName}</Typography>
                {shift.locationName && (
                  <Typography variant="body2" color="text.secondary">{shift.locationName}</Typography>
                )}
                <Stack direction="row" spacing={2} mt={0.5} flexWrap="wrap">
                  <Typography variant="body2" fontWeight={600}>{fmtDate(shift.startTime)}</Typography>
                  <Typography variant="body2">{fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}</Typography>
                  <Typography variant="body2" color="text.secondary">{durationH(shift.startTime, shift.endTime, shift.breakMinutes)} h</Typography>
                </Stack>
              </Box>
              <Button
                variant="contained"
                color="warning"
                size="small"
                startIcon={<CheckCircleIcon />}
                sx={{ ml: 1, flexShrink: 0 }}
                onClick={() =>
                  shift.myContract
                    ? navigate(`/worker/contracts/${shift.myContract._id}`)
                    : navigate(`/worker/shifts/${shift._id}`)
                }
              >
                {t('workerPortal.signContract')}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function UpcomingTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: shifts, isLoading, error } = useQuery({
    queryKey: ['worker-shifts', 'upcoming'],
    queryFn: () => workerPortalApi.getMyShifts('upcoming'),
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{t('common.loadError')}</Alert>;
  if (!shifts?.length) return <Alert severity="info">{t('workerPortal.noUpcoming')}</Alert>;

  return (
    <Stack spacing={1.5}>
      {shifts.map((shift) => {
        const isConfirmed = shift.myStatus === 'confirmed';
        return (
          <Card
            key={shift._id}
            sx={{ borderLeft: 4, borderColor: isConfirmed ? 'success.main' : 'warning.main' }}
          >
            <CardActionArea onClick={() => navigate(`/worker/shifts/${shift._id}`)}>
              <CardContent sx={{ py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography variant="body1" fontWeight={700}>
                        {new Date(shift.startTime).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </Typography>
                      <Typography variant="body2">
                        {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{shift.title} · {shift.businessName}</Typography>
                    {shift.locationName && (
                      <Typography variant="caption" color="text.secondary">{shift.locationName}</Typography>
                    )}
                  </Box>
                  <Stack alignItems="flex-end">
                    <Chip
                      label={t(`workerPortal.statusLabel.${shift.myStatus}`)}
                      color={isConfirmed ? 'success' : 'warning'}
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
      })}
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

  if (isLoading) return <CircularProgress />;
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
        <Box key={month} mb={3}>
          <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1}>
            {month}
          </Typography>
          <Stack spacing={1.5}>
            {monthShifts.map((shift) => (
              <Card key={shift._id} sx={{ borderLeft: 4, borderColor: 'primary.main' }}>
                <CardActionArea onClick={() => navigate(`/worker/shifts/${shift._id}`)}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Typography variant="body1" fontWeight={700}>
                            {new Date(shift.startTime).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          </Typography>
                          <Typography variant="body2">
                            {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">{shift.title} · {shift.businessName}</Typography>
                      </Box>
                      <Stack alignItems="flex-end">
                        <Chip label={t('workerPortal.statusLabel.completed')} color="primary" size="small" />
                        <Typography variant="caption" color="text.secondary" mt={0.5}>
                          {durationH(shift.startTime, shift.endTime, shift.breakMinutes)} h
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

function TimelineTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: shifts, isLoading, error } = useQuery({
    queryKey: ['worker-shifts', 'timeline'],
    queryFn: () => workerPortalApi.getMyShifts('timeline'),
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{t('common.loadError')}</Alert>;
  if (!shifts?.length) return <Alert severity="info">{t('workerPortal.noTimeline')}</Alert>;

  // Group by month
  const grouped: Record<string, WorkerShift[]> = {};
  for (const shift of shifts) {
    const key = new Date(shift.startTime).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(shift);
  }

  return (
    <Box>
      {Object.entries(grouped).map(([month, monthShifts]) => (
        <Box key={month} mb={3}>
          <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1}>
            {month}
          </Typography>
          <Stack spacing={1.5}>
            {monthShifts.map((shift) => (
              <Card key={shift._id} sx={{ borderLeft: 4, borderColor: 'success.main' }}>
                <CardActionArea onClick={() => navigate(`/worker/shifts/${shift._id}`)}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Typography variant="body1" fontWeight={700}>
                            {new Date(shift.startTime).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          </Typography>
                          <Typography variant="body2">
                            {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">{shift.title} · {shift.businessName}</Typography>
                      </Box>
                      <Stack alignItems="flex-end">
                        <Chip label={t('workerPortal.statusLabel.confirmed')} color="success" size="small" />
                        <Typography variant="caption" color="text.secondary" mt={0.5}>
                          {durationH(shift.startTime, shift.endTime, shift.breakMinutes)} h
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

export default function WorkerMyShiftsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabVal>('upcoming');

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>{t('workerPortal.myShifts')}</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        <Tab label={t('workerPortal.upcoming')} value="upcoming" />
        <Tab label={t('workerPortal.completedShifts')} value="completed" />
        <Tab label={t('workerPortal.toConfirm')} value="to-confirm" />
        <Tab label={t('workerPortal.applications')} value="applications" />
        <Tab label={t('workerPortal.timeline')} value="timeline" />
      </Tabs>

      {tab === 'upcoming' && <UpcomingTab />}
      {tab === 'completed' && <CompletedTab />}
      {tab === 'applications' && <ApplicationsTab />}
      {tab === 'to-confirm' && <ToConfirmTab />}
      {tab === 'timeline' && <TimelineTab />}
    </Box>
  );
}
