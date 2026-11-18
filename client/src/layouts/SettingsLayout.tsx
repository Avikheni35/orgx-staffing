import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Paper, Typography } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import GavelIcon from '@mui/icons-material/Gavel';
import FolderIcon from '@mui/icons-material/Folder';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PaymentIcon from '@mui/icons-material/Payment';
import DescriptionIcon from '@mui/icons-material/Description';
import LinkIcon from '@mui/icons-material/Link';
import TuneIcon from '@mui/icons-material/Tune';
import { useTranslation } from 'react-i18next';

const NAV = [
  { label: 'settings.nav.agency',        path: '/app/settings/agency',        icon: <BusinessIcon fontSize="small" /> },
  { label: 'settings.nav.compliance',    path: '/app/settings/compliance',    icon: <GavelIcon fontSize="small" /> },
  { label: 'settings.nav.features',      path: '/app/settings/features',      icon: <TuneIcon fontSize="small" /> },
  { label: 'settings.nav.documents',     path: '/app/settings/documents',     icon: <FolderIcon fontSize="small" /> },
  { label: 'settings.nav.notifications', path: '/app/settings/notifications', icon: <NotificationsIcon fontSize="small" /> },
  { label: 'settings.nav.billing',       path: '/app/settings/billing',       icon: <PaymentIcon fontSize="small" /> },
  { label: 'settings.nav.templates',     path: '/app/settings/templates',     icon: <DescriptionIcon fontSize="small" /> },
  { label: 'settings.nav.integrations',  path: '/app/settings/integrations',  icon: <LinkIcon fontSize="small" /> },
] as const;

export default function SettingsLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
      <Paper sx={{ width: 220, flexShrink: 0, py: 1 }}>
        <Typography variant="overline" sx={{ px: 2, display: 'block', color: 'text.secondary', mb: 0.5 }}>
          {t('nav.settings')}
        </Typography>
        <List dense disablePadding>
          {NAV.map(({ label, path, icon }) => {
            const active = location.pathname === path;
            return (
              <ListItemButton
                key={path}
                component={NavLink}
                to={path}
                selected={active}
                sx={{
                  borderRadius: 1,
                  mx: 0.5,
                  '&.active': { bgcolor: 'primary.50', color: 'primary.main' },
                  '& .MuiListItemIcon-root': { minWidth: 32 },
                }}
              >
                <ListItemIcon sx={{ color: active ? 'primary.main' : 'text.secondary' }}>
                  {icon}
                </ListItemIcon>
                <ListItemText
                  primary={t(label)}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Paper>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
