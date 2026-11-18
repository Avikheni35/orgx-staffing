import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import CancelIcon from '@mui/icons-material/Cancel';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiClient from '../../../api/client';

interface AssignmentDetail {
  shift: {
    _id: string;
    title: string;
    businessName: string;
    locationName?: string;
    startTime: string;
    endTime: string;
    status: string;
  };
  assignment: {
    _id: string;
    workerId: string;
    checkInTime?: string;
    checkInLocation?: { lat: number; lng: number };
    checkOutTime?: string;
    status: string;
  };
  worker: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  contract?: { _id: string; status: string };
  timesheet?: { _id: string; status: string; grossPay: number };
}

function fetchAssignment(id: string) {
  return apiClient.get<AssignmentDetail>(`/shifts/assignment/${id}`).then((r) => r.data);
}

function cancelAssignment(assignmentId: string) {
  return apiClient.delete(`/shifts/assignments/${assignmentId}`).then((r) => r.data);
}

function checkInAssignment(assignmentId: string) {
  return apiClient.patch(`/shifts/assignments/${assignmentId}/check-in`).then((r) => r.data);
}

function checkOutAssignment(assignmentId: string) {
  return apiClient.patch(`/shifts/assignments/${assignmentId}/check-out`).then((r) => r.data);
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <Stack direction="row" gap={2} py={0.5}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>{label}</Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Stack>
  );
}

export default function AssignmentDetailPage() {
  const { t } = useTranslation();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: () => fetchAssignment(assignmentId!),
    enabled: !!assignmentId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['assignment', assignmentId] });

  const checkInMut = useMutation({ mutationFn: () => checkInAssignment(assignmentId!), onSuccess: invalidate });
  const checkOutMut = useMutation({ mutationFn: () => checkOutAssignment(assignmentId!), onSuccess: invalidate });
  const cancelMut = useMutation({ mutationFn: () => cancelAssignment(assignmentId!), onSuccess: () => navigate(-1) });

  if (isLoading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const { shift, assignment, worker, contract, timesheet } = data;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" gap={2}>
          <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate(`/app/shifts/${shift._id}`)}>
            {t('common.back')}
          </Button>
          <Typography variant="h5" fontWeight={700}>{t('assignments.title')}</Typography>
        </Stack>
        <Stack direction="row" gap={1}>
          {!assignment.checkInTime && (
            <Button
              variant="outlined"
              startIcon={<LoginIcon />}
              disabled={checkInMut.isPending}
              onClick={() => checkInMut.mutate()}
            >
              {t('assignments.checkIn')}
            </Button>
          )}
          {assignment.checkInTime && !assignment.checkOutTime && (
            <Button
              variant="outlined"
              startIcon={<LogoutIcon />}
              disabled={checkOutMut.isPending}
              onClick={() => checkOutMut.mutate()}
            >
              {t('assignments.checkOut')}
            </Button>
          )}
          <Button
            variant="outlined"
            color="error"
            startIcon={<CancelIcon />}
            disabled={cancelMut.isPending}
            onClick={() => { if (confirm(t('assignments.cancelConfirm'))) cancelMut.mutate(); }}
          >
            {t('assignments.cancel')}
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('assignments.shift')}</Typography>
            <Divider sx={{ mb: 2 }} />
            <InfoRow label={t('shifts.title')} value={shift.title} />
            <InfoRow label={t('shifts.business')} value={shift.businessName} />
            {shift.locationName && <InfoRow label={t('shifts.location')} value={shift.locationName} />}
            <InfoRow label={t('shifts.start')} value={new Date(shift.startTime).toLocaleString('de-DE')} />
            <InfoRow label={t('shifts.end')} value={new Date(shift.endTime).toLocaleString('de-DE')} />
            <Box mt={1}><Chip size="small" label={shift.status} /></Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('assignments.worker')}</Typography>
            <Divider sx={{ mb: 2 }} />
            <InfoRow label={t('workers.firstName')} value={worker.firstName} />
            <InfoRow label={t('workers.lastName')} value={worker.lastName} />
            <InfoRow label={t('workers.email')} value={worker.email} />
            <InfoRow label={t('workers.phone')} value={worker.phone} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('assignments.contract')}</Typography>
            <Divider sx={{ mb: 2 }} />
            {contract ? (
              <>
                <InfoRow label={t('common.status')} value={contract.status} />
                <Button size="small" sx={{ mt: 1 }} onClick={() => navigate(`/app/contracts/${contract._id}`)}>
                  {t('common.view')}
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">{t('assignments.noContract')}</Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('assignments.timesheet')}</Typography>
            <Divider sx={{ mb: 2 }} />
            {timesheet ? (
              <>
                <InfoRow label={t('common.status')} value={timesheet.status} />
                <InfoRow
                  label={t('timesheets.grossPay')}
                  value={timesheet.grossPay.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                />
                <Button size="small" sx={{ mt: 1 }} onClick={() => navigate(`/app/timesheets/${timesheet._id}`)}>
                  {t('common.view')}
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">{t('assignments.noTimesheet')}</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
