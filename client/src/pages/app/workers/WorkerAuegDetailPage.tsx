import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workersApi } from '../../../api/workers';

const AUEG_WARN = 9;
const AUEG_BLOCK = 18;

function statusChip(months: number) {
  if (months >= AUEG_BLOCK) return <Chip size="small" color="error" label="≥18 Mon." />;
  if (months >= AUEG_WARN) return <Chip size="small" color="warning" label="≥9 Mon." />;
  return <Chip size="small" color="success" label="OK" />;
}

export default function WorkerAuegDetailPage() {
  const { t } = useTranslation();
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();

  const { data: worker, isLoading, error } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => workersApi.get(workerId!),
    enabled: !!workerId,
  });

  if (isLoading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
  if (error || !worker) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const fullName = `${worker.firstName} ${worker.lastName}`;
  const aueg = (worker as unknown as { auegTracking?: Array<{ businessId: string; businessName: string; months: number; firstAssignmentDate?: string; lastAssignmentDate?: string }> }).auegTracking ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate(`/app/workers/${workerId}`)}>
          {t('common.back')}
        </Button>
        <Typography variant="h5" fontWeight={700}>{t('workerAueg.title', { name: fullName })}</Typography>
      </Stack>

      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 3 }}>
        {t('workerAueg.legalNote')}
      </Alert>

      {aueg.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">{t('workerAueg.noRecords')}</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('workerAueg.business')}</TableCell>
                <TableCell align="right">{t('workerAueg.monthsWorked')}</TableCell>
                <TableCell>{t('workerAueg.startDate')}</TableCell>
                <TableCell>{t('workerAueg.lastAssignment')}</TableCell>
                <TableCell>{t('workerAueg.status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {aueg.map((entry, idx) => (
                <TableRow key={idx} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{entry.businessName}</TableCell>
                  <TableCell align="right">{entry.months}</TableCell>
                  <TableCell>
                    {entry.firstAssignmentDate
                      ? new Date(entry.firstAssignmentDate).toLocaleDateString('de-DE')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {entry.lastAssignmentDate
                      ? new Date(entry.lastAssignmentDate).toLocaleDateString('de-DE')
                      : '—'}
                  </TableCell>
                  <TableCell>{statusChip(entry.months)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Divider />
          <Box px={2} py={1.5}>
            <Typography variant="caption" color="text.secondary">
              {t('workerAueg.totalMonths', {
                count: aueg.reduce((s, e) => s + e.months, 0),
              })}
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
