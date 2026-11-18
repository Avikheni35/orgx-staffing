import { Box, Button, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { portalHome } from '../types';

export default function UnauthorizedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 3 }}>
      <Box>
        <LockOutlinedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" gutterBottom>{t('error.403.title')}</Typography>
        <Typography color="text.secondary" mb={3}>{t('error.403.description')}</Typography>
        <Button variant="contained" onClick={() => navigate(user ? portalHome(user.role) : '/login')}>
          {t('error.403.action')}
        </Button>
      </Box>
    </Box>
  );
}
