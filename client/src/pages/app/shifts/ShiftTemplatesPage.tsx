import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, CardActions, Chip,
  CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, Grid, IconButton, InputLabel, MenuItem,
  Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { shiftTemplatesApi, CreateTemplateData } from '../../../api/shiftTemplates';
import { businessesApi, Business } from '../../../api/businesses';

const MINDESTLOHN = 12.82;

function pad2(n: number) { return String(n).padStart(2, '0'); }

const EMPTY_FORM: CreateTemplateData = {
  name: '', businessId: '', locationId: '', title: '',
  startHour: 8, startMinute: 0, durationHours: 8,
  breakMinutes: 30, requiredWorkers: 1,
  payRatePerHour: MINDESTLOHN, billingRatePerHour: undefined, notes: '',
};

export default function ShiftTemplatesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen]   = useState(false);
  const [useOpen, setUseOpen]         = useState<string | null>(null); // templateId
  const [useDate, setUseDate]         = useState(new Date().toISOString().slice(0, 10));
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [form, setForm]               = useState<CreateTemplateData>(EMPTY_FORM);
  const [err, setErr]                 = useState('');
  const [useErr, setUseErr]           = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['shift-templates'],
    queryFn: shiftTemplatesApi.list,
  });

  const { data: bizData } = useQuery({
    queryKey: ['businesses-all'],
    queryFn: () => businessesApi.list({ limit: 200 }),
  });

  const selectedBiz: Business | undefined = bizData?.businesses.find((b) => b._id === form.businessId);

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const createMut = useMutation({
    mutationFn: () => {
      const payload: CreateTemplateData = {
        ...form,
        locationId: form.locationId || undefined,
        billingRatePerHour: form.billingRatePerHour || undefined,
        notes: form.notes || undefined,
      };
      return shiftTemplatesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-templates'] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setErr('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(msg ?? t('common.error'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => shiftTemplatesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shift-templates'] }); setDeleteId(null); },
  });

  const useMut = useMutation({
    mutationFn: () => shiftTemplatesApi.use(useOpen!, useDate),
    onSuccess: (shift: { _id: string }) => {
      setUseOpen(null);
      navigate(`/app/shifts/${shift._id}`);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setUseErr(msg ?? t('common.error'));
    },
  });

  const templates = data?.templates ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate('/app/shifts')}>
            {t('common.back')}
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700}>{t('shiftTemplates.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('shiftTemplates.subtitle')}</Typography>
          </Box>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setErr(''); setCreateOpen(true); }}>
          {t('shiftTemplates.create')}
        </Button>
      </Stack>

      {isLoading && <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>}

      {!isLoading && templates.length === 0 && (
        <Alert severity="info">{t('shiftTemplates.empty')}</Alert>
      )}

      <Grid container spacing={2}>
        {templates.map((tpl) => (
          <Grid item xs={12} sm={6} md={4} key={tpl._id}>
            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Typography variant="subtitle1" fontWeight={700}>{tpl.name}</Typography>
                  <Chip label={tpl.businessName} size="small" variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary" gutterBottom>{tpl.title}</Typography>
                <Divider sx={{ my: 1 }} />
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Chip size="small" label={`${pad2(tpl.startHour)}:${pad2(tpl.startMinute)} Uhr`} />
                  <Chip size="small" label={`${tpl.durationHours} Std.`} />
                  <Chip size="small" label={`Pause ${tpl.breakMinutes} Min.`} />
                  <Chip size="small" label={`${tpl.requiredWorkers} MA`} />
                  <Chip size="small" label={`€${tpl.payRatePerHour}/h`} color="primary" variant="outlined" />
                </Stack>
                {tpl.locationName && (
                  <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                    {tpl.locationName}
                  </Typography>
                )}
              </CardContent>
              <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                <Tooltip title={t('shiftTemplates.useTemplate')}>
                  <IconButton size="small" color="primary" onClick={() => { setUseErr(''); setUseDate(new Date().toISOString().slice(0, 10)); setUseOpen(tpl._id); }}>
                    <CalendarTodayIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('common.delete')}>
                  <IconButton size="small" color="error" onClick={() => setDeleteId(tpl._id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('shiftTemplates.create')}</DialogTitle>
        <DialogContent>
          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField label={t('shiftTemplates.templateName')} required fullWidth size="small"
                value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" required>
                <InputLabel>{t('shifts.business')}</InputLabel>
                <Select value={form.businessId} label={t('shifts.business')}
                  onChange={(e) => { set('businessId', e.target.value); set('locationId', ''); }}>
                  {bizData?.businesses.map((b) => <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            {selectedBiz && selectedBiz.locations.length > 0 && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('shifts.location')}</InputLabel>
                  <Select value={form.locationId} label={t('shifts.location')} onChange={(e) => set('locationId', e.target.value)}>
                    <MenuItem value=""><em>—</em></MenuItem>
                    {selectedBiz.locations.map((l) => <MenuItem key={l._id} value={l._id}>{l.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField label={t('shifts.title')} required fullWidth size="small"
                value={form.title} onChange={(e) => set('title', e.target.value)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label={t('shiftTemplates.startHour')} type="number" fullWidth size="small"
                inputProps={{ min: 0, max: 23 }} value={form.startHour}
                onChange={(e) => set('startHour', parseInt(e.target.value) || 0)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label={t('shiftTemplates.startMinute')} type="number" fullWidth size="small"
                inputProps={{ min: 0, max: 59, step: 15 }} value={form.startMinute}
                onChange={(e) => set('startMinute', parseInt(e.target.value) || 0)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label={t('shiftTemplates.durationHours')} type="number" fullWidth size="small"
                inputProps={{ min: 0.5, max: 24, step: 0.5 }} value={form.durationHours}
                onChange={(e) => set('durationHours', parseFloat(e.target.value) || 0)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label={t('shifts.breakMinutes')} type="number" fullWidth size="small"
                inputProps={{ min: 0, step: 5 }} value={form.breakMinutes}
                onChange={(e) => set('breakMinutes', parseInt(e.target.value) || 0)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label={t('shifts.requiredWorkers')} type="number" fullWidth size="small"
                inputProps={{ min: 1 }} value={form.requiredWorkers}
                onChange={(e) => set('requiredWorkers', parseInt(e.target.value) || 1)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label={t('shifts.payRate')} type="number" fullWidth size="small"
                inputProps={{ min: MINDESTLOHN, step: 0.01 }} value={form.payRatePerHour}
                onChange={(e) => set('payRatePerHour', parseFloat(e.target.value) || 0)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label={t('shifts.billingRate')} type="number" fullWidth size="small"
                inputProps={{ min: 0, step: 0.01 }} value={form.billingRatePerHour ?? ''}
                onChange={(e) => set('billingRatePerHour', parseFloat(e.target.value) || undefined)} />
            </Grid>
            <Grid item xs={12}>
              <TextField label={t('shifts.notes')} fullWidth size="small" multiline rows={2}
                value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" disabled={createMut.isPending} onClick={() => createMut.mutate()}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Use template dialog */}
      <Dialog open={!!useOpen} onClose={() => setUseOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <ContentCopyIcon fontSize="small" />
            {t('shiftTemplates.useTemplate')}
          </Stack>
        </DialogTitle>
        <DialogContent>
          {useErr && <Alert severity="error" sx={{ mb: 2 }}>{useErr}</Alert>}
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t('shiftTemplates.useTemplateHint')}
          </Typography>
          <TextField label={t('shiftTemplates.shiftDate')} type="date" fullWidth
            value={useDate} InputLabelProps={{ shrink: true }}
            onChange={(e) => setUseDate(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUseOpen(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" disabled={useMut.isPending || !useDate} onClick={() => useMut.mutate()}>
            {t('shiftTemplates.createShift')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs">
        <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
        <DialogContent>
          <Typography>{t('shiftTemplates.deleteConfirm')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" disabled={deleteMut.isPending}
            onClick={() => deleteId && deleteMut.mutate(deleteId)}>
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
