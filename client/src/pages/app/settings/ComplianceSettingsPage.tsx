import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { ControllerRenderProps } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  Paper,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { settingsApi } from '../../../api/settings';

interface FormValues {
  auegWarnMonths: number;
  auegBlockMonths: number;
  minRestHoursBetweenShifts: number;
  mindestlohnOverride: string;
  require2FA: boolean;
}

export default function ComplianceSettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['agency-settings'],
    queryFn: settingsApi.getAgency,
  });

  const { control, register, reset, handleSubmit, watch, formState: { isDirty, errors } } = useForm<FormValues>({
    defaultValues: {
      auegWarnMonths: 9,
      auegBlockMonths: 18,
      minRestHoursBetweenShifts: 11,
      mindestlohnOverride: '',
      require2FA: true,
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        auegWarnMonths: data.complianceSettings.auegWarnMonths,
        auegBlockMonths: data.complianceSettings.auegBlockMonths,
        minRestHoursBetweenShifts: data.complianceSettings.minRestHoursBetweenShifts,
        mindestlohnOverride: data.complianceSettings.mindestlohnOverride?.toString() ?? '',
        require2FA: data.securitySettings?.require2FA ?? true,
      });
    }
  }, [data, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const override = parseFloat(values.mindestlohnOverride);
      return settingsApi.updateAgency({
        complianceSettings: {
          auegWarnMonths: values.auegWarnMonths,
          auegBlockMonths: values.auegBlockMonths,
          minRestHoursBetweenShifts: values.minRestHoursBetweenShifts,
          mindestlohnOverride: isNaN(override) ? null : override,
        },
        securitySettings: { require2FA: values.require2FA },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agency-settings'] }),
  });

  if (isLoading) return <CircularProgress />;

  const warnMonths = watch('auegWarnMonths');
  const blockMonths = watch('auegBlockMonths');

  const renderSlider = (field: ControllerRenderProps<FormValues, 'auegWarnMonths'> | ControllerRenderProps<FormValues, 'auegBlockMonths'>, min: number, max: number, marks: { value: number; label: string }[], color: 'warning' | 'error') => (
    <Slider
      value={field.value as number}
      onChange={(_, v) => field.onChange(v)}
      min={min} max={max} step={1}
      marks={marks}
      valueLabelDisplay="auto"
      color={color}
    />
  );

  return (
    <Box maxWidth={680}>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('settings.compliance.title')}</Typography>

      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
        <Stack spacing={3}>

          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>{t('settings.compliance.aueg')}</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>{t('settings.compliance.auegHint')}</Typography>
            <Stack spacing={3}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  {t('settings.compliance.warnAt')}: <strong>{warnMonths} {t('settings.compliance.months')}</strong>
                </Typography>
                <Controller
                  name="auegWarnMonths"
                  control={control}
                  render={({ field }) => renderSlider(field, 1, 17, [{value:9,label:'9'},{value:12,label:'12'},{value:15,label:'15'}], 'warning')}
                />
              </Box>
              <Box>
                <Typography variant="body2" gutterBottom>
                  {t('settings.compliance.blockAt')}: <strong>{blockMonths} {t('settings.compliance.months')}</strong>
                </Typography>
                <Controller
                  name="auegBlockMonths"
                  control={control}
                  render={({ field }) => renderSlider(field, warnMonths + 1, 24, [{value:18,label:'18 (§ AÜG)'},{value:24,label:'24'}], 'error')}
                />
              </Box>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>{t('settings.compliance.arbzg')}</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>{t('settings.compliance.arbzgHint')}</Typography>
            <Controller
              name="minRestHoursBetweenShifts"
              control={control}
              render={({ field }) => (
                <TextField
                  value={field.value}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  type="number"
                  label={t('settings.compliance.restHours')}
                  inputProps={{ min: 0, max: 24, step: 0.5 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }}
                  size="small"
                  sx={{ width: 200 }}
                />
              )}
            />
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>{t('settings.compliance.milog')}</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>{t('settings.compliance.milogHint')}</Typography>
            <TextField
              {...register('mindestlohnOverride', {
                validate: (v) => !v || !isNaN(parseFloat(v)) || 'Ungültige Zahl',
              })}
              type="number"
              label={t('settings.compliance.mindestlohnOverride')}
              placeholder="12.82"
              error={!!errors.mindestlohnOverride}
              helperText={errors.mindestlohnOverride?.message}
              inputProps={{ step: 0.01, min: 0 }}
              InputProps={{ startAdornment: <InputAdornment position="start">€</InputAdornment> }}
              size="small"
              sx={{ width: 200 }}
            />
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>{t('settings.compliance.security')}</Typography>
            <Controller
              name="require2FA"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value as boolean} onChange={(e) => field.onChange(e.target.checked)} />}
                  label={t('settings.compliance.require2FA')}
                />
              )}
            />
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              {t('settings.compliance.require2FAHint')}
            </Typography>
          </Paper>

          {saveMutation.isError && <Alert severity="error">{t('common.error')}</Alert>}
          {saveMutation.isSuccess && <Alert severity="success">{t('common.saved')}</Alert>}

          <Box>
            <Button type="submit" variant="contained" disabled={!isDirty || saveMutation.isPending}>
              {saveMutation.isPending ? <CircularProgress size={20} /> : t('common.save')}
            </Button>
          </Box>
        </Stack>
      </form>
    </Box>
  );
}
