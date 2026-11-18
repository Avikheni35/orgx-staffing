import { useState } from 'react';
import { Alert, Box, Button, InputAdornment, Stack, TextField, Typography, Link } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import EmailIcon from '@mui/icons-material/Email';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { authApi } from '../../api/auth';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch {
      setError(t('common.error'));
    } finally { setLoading(false); }
  };

  if (submitted) {
    return (
      <Box textAlign="center" py={2}>
        <MarkEmailReadIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
        <Typography variant="h6" fontWeight={700} gutterBottom>E-Mail gesendet</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('auth.forgotPassword.success')}
        </Typography>
        <Link component={RouterLink} to="/login" variant="body2" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          {t('auth.forgotPassword.back')}
        </Link>
      </Box>
    );
  }

  return (
    <>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('auth.forgotPassword.title')}</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>{t('auth.forgotPassword.description')}</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            label={t('auth.forgotPassword.email')} type="email" fullWidth required
            value={email} onChange={(e) => setEmail(e.target.value)}
            autoFocus
            InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
          />
          <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}>
            {loading ? t('common.loading') : t('auth.forgotPassword.submit')}
          </Button>
        </Stack>
      </Box>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Link component={RouterLink} to="/login" variant="body2" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          {t('auth.forgotPassword.back')}
        </Link>
      </Box>
    </>
  );
}
