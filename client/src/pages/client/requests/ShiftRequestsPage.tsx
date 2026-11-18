import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { shiftRequestsApi } from '../../../api/shiftRequests';

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'error',
  fulfilled: 'success',
};

export default function ShiftRequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: requests, isLoading, error } = useQuery({
    queryKey: ['shift-requests'],
    queryFn: () => shiftRequestsApi.list(),
  });

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('shiftRequests.title')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('shiftRequests.subtitle')}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/client/requests/new')}>
          {t('shiftRequests.create')}
        </Button>
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error">{t('common.loadError')}</Alert>
      ) : (requests ?? []).length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">{t('shiftRequests.empty')}</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {(requests ?? []).map((req) => (
            <Paper key={req._id} sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="body1" fontWeight={600}>{req.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(req.date).toLocaleDateString('de-DE')} · {req.startTime}–{req.endTime} · {req.workersNeeded} {t('shiftRequests.workers')}
                  </Typography>
                  {req.agencyNote && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {t('shiftRequests.agencyNote')}: {req.agencyNote}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Chip
                    size="small"
                    label={t(`shiftRequests.status.${req.status}`)}
                    color={STATUS_COLOR[req.status] ?? 'default'}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(req.createdAt).toLocaleDateString('de-DE')}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
