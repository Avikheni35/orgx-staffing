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
  Grid,
  InputAdornment,
  Stack,
  Switch,
  FormControlLabel,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import LockIcon from '@mui/icons-material/Lock';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { workerPortalApi, WorkerProfileUpdate } from '../../api/workerPortal';
import { pushApi, registerServiceWorker, urlBase64ToUint8Array } from '../../api/push';

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

const GENDER_LABEL: Record<string, string> = {
  male: 'Männlich',
  female: 'Weiblich',
  diverse: 'Divers',
  not_specified: 'Keine Angabe',
};

const LANG_LEVEL_LABEL: Record<string, string> = {
  basic: 'Grundkenntnisse',
  conversational: 'Konversationssicher',
  fluent: 'Fließend',
  native: 'Muttersprache',
};

export default function WorkerProfilePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [pushEnabled, setPushEnabled]     = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushLoading, setPushLoading]     = useState(false);
  const [pushMessage, setPushMessage]     = useState('');

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setPushEnabled(!!sub);
        });
      }).catch(() => {/* no-op */});
    }
  }, []);

  const handlePushToggle = async () => {
    setPushLoading(true);
    setPushMessage('');
    try {
      const reg = await registerServiceWorker();
      if (!reg) { setPushMessage('Push-Benachrichtigungen werden nicht unterstützt.'); return; }
      const existing = await reg.pushManager.getSubscription();
      if (pushEnabled && existing) {
        await pushApi.unsubscribe(existing.endpoint);
        await existing.unsubscribe();
        setPushEnabled(false);
        setPushMessage('Push-Benachrichtigungen deaktiviert.');
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { setPushMessage('Berechtigung verweigert.'); return; }
        const { data: keyData } = await pushApi.getVapidPublicKey();
        if (!keyData.publicKey) { setPushMessage('Push nicht konfiguriert.'); return; }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        });
        await pushApi.subscribe(sub.toJSON() as PushSubscriptionJSON);
        setPushEnabled(true);
        setPushMessage('Push-Benachrichtigungen aktiviert.');
      }
    } catch {
      setPushMessage('Fehler beim Einrichten der Benachrichtigungen.');
    } finally {
      setPushLoading(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['worker-profile'],
    queryFn: workerPortalApi.getProfile,
  });

  const [contact, setContact] = useState({
    phone: '',
    street: '', city: '', postalCode: '', country: 'DE',
  });
  const [tax, setTax] = useState({
    steuerklasse: '', steuernummer: '', sozialversicherungsnummer: '', healthInsuranceProvider: '',
  });
  const [bank, setBank] = useState({ iban: '', bankName: '' });

  useEffect(() => {
    if (!data) return;
    setContact({
      phone: data.phone ?? '',
      street: data.address.street ?? '',
      city: data.address.city ?? '',
      postalCode: data.address.postalCode ?? '',
      country: data.address.country ?? 'DE',
    });
    setTax({
      steuerklasse: data.steuerklasse ?? '',
      steuernummer: data.steuernummer ?? '',
      sozialversicherungsnummer: data.sozialversicherungsnummer ?? '',
      healthInsuranceProvider: data.healthInsuranceProvider ?? '',
    });
    setBank({ iban: data.iban ?? '', bankName: data.bankName ?? '' });
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: WorkerProfileUpdate) => workerPortalApi.updateProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Fehler beim Speichern'
      );
    },
  });

  const handleSave = () => {
    mutation.mutate({
      phone: contact.phone || undefined,
      address: {
        street: contact.street || undefined,
        city: contact.city || undefined,
        postalCode: contact.postalCode || undefined,
        country: contact.country || 'DE',
      },
      steuerklasse: tax.steuerklasse || undefined,
      steuernummer: tax.steuernummer || undefined,
      sozialversicherungsnummer: tax.sozialversicherungsnummer || undefined,
      healthInsuranceProvider: tax.healthInsuranceProvider || undefined,
      iban: bank.iban || undefined,
      bankName: bank.bankName || undefined,
    });
  };

  if (isLoading) return <CircularProgress />;
  if (!data) return null;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {data.firstName} {data.lastName}
          </Typography>
          <Typography variant="body2" color="text.secondary">{data.email}</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={saved ? <CheckIcon /> : <SaveIcon />}
          color={saved ? 'success' : 'primary'}
          onClick={handleSave}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Speichern...' : saved ? 'Gespeichert' : 'Speichern'}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label="Persönliche Daten" />
          <Tab label="Kontakt & Adresse" />
          <Tab label="Steuer & Soziales" />
          <Tab label="Bankverbindung" />
          <Tab label="Benachrichtigungen" icon={<NotificationsIcon />} iconPosition="start" />
        </Tabs>

        <CardContent sx={{ p: 3 }}>
          {/* ── Persönliche Daten ─────────────────────── */}
          <TabPanel value={tab} index={0}>
            <Section title="STAMMDATEN">
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Name, Geburtsdatum, Nationalität und Geschlecht werden von Ihrer Agentur verwaltet.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField label="Vorname" value={data.firstName} disabled fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Nachname" value={data.lastName} disabled fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="E-Mail-Adresse" value={data.email} disabled fullWidth />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Geburtsdatum"
                    value={data.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString('de-DE') : '—'}
                    disabled
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Geschlecht"
                    value={data.gender ? GENDER_LABEL[data.gender] ?? data.gender : '—'}
                    disabled
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField label="Nationalität" value={data.nationality ?? '—'} disabled fullWidth />
                </Grid>
              </Grid>
            </Section>

            {(data.skills.length > 0 || data.languages.length > 0) && (
              <Section title="QUALIFIKATIONEN">
                {data.skills.length > 0 && (
                  <Box mb={2}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      Fähigkeiten
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      {data.skills.map((s) => (
                        <Chip key={s} label={s} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Box>
                )}
                {data.languages.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      Sprachen
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      {data.languages.map((l, i) => (
                        <Chip
                          key={i}
                          label={`${l.language} · ${LANG_LEVEL_LABEL[l.level] ?? l.level}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Section>
            )}
          </TabPanel>

          {/* ── Kontakt & Adresse ─────────────────────── */}
          <TabPanel value={tab} index={1}>
            <Section title="KONTAKTDATEN">
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Telefonnummer"
                    fullWidth
                    value={contact.phone}
                    onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+49 151 12345678"
                  />
                </Grid>
              </Grid>
            </Section>

            <Section title="WOHNANSCHRIFT">
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Straße und Hausnummer"
                    fullWidth
                    value={contact.street}
                    onChange={(e) => setContact((p) => ({ ...p, street: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Postleitzahl"
                    fullWidth
                    value={contact.postalCode}
                    onChange={(e) => setContact((p) => ({ ...p, postalCode: e.target.value }))}
                    inputProps={{ maxLength: 10 }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Stadt"
                    fullWidth
                    value={contact.city}
                    onChange={(e) => setContact((p) => ({ ...p, city: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Land"
                    fullWidth
                    value={contact.country}
                    onChange={(e) => setContact((p) => ({ ...p, country: e.target.value }))}
                  />
                </Grid>
              </Grid>
            </Section>
          </TabPanel>

          {/* ── Steuer & Soziales ─────────────────────── */}
          <TabPanel value={tab} index={2}>
            <Alert severity="info" icon={<LockIcon />} sx={{ mb: 3 }}>
              Diese Daten sind vertraulich und werden nur für die Lohnabrechnung verwendet.
              Sie werden verschlüsselt gespeichert und nicht an Dritte weitergegeben.
            </Alert>

            <Section title="STEUERDATEN">
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Steuerklasse"
                    fullWidth
                    value={tax.steuerklasse}
                    onChange={(e) => setTax((p) => ({ ...p, steuerklasse: e.target.value }))}
                    placeholder="z. B. I"
                    helperText="Steuerklasse I–VI"
                  />
                </Grid>
                <Grid item xs={12} md={8}>
                  <TextField
                    label="Steuernummer"
                    fullWidth
                    value={tax.steuernummer}
                    onChange={(e) => setTax((p) => ({ ...p, steuernummer: e.target.value }))}
                    placeholder="12/345/67890"
                    helperText="Finanzamt-Steuernummer (nicht die Steuer-ID)"
                  />
                </Grid>
              </Grid>
            </Section>

            <Section title="SOZIALVERSICHERUNG">
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Sozialversicherungsnummer"
                    fullWidth
                    value={tax.sozialversicherungsnummer}
                    onChange={(e) => setTax((p) => ({ ...p, sozialversicherungsnummer: e.target.value }))}
                    placeholder="65 180575 M 021"
                    inputProps={{ maxLength: 20 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Krankenkasse"
                    fullWidth
                    value={tax.healthInsuranceProvider}
                    onChange={(e) => setTax((p) => ({ ...p, healthInsuranceProvider: e.target.value }))}
                    placeholder="z. B. AOK Bayern"
                  />
                </Grid>
              </Grid>
            </Section>
          </TabPanel>

          {/* ── Bankverbindung ────────────────────────── */}
          <TabPanel value={tab} index={3}>
            <Alert severity="info" icon={<LockIcon />} sx={{ mb: 3 }}>
              Ihre Bankdaten werden ausschließlich für die Lohnüberweisung verwendet.
            </Alert>

            <Section title="KONTOVERBINDUNG">
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField
                    label="IBAN"
                    fullWidth
                    value={bank.iban}
                    onChange={(e) => setBank((p) => ({ ...p, iban: e.target.value }))}
                    placeholder="DE89 3704 0044 0532 0130 00"
                    inputProps={{ maxLength: 34 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Kreditinstitut"
                    fullWidth
                    value={bank.bankName}
                    onChange={(e) => setBank((p) => ({ ...p, bankName: e.target.value }))}
                    placeholder="z. B. Deutsche Bank"
                  />
                </Grid>
              </Grid>
            </Section>
          </TabPanel>

          {/* ── Benachrichtigungen ────────────────────── */}
          <TabPanel value={tab} index={4}>
            <Section title="PUSH-BENACHRICHTIGUNGEN">
              {!pushSupported ? (
                <Alert severity="info">Push-Benachrichtigungen werden von Ihrem Browser nicht unterstützt.</Alert>
              ) : (
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Erhalten Sie Benachrichtigungen direkt auf Ihrem Gerät, auch wenn Sie die App nicht geöffnet haben.
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={pushEnabled}
                        onChange={handlePushToggle}
                        disabled={pushLoading}
                        color="primary"
                      />
                    }
                    label={pushEnabled ? 'Push-Benachrichtigungen aktiv' : 'Push-Benachrichtigungen aktivieren'}
                  />
                  {pushMessage && (
                    <Alert severity={pushEnabled ? 'success' : 'info'} onClose={() => setPushMessage('')}>
                      {pushMessage}
                    </Alert>
                  )}
                </Stack>
              )}
            </Section>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
}
