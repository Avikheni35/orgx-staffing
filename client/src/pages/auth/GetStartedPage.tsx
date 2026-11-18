import { useState } from 'react';
import {
  Alert, Box, Button, InputAdornment, IconButton,
  LinearProgress, Stack, Step, StepLabel, Stepper,
  TextField, Typography, Paper,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { APP_PLATFORM } from '../../config/brand';

interface RegisterPayload {
  agencyName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface RegisterResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'agency_admin';
    tenantId: string;
    language: 'de';
  };
  tenantCode: string;
}

const STEPS = ['Agentur-Infos', 'Admin-Konto', 'Fertig'];

export default function GetStartedPage() {
  const navigate = useNavigate();
  const [step, setStep]         = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [tenantCode, setTenantCode] = useState('');

  const [form, setForm] = useState<RegisterPayload>({
    agencyName: '',
    firstName:  '',
    lastName:   '',
    email:      '',
    password:   '',
  });

  function set(field: keyof RegisterPayload, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function nextStep() {
    setError('');
    setStep((s) => s + 1);
  }

  function validateStep0() {
    if (form.agencyName.trim().length < 2)
      return 'Agenturname muss mindestens 2 Zeichen lang sein.';
    return '';
  }

  function validateStep1() {
    if (!form.firstName.trim()) return 'Vorname ist erforderlich.';
    if (!form.lastName.trim())  return 'Nachname ist erforderlich.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return 'Bitte eine gültige E-Mail-Adresse eingeben.';
    if (form.password.length < 8)
      return 'Passwort muss mindestens 8 Zeichen lang sein.';
    return '';
  }

  async function handleSubmit() {
    const err = validateStep1();
    if (err) { setError(err); return; }

    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.post<RegisterResponse>(
        '/public/register',
        form
      );

      // Store tokens + hydrate auth store exactly like login
      useAuthStore.setState({
        accessToken:     data.accessToken,
        user: {
          id:        data.user.id,
          email:     data.user.email,
          firstName: data.user.firstName,
          lastName:  data.user.lastName,
          role:      data.user.role,
          tenantId:  data.user.tenantId,
          language:  data.user.language,
        },
        isAuthenticated: true,
        isInitializing:  false,
      });

      setTenantCode(data.tenantCode);
      setStep(2);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Registrierung fehlgeschlagen.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Paper elevation={3} sx={{ width: '100%', maxWidth: 520, p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={700}>
            {APP_PLATFORM} kostenlos testen
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            14 Tage gratis — kein Kreditkarte erforderlich
          </Typography>
        </Box>

        <Stepper activeStep={step} sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {loading && <LinearProgress sx={{ mb: 2 }} />}
        {error   && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Step 0 — Agency name */}
        {step === 0 && (
          <Stack spacing={2}>
            <TextField
              label="Agenturname"
              value={form.agencyName}
              onChange={(e) => set('agencyName', e.target.value)}
              fullWidth
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><BusinessIcon fontSize="small" /></InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => {
                const e = validateStep0();
                if (e) { setError(e); return; }
                nextStep();
              }}
            >
              Weiter
            </Button>
            <Typography variant="body2" textAlign="center" color="text.secondary">
              Bereits registriert?{' '}
              <RouterLink to="/login" style={{ color: 'inherit' }}>Anmelden</RouterLink>
            </Typography>
          </Stack>
        )}

        {/* Step 1 — Admin account */}
        {step === 1 && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Vorname"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                fullWidth
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start"><PersonIcon fontSize="small" /></InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Nachname"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                fullWidth
              />
            </Stack>
            <TextField
              label="E-Mail"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value.toLowerCase())}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><EmailIcon fontSize="small" /></InputAdornment>
                ),
              }}
            />
            <TextField
              label="Passwort"
              type={showPw ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><LockIcon fontSize="small" /></InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPw((v) => !v)}>
                      {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" fullWidth onClick={() => setStep(0)}>Zurück</Button>
              <Button variant="contained" size="large" fullWidth onClick={handleSubmit}>
                Konto erstellen
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              Mit der Registrierung akzeptieren Sie unsere{' '}
              <RouterLink to="/agb" style={{ color: 'inherit' }}>AGB</RouterLink>{' '}
              und{' '}
              <RouterLink to="/datenschutz" style={{ color: 'inherit' }}>Datenschutzrichtlinie</RouterLink>.
            </Typography>
          </Stack>
        )}

        {/* Step 2 — Done */}
        {step === 2 && (
          <Stack spacing={3} alignItems="center" textAlign="center">
            <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main' }} />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Ihr Konto ist bereit!
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                Login-Code: <strong>{tenantCode}</strong>
                <br />
                Sie haben 14 Tage kostenlosen Zugriff auf alle Starter-Funktionen.
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => navigate('/app/dashboard')}
            >
              Zum Dashboard
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
