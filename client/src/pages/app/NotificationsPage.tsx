import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { notificationsApi, AppNotification } from '../../api/notifications';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-page'],
    queryFn: () => notificationsApi.list({ limit: 100 }),
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-page'] });
      qc.invalidateQueries({ queryKey: ['notifications-bell'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-page'] });
      qc.invalidateQueries({ queryKey: ['notifications-bell'] });
    },
  });

  const handleClick = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n._id);
    if (n.link) navigate(n.link);
  };

  const items = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('notifications.title')}</Typography>
        {unread > 0 && (
          <Button variant="outlined" size="small" onClick={() => markAllRead.mutate()}>
            {t('notifications.markAllRead')}
          </Button>
        )}
      </Stack>

      <Paper>
        {isLoading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">{t('notifications.empty')}</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {items.map((n, i) => (
              <Box key={n._id}>
                <ListItem
                  button
                  onClick={() => handleClick(n)}
                  sx={{ bgcolor: n.readAt ? 'transparent' : 'action.hover', py: 1.5 }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="body1" fontWeight={n.readAt ? 400 : 700}>
                        {n.title}
                      </Typography>
                    }
                    secondary={
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mt={0.25}>
                        <Typography variant="body2" color="text.secondary">{n.body}</Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap', ml: 2 }}>
                          {fmtDate(n.createdAt)}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
                {i < items.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
