import { useState } from 'react';
import { useSearchParams, Link as RouterLink, Navigate } from 'react-router-dom';
import { APP_PLATFORM } from '@/config/brand';
import {
  Alert, Box, Button, Divider, InputAdornment, Link, Stack, TextField, Typography,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import BusinessIcon from '@mui/icons-material/Business';
import FactoryIcon from '@mui/icons-material/Factory';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ReceiptIcon from '@mui/icons-material/Receipt';
import StarHalfIcon from '@mui/icons-material/StarHalf';
import apiClient from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { portalHome } from '../../types';

const FEATURES = [
  { icon: <AssignmentIcon sx={{ fontSize: 20 }} />, text: 'Schichtübersicht & Mitarbeitereinsätze' },
  { icon: <FactoryIcon sx={{ fontSize: 20 }} />, text: 'Anwesenheit & Stundenzettel freigeben' },
  { icon: <ReceiptIcon sx={{ fontSize: 20 }} />, text: 'Rechnungen einsehen & herunterladen' },
  { icon: <StarHalfIcon sx={{ fontSize: 20 }} />, text: 'Mitarbeiterbewertungen abgeben' },
];

export default function ClientLoginPage() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isInitializing, user } = useAuthStore();

  const [tenantCode, setTenantCode] = useState(searchParams.get('code') ?? '');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  if (isInitializing) return null;
  if (isAuthenticated && user) return <Navigate to={portalHome(user.role)} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantCode.trim() || !email.trim()) return;
    setError(''); setLoading(true);
    try {
      await apiClient.post(
        '/auth/magic-link',
        { email },
        { headers: { 'X-Tenant-Code': tenantCode.trim().toLowerCase() } }
      );
      setSent(true);
    } catch {
      setError('Fehler beim Senden. Bitte Agenturcode und E-Mail-Adresse prüfen.');
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Left branding panel ── */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        width: '42%', flexShrink: 0,
        flexDirection: 'column', justifyContent: 'center',
        px: 6, py: 8,
        background: 'linear-gradient(160deg, #0c1a14 0%, #134e2a 55%, #166534 100%)',
        color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', top: -80, right: -90, pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(34,197,94,0.07)', bottom: 60, left: -40, pointerEvents: 'none' }} />

        <Stack spacing={1} mb={5} sx={{ position: 'relative' }}>
          <Box sx={{ width: 52, height: 52, borderRadius: 2, bgcolor: 'rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
            <BusinessIcon sx={{ fontSize: 28, color: '#86efac' }} />
          </Box>
          <Typography variant="overline" sx={{ color: '#4ade80', letterSpacing: 3, fontSize: '0.7rem' }}>{APP_PLATFORM}</Typography>
          <Typography variant="h4" fontWeight={800} lineHeight={1.2}>
            Kunden&shy;betrieb<br />Portal
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mt: 1, maxWidth: 280 }}>
            Ihr zentraler Zugang für Schichtverwaltung, Stundenzettel und Rechnungen Ihrer Zeitarbeitsfirma.
          </Typography>
        </Stack>

        <Stack spacing={2} sx={{ position: 'relative' }}>
          {FEATURES.map((f) => (
            <Stack key={f.text} direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 36, height: 36, borderRadius: 1.5, flexShrink: 0, bgcolor: 'rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#86efac' }}>
                {f.icon}
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>{f.text}</Typography>
            </Stack>
          ))}
        </Stack>

        <Box sx={{ mt: 'auto', pt: 6, position: 'relative' }}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mb: 2.5 }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)' }}>
            Zeitarbeitsagentur?{' '}
            <Link component={RouterLink} to="/login" sx={{ color: 'rgba(134,239,172,0.7)', textDecorationColor: 'transparent' }}>
              Zur Agentur-Anmeldung
            </Link>
          </Typography>
        </Box>
      </Box>

      {/* ── Right form panel ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: { xs: 3, sm: 6 }, py: 6, bgcolor: 'background.default' }}>
        {/* Mobile logo */}
        <Stack alignItems="center" spacing={0.5} mb={4} sx={{ display: { md: 'none' } }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 2, background: 'linear-gradient(135deg, #134e2a, #22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BusinessIcon sx={{ color: '#fff', fontSize: 26 }} />
          </Box>
          <Typography variant="h6" fontWeight={700}>Kundenportal</Typography>
        </Stack>

        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {sent ? (
            <Box textAlign="center">
              <EmailIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" fontWeight={700} mb={1}>Link gesendet!</Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Falls Ihre E-Mail-Adresse bekannt ist, erhalten Sie einen Anmeldelink. Bitte prüfen Sie Ihren Posteingang.
              </Typography>
              <Button variant="outlined" fullWidth onClick={() => setSent(false)}>Nochmal senden</Button>
            </Box>
          ) : (
            <>
              <Typography variant="h5" fontWeight={700} mb={0.5}>Kundenportal – Anmeldung</Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Geben Sie Ihren Agenturcode und Ihre E-Mail ein. Sie erhalten einen sicheren Anmeldelink per E-Mail.
              </Typography>

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <form onSubmit={handleSubmit}>
                <Stack spacing={2.5}>
                  <TextField
                    label="Agenturcode" fullWidth required
                    value={tenantCode} onChange={(e) => setTenantCode(e.target.value)}
                    placeholder="z. B. demo"
                    helperText="Den Agenturcode erhalten Sie von Ihrer Zeitarbeitsfirma."
                    autoFocus={!tenantCode}
                    InputProps={{ startAdornment: <InputAdornment position="start"><BusinessIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                  />
                  <TextField
                    label="E-Mail-Adresse" type="email" fullWidth required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email" autoFocus={Boolean(tenantCode)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                  />
                  <Button
                    type="submit" variant="contained" fullWidth size="large"
                    disabled={loading || !tenantCode.trim() || !email.trim()}
                    sx={{ background: 'linear-gradient(135deg, #134e2a, #22c55e)', '&:hover': { background: 'linear-gradient(135deg, #134e2a, #16a34a)' }, fontWeight: 700, py: 1.4 }}
                  >
                    {loading ? 'Wird gesendet…' : 'Anmeldelink senden'}
                  </Button>
                </Stack>
              </form>

              <Divider sx={{ my: 3 }} />
              <Button component={RouterLink} to="/login" variant="outlined" fullWidth color="inherit" sx={{ borderColor: 'divider', color: 'text.secondary' }}>
                Zur Agentur-Anmeldung
              </Button>
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
