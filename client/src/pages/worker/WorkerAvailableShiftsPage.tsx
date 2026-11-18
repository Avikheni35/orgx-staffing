import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import BoltIcon from '@mui/icons-material/Bolt';
import UndoIcon from '@mui/icons-material/Undo';
import { useTranslation } from 'react-i18next';
import { workerPortalApi } from '../../api/workerPortal';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function durationH(start: string, end: string, breakMin: number) {
  return ((new Date(end).getTime() - new Date(start).getTime()) / 3_600_000 - breakMin / 60).toFixed(1);
}

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'In Prüfung',
  inactive:       'Inaktiv',
  suspended:      'Gesperrt',
  blacklisted:    'Gesperrt',
};

export default function WorkerAvailableShiftsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: me } = useQuery({
    queryKey: ['worker-me'],
    queryFn: workerPortalApi.me,
  });

  const { data: shifts, isLoading, error } = useQuery({
    queryKey: ['worker-available-shifts'],
    queryFn: workerPortalApi.getAvailableShifts,
  });

  const { data: myApplications } = useQuery({
    queryKey: ['worker-applications'],
    queryFn: workerPortalApi.getApplications,
  });

  const pendingApplications = (myApplications ?? []).filter((a) => a.status === 'pending');

  const applyMutation = useMutation({
    mutationFn: (shiftId: string) => workerPortalApi.applyForShift(shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-available-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['worker-applications'] });
      queryClient.invalidateQueries({ queryKey: ['worker-me'] });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (shiftId: string) => workerPortalApi.withdrawApplication(shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-applications'] });
      queryClient.invalidateQueries({ queryKey: ['worker-available-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['worker-me'] });
    },
  });

  const instantBookMutation = useMutation({
    mutationFn: (shiftId: string) => workerPortalApi.instantBook(shiftId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['worker-available-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['worker-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['worker-me'] });
      navigate(`/worker/contracts/${data.contractId}`);
    },
  });

  const workerStatus = me?.worker.status;
  const canApply = workerStatus === 'active';

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={1}>{t('workerPortal.shiftOffers')}</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>{t('workerPortal.shiftOffersDesc')}</Typography>

      {!canApply && workerStatus && (
        <Alert severity="warning" icon={<LockIcon />} sx={{ mb: 3 }}>
          <Typography fontWeight={600}>Bewerbungen derzeit nicht möglich</Typography>
          Ihr Konto hat den Status <strong>{STATUS_LABELS[workerStatus] ?? workerStatus}</strong>. Nur aktive Mitarbeiter können sich für Schichten bewerben. Bitte wenden Sie sich an Ihre Agentur.
        </Alert>
      )}

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{t('common.loadError')}</Alert>}

      {shifts && shifts.length === 0 && (
        <Alert severity="info" icon={<CheckCircleIcon />}>{t('workerPortal.noAvailableShifts')}</Alert>
      )}

      {pendingApplications.length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight={700} mb={1}>
            Ausstehende Bewerbungen ({pendingApplications.length})
          </Typography>
          <Stack spacing={1}>
            {pendingApplications.map((app) => (
              <Card key={app._id} variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{app.shift?.title ?? '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {app.shift ? `${fmtDate(app.shift.startTime)} · ${fmtTime(app.shift.startTime)} – ${fmtTime(app.shift.endTime)}` : ''}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label="Ausstehend" color="warning" size="small" />
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<UndoIcon />}
                        disabled={withdrawMutation.isPending}
                        onClick={() => withdrawMutation.mutate(app.shiftId)}
                      >
                        Zurückziehen
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {applyMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>{t('workerPortal.applySuccess')}</Alert>
      )}
      {applyMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(applyMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.saveError')}
        </Alert>
      )}
      {instantBookMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(instantBookMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.saveError')}
        </Alert>
      )}

      <Stack spacing={2}>
        {(shifts ?? []).map((shift) => (
          <Card
            key={shift._id}
            sx={shift.isInstantBooking ? { border: '1px solid', borderColor: 'warning.main', bgcolor: 'rgba(255, 152, 0, 0.06)' } : undefined}
          >
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box flex={1}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                    <Typography variant="subtitle1" fontWeight={700}>{shift.title}</Typography>
                    {shift.isInstantBooking && (
                      <Chip icon={<BoltIcon />} label={t('workerPortal.instantBooking')} color="warning" size="small" />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">{shift.businessName}</Typography>
                  {shift.locationName && (
                    <Typography variant="body2" color="text.secondary">{shift.locationName}</Typography>
                  )}
                  <Stack direction="row" spacing={2} mt={1} flexWrap="wrap">
                    <Typography variant="body2" fontWeight={600}>{fmtDate(shift.startTime)}</Typography>
                    <Typography variant="body2">{fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}</Typography>
                    <Typography variant="body2" color="text.secondary">{durationH(shift.startTime, shift.endTime, shift.breakMinutes)} h</Typography>
                    <Typography variant="body2" fontWeight={600}>{shift.payRatePerHour.toFixed(2)} €/h</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} mt={1}>
                    <Chip
                      size="small"
                      label={`${shift.assignedWorkers.length} / ${shift.requiredWorkers} ${t('workerPortal.filled')}`}
                      color={shift.assignedWorkers.length >= shift.requiredWorkers ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  </Stack>
                </Box>
                <Tooltip title={canApply ? (shift.isInstantBooking ? t('workerPortal.instantBookTooltip') : '') : 'Ihr Konto ist nicht aktiv. Bitte wenden Sie sich an Ihre Agentur.'} arrow>
                  <span>
                    {shift.isInstantBooking ? (
                      <Button
                        variant="contained"
                        size="small"
                        color="warning"
                        startIcon={canApply ? <BoltIcon /> : <LockIcon />}
                        sx={{ ml: 2, minWidth: 130, flexShrink: 0 }}
                        disabled={!canApply || instantBookMutation.isPending}
                        onClick={() => instantBookMutation.mutate(shift._id)}
                      >
                        {t('workerPortal.instantBook')}
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={canApply ? <SendIcon /> : <LockIcon />}
                        sx={{ ml: 2, minWidth: 120, flexShrink: 0 }}
                        disabled={!canApply || applyMutation.isPending}
                        onClick={() => applyMutation.mutate(shift._id)}
                      >
                        {t('workerPortal.apply')}
                      </Button>
                    )}
                  </span>
                </Tooltip>
              </Stack>
              {shift.notes && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="body2" color="text.secondary">{shift.notes}</Typography>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
