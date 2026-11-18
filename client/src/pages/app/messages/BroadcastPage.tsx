import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workersApi } from '../../../api/workers';
import apiClient from '../../../api/client';

type WorkerStatus = 'active' | 'inactive' | 'pending_review' | 'suspended' | 'blacklisted' | 'all';

function sendBroadcast(payload: { subject: string; body: string; workerStatus?: string; workerIds?: string[] }) {
  return apiClient.post<{ sent: number }>('/messages/broadcast', payload).then((r) => r.data);
}

export default function BroadcastPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>('active');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState('');

  const { data: workers, isLoading } = useQuery({
    queryKey: ['workers-list', { status: workerStatus }],
    queryFn: () => workerStatus === 'all' ? workersApi.list() : workersApi.list({ status: workerStatus }),
  });

  const recipients = workers?.workers ?? [];

  const mut = useMutation({
    mutationFn: () =>
      sendBroadcast({
        subject,
        body,
        workerStatus,
      }),
    onSuccess: (data) => {
      setSent(data.sent);
      setErrMsg('');
      setSubject('');
      setBody('');
    },
    onError: (e: unknown) =>
      setErrMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')),
  });

  const canSend = subject.trim() && body.trim() && recipients.length > 0;

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate('/app/messages')}>
          {t('broadcast.backToMessages')}
        </Button>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('broadcast.title')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('broadcast.subtitle')}</Typography>
        </Box>
      </Stack>

      {sent !== null && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSent(null)}>
          {t('broadcast.sent', { count: sent })}
        </Alert>
      )}
      {errMsg && <Alert severity="error" sx={{ mb: 2 }}>{errMsg}</Alert>}

      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('broadcast.filter')}</Typography>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('broadcast.workerStatus')}</InputLabel>
            <Select
              value={workerStatus}
              label={t('broadcast.workerStatus')}
              onChange={(e) => setWorkerStatus(e.target.value as WorkerStatus)}
            >
              <MenuItem value="all">{t('common.all')}</MenuItem>
              <MenuItem value="active">{t('workers.status.active')}</MenuItem>
              <MenuItem value="inactive">{t('workers.status.inactive')}</MenuItem>
              <MenuItem value="pending_review">{t('workers.status.pending_review')}</MenuItem>
            </Select>
          </FormControl>

          <Box mt={2}>
            {isLoading ? (
              <CircularProgress size={20} />
            ) : recipients.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('broadcast.noRecipients')}</Typography>
            ) : (
              <Stack direction="row" alignItems="center" gap={1}>
                <Chip label={t('broadcast.recipientCount', { count: recipients.length })} color="primary" size="small" />
              </Stack>
            )}
          </Box>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {t('broadcast.preview')}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label={t('broadcast.subject')}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ maxLength: 200 }}
            />
            <TextField
              label={t('broadcast.body')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              fullWidth
              multiline
              rows={6}
              inputProps={{ maxLength: 2000 }}
            />
          </Stack>
          <Box mt={2}>
            <Button
              variant="contained"
              startIcon={mut.isPending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              disabled={!canSend || mut.isPending}
              onClick={() => mut.mutate()}
            >
              {t('broadcast.send', { count: recipients.length })}
            </Button>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}
