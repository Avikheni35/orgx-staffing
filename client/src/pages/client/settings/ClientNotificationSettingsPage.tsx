import { useState } from 'react';
import {
  Alert,
  Box,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface NotifSettings {
  shiftUpdates: boolean;
  invoiceReady: boolean;
  attendanceAlerts: boolean;
  workerChanges: boolean;
}

export default function ClientNotificationSettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotifSettings>({
    shiftUpdates: true,
    invoiceReady: true,
    attendanceAlerts: true,
    workerChanges: false,
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof NotifSettings) => {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
    setSaved(false);
  };

  const ITEMS: Array<{ key: keyof NotifSettings; labelKey: string; descKey: string }> = [
    { key: 'shiftUpdates', labelKey: 'clientNotifSettings.shiftUpdates', descKey: 'clientNotifSettings.shiftUpdatesDesc' },
    { key: 'invoiceReady', labelKey: 'clientNotifSettings.invoiceReady', descKey: 'clientNotifSettings.invoiceReadyDesc' },
    { key: 'attendanceAlerts', labelKey: 'clientNotifSettings.attendanceAlerts', descKey: 'clientNotifSettings.attendanceAlertsDesc' },
    { key: 'workerChanges', labelKey: 'clientNotifSettings.workerChanges', descKey: 'clientNotifSettings.workerChangesDesc' },
  ];

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('clientNotifSettings.title')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('clientNotifSettings.subtitle')}</Typography>
      </Box>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>{t('common.saved')}</Alert>}

      <Paper sx={{ p: 0 }}>
        {ITEMS.map((item, idx) => (
          <Box key={item.key}>
            {idx > 0 && <Divider />}
            <Stack direction="row" alignItems="center" justifyContent="space-between" px={3} py={2}>
              <Box>
                <Typography variant="body1" fontWeight={500}>{t(item.labelKey)}</Typography>
                <Typography variant="body2" color="text.secondary">{t(item.descKey)}</Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings[item.key]}
                    onChange={() => toggle(item.key)}
                  />
                }
                label=""
                sx={{ ml: 2 }}
              />
            </Stack>
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
