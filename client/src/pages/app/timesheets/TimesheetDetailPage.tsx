import { useState } from 'react';
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
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { timesheetsApi, TimesheetStatus } from '../../../api/timesheets';

const STATUS_COLOR: Record<TimesheetStatus, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  pending: 'warning',
  approved: 'success',
  disputed: 'error',
  exported: 'info',
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function calcHours(start: string, end: string, breakMin: number): number {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000 - breakMin / 60);
}

export default function TimesheetDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ actualStart: '', actualEnd: '', actualBreakMinutes: 0, notes: '' });

  const { data: ts, isLoading, error } = useQuery({
    queryKey: ['timesheet', id],
    queryFn: () => timesheetsApi.get(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['timesheet', id] });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    queryClient.invalidateQueries({ queryKey: ['worker-timesheets'] });
  };

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof timesheetsApi.update>[1]) =>
      timesheetsApi.update(id!, data),
    onSuccess: () => { invalidate(); setEditing(false); },
  });

  const approveMutation = useMutation({
    mutationFn: () => timesheetsApi.approve(id!),
    onSuccess: invalidate,
  });

  const disputeMutation = useMutation({
    mutationFn: () => timesheetsApi.update(id!, { status: 'disputed' }),
    onSuccess: invalidate,
  });

  const resetToPendingMutation = useMutation({
    mutationFn: () => timesheetsApi.update(id!, { status: 'pending' }),
    onSuccess: invalidate,
  });

  if (isLoading) return <CircularProgress />;
  if (error || !ts) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const plannedHours = calcHours(ts.plannedStart, ts.plannedEnd, ts.plannedBreakMinutes);
  const actualHours = ts.totalHours;
  const hasDiff = Math.abs(plannedHours - actualHours) > 0.01;
  const canEdit = ts.status !== 'exported';
  const canApprove = ts.status === 'pending' || ts.status === 'disputed';

  const startEdit = () => {
    setEditForm({
      actualStart: toLocalInput(ts.actualStart),
      actualEnd: toLocalInput(ts.actualEnd),
      actualBreakMinutes: ts.actualBreakMinutes,
      notes: ts.notes ?? '',
    });
    setEditing(true);
  };

  const saveEdit = () => {
    updateMutation.mutate({
      actualStart: new Date(editForm.actualStart).toISOString(),
      actualEnd: new Date(editForm.actualEnd).toISOString(),
      actualBreakMinutes: editForm.actualBreakMinutes,
      notes: editForm.notes || undefined,
    });
  };

  const previewHours = editing
    ? calcHours(editForm.actualStart, editForm.actualEnd, editForm.actualBreakMinutes)
    : actualHours;
  const previewPay = previewHours * ts.payRatePerHour;

  return (
    <Box>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/timesheets')} size="small">
            {t('common.back')}
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700}>{ts.workerName}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
              <Chip label={t(`timesheets.statusLabel.${ts.status}`)} color={STATUS_COLOR[ts.status]} size="small" />
              <Typography variant="caption" color="text.secondary">
                {ts.businessName} · {new Date(ts.shiftDate).toLocaleDateString('de-DE')}
              </Typography>
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          {canApprove && !editing && (
            <>
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<CheckCircleIcon />}
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                {t('timesheets.approve')}
              </Button>
              {ts.status === 'pending' && (
                <Button
                  variant="outlined"
                  color="warning"
                  size="small"
                  startIcon={<WarningAmberIcon />}
                  onClick={() => disputeMutation.mutate()}
                  disabled={disputeMutation.isPending}
                >
                  {t('timesheets.dispute')}
                </Button>
              )}
              {ts.status === 'disputed' && (
                <Button
                  variant="outlined"
                  color="info"
                  size="small"
                  onClick={() => resetToPendingMutation.mutate()}
                  disabled={resetToPendingMutation.isPending}
                >
                  {t('timesheets.resetToPending')}
                </Button>
              )}
            </>
          )}
          {canEdit && !editing && (
            <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={startEdit}>
              {t('timesheets.editActual')}
            </Button>
          )}
          {editing && (
            <>
              <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={saveEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t('common.loading') : t('common.save')}
              </Button>
              <Button variant="outlined" size="small" startIcon={<CloseIcon />} onClick={() => setEditing(false)}>
                {t('common.cancel')}
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {ts.status === 'disputed' && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={600}>{t('timesheets.workerDisputedMessage')}</Typography>
          {ts.disputeReason && (
            <Typography variant="body2" mt={0.5}>
              {t('timesheets.workerReason')}: {ts.disputeReason}
            </Typography>
          )}
        </Alert>
      )}

      {(updateMutation.isError || approveMutation.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>{t('common.saveError')}</Alert>
      )}

      <Grid container spacing={3}>
        {/* Planned vs Actual */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t('timesheets.planned')} vs. {t('timesheets.actual')}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {editing ? (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={5}>
                  <TextField
                    label={t('timesheets.startTime')}
                    type="datetime-local"
                    fullWidth
                    value={editForm.actualStart}
                    onChange={(e) => setEditForm((p) => ({ ...p, actualStart: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField
                    label={t('timesheets.endTime')}
                    type="datetime-local"
                    fullWidth
                    value={editForm.actualEnd}
                    onChange={(e) => setEditForm((p) => ({ ...p, actualEnd: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label={t('timesheets.break')}
                    type="number"
                    fullWidth
                    value={editForm.actualBreakMinutes}
                    onChange={(e) => setEditForm((p) => ({ ...p, actualBreakMinutes: parseInt(e.target.value) || 0 }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label={t('timesheets.notes')}
                    fullWidth
                    multiline
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </Grid>
              </Grid>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    {t('timesheets.planned')}
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">{fmtDateTime(ts.plannedStart)}</Typography>
                    <Typography variant="body2">{fmtDateTime(ts.plannedEnd)}</Typography>
                    <Typography variant="body2" color="text.secondary">{ts.plannedBreakMinutes} min {t('timesheets.break').toLowerCase()}</Typography>
                    <Typography variant="body2" fontWeight={600}>{plannedHours.toFixed(2)} h</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    {t('timesheets.actual')}
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color={ts.actualStart !== ts.plannedStart ? 'warning.main' : 'inherit'}>
                      {fmtDateTime(ts.actualStart)}
                    </Typography>
                    <Typography variant="body2" color={ts.actualEnd !== ts.plannedEnd ? 'warning.main' : 'inherit'}>
                      {fmtDateTime(ts.actualEnd)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{ts.actualBreakMinutes} min {t('timesheets.break').toLowerCase()}</Typography>
                    <Typography variant="body2" fontWeight={600} color={hasDiff ? 'warning.main' : 'inherit'}>
                      {actualHours.toFixed(2)} h {hasDiff && `(${actualHours > plannedHours ? '+' : ''}${(actualHours - plannedHours).toFixed(2)})`}
                    </Typography>
                  </Stack>
                </Grid>
              </Grid>
            )}

            {ts.notes && !editing && (
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">{t('timesheets.notes')}</Typography>
                <Typography variant="body2">{ts.notes}</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Pay summary */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Abrechnung</Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">{t('timesheets.payRate')}</Typography>
                <Typography variant="body2">{ts.payRatePerHour.toFixed(2)} €/h</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">{t('timesheets.actualHours')}</Typography>
                <Typography variant="body2">{previewHours.toFixed(2)} h</Typography>
              </Stack>
              {ts.billingRatePerHour && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">{t('shifts.billingRate')}</Typography>
                  <Typography variant="body2">{ts.billingRatePerHour.toFixed(2)} €/h</Typography>
                </Stack>
              )}
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body1" fontWeight={700}>{t('timesheets.grossPay')}</Typography>
                <Typography variant="body1" fontWeight={700}>
                  € {previewPay.toFixed(2)}
                </Typography>
              </Stack>
              {ts.billingRatePerHour && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Umsatz</Typography>
                  <Typography variant="body2">€ {(previewHours * ts.billingRatePerHour).toFixed(2)}</Typography>
                </Stack>
              )}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, mt: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Schicht</Typography>
            <Divider sx={{ mb: 2 }} />
            <Button
              size="small"
              variant="outlined"
              fullWidth
              onClick={() => navigate(`/app/shifts/${ts.shiftId}`)}
            >
              {t('timesheets.backToShift')}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
