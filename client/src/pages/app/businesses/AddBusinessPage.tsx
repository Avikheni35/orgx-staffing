import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { businessesApi, CreateBusinessData } from '../../../api/businesses';

export default function AddBusinessPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateBusinessData & { street?: string; city?: string; postalCode?: string; country?: string }>({
    name: '',
    industry: '',
    vatNumber: '',
    hrbNumber: '',
    street: '',
    city: '',
    postalCode: '',
    country: 'DE',
    defaultBillingRatePerHour: undefined,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field: string, value: string | number | undefined) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t('businesses.validation.required')); return; }
    setError('');
    setLoading(true);
    try {
      const payload: CreateBusinessData = {
        name: form.name.trim(),
        industry: form.industry || undefined,
        vatNumber: form.vatNumber || undefined,
        hrbNumber: form.hrbNumber || undefined,
        address: {
          street: form.street || undefined,
          city: form.city || undefined,
          postalCode: form.postalCode || undefined,
          country: form.country || 'DE',
        },
        defaultBillingRatePerHour: form.defaultBillingRatePerHour || undefined,
        notes: form.notes || undefined,
      };
      const created = await businessesApi.create(payload);
      navigate(`/app/businesses/${created._id}`, { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/businesses')} size="small">
          {t('common.back')}
        </Button>
        <Typography variant="h5" fontWeight={700}>
          {t('businesses.addBusiness')}
        </Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t('businesses.section.general')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label={t('businesses.name')}
              required
              fullWidth
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label={t('businesses.industry')}
              fullWidth
              value={form.industry}
              onChange={(e) => set('industry', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label={t('businesses.vatNumber')}
              fullWidth
              value={form.vatNumber}
              onChange={(e) => set('vatNumber', e.target.value)}
              placeholder="DE123456789"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label={t('businesses.hrbNumber')}
              fullWidth
              value={form.hrbNumber}
              onChange={(e) => set('hrbNumber', e.target.value)}
            />
          </Grid>
        </Grid>

        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 3 }}>
          {t('businesses.section.address')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label={t('businesses.location.street')}
              fullWidth
              value={form.street}
              onChange={(e) => set('street', e.target.value)}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              label={t('businesses.location.postalCode')}
              fullWidth
              value={form.postalCode}
              onChange={(e) => set('postalCode', e.target.value)}
            />
          </Grid>
          <Grid item xs={8}>
            <TextField
              label={t('businesses.location.city')}
              fullWidth
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label={t('businesses.location.country')}
              fullWidth
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
            />
          </Grid>
        </Grid>

        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 3 }}>
          {t('businesses.section.billing')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              label={t('businesses.defaultBillingRate')}
              fullWidth
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={form.defaultBillingRatePerHour ?? ''}
              onChange={(e) => set('defaultBillingRatePerHour', e.target.value ? parseFloat(e.target.value) : undefined)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label={t('businesses.notes')}
              fullWidth
              multiline
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Grid>
        </Grid>

        <Stack direction="row" justifyContent="flex-end" mt={3}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
          >
            {loading ? t('common.loading') : t('businesses.save')}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
