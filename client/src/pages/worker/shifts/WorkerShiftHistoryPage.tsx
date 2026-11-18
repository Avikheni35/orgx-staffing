import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiClient from '../../../api/client';

interface WorkerShift {
  _id: string;
  title: string;
  businessName: string;
  locationName?: string;
  startTime: string;
  endTime: string;
  status: string;
  payRatePerHour: number;
}

function fetchHistory(from: string, to: string) {
  return apiClient
    .get<WorkerShift[]>('/worker-portal/shifts/history', { params: { from, to } })
    .then((r) => r.data);
}

const now = new Date();
const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10);
const defaultTo = now.toISOString().slice(0, 10);

export default function WorkerShiftHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const { data, isLoading, error } = useQuery({
    queryKey: ['worker-shift-history', from, to],
    queryFn: () => fetchHistory(from, to),
  });

  const shifts = data ?? [];

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('workerShiftHistory.title')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('workerShiftHistory.subtitle')}</Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            size="small"
            type="date"
            label={t('workerShiftHistory.from')}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="date"
            label={t('workerShiftHistory.to')}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </Paper>

      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error">{t('common.loadError')}</Alert>
      ) : shifts.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">{t('workerShiftHistory.empty')}</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {shifts.map((shift) => (
            <Paper
              key={shift._id}
              sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              onClick={() => navigate(`/worker/shifts/${shift._id}`)}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="body1" fontWeight={600}>{shift.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {shift.businessName}{shift.locationName ? ` – ${shift.locationName}` : ''}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Chip size="small" label={shift.status} />
                </Stack>
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" gap={3} flexWrap="wrap">
                <Typography variant="caption" color="text.secondary">
                  {new Date(shift.startTime).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  {' '}
                  {new Date(shift.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(shift.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {shift.payRatePerHour.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}/h
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
