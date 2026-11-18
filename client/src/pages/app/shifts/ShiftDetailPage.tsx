import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CancelIcon from '@mui/icons-material/Cancel';
import LayersIcon from '@mui/icons-material/Layers';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { shiftsApi, Shift, ShiftStatus, WorkerAssignmentStatus, ShiftApplicationItem, ShiftOfferItem } from '../../../api/shifts';
import { workersApi, Worker } from '../../../api/workers';
import { timesheetsApi } from '../../../api/timesheets';
import { shiftTemplatesApi } from '../../../api/shiftTemplates';

const STATUS_COLOR: Record<ShiftStatus, 'default' | 'info' | 'success' | 'error'> = {
  draft: 'default',
  published: 'info',
  completed: 'success',
  cancelled: 'error',
};

const WORKER_STATUS_COLOR: Record<WorkerAssignmentStatus, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  assigned: 'info',
  confirmed: 'success',
  completed: 'success',
  no_show: 'error',
};

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function netHours(shift: Shift) {
  const ms = new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime();
  return (ms / 3600000 - shift.breakMinutes / 60).toFixed(2);
}

export default function ShiftDetailPage() {
  const { t } = useTranslation();
  const { shiftId } = useParams<{ shiftId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | number>>({});
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workerSearch, setWorkerSearch] = useState('');
  const [offerWorkers, setOfferWorkers] = useState<Worker[]>([]);
  const [offerMessage, setOfferMessage] = useState('');
  const [offerExpiresHours, setOfferExpiresHours] = useState(24);
  const [offerResult, setOfferResult] = useState<{ workerName: string; status: string }[] | null>(null);
  const [assignWarning, setAssignWarning] = useState<{ months: number; businessName: string } | null>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneDate, setCloneDate] = useState('');

  const { data: shift, isLoading, error } = useQuery({
    queryKey: ['shift', shiftId],
    queryFn: () => shiftsApi.get(shiftId!),
    enabled: !!shiftId,
  });

  const { data: workerData } = useQuery({
    queryKey: ['workers-search', workerSearch],
    queryFn: () => workersApi.list({ ...(workerSearch ? { search: workerSearch } : {}), status: 'active', limit: 20 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shift', shiftId] });

  const { data: applications } = useQuery({
    queryKey: ['shift-applications', shiftId],
    queryFn: () => shiftsApi.getApplications(shiftId!),
    enabled: !!shiftId,
  });

  const { data: offers, refetch: refetchOffers } = useQuery({
    queryKey: ['shift-offers', shiftId],
    queryFn: () => shiftsApi.getOffers(shiftId!),
    enabled: !!shiftId,
  });

  const sendOffersMutation = useMutation({
    mutationFn: () => shiftsApi.sendOffers(shiftId!, {
      workerIds: offerWorkers.map((w) => w._id),
      message: offerMessage || undefined,
      expiresInHours: offerExpiresHours,
    }),
    onSuccess: (data) => {
      setOfferResult(data.results);
      setOfferWorkers([]);
      setOfferMessage('');
      refetchOffers();
    },
  });

  const cancelOfferMutation = useMutation({
    mutationFn: (offerId: string) => shiftsApi.cancelOffer(shiftId!, offerId),
    onSuccess: () => refetchOffers(),
  });

  const approveMutation = useMutation({
    mutationFn: (appId: string) => shiftsApi.approveApplication(shiftId!, appId),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['shift-applications', shiftId] });
      queryClient.invalidateQueries({ queryKey: ['compliance-aueg'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (appId: string) => shiftsApi.rejectApplication(shiftId!, appId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shift-applications', shiftId] }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => shiftsApi.update(shiftId!, data as never),
    onSuccess: () => { invalidate(); setEditing(false); },
  });

  const assignMutation = useMutation({
    mutationFn: (workerId: string) => shiftsApi.assignWorker(shiftId!, workerId),
    onSuccess: (data) => {
      invalidate();
      setSelectedWorker(null);
      setWorkerSearch('');
      setAssignWarning(data.auegWarning ?? null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (workerId: string) => shiftsApi.removeWorker(shiftId!, workerId),
    onSuccess: invalidate,
  });

  const workerStatusMutation = useMutation({
    mutationFn: ({ workerId, status }: { workerId: string; status: WorkerAssignmentStatus }) =>
      shiftsApi.updateWorkerStatus(shiftId!, workerId, status),
    onSuccess: invalidate,
  });

  const createTimesheetsMutation = useMutation({
    mutationFn: () => shiftsApi.createTimesheets(shiftId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['shift-timesheets', shiftId] });
    },
  });

  const { data: shiftTimesheets } = useQuery({
    queryKey: ['shift-timesheets', shiftId],
    queryFn: () => timesheetsApi.list({ shiftId: shiftId!, limit: 100 }),
    enabled: !!shiftId && shift?.status === 'completed',
  });

  const cloneMutation = useMutation({
    mutationFn: (offsetDays: number) => shiftsApi.clone(shiftId!, offsetDays),
    onSuccess: (cloned) => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setCloneDialogOpen(false);
      navigate(`/app/shifts/${cloned._id}`);
    },
  });

  if (isLoading) return <CircularProgress />;
  if (error || !shift) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const startEdit = () => {
    setEditForm({
      title: shift.title,
      startTime: toLocalInput(shift.startTime),
      endTime: toLocalInput(shift.endTime),
      breakMinutes: shift.breakMinutes,
      requiredWorkers: shift.requiredWorkers,
      payRatePerHour: shift.payRatePerHour,
      billingRatePerHour: shift.billingRatePerHour ?? '',
      status: shift.status,
      notes: shift.notes ?? '',
    });
    setEditing(true);
  };

  const saveEdit = () => {
    const { startTime, endTime, billingRatePerHour, payRatePerHour, breakMinutes, requiredWorkers, ...rest } = editForm;
    updateMutation.mutate({
      ...rest,
      startTime: new Date(startTime as string).toISOString(),
      endTime: new Date(endTime as string).toISOString(),
      payRatePerHour: parseFloat(String(payRatePerHour)) || 0,
      breakMinutes: parseInt(String(breakMinutes)) || 0,
      requiredWorkers: parseInt(String(requiredWorkers)) || 1,
      billingRatePerHour: billingRatePerHour !== '' && billingRatePerHour != null
        ? parseFloat(String(billingRatePerHour))
        : undefined,
    });
  };

  const canEdit = shift.status !== 'completed' && shift.status !== 'cancelled';
  const totalAssigned = shift.assignedWorkers.length;

  const openCloneDialog = () => {
    const d = new Date(new Date(shift.startTime).getTime() + 7 * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    setCloneDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setCloneDialogOpen(true);
  };

  const handleCloneConfirm = () => {
    const sourceDate = new Date(shift.startTime);
    sourceDate.setHours(0, 0, 0, 0);
    const targetDate = new Date(cloneDate);
    targetDate.setHours(0, 0, 0, 0);
    const offsetDays = Math.round((targetDate.getTime() - sourceDate.getTime()) / 86_400_000);
    if (offsetDays < 1) return;
    cloneMutation.mutate(offsetDays);
  };
  const confirmed = shift.assignedWorkers.filter(
    (aw) => aw.status === 'confirmed' || aw.status === 'completed'
  ).length;

  return (
    <Box>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/shifts')} size="small">
            {t('common.back')}
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700}>{shift.title}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
              <Chip label={t(`shifts.statusLabel.${shift.status}`)} color={STATUS_COLOR[shift.status]} size="small" />
              <Typography variant="caption" color="text.secondary">{shift.businessName}</Typography>
              {shift.locationName && (
                <Typography variant="caption" color="text.secondary">· {shift.locationName}</Typography>
              )}
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={openCloneDialog}
          >
            {t('shifts.clone')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            color={templateSaved ? 'success' : 'inherit'}
            startIcon={<LayersIcon />}
            disabled={savingTemplate}
            onClick={async () => {
              setSavingTemplate(true);
              try {
                const start = new Date(shift.startTime);
                const end   = new Date(shift.endTime);
                const durationHours = Math.max(0.5, (end.getTime() - start.getTime()) / 3_600_000);
                await shiftTemplatesApi.create({
                  name: shift.title,
                  businessId: shift.businessId,
                  locationId: shift.locationId,
                  title: shift.title,
                  startHour: start.getHours(),
                  startMinute: start.getMinutes(),
                  durationHours,
                  breakMinutes: shift.breakMinutes,
                  requiredWorkers: shift.requiredWorkers,
                  payRatePerHour: shift.payRatePerHour,
                  billingRatePerHour: shift.billingRatePerHour,
                  notes: shift.notes,
                });
                setTemplateSaved(true);
                setTimeout(() => setTemplateSaved(false), 3000);
              } catch { /* ignore */ }
              finally { setSavingTemplate(false); }
            }}
          >
            {templateSaved ? t('shifts.savedAsTemplate') : t('shifts.saveAsTemplate')}
          </Button>
          {canEdit && (
            <>
              {editing ? (
                <>
                  <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={saveEdit} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? t('common.loading') : t('common.save')}
                  </Button>
                  <Button variant="outlined" size="small" startIcon={<CloseIcon />} onClick={() => setEditing(false)}>
                    {t('common.cancel')}
                  </Button>
                </>
              ) : (
                <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={startEdit}>
                  {t('common.edit')}
                </Button>
              )}
            </>
          )}
        </Stack>
      </Stack>

      {shift.status === 'completed' && shift.completedAt && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={600}>{t('shifts.shiftCompletedOn')}</Typography>
          <Typography variant="caption">
            {new Date(shift.completedAt).toLocaleString('de-DE', {
              weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </Typography>
        </Alert>
      )}

      {(() => {
        if (shift.status !== 'completed' || !shiftTimesheets) return null;
        const eligibleWorkers = shift.assignedWorkers.filter((a) => a.status !== 'no_show').length;
        const timesheetCount = shiftTimesheets.total;
        if (timesheetCount >= eligibleWorkers) return null;
        const missing = eligibleWorkers - timesheetCount;
        return (
          <Alert
            severity="warning"
            icon={<WarningAmberIcon />}
            sx={{ mb: 2 }}
            action={
              <Button
                size="small"
                color="warning"
                variant="outlined"
                disabled={createTimesheetsMutation.isPending}
                onClick={() => createTimesheetsMutation.mutate()}
              >
                {createTimesheetsMutation.isPending ? t('common.loading') : t('shifts.createMissingTimesheets')}
              </Button>
            }
          >
            <Typography variant="body2" fontWeight={600}>
              {t('shifts.missingTimesheets', { count: missing })}
            </Typography>
            <Typography variant="caption" display="block">
              {timesheetCount} von {eligibleWorkers} Stundennachweisen erstellt.
              Mitarbeiter mit Status „Nicht erschienen" werden übersprungen.
            </Typography>
          </Alert>
        );
      })()}

      {(updateMutation.isError || assignMutation.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {((updateMutation.error || assignMutation.error) as { response?: { data?: { message?: string } } })
            ?.response?.data?.message ?? t('common.error')}
        </Alert>
      )}

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label={t('shifts.tab.info')} />
          <Tab label={`${t('shifts.tab.workers')} (${confirmed}/${shift.requiredWorkers})`} />
          <Tab label={`${t('shifts.tab.applications')} (${(applications ?? []).filter((a) => a.status === 'pending').length})`} />
          <Tab label={`Angebote (${(offers ?? []).filter((o) => o.status === 'pending').length})`} icon={<LocalOfferIcon fontSize="small" />} iconPosition="start" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Info Tab */}
          <TabPanel value={tab} index={0}>
            {editing ? (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField label={t('shifts.title')} required fullWidth value={editForm.title ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>{t('shifts.status')}</InputLabel>
                    <Select value={editForm.status ?? ''} label={t('shifts.status')} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}>
                      {(['draft', 'published', 'completed', 'cancelled'] as ShiftStatus[]).map((s) => {
                        const disabledCompleted = s === 'completed' && new Date() < new Date(shift.startTime);
                        return (
                          <MenuItem key={s} value={s} disabled={disabledCompleted}>
                            {t(`shifts.statusLabel.${s}`)}
                            {disabledCompleted && (
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                ({t('shifts.notStartedYet')})
                              </Typography>
                            )}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label={t('shifts.startTime')} type="datetime-local" required fullWidth value={editForm.startTime ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, startTime: e.target.value }))} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label={t('shifts.endTime')} type="datetime-local" required fullWidth value={editForm.endTime ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, endTime: e.target.value }))} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField label={t('shifts.breakMinutes')} type="number" fullWidth value={editForm.breakMinutes ?? 0} onChange={(e) => setEditForm((p) => ({ ...p, breakMinutes: parseInt(e.target.value) || 0 }))} />
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField label={t('shifts.requiredWorkers')} type="number" fullWidth value={editForm.requiredWorkers ?? 1} onChange={(e) => setEditForm((p) => ({ ...p, requiredWorkers: parseInt(e.target.value) || 1 }))} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField label={t('shifts.payRate')} type="number" fullWidth value={editForm.payRatePerHour ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, payRatePerHour: parseFloat(e.target.value) || 0 }))} helperText={t('shifts.mindestlohnHint')} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField label={t('shifts.billingRate')} type="number" fullWidth value={editForm.billingRatePerHour ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, billingRatePerHour: e.target.value }))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label={t('shifts.notes')} fullWidth multiline rows={2} value={editForm.notes ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} />
                </Grid>
              </Grid>
            ) : (
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Zeitraum</Typography>
                  <Divider sx={{ mb: 1.5 }} />
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1}><Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>{t('shifts.startTime')}</Typography><Typography variant="body2">{fmtDateTime(shift.startTime)}</Typography></Stack>
                    <Stack direction="row" spacing={1}><Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>{t('shifts.endTime')}</Typography><Typography variant="body2">{fmtDateTime(shift.endTime)}</Typography></Stack>
                    <Stack direction="row" spacing={1}><Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>{t('shifts.breakMinutes')}</Typography><Typography variant="body2">{shift.breakMinutes} min</Typography></Stack>
                    <Stack direction="row" spacing={1}><Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>Nettostunden</Typography><Typography variant="body2" fontWeight={600}>{netHours(shift)} h</Typography></Stack>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Vergütung</Typography>
                  <Divider sx={{ mb: 1.5 }} />
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1}><Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>{t('shifts.payRate')}</Typography><Typography variant="body2">{shift.payRatePerHour.toFixed(2)} €/h</Typography></Stack>
                    {shift.billingRatePerHour && <Stack direction="row" spacing={1}><Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>{t('shifts.billingRate')}</Typography><Typography variant="body2">{shift.billingRatePerHour.toFixed(2)} €/h</Typography></Stack>}
                  </Stack>
                </Grid>
                {shift.notes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('shifts.notes')}</Typography>
                    <Divider sx={{ mb: 1.5 }} />
                    <Typography variant="body2">{shift.notes}</Typography>
                  </Grid>
                )}
              </Grid>
            )}
          </TabPanel>

          {/* Workers Tab */}
          <TabPanel value={tab} index={1}>
            {assignWarning && (
              <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }} onClose={() => setAssignWarning(null)}>
                <Typography variant="body2" fontWeight={600}>{t('compliance.auegWarningTitle')}</Typography>
                <Typography variant="body2">
                  {t('compliance.auegWarningDetail', {
                    months: assignWarning.months,
                    business: assignWarning.businessName,
                    max: 18,
                  })}
                </Typography>
              </Alert>
            )}
            {canEdit && totalAssigned < shift.requiredWorkers && (
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>{t('shifts.assignWorker')}</Typography>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Autocomplete
                    options={(workerData?.workers ?? []).filter(
                      (w) => !shift.assignedWorkers.some((a) => a.workerId === w._id)
                    )}
                    getOptionLabel={(w) => `${w.firstName} ${w.lastName}`}
                    value={selectedWorker}
                    onChange={(_, v) => setSelectedWorker(v)}
                    inputValue={workerSearch}
                    onInputChange={(_, v) => setWorkerSearch(v)}
                    sx={{ flex: 1 }}
                    renderInput={(params) => (
                      <TextField {...params} size="small" placeholder={t('shifts.searchWorker')} />
                    )}
                  />
                  <Button
                    variant="contained"
                    startIcon={<PersonAddIcon />}
                    disabled={!selectedWorker || assignMutation.isPending}
                    onClick={() => selectedWorker && assignMutation.mutate(selectedWorker._id)}
                  >
                    {assignMutation.isPending ? t('common.loading') : t('shifts.assignWorker')}
                  </Button>
                </Stack>
              </Paper>
            )}

            {shift.assignedWorkers.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('shifts.noWorkers')}</Typography>
            ) : (
              shift.assignedWorkers.map((a) => (
                <Paper key={a.workerId} variant="outlined" sx={{ p: 2, mb: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{a.workerName}</Typography>
                      <Stack direction="row" spacing={2} mt={0.25} flexWrap="wrap">
                        {a.checkInTime && (
                          <Typography variant="caption" color="success.main">
                            ✓ Ein: {new Date(a.checkInTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        )}
                        {a.checkOutTime && (
                          <Typography variant="caption" color="primary.main">
                            ✓ Aus: {new Date(a.checkOutTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        )}
                        {a.completedAt && (
                          <Typography variant="caption" color="text.secondary">
                            {t('shifts.completedAt')}: {new Date(a.completedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <Select
                          value={a.status}
                          onChange={(e) => workerStatusMutation.mutate({ workerId: a.workerId, status: e.target.value as WorkerAssignmentStatus })}
                          disabled={!canEdit}
                        >
                          {(['assigned', 'confirmed', 'completed', 'no_show'] as WorkerAssignmentStatus[]).map((s) => (
                            <MenuItem key={s} value={s}>
                              <Chip label={t(`shifts.workerStatusLabel.${s}`)} color={WORKER_STATUS_COLOR[s]} size="small" />
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {canEdit && (
                        <Tooltip title={t('shifts.removeWorker')}>
                          <IconButton size="small" onClick={() => removeMutation.mutate(a.workerId)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              ))
            )}
          </TabPanel>

          {/* Applications Tab */}
          <TabPanel value={tab} index={2}>
            {approveMutation.isSuccess && approveMutation.data?.auegWarning && (
              <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={600}>{t('compliance.auegWarningTitle')}</Typography>
                <Typography variant="body2">
                  {t('compliance.auegWarningDetail', {
                    months: approveMutation.data.auegWarning.months,
                    business: approveMutation.data.auegWarning.businessName,
                    max: 18,
                  })}
                </Typography>
              </Alert>
            )}
            {(approveMutation.isError || rejectMutation.isError) && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {((approveMutation.error || rejectMutation.error) as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')}
              </Alert>
            )}
            {!applications?.length ? (
              <Typography variant="body2" color="text.secondary">{t('shifts.noApplications')}</Typography>
            ) : (
              applications.map((app: ShiftApplicationItem) => (
                <Paper key={app._id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{app.workerName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('shifts.appliedOn')}: {new Date(app.appliedAt).toLocaleDateString('de-DE')}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label={t(`shifts.applicationStatus.${app.status}`)}
                        color={app.status === 'approved' ? 'success' : app.status === 'rejected' ? 'error' : 'warning'}
                      />
                      {app.status === 'pending' && (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(app._id)}
                          >
                            {t('shifts.approve')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={rejectMutation.isPending}
                            onClick={() => rejectMutation.mutate(app._id)}
                          >
                            {t('shifts.reject')}
                          </Button>
                        </>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              ))
            )}
          </TabPanel>

          {/* Offers Tab */}
          <TabPanel value={tab} index={3}>
            {/* Send offer form */}
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Angebot senden</Typography>
            <Stack spacing={2} mb={3}>
              <Autocomplete
                multiple
                options={workerData?.workers ?? []}
                getOptionLabel={(w) => `${w.firstName} ${w.lastName}`}
                value={offerWorkers}
                onChange={(_, val) => setOfferWorkers(val)}
                onInputChange={(_, val) => setWorkerSearch(val)}
                renderInput={(params) => (
                  <TextField {...params} label="Mitarbeiter auswählen" placeholder="Name suchen…" size="small" />
                )}
                isOptionEqualToValue={(a, b) => a._id === b._id}
                filterSelectedOptions
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Nachricht (optional)"
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  size="small"
                  fullWidth
                  inputProps={{ maxLength: 500 }}
                />
                <TextField
                  label="Ablauf (Stunden)"
                  type="number"
                  value={offerExpiresHours}
                  onChange={(e) => setOfferExpiresHours(Math.max(1, parseInt(e.target.value) || 24))}
                  size="small"
                  sx={{ width: 160, flexShrink: 0 }}
                  inputProps={{ min: 1, max: 168 }}
                />
              </Stack>
              {offerResult && (
                <Alert severity="info" onClose={() => setOfferResult(null)}>
                  {offerResult.map((r) => (
                    <Typography key={r.workerName} variant="caption" display="block">
                      {r.workerName}: {
                        r.status === 'sent' ? '✓ Gesendet' :
                        r.status === 'already_assigned' ? 'Bereits zugewiesen' :
                        r.status === 'already_offered' ? 'Angebot bereits vorhanden' :
                        r.status === 'schedule_conflict' ? '⚠ Zeitkonflikt – bereits in anderer Schicht eingeplant' :
                        r.status === 'worker_not_found' ? 'Nicht gefunden' : r.status
                      }
                    </Typography>
                  ))}
                </Alert>
              )}
              <Box>
                <Button
                  variant="contained"
                  startIcon={<LocalOfferIcon />}
                  disabled={offerWorkers.length === 0 || sendOffersMutation.isPending}
                  onClick={() => { setOfferResult(null); sendOffersMutation.mutate(); }}
                >
                  {sendOffersMutation.isPending ? 'Wird gesendet…' : `Angebot senden (${offerWorkers.length})`}
                </Button>
              </Box>
            </Stack>

            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Gesendete Angebote ({(offers ?? []).length})
            </Typography>

            {!offers?.length ? (
              <Typography variant="body2" color="text.secondary">
                Noch keine Angebote für diese Schicht gesendet.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {(offers as ShiftOfferItem[]).map((offer) => {
                  const isPending = offer.status === 'pending' && new Date(offer.expiresAt) > new Date();
                  return (
                    <Paper key={offer._id} variant="outlined" sx={{ p: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{offer.workerName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Gesendet: {new Date(offer.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            {' · '}
                            Ablauf: {new Date(offer.expiresAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                          {offer.responseNote && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: 'italic' }}>
                              Grund: „{offer.responseNote}"
                            </Typography>
                          )}
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            size="small"
                            label={
                              offer.status === 'pending' && new Date(offer.expiresAt) < new Date() ? 'Abgelaufen' :
                              ({ pending: 'Ausstehend', accepted: 'Angenommen', declined: 'Abgelehnt', cancelled: 'Widerrufen', expired: 'Abgelaufen' } as const)[offer.status]
                            }
                            color={
                              offer.status === 'accepted' ? 'success' :
                              offer.status === 'declined' ? 'error' :
                              offer.status === 'pending' ? 'warning' : 'default'
                            }
                          />
                          {isPending && (
                            <Tooltip title="Angebot zurückziehen">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => cancelOfferMutation.mutate(offer._id)}
                                disabled={cancelOfferMutation.isPending}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </TabPanel>
        </Box>
      </Paper>

      {/* Clone Shift Dialog */}
      <Dialog open={cloneDialogOpen} onClose={() => setCloneDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('shifts.cloneTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t('shifts.cloneDesc')}
          </Typography>
          <TextField
            label={t('shifts.cloneNewDate')}
            type="date"
            fullWidth
            value={cloneDate}
            onChange={(e) => setCloneDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date().toISOString().slice(0, 10) }}
          />
          {cloneMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(cloneMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloneDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            startIcon={<ContentCopyIcon />}
            disabled={!cloneDate || cloneMutation.isPending}
            onClick={handleCloneConfirm}
          >
            {cloneMutation.isPending ? t('common.loading') : t('shifts.cloneConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
