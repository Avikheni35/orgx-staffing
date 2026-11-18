import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { shiftRequestsApi } from '../../../api/shiftRequests';

export default function NewShiftRequestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    workersNeeded: '1',
    qualifications: '',
  });
  const [errMsg, setErrMsg] = useState('');

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const mut = useMutation({
    mutationFn: () =>
      shiftRequestsApi.create({
        title: form.title,
        description: form.description || undefined,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        workersNeeded: parseInt(form.workersNeeded, 10),
        qualifications: form.qualifications ? form.qualifications.split(',').map((q) => q.trim()).filter(Boolean) : undefined,
      }),
    onSuccess: () => navigate('/client/requests'),
    onError: (e: unknown) =>
      setErrMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')),
  });

  const canSubmit = form.title && form.date && form.startTime && form.endTime && parseInt(form.workersNeeded) >= 1;

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate('/client/requests')}>
          {t('common.back')}
        </Button>
        <Typography variant="h5" fontWeight={700}>{t('shiftRequests.newTitle')}</Typography>
      </Stack>

      <Paper sx={{ p: 3, maxWidth: 640 }}>
        {errMsg && <Alert severity="error" sx={{ mb: 2 }}>{errMsg}</Alert>}
        <Stack spacing={2.5}>
          <TextField
            label={t('shiftRequests.titleField')}
            value={form.title}
            onChange={set('title')}
            required
            fullWidth
          />
          <TextField
            label={t('shiftRequests.descriptionField')}
            value={form.description}
            onChange={set('description')}
            fullWidth
            multiline
            rows={3}
          />
          <Stack direction="row" gap={2}>
            <TextField
              label={t('shiftRequests.date')}
              type="date"
              value={form.date}
              onChange={set('date')}
              required
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
            <TextField
              label={t('shiftRequests.startTime')}
              type="time"
              value={form.startTime}
              onChange={set('startTime')}
              required
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
            <TextField
              label={t('shiftRequests.endTime')}
              type="time"
              value={form.endTime}
              onChange={set('endTime')}
              required
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
          </Stack>
          <TextField
            label={t('shiftRequests.workersNeeded')}
            type="number"
            value={form.workersNeeded}
            onChange={set('workersNeeded')}
            required
            inputProps={{ min: 1, max: 100 }}
            sx={{ width: 160 }}
          />
          <TextField
            label={t('shiftRequests.qualifications')}
            value={form.qualifications}
            onChange={set('qualifications')}
            fullWidth
            helperText={t('shiftRequests.qualificationsHint')}
          />
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={mut.isPending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              disabled={!canSubmit || mut.isPending}
              onClick={() => mut.mutate()}
            >
              {t('shiftRequests.submit')}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
