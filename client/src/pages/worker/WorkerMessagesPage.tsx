import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useTranslation } from 'react-i18next';
import { messagesApi, Message } from '../../api/messages';

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function WorkerMessagesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['worker-messages'],
    queryFn: messagesApi.getMyThread,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => messagesApi.sendToAgency(body),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['worker-messages'] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const body = draft.trim();
    if (!body || sendMutation.isPending) return;
    sendMutation.mutate(body);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <Typography variant="h6" fontWeight={700} mb={2}>{t('nav.messages')}</Typography>

      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Messages area */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!isLoading && (!messages || messages.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body2" color="text.secondary">{t('messages.noMessages')}</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                {t('messages.workerHint')}
              </Typography>
            </Box>
          )}

          {messages?.map((msg: Message) => {
            const isWorker = msg.senderRole === 'worker';
            return (
              <Box
                key={msg._id}
                sx={{ display: 'flex', justifyContent: isWorker ? 'flex-end' : 'flex-start', mb: 1.5 }}
              >
                {!isWorker && (
                  <Avatar sx={{ bgcolor: 'primary.main', width: 28, height: 28, fontSize: 12, mr: 1, mt: 0.5 }}>
                    A
                  </Avatar>
                )}
                <Box sx={{ maxWidth: '75%' }}>
                  {!isWorker && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      {msg.senderName}
                    </Typography>
                  )}
                  <Paper
                    elevation={0}
                    sx={{
                      px: 1.5,
                      py: 1,
                      bgcolor: isWorker ? 'primary.main' : 'grey.100',
                      color: isWorker ? 'primary.contrastText' : 'text.primary',
                      borderRadius: 2,
                      borderTopRightRadius: isWorker ? 0 : 2,
                      borderTopLeftRadius: isWorker ? 2 : 0,
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.body}
                    </Typography>
                  </Paper>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, textAlign: isWorker ? 'right' : 'left' }}>
                    {fmtTime(msg.createdAt)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
          <div ref={bottomRef} />
        </Box>

        <Divider />

        {sendMutation.isError && (
          <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{t('common.error')}</Alert>
        )}

        {/* Send box */}
        <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            multiline
            maxRows={4}
            placeholder={t('messages.placeholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!draft.trim() || sendMutation.isPending}
          >
            <SendIcon />
          </IconButton>
        </Stack>
      </Paper>
    </Box>
  );
}
