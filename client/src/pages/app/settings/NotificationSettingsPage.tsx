import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { settingsApi } from '../../../api/settings';

interface FormValues {
  email: boolean;
  sms: boolean;
  push: boolean;
}

export default function NotificationSettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['profile-settings'],
    queryFn: settingsApi.getProfile,
  });

  const { control, reset, handleSubmit, formState: { isDirty } } = useForm<FormValues>({
    defaultValues: { email: true, sms: false, push: false },
  });

  useEffect(() => {
    if (data?.notificationPreferences) {
      reset({
        email: data.notificationPreferences.email,
        sms: data.notificationPreferences.sms,
        push: data.notificationPreferences.push,
      });
    }
  }, [data, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      settingsApi.updateProfile({ notificationPreferences: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-settings'] }),
  });

  if (isLoading) return <CircularProgress />;

  const channels: { key: keyof FormValues; label: string; desc: string }[] = [
    { key: 'email', label: t('settings.notifications.email'), desc: t('settings.notifications.emailDesc') },
    { key: 'sms',   label: t('settings.notifications.sms'),   desc: t('settings.notifications.smsDesc') },
    { key: 'push',  label: t('settings.notifications.push'),  desc: t('settings.notifications.pushDesc') },
  ];

  return (
    <Box maxWidth={680}>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('settings.notifications.title')}</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>{t('settings.notifications.subtitle')}</Typography>

      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2} divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
            {channels.map(({ key, label, desc }) => (
              <Stack key={key} direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body1">{label}</Typography>
                  <Typography variant="caption" color="text.secondary">{desc}</Typography>
                </Box>
                <Controller
                  name={key}
                  control={control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value as boolean}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  )}
                />
              </Stack>
            ))}
          </Stack>
        </Paper>

        <Stack direction="row" spacing={2} mt={3} alignItems="center">
          <Button type="submit" variant="contained" disabled={!isDirty || saveMutation.isPending}>
            {saveMutation.isPending ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
          {saveMutation.isSuccess && <Alert severity="success" sx={{ py: 0.5 }}>{t('common.saved')}</Alert>}
          {saveMutation.isError && <Alert severity="error" sx={{ py: 0.5 }}>{t('common.error')}</Alert>}
        </Stack>
      </form>
    </Box>
  );
}
