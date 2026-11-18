import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { contractsApi, ContractStatus } from '../../api/contracts';

const STATUS_COLOR: Record<ContractStatus, 'warning' | 'success' | 'error'> = {
  pending_signature: 'warning',
  signed: 'success',
  voided: 'error',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function WorkerContractsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: contracts, isLoading, error } = useQuery({
    queryKey: ['worker-contracts'],
    queryFn: () => contractsApi.myContracts(),
  });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
        <GavelIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>{t('contract.myContracts')}</Typography>
      </Stack>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{t('common.loadError')}</Alert>}
      {contracts?.length === 0 && <Alert severity="info">{t('contract.noContracts')}</Alert>}

      <Stack spacing={2}>
        {(contracts ?? []).map((c) => (
          <Card key={c._id}>
            <CardActionArea onClick={() => navigate(`/worker/contracts/${c._id}`)}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                      <Typography variant="subtitle1" fontWeight={700}>{c.shiftTitle}</Typography>
                      <Chip
                        label={t(`contract.statusLabel.${c.status}`)}
                        color={STATUS_COLOR[c.status]}
                        size="small"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{c.businessName}</Typography>
                    <Stack direction="row" spacing={2} mt={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        {fmtDate(c.startTime)}
                      </Typography>
                      {c.signedAt && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <CheckCircleIcon sx={{ fontSize: 12 }} color="success" />
                          <Typography variant="caption" color="success.main" fontWeight={600}>
                            {t('contract.signedAt')}: {fmtDate(c.signedAt)}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                  <Typography variant="body2" fontWeight={600} mt={0.5}>
                    {c.payRatePerHour.toFixed(2)} €/h
                  </Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
