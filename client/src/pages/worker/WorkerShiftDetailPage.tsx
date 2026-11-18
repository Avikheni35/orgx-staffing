import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import BusinessIcon from '@mui/icons-material/Business';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GavelIcon from '@mui/icons-material/Gavel';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workerPortalApi } from '../../api/workerPortal';

const MY_STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  assigned: 'info',
  confirmed: 'success',
  completed: 'default',
  no_show: 'error',
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function WorkerShiftDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: shift, isLoading, error } = useQuery({
    queryKey: ['worker-shift', id],
    queryFn: () => workerPortalApi.getShift(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['worker-shift', id] });
    queryClient.invalidateQueries({ queryKey: ['worker-shifts'] });
    queryClient.invalidateQueries({ queryKey: ['worker-me'] });
  };

  const completeMutation = useMutation({
    mutationFn: () => workerPortalApi.completeShift(id!),
    onSuccess: invalidate,
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (error || !shift) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const now = new Date();
  const shiftStarted = now >= new Date(shift.startTime);
  const durationH = ((new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3_600_000 - shift.breakMinutes / 60).toFixed(1);

  const pendingContract = shift.myContract && shift.myContract.status === 'pending_signature';
  const contractSigned = shift.myContract?.status === 'signed';
  const checkInWindowOpen = now >= new Date(new Date(shift.startTime).getTime() - 5 * 60_000);
  // Worker must sign contract before attendance can be confirmed
  const showSignContractBtn = shift.myStatus === 'assigned' && pendingContract && shift.status !== 'cancelled' && shift.status !== 'completed';
  // Confirm button only shows if assigned but NO pending contract (shouldn't happen in normal flow, safety fallback)
const showCompleteBtn = shift.myStatus === 'confirmed' && shiftStarted && shift.status !== 'cancelled' && shift.status !== 'completed';
  // Requires a signed contract; visible from 5 min before start, or any time after check-in (to allow check-out)
  const showCheckInBtn = (shift.myStatus === 'confirmed' || shift.myStatus === 'assigned')
    && contractSigned
    && (checkInWindowOpen || !!shift.myCheckInTime)
    && shift.status !== 'cancelled'
    && shift.status !== 'completed';

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/worker/shifts')} size="small">
          {t('common.back')}
        </Button>
        <Typography variant="h5" fontWeight={700}>{shift.title}</Typography>
      </Stack>

      {/* Shift completed — either by agency or auto-triggered when all workers finished */}
      {shift.status === 'completed' && shift.myStatus !== 'completed' && (
        <Alert
          severity="info"
          icon={<BusinessIcon />}
          sx={{ mb: 2 }}
        >
          <Typography variant="body2" fontWeight={600}>
            {t('workerPortal.agencyEndedShift')}
          </Typography>
          {shift.completedAt && (
            <Typography variant="caption">
              {t('workerPortal.completedAt')}: {fmtDateTime(shift.completedAt)}
            </Typography>
          )}
        </Alert>
      )}

      {/* Shift cancelled */}
      {shift.status === 'cancelled' && (
        <Alert severity="error" sx={{ mb: 2 }}>{t('workerPortal.shiftCancelled')}</Alert>
      )}

      {/* Worker self-completed */}
      {shift.myStatus === 'completed' && shift.myCompletedAt && (
        <Alert severity="success" icon={<DoneAllIcon />} sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={600}>{t('workerPortal.youCompletedShift')}</Typography>
          <Typography variant="caption">
            {t('workerPortal.completedAt')}: {fmtDateTime(shift.myCompletedAt)}
          </Typography>
        </Alert>
      )}

      {/* Mutation errors */}
      {completeMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>{t('common.saveError')}</Alert>
      )}

      {/* Not yet started but can complete */}
      {shift.myStatus === 'confirmed' && !shiftStarted && shift.status !== 'cancelled' && (
        <Alert severity="warning" icon={<AccessTimeIcon />} sx={{ mb: 2 }}>
          {t('workerPortal.completeAvailableAfterStart')}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>{shift.businessName}</Typography>
              {shift.locationName && (
                <Typography variant="body2" color="text.secondary">{shift.locationName}</Typography>
              )}
            </Box>
            <Stack spacing={0.5} alignItems="flex-end">
              <Chip
                label={t(`workerPortal.statusLabel.${shift.myStatus}`)}
                color={MY_STATUS_COLOR[shift.myStatus ?? ''] ?? 'default'}
                size="small"
              />
              {shift.status === 'completed' && (
                <Chip label={t('workerPortal.shiftEnded')} color="default" size="small" variant="outlined" />
              )}
            </Stack>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">{t('workerPortal.start')}</Typography>
              <Typography variant="body2" fontWeight={600}>{fmtDateTime(shift.startTime)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">{t('workerPortal.end')}</Typography>
              <Typography variant="body2" fontWeight={600}>{fmtTime(shift.endTime)} Uhr</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">{t('workerPortal.break')}</Typography>
              <Typography variant="body2">{shift.breakMinutes} min</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">{t('workerPortal.duration')}</Typography>
              <Typography variant="body2">{durationH} h</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">{t('workerPortal.payRate')}</Typography>
              <Typography variant="body2" fontWeight={600}>{shift.payRatePerHour.toFixed(2)} €/h</Typography>
            </Stack>
          </Stack>

          {shift.notes && (
            <Box mt={2} p={1.5} bgcolor="grey.50" borderRadius={1}>
              <Typography variant="caption" color="text.secondary" display="block">Hinweise</Typography>
              <Typography variant="body2">{shift.notes}</Typography>
            </Box>
          )}

          {/* Action buttons */}
          <Stack spacing={1.5} mt={3}>
            {showSignContractBtn && (
              <Box>
                <Alert severity="warning" icon={<GavelIcon />} sx={{ mb: 1.5 }}>
                  {t('contract.mustSignFirst')}
                </Alert>
                <Button
                  variant="contained"
                  color="warning"
                  fullWidth
                  size="large"
                  startIcon={<GavelIcon />}
                  onClick={() => navigate(`/worker/contracts/${shift.myContract!._id}`)}
                >
                  {t('contract.signContractBtn')}
                </Button>
              </Box>
            )}


            {showCheckInBtn && (
              <Button
                variant="outlined"
                color="success"
                fullWidth
                size="large"
                startIcon={<HowToRegIcon />}
                onClick={() => navigate(`/worker/shifts/${id}/checkin`)}
              >
                {shift.myCheckInTime ? 'Check-out' : 'Check-in / Check-out'}
              </Button>
            )}

            {showCompleteBtn && (
              <Button
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                startIcon={<DoneAllIcon />}
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending ? t('common.loading') : t('workerPortal.completeShift')}
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
