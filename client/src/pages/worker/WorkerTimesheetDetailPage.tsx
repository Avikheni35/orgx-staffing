import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workerPortalApi } from '../../api/workerPortal';
import type { TimesheetStatus } from '../../api/timesheets';

const STATUS_COLOR: Record<TimesheetStatus, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  pending: 'warning',
  approved: 'success',
  disputed: 'error',
  exported: 'info',
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function calcHours(start: string, end: string, breakMin: number) {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000 - breakMin / 60);
}

export default function WorkerTimesheetDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const { data: ts, isLoading, error } = useQuery({
    queryKey: ['worker-timesheet', id],
    queryFn: () => workerPortalApi.getTimesheet(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['worker-timesheet', id] });
    queryClient.invalidateQueries({ queryKey: ['worker-timesheets'] });
    queryClient.invalidateQueries({ queryKey: ['worker-me'] });
  };

  const disputeMutation = useMutation({
    mutationFn: () => workerPortalApi.disputeTimesheet(id!, disputeReason),
    onSuccess: () => { invalidate(); setShowDisputeForm(false); },
  });

  const withdrawMutation = useMutation({
    mutationFn: () => workerPortalApi.withdrawDispute(id!),
    onSuccess: invalidate,
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (error || !ts) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const plannedHours = calcHours(ts.plannedStart, ts.plannedEnd, ts.plannedBreakMinutes);
  const hasDiff = Math.abs(ts.totalHours - plannedHours) > 0.01;
  const canDispute = ts.status === 'pending' || ts.status === 'approved';

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/worker/timesheets')} size="small">
          {t('common.back')}
        </Button>
        <Box>
          <Typography variant="h5" fontWeight={700}>{ts.businessName}</Typography>
          <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
            <Chip label={t(`timesheets.statusLabel.${ts.status}`)} color={STATUS_COLOR[ts.status]} size="small" />
            <Typography variant="caption" color="text.secondary">
              {new Date(ts.shiftDate).toLocaleDateString('de-DE')}
            </Typography>
          </Stack>
        </Box>
      </Stack>

      {ts.status === 'approved' && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
          {t('timesheets.approvedMessage')}
        </Alert>
      )}

      {ts.status === 'disputed' && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 2 }}
          action={
            <Button
              size="small"
              color="warning"
              variant="outlined"
              disabled={withdrawMutation.isPending}
              onClick={() => withdrawMutation.mutate()}
            >
              {t('timesheets.withdrawDispute')}
            </Button>
          }
        >
          <Typography variant="body2" fontWeight={600}>{t('timesheets.disputedMessage')}</Typography>
          {ts.disputeReason && (
            <Typography variant="caption">
              {t('timesheets.yourReason')}: {ts.disputeReason}
            </Typography>
          )}
        </Alert>
      )}

      {hasDiff && ts.status !== 'disputed' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('timesheets.hoursMismatchHint')}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t('timesheets.planned')} vs. {t('timesheets.actual')}
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Stack direction="row" spacing={4}>
          <Box flex={1}>
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              {t('timesheets.planned')}
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">{fmtDateTime(ts.plannedStart)}</Typography>
              <Typography variant="body2">{fmtDateTime(ts.plannedEnd)}</Typography>
              <Typography variant="body2" color="text.secondary">{ts.plannedBreakMinutes} min</Typography>
              <Typography variant="body2" fontWeight={600}>{plannedHours.toFixed(2)} h</Typography>
            </Stack>
          </Box>
          <Box flex={1}>
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              {t('timesheets.actual')}
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">{fmtDateTime(ts.actualStart)}</Typography>
              <Typography variant="body2">{fmtDateTime(ts.actualEnd)}</Typography>
              <Typography variant="body2" color="text.secondary">{ts.actualBreakMinutes} min</Typography>
              <Typography
                variant="body2"
                fontWeight={600}
                color={hasDiff ? 'warning.main' : 'inherit'}
              >
                {ts.totalHours.toFixed(2)} h
                {hasDiff && ` (${ts.totalHours > plannedHours ? '+' : ''}${(ts.totalHours - plannedHours).toFixed(2)})`}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        {ts.notes && (
          <Box mt={2}>
            <Typography variant="caption" color="text.secondary">{t('timesheets.notes')}</Typography>
            <Typography variant="body2">{ts.notes}</Typography>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Abrechnung</Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">{t('timesheets.payRate')}</Typography>
            <Typography variant="body2">{ts.payRatePerHour.toFixed(2)} €/h</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">{t('timesheets.actualHours')}</Typography>
            <Typography variant="body2">{ts.totalHours.toFixed(2)} h</Typography>
          </Stack>
          <Divider />
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body1" fontWeight={700}>{t('timesheets.grossPay')}</Typography>
            <Typography variant="body1" fontWeight={700} color="success.main">
              € {ts.grossPay.toFixed(2)}
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {/* Dispute section */}
      {canDispute && !showDisputeForm && (
        <Button
          variant="outlined"
          color="warning"
          startIcon={<WarningAmberIcon />}
          onClick={() => setShowDisputeForm(true)}
        >
          {t('timesheets.disputeHours')}
        </Button>
      )}

      {showDisputeForm && (
        <Paper sx={{ p: 3, border: '1px solid', borderColor: 'warning.main' }}>
          <Typography variant="subtitle2" fontWeight={700} color="warning.main" gutterBottom>
            {t('timesheets.disputeTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t('timesheets.disputeHint')}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label={t('timesheets.disputeReason')}
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder={t('timesheets.disputeReasonPlaceholder')}
            sx={{ mb: 2 }}
          />
          {disputeMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>{t('common.saveError')}</Alert>
          )}
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color="warning"
              onClick={() => disputeMutation.mutate()}
              disabled={disputeReason.trim().length < 5 || disputeMutation.isPending}
            >
              {disputeMutation.isPending ? t('common.loading') : t('timesheets.submitDispute')}
            </Button>
            <Button variant="outlined" onClick={() => { setShowDisputeForm(false); setDisputeReason(''); }}>
              {t('common.cancel')}
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
