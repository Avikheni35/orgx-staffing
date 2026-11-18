import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LayersIcon from '@mui/icons-material/Layers';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { businessesApi, Business } from '../../../api/businesses';
import { shiftsApi, CreateShiftData, Shift } from '../../../api/shifts';
import { shiftTemplatesApi } from '../../../api/shiftTemplates';

const MINDESTLOHN = 12.82;

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AddShiftPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(16, 0, 0, 0);

  const [form, setForm] = useState({
    businessId: '',
    locationId: '',
    title: '',
    startTime: toLocalDateTimeInput(tomorrow),
    endTime: toLocalDateTimeInput(tomorrowEnd),
    breakMinutes: 30,
    requiredWorkers: 1,
    payRatePerHour: MINDESTLOHN,
    billingRatePerHour: '',
    status: 'draft' as const,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly'>('none');
  const [repeatCount, setRepeatCount] = useState(5);
  const [repeatCreated, setRepeatCreated] = useState(0);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const { data: bizData } = useQuery({
    queryKey: ['businesses-all'],
    queryFn: () => businessesApi.list({ limit: 200 }),
  });

  const selectedBusiness: Business | undefined = bizData?.businesses.find(
    (b) => b._id === form.businessId
  );

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessId || !form.title || !form.startTime || !form.endTime) {
      setError(t('shifts.validation.required'));
      return;
    }
    const start = new Date(form.startTime);
    const end = new Date(form.endTime);
    if (end <= start) { setError(t('shifts.validation.endAfterStart')); return; }
    if (form.payRatePerHour < MINDESTLOHN) { setError(t('shifts.validation.mindestlohn')); return; }

    setError('');
    setLoading(true);
    setRepeatCreated(0);
    try {
      const payload: CreateShiftData & { repeat?: { type: 'daily' | 'weekly'; count: number } } = {
        businessId: form.businessId,
        locationId: form.locationId || undefined,
        title: form.title,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        breakMinutes: form.breakMinutes,
        requiredWorkers: form.requiredWorkers,
        payRatePerHour: form.payRatePerHour,
        billingRatePerHour: form.billingRatePerHour ? parseFloat(String(form.billingRatePerHour)) : undefined,
        status: form.status,
        notes: form.notes || undefined,
      };

      if (repeat !== 'none') {
        payload.repeat = { type: repeat, count: repeatCount };
        const result = await shiftsApi.create(payload) as unknown as { shifts: Shift[]; count: number };
        setRepeatCreated(result.count);
        setTimeout(() => navigate('/app/shifts'), 2000);
      } else {
        const created = await shiftsApi.create(payload);
        navigate(`/app/shifts/${(created as Shift)._id}`, { replace: true });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!form.businessId || !form.title || !form.startTime) return;
    const start = new Date(form.startTime);
    const end = new Date(form.endTime);
    const durationHours = Math.max(0.5, (end.getTime() - start.getTime()) / 3_600_000);
    setSavingTemplate(true);
    try {
      await shiftTemplatesApi.create({
        name: form.title,
        businessId: form.businessId,
        locationId: form.locationId || undefined,
        title: form.title,
        startHour: start.getHours(),
        startMinute: start.getMinutes(),
        durationHours,
        breakMinutes: form.breakMinutes,
        requiredWorkers: form.requiredWorkers,
        payRatePerHour: form.payRatePerHour,
        billingRatePerHour: form.billingRatePerHour ? parseFloat(String(form.billingRatePerHour)) : undefined,
        notes: form.notes || undefined,
      });
      setError('');
    } catch {
      /* ignore */
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/shifts')} size="small">
          {t('common.back')}
        </Button>
        <Typography variant="h5" fontWeight={700}>{t('shifts.addShift')}</Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t('shifts.business')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth required>
              <InputLabel>{t('shifts.business')}</InputLabel>
              <Select
                value={form.businessId}
                label={t('shifts.business')}
                onChange={(e) => { set('businessId', e.target.value); set('locationId', ''); }}
              >
                {bizData?.businesses.map((b) => (
                  <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          {selectedBusiness && selectedBusiness.locations.length > 0 && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{t('shifts.location')}</InputLabel>
                <Select
                  value={form.locationId}
                  label={t('shifts.location')}
                  onChange={(e) => set('locationId', e.target.value)}
                >
                  <MenuItem value=""><em>—</em></MenuItem>
                  {selectedBusiness.locations.map((l) => (
                    <MenuItem key={l._id} value={l._id}>{l.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid item xs={12} md={6}>
            <TextField
              label={t('shifts.title')}
              required
              fullWidth
              placeholder="z. B. Lagerhelfer, Verkäufer"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>{t('shifts.status')}</InputLabel>
              <Select value={form.status} label={t('shifts.status')} onChange={(e) => set('status', e.target.value)}>
                <MenuItem value="draft">{t('shifts.statusLabel.draft')}</MenuItem>
                <MenuItem value="published">{t('shifts.statusLabel.published')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 3 }}>
          {t('shifts.date')} & {t('shifts.startTime')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              label={t('shifts.startTime')}
              type="datetime-local"
              required
              fullWidth
              value={form.startTime}
              onChange={(e) => set('startTime', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label={t('shifts.endTime')}
              type="datetime-local"
              required
              fullWidth
              value={form.endTime}
              onChange={(e) => set('endTime', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              label={t('shifts.breakMinutes')}
              type="number"
              fullWidth
              inputProps={{ min: 0, step: 5 }}
              value={form.breakMinutes}
              onChange={(e) => set('breakMinutes', parseInt(e.target.value) || 0)}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              label={t('shifts.requiredWorkers')}
              type="number"
              fullWidth
              inputProps={{ min: 1 }}
              value={form.requiredWorkers}
              onChange={(e) => set('requiredWorkers', parseInt(e.target.value) || 1)}
            />
          </Grid>
        </Grid>

        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 3 }}>
          {t('shifts.compensation')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              label={t('shifts.payRate')}
              type="number"
              required
              fullWidth
              inputProps={{ min: MINDESTLOHN, step: 0.01 }}
              value={form.payRatePerHour}
              onChange={(e) => set('payRatePerHour', parseFloat(e.target.value) || 0)}
              helperText={t('shifts.mindestlohnHint')}
              error={form.payRatePerHour > 0 && form.payRatePerHour < MINDESTLOHN}
            />
            {form.payRatePerHour > 0 && form.payRatePerHour < MINDESTLOHN && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {t('shifts.validation.mindestlohn')}
              </Alert>
            )}
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label={t('shifts.billingRate')}
              type="number"
              fullWidth
              inputProps={{ min: 0, step: 0.01 }}
              value={form.billingRatePerHour}
              onChange={(e) => set('billingRatePerHour', parseFloat(e.target.value) || '')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label={t('shifts.notes')}
              fullWidth
              multiline
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Grid>
        </Grid>

        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 3 }}>
          {t('shifts.repeat.label')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <RadioGroup row value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)}>
          <FormControlLabel value="none"   control={<Radio size="small" />} label={t('shifts.repeat.none')} />
          <FormControlLabel value="daily"  control={<Radio size="small" />} label={t('shifts.repeat.daily')} />
          <FormControlLabel value="weekly" control={<Radio size="small" />} label={t('shifts.repeat.weekly')} />
        </RadioGroup>
        {repeat !== 'none' && (
          <Stack direction="row" alignItems="center" gap={2} mt={1}>
            <TextField
              label={t('shifts.repeat.count')}
              type="number"
              size="small"
              sx={{ width: 160 }}
              inputProps={{ min: 2, max: 52 }}
              value={repeatCount}
              onChange={(e) => setRepeatCount(parseInt(e.target.value) || 2)}
            />
            <Typography variant="caption" color="text.secondary">
              {repeat === 'weekly'
                ? t('shifts.repeat.hintWeekly', { count: repeatCount })
                : t('shifts.repeat.hint', { count: repeatCount })}
            </Typography>
          </Stack>
        )}

        {repeatCreated > 0 && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {t('shifts.repeat.created', { count: repeatCreated })}
          </Alert>
        )}

        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={3}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<LayersIcon />}
            disabled={!form.businessId || !form.title || savingTemplate}
            onClick={handleSaveAsTemplate}
          >
            {savingTemplate ? t('common.loading') : t('shifts.saveAsTemplate')}
          </Button>
          <Button type="submit" variant="contained" size="large" disabled={loading}>
            {loading ? t('common.loading') : t('shifts.save')}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
