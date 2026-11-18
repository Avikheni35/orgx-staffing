import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { portalHome } from '../types';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 3 }}>
      <Box>
        <Typography variant="h1" color="text.disabled" fontWeight={900}>404</Typography>
        <Typography variant="h5" gutterBottom>{t('error.404.title')}</Typography>
        <Typography color="text.secondary" mb={3}>{t('error.404.description')}</Typography>
        <Button variant="contained" onClick={() => navigate(user ? portalHome(user.role) : '/login')}>
          {t('error.404.action')}
        </Button>
      </Box>
    </Box>
  );
}
