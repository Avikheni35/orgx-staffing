import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import LockResetIcon from '@mui/icons-material/LockReset';
import PersonIcon from '@mui/icons-material/Person';
import { settingsApi, UpdateStaffProfile } from '../../../api/settings';

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box mb={3}>
      <Typography variant="subtitle2" color="text.secondary" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      {children}
    </Box>
  );
}

const ROLE_LABEL: Record<string, string> = {
  agency_admin: 'Administrator',
  disponent: 'Disponent',
  super_admin: 'Super Admin',
};

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['staff-profile'],
    queryFn: settingsApi.getProfile,
  });

  const [form, setForm] = useState<UpdateStaffProfile>({
    firstName: '',
    lastName: '',
    phone: '',
    language: 'de',
    notificationPreferences: { email: true, sms: false, push: false },
  });

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (!data) return;
    setForm({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? '',
      language: data.language,
      notificationPreferences: { ...data.notificationPreferences },
    });
  }, [data]);

  const profileMutation = useMutation({
    mutationFn: (payload: UpdateStaffProfile) => settingsApi.updateProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-profile'] });
      setSaved(true);
      setSaveError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: unknown) => {
      setSaveError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Fehler beim Speichern'
      );
    },
  });

  const pwMutation = useMutation({
    mutationFn: () => settingsApi.changePassword(pwForm.current, pwForm.next),
    onSuccess: () => {
      setPwSaved(true);
      setPwError('');
      setPwForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setPwSaved(false), 3000);
    },
    onError: (err: unknown) => {
      setPwError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Fehler beim Ändern des Passworts'
      );
    },
  });

  const handleSave = () => {
    profileMutation.mutate({
      ...form,
      phone: form.phone || undefined,
    });
  };

  const handlePwSave = () => {
    if (pwForm.next !== pwForm.confirm) {
      setPwError('Passwörter stimmen nicht überein');
      return;
    }
    if (pwForm.next.length < 8) {
      setPwError('Mindestens 8 Zeichen erforderlich');
      return;
    }
    setPwError('');
    pwMutation.mutate();
  };

  if (isLoading) return <CircularProgress />;
  if (!data) return null;

  const isAdmin = data.role === 'agency_admin' || data.role === 'super_admin';

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 48, height: 48, borderRadius: '50%', bgcolor: 'primary.main',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <PersonIcon sx={{ color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {data.firstName} {data.lastName}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">{data.email}</Typography>
              <Chip label={ROLE_LABEL[data.role] ?? data.role} size="small" color={isAdmin ? 'primary' : 'default'} />
            </Stack>
          </Box>
        </Stack>
        {tab === 0 && (
          <Button
            variant="contained"
            startIcon={saved ? <CheckIcon /> : <SaveIcon />}
            color={saved ? 'success' : 'primary'}
            onClick={handleSave}
            disabled={profileMutation.isPending}
          >
            {profileMutation.isPending ? 'Speichern...' : saved ? 'Gespeichert' : 'Speichern'}
          </Button>
        )}
      </Stack>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label="Profil" />
          <Tab label="Passwort ändern" />
          <Tab label="Benachrichtigungen" />
        </Tabs>

        <CardContent sx={{ p: 3 }}>
          {/* ── Profil ─────────────────────────────────── */}
          <TabPanel value={tab} index={0}>
            {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

            <Section title="PERSÖNLICHE DATEN">
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Vorname"
                    fullWidth
                    value={form.firstName ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Nachname"
                    fullWidth
                    value={form.lastName ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="E-Mail-Adresse"
                    fullWidth
                    value={data.email}
                    disabled
                    helperText="Die E-Mail-Adresse kann nicht selbst geändert werden"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Telefonnummer"
                    fullWidth
                    value={form.phone ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+49 151 12345678"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Sprache"
                    select
                    fullWidth
                    value={form.language ?? 'de'}
                    onChange={(e) => setForm((p) => ({ ...p, language: e.target.value as 'de' | 'en' }))}
                  >
                    <MenuItem value="de">Deutsch</MenuItem>
                    <MenuItem value="en">English</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </Section>

            <Section title="KONTO-INFORMATIONEN">
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField label="Rolle" value={ROLE_LABEL[data.role] ?? data.role} disabled fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Mitglied seit"
                    value={new Date(data.createdAt).toLocaleDateString('de-DE')}
                    disabled
                    fullWidth
                  />
                </Grid>
                {data.lastLoginAt && (
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Letzte Anmeldung"
                      value={new Date(data.lastLoginAt).toLocaleDateString('de-DE')}
                      disabled
                      fullWidth
                    />
                  </Grid>
                )}
              </Grid>
            </Section>
          </TabPanel>

          {/* ── Passwort ───────────────────────────────── */}
          <TabPanel value={tab} index={1}>
            {pwError && <Alert severity="error" sx={{ mb: 2 }}>{pwError}</Alert>}
            {pwSaved && <Alert severity="success" sx={{ mb: 2 }}>Passwort erfolgreich geändert. Alle anderen Sitzungen wurden abgemeldet.</Alert>}

            <Section title="PASSWORT ÄNDERN">
              <Alert severity="info" sx={{ mb: 3 }}>
                Nach der Änderung werden alle anderen aktiven Sitzungen automatisch abgemeldet.
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Aktuelles Passwort"
                    type="password"
                    fullWidth
                    value={pwForm.current}
                    onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                    autoComplete="current-password"
                  />
                </Grid>
                <Grid item xs={12} />
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Neues Passwort"
                    type="password"
                    fullWidth
                    value={pwForm.next}
                    onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                    helperText="Mindestens 8 Zeichen"
                    autoComplete="new-password"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Neues Passwort bestätigen"
                    type="password"
                    fullWidth
                    value={pwForm.confirm}
                    onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                    error={!!pwForm.confirm && pwForm.confirm !== pwForm.next}
                    helperText={pwForm.confirm && pwForm.confirm !== pwForm.next ? 'Passwörter stimmen nicht überein' : ''}
                    autoComplete="new-password"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    startIcon={pwSaved ? <CheckIcon /> : <LockResetIcon />}
                    color={pwSaved ? 'success' : 'primary'}
                    onClick={handlePwSave}
                    disabled={pwMutation.isPending || !pwForm.current || !pwForm.next || !pwForm.confirm}
                  >
                    {pwMutation.isPending ? 'Wird geändert...' : pwSaved ? 'Geändert' : 'Passwort ändern'}
                  </Button>
                </Grid>
              </Grid>
            </Section>
          </TabPanel>

          {/* ── Benachrichtigungen ─────────────────────── */}
          <TabPanel value={tab} index={2}>
            <Section title="BENACHRICHTIGUNGSKANÄLE">
              <Alert severity="info" sx={{ mb: 3 }}>
                Einige Benachrichtigungen (z.&nbsp;B. Sicherheitshinweise) werden unabhängig von diesen Einstellungen gesendet.
              </Alert>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.notificationPreferences?.email ?? true}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          notificationPreferences: { ...p.notificationPreferences!, email: e.target.checked },
                        }))
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>E-Mail-Benachrichtigungen</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Neue Aufgaben, Genehmigungen, Statusänderungen
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.notificationPreferences?.sms ?? false}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          notificationPreferences: { ...p.notificationPreferences!, sms: e.target.checked },
                        }))
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>SMS-Benachrichtigungen</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Dringende Hinweise per Textnachricht (Telefonnummer erforderlich)
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.notificationPreferences?.push ?? false}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          notificationPreferences: { ...p.notificationPreferences!, push: e.target.checked },
                        }))
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>Push-Benachrichtigungen</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Browser- oder App-Benachrichtigungen (Phase 2)
                      </Typography>
                    </Box>
                  }
                />
              </Stack>
            </Section>

            <Button
              variant="contained"
              startIcon={saved ? <CheckIcon /> : <SaveIcon />}
              color={saved ? 'success' : 'primary'}
              onClick={handleSave}
              disabled={profileMutation.isPending}
              sx={{ mt: 1 }}
            >
              {profileMutation.isPending ? 'Speichern...' : saved ? 'Gespeichert' : 'Einstellungen speichern'}
            </Button>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
}
