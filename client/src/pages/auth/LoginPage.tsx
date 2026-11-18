import { useState } from 'react';
import { APP_PLATFORM, APP_STAFFING } from '@/config/brand';
import {
  Alert, Box, Button, Divider, InputAdornment, IconButton,
  Link, Stack, TextField, Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useLocation, useSearchParams, Navigate } from 'react-router-dom';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import GroupsIcon from '@mui/icons-material/Groups';
import ScheduleIcon from '@mui/icons-material/Schedule';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import DescriptionIcon from '@mui/icons-material/Description';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api/auth';
import { portalHome } from '../../types';

const FEATURES = [
  { icon: <GroupsIcon sx={{ fontSize: 20 }} />, text: 'Mitarbeiterpool & Qualifikationen verwalten' },
  { icon: <ScheduleIcon sx={{ fontSize: 20 }} />, text: 'Schichtplanung & automatische Stundenzettel' },
  { icon: <VerifiedUserIcon sx={{ fontSize: 20 }} />, text: 'AÜG-Compliance — 9/18-Monats-Tracking' },
  { icon: <DescriptionIcon sx={{ fontSize: 20 }} />, text: 'Verträge, Rechnungen & DATEV-Export' },
];

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isInitializing, user, setAuth } = useAuthStore();

  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState('');
  const [tenantCode, setTenantCode] = useState(searchParams.get('tenant') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = (location.state as { from?: Location })?.from?.pathname;

  if (isInitializing) return null;
  if (isAuthenticated && user) return <Navigate to={portalHome(user.role)} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await authApi.login({ email, password });
      if (result.requiresOtp) { setStep('otp'); return; }
      setAuth(result.user!, result.accessToken!);
      navigate(from ?? portalHome(result.user!.role), { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error');
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await authApi.verifyOtp(email, otp);
      setAuth(result.user, result.accessToken);
      navigate(from ?? portalHome(result.user.role), { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error');
      setError(msg); setOtp('');
    } finally { setLoading(false); }
  };

  const handleMagicLink = async () => {
    if (!email) { setError(t('auth.validation.emailRequired')); return; }
    if (!tenantCode.trim()) { setError(t('auth.validation.tenantCodeRequired')); return; }
    setLoading(true); setError('');
    try {
      await authApi.sendMagicLink(email, tenantCode);
      navigate('/magic-link-sent', { state: { email } });
    } catch { setError(t('common.error')); }
    finally { setLoading(false); }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Left branding panel ── */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        width: '42%', flexShrink: 0,
        flexDirection: 'column', justifyContent: 'center',
        px: 6, py: 8,
        background: 'linear-gradient(160deg, #0a1628 0%, #1e3a5f 55%, #1e4db7 100%)',
        color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', top: -80, right: -100, pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'rgba(59,130,246,0.07)', bottom: 60, left: -50, pointerEvents: 'none' }} />

        <Stack spacing={1} mb={5} sx={{ position: 'relative' }}>
          <Box sx={{ width: 52, height: 52, borderRadius: 2, bgcolor: 'rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
            <BusinessCenterIcon sx={{ fontSize: 28, color: '#93c5fd' }} />
          </Box>
          <Typography variant="overline" sx={{ color: '#60a5fa', letterSpacing: 3, fontSize: '0.7rem' }}>{APP_PLATFORM}</Typography>
          <Typography variant="h4" fontWeight={800} lineHeight={1.2}>
            Zeitarbeit<br />digital verwalten
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mt: 1, maxWidth: 280 }}>
            Das Agentur-Portal für deutsche Zeitarbeitsfirmen — von der Schichtplanung bis zur AÜG-Compliance.
          </Typography>
        </Stack>

        <Stack spacing={2} sx={{ position: 'relative' }}>
          {FEATURES.map((f) => (
            <Stack key={f.text} direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 36, height: 36, borderRadius: 1.5, flexShrink: 0, bgcolor: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93c5fd' }}>
                {f.icon}
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>{f.text}</Typography>
            </Stack>
          ))}
        </Stack>

        <Box sx={{ mt: 'auto', pt: 6, position: 'relative' }}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mb: 2.5 }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)' }}>
            Kundenbetrieb?{' '}
            <Link component={RouterLink} to="/client/login" sx={{ color: 'rgba(147,197,253,0.7)', textDecorationColor: 'transparent' }}>
              client/login
            </Link>
          </Typography>
        </Box>
      </Box>

      {/* ── Right form panel ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: { xs: 3, sm: 6 }, py: 6, bgcolor: 'background.default' }}>
        {/* Mobile logo */}
        <Stack alignItems="center" spacing={0.5} mb={4} sx={{ display: { md: 'none' } }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 2, background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BusinessCenterIcon sx={{ color: '#fff', fontSize: 26 }} />
          </Box>
          <Typography variant="h6" fontWeight={700}>{APP_STAFFING}</Typography>
        </Stack>

        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {step === 'credentials' ? (
            <>
              <Typography variant="h5" fontWeight={700} mb={0.5}>Willkommen zurück</Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>Melden Sie sich im Agentur-Portal an.</Typography>

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <form onSubmit={handleSubmit}>
                <Stack spacing={2.5}>
                  <TextField
                    label={t('auth.login.email')} type="email" fullWidth required autoFocus
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                  />
                  <TextField
                    label={t('auth.login.password')} type={showPw ? 'text' : 'password'} fullWidth required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPw((v) => !v)} edge="end">
                            {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
                    <Link component={RouterLink} to="/forgot-password" variant="caption">{t('auth.login.forgotPassword')}</Link>
                  </Box>
                  <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}
                    sx={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', '&:hover': { background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }, fontWeight: 700, py: 1.4 }}>
                    {loading ? t('common.loading') : t('auth.login.submit')}
                  </Button>
                </Stack>
              </form>

              <Divider sx={{ my: 3 }}>
                <Typography variant="caption" color="text.disabled">{t('auth.login.orDivider')}</Typography>
              </Divider>

              <Stack spacing={2}>
                <TextField
                  label={t('auth.login.agencyCode')} fullWidth
                  value={tenantCode} onChange={(e) => setTenantCode(e.target.value)}
                  placeholder="z. B. demo" helperText={t('auth.login.agencyCodeHint')}
                />
                <Button variant="outlined" fullWidth size="large" disabled={loading || !tenantCode.trim()} onClick={handleMagicLink} color="inherit" sx={{ borderColor: 'divider', color: 'text.secondary' }}>
                  {loading ? t('common.loading') : t('auth.login.magicLink')}
                </Button>
              </Stack>
            </>
          ) : (
            <>
              <Typography variant="h5" fontWeight={700} mb={0.5}>{t('auth.otp.title')}</Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>{t('auth.otp.subtitle', { email })}</Typography>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <form onSubmit={handleOtp}>
                <Stack spacing={2.5}>
                  <TextField
                    label={t('auth.otp.code')} fullWidth required autoFocus
                    value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputProps={{ inputMode: 'numeric', maxLength: 6 }} autoComplete="one-time-code" placeholder="000000"
                  />
                  <Button type="submit" variant="contained" fullWidth size="large" disabled={loading || otp.length !== 6}
                    sx={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', fontWeight: 700, py: 1.4 }}>
                    {loading ? t('common.loading') : t('auth.otp.submit')}
                  </Button>
                  <Button variant="text" fullWidth disabled={loading} onClick={() => { setStep('credentials'); setError(''); setOtp(''); }}>
                    {t('auth.otp.back')}
                  </Button>
                </Stack>
              </form>
            </>
          )}
        </Box>

        <Stack direction="row" spacing={2} mt={6} flexWrap="wrap" justifyContent="center">
          <Link component={RouterLink} to="/impressum" variant="caption" color="text.disabled" underline="hover">Impressum</Link>
          <Link component={RouterLink} to="/datenschutz" variant="caption" color="text.disabled" underline="hover">Datenschutz</Link>
          <Link component={RouterLink} to="/agb" variant="caption" color="text.disabled" underline="hover">AGB</Link>
        </Stack>
      </Box>
    </Box>
  );
}
