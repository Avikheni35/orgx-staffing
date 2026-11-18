import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Divider,
  FormControl, FormControlLabel, FormHelperText, InputAdornment,
  MenuItem, Select, Stack, Switch, TextField, Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import SaveIcon from '@mui/icons-material/Save';
import { useTranslation } from 'react-i18next';
import { settingsApi, type M1FeatureFlags } from '../../../api/settings';

const DEFAULT: M1FeatureFlags = {
  workerSelfRegistration: false,
  requireDocumentUpload: false,
  enableMagicLink: true,
  enableJobApplicationForm: false,
  attendanceMethod: 'manual',
  overtimeThresholdHours: 8,
  timesheetApprovalRequired: true,
  contractAutoVoidOverlap: true,
  autoInvoiceOnApproval: false,
  datevExportEnabled: false,
  enableClientPortal: true,
  enableWorkerRatings: false,
  smsNotifications: false,
  sessionTimeoutMinutes: null,
};

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="overline" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
      {children}
    </Typography>
  );
}

function SettingRow({
  label, description, checked, onChange, disabled,
}: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 1.5 }}>
      <Box sx={{ maxWidth: '75%' }}>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        {description && <Typography variant="caption" color="text.secondary">{description}</Typography>}
      </Box>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} size="small" />
    </Box>
  );
}

export default function FeatureSettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<M1FeatureFlags>(DEFAULT);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'features', 'm1'],
    queryFn: settingsApi.getM1Features,
  });

  useEffect(() => {
    if (data) setForm({ ...DEFAULT, ...data });
  }, [data]);

  const mutation = useMutation({
    mutationFn: (patch: Partial<M1FeatureFlags>) => settingsApi.updateM1Features(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'features', 'm1'] });
      setSaved(true); setError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: unknown) => {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Fehler beim Speichern');
    },
  });

  const set = <K extends keyof M1FeatureFlags>(key: K, val: M1FeatureFlags[K]) =>
    setForm((p) => ({ ...p, [key]: val }));

  if (isLoading) return <CircularProgress />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('settings.features.title')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('settings.features.subtitle')}</Typography>
        </Box>
        <Button
          variant="contained"
          disabled={mutation.isPending}
          startIcon={saved ? <CheckIcon /> : <SaveIcon />}
          color={saved ? 'success' : 'primary'}
          onClick={() => mutation.mutate(form)}
        >
          {mutation.isPending ? '…' : saved ? t('common.saved') : t('common.save')}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardContent sx={{ p: 3 }}>

          {/* Worker & Onboarding */}
          <SectionTitle>{t('settings.features.section.worker')}</SectionTitle>
          <Divider sx={{ mb: 1 }} />
          <SettingRow
            label={t('settings.features.workerSelfRegistration')}
            description={t('settings.features.workerSelfRegistrationHint')}
            checked={form.workerSelfRegistration}
            onChange={(v) => set('workerSelfRegistration', v)}
          />
          <SettingRow
            label={t('settings.features.requireDocumentUpload')}
            description={t('settings.features.requireDocumentUploadHint')}
            checked={form.requireDocumentUpload}
            onChange={(v) => set('requireDocumentUpload', v)}
          />
          <SettingRow
            label={t('settings.features.enableMagicLink')}
            description={t('settings.features.enableMagicLinkHint')}
            checked={form.enableMagicLink}
            onChange={(v) => set('enableMagicLink', v)}
          />
          <SettingRow
            label={t('settings.features.enableJobApplicationForm')}
            description={t('settings.features.enableJobApplicationFormHint')}
            checked={form.enableJobApplicationForm}
            onChange={(v) => set('enableJobApplicationForm', v)}
          />

          {/* Attendance */}
          <Box mt={3}>
            <SectionTitle>{t('settings.features.section.attendance')}</SectionTitle>
            <Divider sx={{ mb: 1 }} />
          </Box>
          <Box py={1.5}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <Typography variant="body2" fontWeight={500} mb={0.5}>{t('settings.features.attendanceMethod')}</Typography>
              <Select value={form.attendanceMethod} onChange={(e) => set('attendanceMethod', e.target.value as M1FeatureFlags['attendanceMethod'])}>
                <MenuItem value="manual">Manuell (Disponent trägt ein)</MenuItem>
                <MenuItem value="qr">QR-Code (Worker scannt vor Ort)</MenuItem>
                <MenuItem value="gps">GPS (Standortverifizierung)</MenuItem>
                <MenuItem value="nfc">NFC (Karte am Lesegerät)</MenuItem>
              </Select>
              <FormHelperText>{t('settings.features.attendanceMethodHint')}</FormHelperText>
            </FormControl>
          </Box>
          <Box py={1.5}>
            <Typography variant="body2" fontWeight={500} mb={0.5}>{t('settings.features.overtimeThreshold')}</Typography>
            <TextField
              size="small"
              type="number"
              value={form.overtimeThresholdHours}
              onChange={(e) => set('overtimeThresholdHours', Number(e.target.value))}
              inputProps={{ min: 1, max: 24, step: 0.5 }}
              InputProps={{ endAdornment: <InputAdornment position="end">Std./Tag</InputAdornment> }}
              sx={{ width: 160 }}
              helperText={t('settings.features.overtimeThresholdHint')}
            />
          </Box>
          <SettingRow
            label={t('settings.features.timesheetApprovalRequired')}
            description={t('settings.features.timesheetApprovalRequiredHint')}
            checked={form.timesheetApprovalRequired}
            onChange={(v) => set('timesheetApprovalRequired', v)}
          />

          {/* Compliance */}
          <Box mt={3}>
            <SectionTitle>{t('settings.features.section.compliance')}</SectionTitle>
            <Divider sx={{ mb: 1 }} />
          </Box>
          <SettingRow
            label={t('settings.features.contractAutoVoidOverlap')}
            description={t('settings.features.contractAutoVoidOverlapHint')}
            checked={form.contractAutoVoidOverlap}
            onChange={(v) => set('contractAutoVoidOverlap', v)}
          />

          {/* Invoice & Finance */}
          <Box mt={3}>
            <SectionTitle>{t('settings.features.section.invoice')}</SectionTitle>
            <Divider sx={{ mb: 1 }} />
          </Box>
          <SettingRow
            label={t('settings.features.autoInvoiceOnApproval')}
            description={t('settings.features.autoInvoiceOnApprovalHint')}
            checked={form.autoInvoiceOnApproval}
            onChange={(v) => set('autoInvoiceOnApproval', v)}
          />
          <SettingRow
            label={t('settings.features.datevExportEnabled')}
            description={t('settings.features.datevExportEnabledHint')}
            checked={form.datevExportEnabled}
            onChange={(v) => set('datevExportEnabled', v)}
          />

          {/* Portals & Features */}
          <Box mt={3}>
            <SectionTitle>{t('settings.features.section.portals')}</SectionTitle>
            <Divider sx={{ mb: 1 }} />
          </Box>
          <SettingRow
            label={t('settings.features.enableClientPortal')}
            description={t('settings.features.enableClientPortalHint')}
            checked={form.enableClientPortal}
            onChange={(v) => set('enableClientPortal', v)}
          />
          <SettingRow
            label={t('settings.features.enableWorkerRatings')}
            description={t('settings.features.enableWorkerRatingsHint')}
            checked={form.enableWorkerRatings}
            onChange={(v) => set('enableWorkerRatings', v)}
          />
          <SettingRow
            label={t('settings.features.smsNotifications')}
            description={t('settings.features.smsNotificationsHint')}
            checked={form.smsNotifications}
            onChange={(v) => set('smsNotifications', v)}
          />

          {/* Security */}
          <Box mt={3}>
            <SectionTitle>{t('settings.features.section.security')}</SectionTitle>
            <Divider sx={{ mb: 1 }} />
          </Box>
          <Box py={1.5}>
            <Typography variant="body2" fontWeight={500} mb={0.5}>{t('settings.features.sessionTimeout')}</Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={form.sessionTimeoutMinutes !== null}
                    onChange={(e) => set('sessionTimeoutMinutes', e.target.checked ? 60 : null)}
                  />
                }
                label={form.sessionTimeoutMinutes === null ? 'Deaktiviert' : 'Aktiviert'}
              />
              {form.sessionTimeoutMinutes !== null && (
                <TextField
                  size="small"
                  type="number"
                  value={form.sessionTimeoutMinutes}
                  onChange={(e) => set('sessionTimeoutMinutes', Number(e.target.value))}
                  inputProps={{ min: 15, max: 480, step: 15 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">Min</InputAdornment> }}
                  sx={{ width: 140 }}
                />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">{t('settings.features.sessionTimeoutHint')}</Typography>
          </Box>

        </CardContent>
      </Card>
    </Box>
  );
}
