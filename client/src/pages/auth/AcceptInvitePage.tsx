import { useState } from 'react';
import { Alert, Box, Button, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api/auth';
import { portalHome } from '../../types';

export default function AcceptInvitePage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError(t('auth.validation.passwordMismatch')); return; }
    if (!token) { setError(t('auth.acceptInvite.invalidToken')); return; }
    setError(''); setLoading(true);
    try {
      const result = await authApi.acceptInvite({ token, password, firstName, lastName });
      setSuccess(true);
      setTimeout(() => {
        setAuth(result.user, result.accessToken);
        navigate(portalHome(result.user.role), { replace: true });
      }, 1200);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('auth.acceptInvite.invalidToken');
      setError(msg);
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <Box textAlign="center" py={2}>
        <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
        <Typography variant="h6" fontWeight={700} gutterBottom>Konto aktiviert!</Typography>
        <Typography variant="body2" color="text.secondary">Sie werden automatisch weitergeleitet…</Typography>
      </Box>
    );
  }

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
        <CardMembershipIcon color="primary" sx={{ fontSize: 28 }} />
        <Box>
          <Typography variant="h5" fontWeight={700} lineHeight={1}>{t('auth.acceptInvite.title')}</Typography>
          <Typography variant="caption" color="text.secondary">{t('auth.acceptInvite.subtitle')}</Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label={t('auth.acceptInvite.firstName')} fullWidth required value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
            <TextField label={t('auth.acceptInvite.lastName')} fullWidth required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Box>
          <TextField
            label={t('auth.acceptInvite.password')} type={showPw ? 'text' : 'password'}
            fullWidth required value={password} onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
              endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPw((v) => !v)} edge="end">{showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</IconButton></InputAdornment>,
            }}
          />
          <TextField
            label={t('auth.acceptInvite.confirmPassword')} type={showPw ? 'text' : 'password'}
            fullWidth required value={confirm} onChange={(e) => setConfirm(e.target.value)}
            error={Boolean(confirm && confirm !== password)}
            helperText={confirm && confirm !== password ? t('auth.validation.passwordMismatch') : ''}
            InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
          />
          <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}>
            {loading ? t('common.loading') : t('auth.acceptInvite.submit')}
          </Button>
        </Stack>
      </Box>
    </>
  );
}
