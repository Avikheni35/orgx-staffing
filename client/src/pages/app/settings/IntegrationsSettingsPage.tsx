import { useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Switch, FormControlLabel,
  Chip, CircularProgress, Divider, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Tooltip, Stack,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { serviceIntegrationsApi, ConnectionPayload } from '../../../api/serviceIntegrations';

interface PeerState {
  url: string;
  token: string;
  enabled: boolean;
}

interface TestResult {
  ok: boolean;
  latencyMs?: number;
}

function usePeerState(initial: { url?: string; token?: string; enabled?: boolean } | null): [PeerState, React.Dispatch<React.SetStateAction<PeerState>>] {
  return useState<PeerState>({
    url:     initial?.url     ?? '',
    token:   initial?.token   ?? '',
    enabled: initial?.enabled ?? true,
  });
}

function ConnectionCard({
  moduleKey,
  label,
  description,
  savedData,
}: {
  moduleKey: 'm2' | 'm3';
  label: string;
  description: string;
  savedData: { url?: string; token?: string; enabled?: boolean; lastPingAt?: string; lastPingOk?: boolean } | null;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [state, setState] = usePeerState(savedData);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const saveMut = useMutation({
    mutationFn: (payload: ConnectionPayload) => serviceIntegrationsApi.saveConnection(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-integrations'] }),
  });

  const testMut = useMutation({
    mutationFn: () => serviceIntegrationsApi.testConnection(moduleKey),
    onSuccess: (data) => setTestResult(data),
  });

  const handleSave = () => {
    saveMut.mutate({ module: moduleKey, url: state.url, token: state.token, enabled: state.enabled });
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>{label}</Typography>
          <Typography variant="body2" color="text.secondary">{description}</Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={state.enabled}
              onChange={(e) => setState((s) => ({ ...s, enabled: e.target.checked }))}
              size="small"
            />
          }
          label={state.enabled ? t('common.enabled', 'Aktiviert') : t('common.disabled', 'Deaktiviert')}
          labelPlacement="start"
        />
      </Stack>

      <Stack spacing={2}>
        <TextField
          label={t('settings.integrations.serviceUrl', 'Service URL')}
          value={state.url}
          onChange={(e) => setState((s) => ({ ...s, url: e.target.value }))}
          placeholder="https://m3.company.de"
          size="small"
          fullWidth
        />
        <TextField
          label={t('settings.integrations.peerToken', 'Service Token (des Zielsystems)')}
          value={state.token}
          onChange={(e) => setState((s) => ({ ...s, token: e.target.value }))}
          type="password"
          size="small"
          fullWidth
        />
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" mt={2}>
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={saveMut.isPending || !state.url || !state.token}
        >
          {saveMut.isPending ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
          {t('common.save', 'Speichern')}
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => testMut.mutate()}
          disabled={testMut.isPending || !savedData?.url}
        >
          {testMut.isPending ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
          {t('settings.integrations.testConnection')}
        </Button>

        {testResult !== null && (
          <Chip
            size="small"
            icon={testResult.ok ? <CheckCircleIcon /> : <ErrorIcon />}
            label={testResult.ok ? `OK (${testResult.latencyMs} ms)` : t('settings.integrations.testFailed', 'Fehlgeschlagen')}
            color={testResult.ok ? 'success' : 'error'}
          />
        )}
      </Stack>

      {savedData?.lastPingAt && (
        <Typography variant="caption" color="text.disabled" mt={1} display="block">
          {t('settings.integrations.lastPing', 'Letzter Ping')}:{' '}
          {new Date(savedData.lastPingAt).toLocaleString('de-DE')}{' '}
          {savedData.lastPingOk ? '✓' : '✗'}
        </Typography>
      )}
    </Paper>
  );
}

export default function IntegrationsSettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['service-integrations'],
    queryFn: serviceIntegrationsApi.get,
  });

  const regenMut = useMutation({
    mutationFn: serviceIntegrationsApi.regenerateToken,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-integrations'] });
      setRegenOpen(false);
    },
  });

  const handleCopy = () => {
    if (data?.ownServiceToken) {
      navigator.clipboard.writeText(data.ownServiceToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={0.5}>
        {t('settings.integrations.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {t(
          'settings.integrations.subtitle',
          'Verbinden Sie M1 mit M2 (Event-Staffing) und M3 (ERP), um Daten automatisch zu synchronisieren.'
        )}
      </Typography>

      {/* Own Service Token */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} mb={0.5}>
          {t('settings.integrations.ownToken')}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {t(
            'settings.integrations.ownTokenHint',
            'Geben Sie diesen Token an andere Module weiter, damit diese M1 anrufen können.'
          )}
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            value={data?.ownServiceToken ?? ''}
            inputProps={{ readOnly: true, style: { fontFamily: 'monospace', fontSize: 13 } }}
            size="small"
            fullWidth
          />
          <Tooltip title={copied ? t('common.copied', 'Kopiert!') : t('common.copy', 'Kopieren')}>
            <IconButton onClick={handleCopy} size="small">
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('settings.integrations.regenerateToken')}>
            <IconButton onClick={() => setRegenOpen(true)} size="small" color="warning">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="subtitle2" color="text.secondary" mb={2} textTransform="uppercase" letterSpacing={1} fontSize={11}>
        {t('settings.integrations.connectedServices')}
      </Typography>

      <Stack spacing={2}>
        <ConnectionCard
          moduleKey="m2"
          label="M2 – Event-Staffing"
          description={t(
            'settings.integrations.m2Desc',
            'Aktivierte Mitarbeiter werden automatisch in den M2-Personalpool übertragen.'
          )}
          savedData={data?.connectedServices?.m2 ?? null}
        />
        <ConnectionCard
          moduleKey="m3"
          label="M3 – ERP / Buchhaltung"
          description={t(
            'settings.integrations.m3Desc',
            'Rechnungen und genehmigte Zeitnachweise werden automatisch als Buchungen in M3 erfasst.'
          )}
          savedData={data?.connectedServices?.m3 ?? null}
        />
      </Stack>

      {/* Regenerate token confirm dialog */}
      <Dialog open={regenOpen} onClose={() => setRegenOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('settings.integrations.regenerateToken')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('settings.integrations.regenerateWarning')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegenOpen(false)}>
            {t('common.cancel', 'Abbrechen')}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => regenMut.mutate()}
            disabled={regenMut.isPending}
          >
            {regenMut.isPending ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
            {t('settings.integrations.regenerateConfirm', 'Neu generieren')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
