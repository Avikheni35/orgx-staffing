import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workersApi, CreateWorkerData } from '../../../api/workers';

const SKILL_SUGGESTIONS = [
  'Kellner', 'Küchenhilfe', 'Barkeeper', 'Koch', 'Lagerhelfer', 'Fahrer',
  'Verkäufer', 'Reinigungskraft', 'Eventhelfer', 'Promoter', 'Kassierer',
  'Sicherheit', 'Bürokraft', 'Kommissionierer', 'Verpackung',
];
const LANGUAGE_OPTIONS = ['Deutsch', 'Englisch', 'Türkisch', 'Arabisch', 'Russisch', 'Polnisch', 'Rumänisch', 'Bulgarisch'];
const STEUERKLASSEN = ['1', '2', '3', '4', '5', '6'];

type EditForm = CreateWorkerData;

export default function WorkerEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workerId } = useParams<{ workerId: string }>();
  const queryClient = useQueryClient();

  const { data: worker, isLoading, error } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => workersApi.get(workerId!),
    enabled: !!workerId,
  });

  const [form, setForm] = useState<EditForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    nationality: '',
    gender: undefined,
    address: { street: '', city: '', postalCode: '', country: 'DE' },
    skills: [],
    languages: [],
    steuerklasse: undefined,
    healthInsuranceProvider: '',
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!worker) return;
    setForm({
      firstName: worker.firstName,
      lastName: worker.lastName,
      email: worker.email,
      phone: worker.phone ?? '',
      nationality: worker.nationality ?? '',
      gender: worker.gender as EditForm['gender'],
      dateOfBirth: worker.dateOfBirth,
      address: {
        street: worker.address?.street ?? '',
        city: worker.address?.city ?? '',
        postalCode: worker.address?.postalCode ?? '',
        country: worker.address?.country ?? 'DE',
      },
      skills: worker.skills ?? [],
      languages: worker.languages ?? [],
      steuerklasse: worker.steuerklasse,
      healthInsuranceProvider: worker.healthInsuranceProvider ?? '',
    });
  }, [worker]);

  const mutation = useMutation({
    mutationFn: (data: Partial<CreateWorkerData>) => workersApi.update(workerId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker', workerId] });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      navigate(`/app/workers/${workerId}`);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setFormError(err.response?.data?.message ?? t('common.saveError'));
    },
  });

  const set = (field: keyof EditForm, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const setAddr = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, address: { ...prev.address, [field]: value } }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError(t('workers.validation.required'));
      return;
    }
    mutation.mutate(form);
  };

  if (isLoading) return <CircularProgress />;
  if (error || !worker) return <Alert severity="error">{t('workers.notFound')}</Alert>;

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/app/workers/${workerId}`)}
          size="small"
        >
          {t('common.back')}
        </Button>
        <Typography variant="h5" fontWeight={700} sx={{ ml: 1 }}>
          {worker.firstName} {worker.lastName} – {t('common.edit')}
        </Typography>
      </Stack>

      {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

      {/* Personal Data */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t('workers.section.personal')}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6}>
          <TextField
            label={t('workers.firstName')}
            required
            fullWidth
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label={t('workers.lastName')}
            required
            fullWidth
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label={t('workers.email')}
            type="email"
            fullWidth
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            helperText={
              form.email !== worker.email
                ? 'Ändert auch die Login-E-Mail des Worker-Portals'
                : 'Betrifft auch den Portal-Login'
            }
            color={form.email !== worker.email ? 'warning' : undefined}
            focused={form.email !== worker.email ? true : undefined}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label={t('workers.phone')}
            fullWidth
            value={form.phone ?? ''}
            onChange={(e) => set('phone', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label={t('workers.dateOfBirth')}
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={form.dateOfBirth ?? ''}
            onChange={(e) => set('dateOfBirth', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth>
            <InputLabel>{t('workers.gender')}</InputLabel>
            <Select
              value={form.gender ?? ''}
              label={t('workers.gender')}
              onChange={(e) => set('gender', e.target.value || undefined)}
            >
              <MenuItem value="">{t('common.notSpecified')}</MenuItem>
              <MenuItem value="male">{t('workers.genderMale')}</MenuItem>
              <MenuItem value="female">{t('workers.genderFemale')}</MenuItem>
              <MenuItem value="diverse">{t('workers.genderDiverse')}</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label={t('workers.nationality')}
            fullWidth
            value={form.nationality ?? ''}
            onChange={(e) => set('nationality', e.target.value)}
          />
        </Grid>
      </Grid>

      {/* Address */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t('workers.section.address')}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12}>
          <TextField
            label={t('workers.street')}
            fullWidth
            value={form.address?.street ?? ''}
            onChange={(e) => setAddr('street', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label={t('workers.postalCode')}
            fullWidth
            value={form.address?.postalCode ?? ''}
            onChange={(e) => setAddr('postalCode', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={8}>
          <TextField
            label={t('workers.city')}
            fullWidth
            value={form.address?.city ?? ''}
            onChange={(e) => setAddr('city', e.target.value)}
          />
        </Grid>
      </Grid>

      {/* Skills & Languages */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t('workers.section.skills')}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12}>
          <Autocomplete
            multiple
            freeSolo
            options={SKILL_SUGGESTIONS}
            value={form.skills ?? []}
            onChange={(_, val) => set('skills', val)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                return <Chip key={key} label={option} size="small" {...tagProps} />;
              })
            }
            renderInput={(params) => (
              <TextField {...params} label={t('workers.skills')} placeholder={t('workers.skillsHint')} />
            )}
          />
        </Grid>
        <Grid item xs={12}>
          <Autocomplete
            multiple
            options={LANGUAGE_OPTIONS}
            value={(form.languages ?? []).map((l) => l.language)}
            onChange={(_, langs) =>
              set(
                'languages',
                langs.map((lang) => {
                  const existing = (form.languages ?? []).find((l) => l.language === lang);
                  return existing ?? { language: lang, level: 'conversational' };
                })
              )
            }
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const entry = (form.languages ?? []).find((l) => l.language === option);
                const { key, ...tagProps } = getTagProps({ index });
                return (
                  <Chip
                    key={key}
                    label={`${option} (${t(`workers.langLevel.${entry?.level ?? 'conversational'}`)})`}
                    size="small"
                    {...tagProps}
                  />
                );
              })
            }
            renderInput={(params) => <TextField {...params} label={t('workers.languages')} />}
          />
        </Grid>
      </Grid>

      {/* Tax */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t('workers.section.tax')}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth>
            <InputLabel>{t('workers.steuerklasse')}</InputLabel>
            <Select
              value={form.steuerklasse ?? ''}
              label={t('workers.steuerklasse')}
              onChange={(e) => set('steuerklasse', e.target.value || undefined)}
            >
              <MenuItem value="">{t('common.notSpecified')}</MenuItem>
              {STEUERKLASSEN.map((sk) => (
                <MenuItem key={sk} value={sk}>
                  {t('workers.steuerklasseLabel', { number: sk })}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={8}>
          <TextField
            label={t('workers.healthInsurance')}
            fullWidth
            value={form.healthInsuranceProvider ?? ''}
            onChange={(e) => set('healthInsuranceProvider', e.target.value)}
            placeholder="z.B. AOK, TK, Barmer"
          />
        </Grid>
      </Grid>

      {/* Actions */}
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={() => navigate(`/app/workers/${workerId}`)} disabled={mutation.isPending}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? t('common.loading') : t('common.save')}
        </Button>
      </Stack>
    </Box>
  );
}
