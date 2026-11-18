import { useState } from 'react';
import { Alert, Box, Button, IconButton, InputAdornment, Stack, TextField, Typography, Link } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { authApi } from '../../api/auth';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError(t('auth.validation.passwordMismatch')); return; }
    if (password.length < 8) { setError(t('auth.validation.passwordMinLength')); return; }
    if (!token) { setError(t('auth.resetPassword.invalidToken')); return; }
    setError(''); setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('auth.resetPassword.invalidToken');
      setError(msg);
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <Box textAlign="center" py={2}>
        <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
        <Typography variant="h6" fontWeight={700} gutterBottom>Passwort gesetzt</Typography>
        <Typography variant="body2" color="text.secondary">{t('auth.resetPassword.success')}</Typography>
        <Typography variant="caption" color="text.disabled" display="block" mt={1}>
          Sie werden weitergeleitet…
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('auth.resetPassword.title')}</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Wählen Sie ein neues sicheres Passwort (mind. 8 Zeichen).
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            label={t('auth.resetPassword.password')} type={showPw ? 'text' : 'password'}
            fullWidth required autoFocus value={password} onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
              endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPw((v) => !v)} edge="end">{showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</IconButton></InputAdornment>,
            }}
          />
          <TextField
            label={t('auth.resetPassword.confirmPassword')} type={showConfirm ? 'text' : 'password'}
            fullWidth required value={confirm} onChange={(e) => setConfirm(e.target.value)}
            error={Boolean(confirm && confirm !== password)}
            helperText={confirm && confirm !== password ? t('auth.validation.passwordMismatch') : ''}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
              endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowConfirm((v) => !v)} edge="end">{showConfirm ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</IconButton></InputAdornment>,
            }}
          />
          <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}>
            {loading ? t('common.loading') : t('auth.resetPassword.submit')}
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
