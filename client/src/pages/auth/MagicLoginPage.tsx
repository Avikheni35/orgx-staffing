import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { portalHome } from '../../types';

export default function MagicLoginPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    const tenantCode = searchParams.get('tenant') ?? undefined;
    authApi
      .loginWithMagicLink(token, tenantCode)
      .then((result) => {
        setAuth(result.user, result.accessToken);
        navigate(portalHome(result.user.role), { replace: true });
      })
      .catch(() => { setError(t('auth.magicLogin.error')); });
  }, [token]);

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      bgcolor: '#f1f5f9', px: 3,
    }}>
      <Box sx={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <Box sx={{
          width: 64, height: 64, borderRadius: 2,
          background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          mx: 'auto', mb: 3,
        }}>
          <BusinessCenterIcon sx={{ color: '#fff', fontSize: 32 }} />
        </Box>

        {error ? (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h6" fontWeight={700} gutterBottom>Link ungültig</Typography>
              <Typography variant="body2" color="text.secondary">{error}</Typography>
            </Box>
            <Alert severity="error">{error}</Alert>
            <Button variant="contained" fullWidth size="large" startIcon={<ArrowBackIcon />} onClick={() => navigate('/login')}>
              {t('auth.magicLogin.back')}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2} alignItems="center">
            <CircularProgress size={36} />
            <Typography variant="body1" fontWeight={500}>{t('auth.magicLogin.verifying')}</Typography>
            <Typography variant="caption" color="text.disabled">Einen Moment bitte…</Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
