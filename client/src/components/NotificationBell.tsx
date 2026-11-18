import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Box,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Popover,
  Stack,
  Tooltip,
  Typography,
  Button,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useTranslation } from 'react-i18next';
import { notificationsApi, AppNotification } from '../api/notifications';

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const { data } = useQuery({
    queryKey: ['notifications-bell'],
    queryFn: () => notificationsApi.list({ limit: 10 }),
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications-bell'] }),
  });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications-bell'] }),
  });

  const unread = data?.unreadCount ?? 0;
  const items = data?.notifications ?? [];

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  const handleClick = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n._id);
    if (n.link) navigate(n.link);
    handleClose();
  };

  const handleViewAll = () => {
    handleClose();
    navigate('/app/notifications');
  };

  return (
    <>
      <Tooltip title={t('notifications.title')}>
        <IconButton onClick={handleOpen} size="small" sx={{ color: 'inherit' }}>
          <Badge badgeContent={unread || undefined} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxHeight: 480 } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>{t('notifications.title')}</Typography>
          {unread > 0 && (
            <Button size="small" onClick={() => markAllRead.mutate()}>
              {t('notifications.markAllRead')}
            </Button>
          )}
        </Stack>
        <Divider />

        {items.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">{t('notifications.empty')}</Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ overflow: 'auto', maxHeight: 340 }}>
            {items.map((n) => (
              <ListItem
                key={n._id}
                button
                onClick={() => handleClick(n)}
                divider
                sx={{ bgcolor: n.readAt ? 'transparent' : 'action.hover', alignItems: 'flex-start' }}
              >
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight={n.readAt ? 400 : 700} noWrap>
                      {n.title}
                    </Typography>
                  }
                  secondary={
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {n.body}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {relativeTime(n.createdAt)}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        <Divider />
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Button size="small" onClick={handleViewAll}>{t('notifications.viewAll')}</Button>
        </Box>
      </Popover>
    </>
  );
}
