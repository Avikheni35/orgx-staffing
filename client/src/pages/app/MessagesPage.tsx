import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  Avatar,
  Badge,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from 'react-i18next';
import { messagesApi, Thread } from '../../api/messages';
import { workersApi, Worker } from '../../api/workers';

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export default function MessagesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [workerSearch, setWorkerSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: threads, isLoading: loadingThreads } = useQuery({
    queryKey: ['message-threads'],
    queryFn: messagesApi.listThreads,
    refetchInterval: 5000,
  });

  const { data: thread, isLoading: loadingThread } = useQuery({
    queryKey: ['message-thread', selectedWorkerId],
    queryFn: () => messagesApi.getThread(selectedWorkerId!),
    enabled: !!selectedWorkerId,
    refetchInterval: 5000,
  });

  const { data: workerData } = useQuery({
    queryKey: ['workers-search', workerSearch],
    queryFn: () => workersApi.list({ search: workerSearch, status: 'active', limit: 20 }),
    enabled: composeOpen,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => messagesApi.sendToWorker(selectedWorkerId!, body),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['message-thread', selectedWorkerId] });
      qc.invalidateQueries({ queryKey: ['message-threads'] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages]);

  useEffect(() => {
    if (selectedWorkerId) {
      qc.invalidateQueries({ queryKey: ['message-threads'] });
    }
  }, [selectedWorkerId, qc]);

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

  const handleSelectWorker = (worker: Worker) => {
    setSelectedWorkerId(worker._id);
    setComposeOpen(false);
    setWorkerSearch('');
  };

  const selectedThread = threads?.find((t: Thread) => t._id === selectedWorkerId);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 2 }}>
      {/* Thread list */}
      <Paper sx={{ width: 300, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight={700}>{t('nav.messages')}</Typography>
          <IconButton size="small" onClick={() => setComposeOpen(true)} title={t('messages.newMessage')}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Stack>

        {loadingThreads ? (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
        ) : !threads?.length ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" mb={2}>{t('messages.noThreads')}</Typography>
            <Button size="small" startIcon={<EditIcon />} onClick={() => setComposeOpen(true)}>
              {t('messages.newMessage')}
            </Button>
          </Box>
        ) : (
          <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
            {threads.map((th: Thread) => (
              <ListItemButton
                key={th._id}
                selected={th._id === selectedWorkerId}
                onClick={() => setSelectedWorkerId(th._id)}
                divider
              >
                <ListItemAvatar>
                  <Badge badgeContent={th.unreadCount || undefined} color="error">
                    <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 14 }}>
                      {initials(th.workerName)}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight={th.unreadCount ? 700 : 400} noWrap>
                      {th.workerName}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {th.latestSenderRole === 'agency' ? `${t('messages.you')}: ` : ''}{th.latestBody}
                    </Typography>
                  }
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                  {fmtTime(th.latestAt)}
                </Typography>
              </ListItemButton>
            ))}
          </List>
        )}
      </Paper>

      {/* Thread view */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedWorkerId ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Typography variant="body1" color="text.secondary">{t('messages.selectThread')}</Typography>
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setComposeOpen(true)}>
              {t('messages.newMessage')}
            </Button>
          </Box>
        ) : (
          <>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {selectedThread?.workerName ?? (thread?.worker ? `${thread.worker.firstName} ${thread.worker.lastName}` : '…')}
              </Typography>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {loadingThread && <CircularProgress size={24} />}
              {thread?.messages.map((msg) => {
                const isAgency = msg.senderRole === 'agency';
                return (
                  <Box key={msg._id} sx={{ display: 'flex', justifyContent: isAgency ? 'flex-end' : 'flex-start', mb: 1.5 }}>
                    {!isAgency && (
                      <Avatar sx={{ bgcolor: 'grey.400', width: 28, height: 28, fontSize: 12, mr: 1, mt: 0.5 }}>
                        {initials(msg.senderName)}
                      </Avatar>
                    )}
                    <Box sx={{ maxWidth: '70%' }}>
                      <Paper
                        elevation={0}
                        sx={{
                          px: 1.5, py: 1,
                          bgcolor: isAgency ? 'primary.main' : 'grey.100',
                          color: isAgency ? 'primary.contrastText' : 'text.primary',
                          borderRadius: 2,
                          borderTopRightRadius: isAgency ? 0 : 2,
                          borderTopLeftRadius: isAgency ? 2 : 0,
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {msg.body}
                        </Typography>
                      </Paper>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, textAlign: isAgency ? 'right' : 'left' }}>
                        {fmtTime(msg.createdAt)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
              {!loadingThread && thread?.messages.length === 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  {t('messages.noMessages')}
                </Typography>
              )}
              <div ref={bottomRef} />
            </Box>

            <Divider />
            {sendMutation.isError && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{t('common.error')}</Alert>}
            <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
              <TextField
                fullWidth size="small" multiline maxRows={4}
                placeholder={t('messages.placeholder')}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                inputProps={{ 'data-testid': 'message-input' }}
              />
              <IconButton color="primary" onClick={handleSend} disabled={!draft.trim() || sendMutation.isPending}>
                <SendIcon />
              </IconButton>
            </Stack>
          </>
        )}
      </Paper>

      {/* Compose dialog */}
      <Dialog open={composeOpen} onClose={() => setComposeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('messages.newMessage')}</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={workerData?.workers ?? []}
            getOptionLabel={(w: Worker) => `${w.firstName} ${w.lastName}`}
            onInputChange={(_, v) => setWorkerSearch(v)}
            onChange={(_, w) => w && handleSelectWorker(w)}
            renderInput={(params) => (
              <TextField {...params} autoFocus label={t('messages.searchWorker')} size="small" sx={{ mt: 1 }} />
            )}
            noOptionsText={workerSearch.length < 2 ? t('messages.typeToSearch') : t('workers.noResults')}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
