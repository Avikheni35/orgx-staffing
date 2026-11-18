import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiClient from '../../../api/client';
import { workerRatingsApi } from '../../../api/workerRatings';

interface ShiftDetail {
  _id: string;
  title: string;
  startTime: string;
  assignedWorkers: Array<{ workerId: string; workerName: string; status: string }>;
}

function fetchShift(id: string) {
  return apiClient.get<ShiftDetail>(`/client-portal/shifts/${id}`).then((r) => r.data);
}

export default function WorkerRatingPage() {
  const { t } = useTranslation();
  const { shiftId } = useParams<{ shiftId: string }>();
  const navigate = useNavigate();
  const [ratings, setRatings] = useState<Record<string, { overall: number; punctuality: number; quality: number; attitude: number; comment: string }>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [errMsg, setErrMsg] = useState('');

  const { data: shift, isLoading, error } = useQuery({
    queryKey: ['client-shift', shiftId],
    queryFn: () => fetchShift(shiftId!),
    enabled: !!shiftId,
  });

  const submitMut = useMutation({
    mutationFn: ({ workerId }: { workerId: string }) => {
      const r = ratings[workerId] ?? { overall: 3, punctuality: 3, quality: 3, attitude: 3, comment: '' };
      return workerRatingsApi.create({
        shiftId: shiftId!,
        workerId,
        overallRating: r.overall,
        punctuality: r.punctuality || undefined,
        quality: r.quality || undefined,
        attitude: r.attitude || undefined,
        comment: r.comment || undefined,
      });
    },
    onSuccess: (_, { workerId }) => {
      setSubmitted((s) => ({ ...s, [workerId]: true }));
      setErrMsg('');
    },
    onError: (e: unknown) =>
      setErrMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')),
  });

  const setWorkerRating = (workerId: string, field: string, value: number | string) => {
    setRatings((r) => {
      const prev = r[workerId] ?? { overall: 3, punctuality: 3, quality: 3, attitude: 3, comment: '' };
      return { ...r, [workerId]: { ...prev, [field]: value } };
    });
  };

  if (isLoading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
  if (error || !shift) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const workers = shift.assignedWorkers ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate(`/client/shifts/${shiftId}`)}>
          {t('common.back')}
        </Button>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('workerRating.title')}</Typography>
          <Typography variant="body2" color="text.secondary">{shift.title}</Typography>
        </Box>
      </Stack>

      {errMsg && <Alert severity="error" sx={{ mb: 2 }}>{errMsg}</Alert>}

      {workers.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">{t('workerRating.noWorkers')}</Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {workers.map((w) => {
            const r = ratings[w.workerId] ?? { overall: 3, punctuality: 3, quality: 3, attitude: 3, comment: '' };
            const done = submitted[w.workerId];
            return (
              <Paper key={w.workerId} sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="subtitle1" fontWeight={600}>{w.workerName}</Typography>
                  {done && <Chip size="small" color="success" label={t('workerRating.submitted')} />}
                </Stack>
                <Divider sx={{ mb: 2 }} />

                {done ? null : (
                  <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" gap={2}>
                      <Typography variant="body2" sx={{ minWidth: 140 }}>{t('workerRating.overall')}</Typography>
                      <Rating
                        value={r.overall}
                        onChange={(_, v) => setWorkerRating(w.workerId, 'overall', v ?? 3)}
                        icon={<StarIcon fontSize="inherit" />}
                      />
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={2}>
                      <Typography variant="body2" sx={{ minWidth: 140 }}>{t('workerRating.punctuality')}</Typography>
                      <Rating
                        value={r.punctuality}
                        onChange={(_, v) => setWorkerRating(w.workerId, 'punctuality', v ?? 3)}
                      />
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={2}>
                      <Typography variant="body2" sx={{ minWidth: 140 }}>{t('workerRating.quality')}</Typography>
                      <Rating
                        value={r.quality}
                        onChange={(_, v) => setWorkerRating(w.workerId, 'quality', v ?? 3)}
                      />
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={2}>
                      <Typography variant="body2" sx={{ minWidth: 140 }}>{t('workerRating.attitude')}</Typography>
                      <Rating
                        value={r.attitude}
                        onChange={(_, v) => setWorkerRating(w.workerId, 'attitude', v ?? 3)}
                      />
                    </Stack>
                    <TextField
                      label={t('workerRating.comment')}
                      multiline
                      rows={3}
                      value={r.comment}
                      onChange={(e) => setWorkerRating(w.workerId, 'comment', e.target.value)}
                      fullWidth
                    />
                    <Box>
                      <Button
                        variant="contained"
                        disabled={submitMut.isPending}
                        onClick={() => submitMut.mutate({ workerId: w.workerId })}
                      >
                        {t('workerRating.submit')}
                      </Button>
                    </Box>
                  </Stack>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
