import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GavelIcon from '@mui/icons-material/Gavel';
import DrawIcon from '@mui/icons-material/Draw';
import DownloadIcon from '@mui/icons-material/Download';
import { useTranslation } from 'react-i18next';
import { contractsApi, Contract, ContractStatus } from '../../../api/contracts';

const STATUS_COLOR: Record<ContractStatus, 'warning' | 'success' | 'error'> = {
  pending_signature: 'warning',
  signed: 'success',
  voided: 'error',
};

type TabVal = 'all' | ContractStatus;

export default function ContractListPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabVal>('all');
  const [preview, setPreview] = useState<Contract | null>(null);

  const { data: contracts, isLoading, error } = useQuery({
    queryKey: ['contracts', tab],
    queryFn: () => contractsApi.list(tab !== 'all' ? { status: tab } : undefined),
  });

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
        <GavelIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>{t('contract.contracts')}</Typography>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t('common.all')} value="all" />
        <Tab label={t('contract.statusLabel.pending_signature')} value="pending_signature" />
        <Tab label={t('contract.statusLabel.signed')} value="signed" />
        <Tab label={t('contract.statusLabel.voided')} value="voided" />
      </Tabs>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{t('common.loadError')}</Alert>}
      {contracts?.length === 0 && <Alert severity="info">{t('contract.noContracts')}</Alert>}

      <Stack spacing={2}>
        {(contracts ?? []).map((c) => (
          <Card key={c._id} sx={{ cursor: 'pointer' }} onClick={() => setPreview(c)}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box flex={1}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                    <Typography variant="subtitle1" fontWeight={700}>{c.workerName}</Typography>
                    <Chip
                      label={t(`contract.statusLabel.${c.status}`)}
                      color={STATUS_COLOR[c.status]}
                      size="small"
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {c.shiftTitle} · {c.businessName}
                  </Typography>
                  <Stack direction="row" spacing={3} mt={0.5} flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary">
                      {t('contract.shiftDate')}: {fmtDate(c.startTime)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('contract.createdAt')}: {fmtDate(c.createdAt)}
                    </Typography>
                    {c.signedAt && (
                      <Typography variant="caption" color="success.main" fontWeight={600}>
                        {t('contract.signedAt')}: {fmtDateTime(c.signedAt)}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                <Stack alignItems="flex-end" spacing={0.5}>
                  <Typography variant="body2" fontWeight={600}>{c.payRatePerHour.toFixed(2)} €/h</Typography>
                  {c.emailSentAt && (
                    <Typography variant="caption" color="text.secondary">{t('contract.emailSent')}</Typography>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Contract preview dialog */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="md" fullWidth>
        {preview && (
          <>
            <DialogTitle>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography fontWeight={700}>{preview.workerName}</Typography>
                  <Typography variant="body2" color="text.secondary">{preview.shiftTitle}</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={t(`contract.statusLabel.${preview.status}`)}
                    color={STATUS_COLOR[preview.status]}
                    size="small"
                  />
                  <IconButton onClick={() => setPreview(null)}><CloseIcon /></IconButton>
                </Stack>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <div dangerouslySetInnerHTML={{ __html: preview.contractHtml }} />

              {preview.status === 'signed' && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <DrawIcon color="success" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight={700} color="success.main">
                        {t('contract.digitalSignature')}
                      </Typography>
                    </Stack>
                    {preview.signatureData?.startsWith('data:image') ? (
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                          {t('contract.drawnSignature')}:
                        </Typography>
                        <img
                          src={preview.signatureData}
                          alt="signature"
                          style={{ border: '1px solid #ddd', borderRadius: 4, maxWidth: 400, display: 'block' }}
                        />
                      </Box>
                    ) : (
                      <Box sx={{ borderLeft: 4, borderColor: 'success.main', pl: 2, py: 1, bgcolor: 'success.50' }}>
                        <Typography fontStyle="italic" fontSize={20}>{preview.signatureData}</Typography>
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {t('contract.signedAt')}: {fmtDateTime(preview.signedAt!)}
                    </Typography>
                  </Stack>
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                component="a"
                href={`/api/contracts/${preview._id}/pdf`}
                target="_blank"
                rel="noopener"
              >
                PDF herunterladen
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
