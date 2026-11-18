import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  Checkbox,
  Paper,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import apiClient from '../../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

type LanguageLevel = 'basic' | 'conversational' | 'fluent' | 'native';

interface FormData {
  // Step 1 — Personal
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'diverse' | 'not_specified' | '';
  nationality: string;
  street: string;
  postalCode: string;
  city: string;
  // Step 2 — Tax & Insurance
  steuerklasse: string;
  steuernummer: string;
  sozialversicherungsnummer: string;
  healthInsuranceProvider: string;
  // Step 3 — Bank
  iban: string;
  // Step 4 — Skills & Languages
  skills: string[];
  languages: Array<{ language: string; level: LanguageLevel }>;
  // Step 5 — Consent
  dsgvoConsent: boolean;
}

const INITIAL: FormData = {
  firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', gender: '',
  nationality: '', street: '', postalCode: '', city: '',
  steuerklasse: '', steuernummer: '', sozialversicherungsnummer: '', healthInsuranceProvider: '',
  iban: '',
  skills: [], languages: [],
  dsgvoConsent: false,
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ['Persönliche Daten', 'Steuer & Soziales', 'Bankverbindung', 'Qualifikationen', 'Datenschutz'];

const SKILL_OPTIONS = [
  'Lagerarbeit', 'Logistik', 'Staplerfahrer', 'Kommissionierung',
  'Küchenhilfe', 'Service / Kellner', 'Gastronomie', 'Barkeeper',
  'Produktion', 'Fertigung', 'Montage', 'Qualitätskontrolle',
  'Reinigung / Haushalt', 'Gebäudereinigung',
  'Pflege / Gesundheit', 'Büroarbeit / Verwaltung',
  'Transport / Fahrertätigkeit', 'Sicherheitsdienst', 'Veranstaltungstechnik',
];

const LANGUAGE_OPTIONS = [
  'Deutsch', 'Englisch', 'Türkisch', 'Arabisch', 'Polnisch', 'Russisch',
  'Rumänisch', 'Kroatisch', 'Italienisch', 'Spanisch', 'Portugiesisch', 'Bulgarisch',
  'Ungarisch', 'Albanisch', 'Serbisch',
];

const LEVEL_LABELS: Record<LanguageLevel, string> = {
  basic: 'Grundkenntnisse',
  conversational: 'Kommunikationsfähig',
  fluent: 'Fließend',
  native: 'Muttersprache',
};

// ── Step components ───────────────────────────────────────────────────────────

function Step1Personal({ form, set }: { form: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <TextField label="Vorname *" fullWidth value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField label="Nachname *" fullWidth value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField label="E-Mail-Adresse *" type="email" fullWidth value={form.email} onChange={(e) => set('email', e.target.value)} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField label="Telefonnummer" fullWidth value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          label="Geburtsdatum"
          type="date"
          fullWidth
          value={form.dateOfBirth}
          onChange={(e) => set('dateOfBirth', e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>Geschlecht</InputLabel>
          <Select label="Geschlecht" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <MenuItem value="male">Männlich</MenuItem>
            <MenuItem value="female">Weiblich</MenuItem>
            <MenuItem value="diverse">Divers</MenuItem>
            <MenuItem value="not_specified">Keine Angabe</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField label="Staatsangehörigkeit" fullWidth value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
      </Grid>
      <Grid item xs={12}>
        <Divider><Typography variant="caption" color="text.secondary">Adresse</Typography></Divider>
      </Grid>
      <Grid item xs={12}>
        <TextField label="Straße und Hausnummer" fullWidth value={form.street} onChange={(e) => set('street', e.target.value)} />
      </Grid>
      <Grid item xs={4}>
        <TextField label="PLZ" fullWidth value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
      </Grid>
      <Grid item xs={8}>
        <TextField label="Stadt" fullWidth value={form.city} onChange={(e) => set('city', e.target.value)} />
      </Grid>
    </Grid>
  );
}

function Step2Tax({ form, set }: { form: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Alert severity="info" sx={{ mb: 1 }}>
          Diese Angaben werden benötigt für die Lohnabrechnung. Alle Felder sind optional — Sie können sie später in Ihrem Profil ergänzen.
        </Alert>
      </Grid>
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>Steuerklasse</InputLabel>
          <Select label="Steuerklasse" value={form.steuerklasse} onChange={(e) => set('steuerklasse', e.target.value)}>
            {['I', 'II', 'III', 'IV', 'V', 'VI'].map((k) => (
              <MenuItem key={k} value={k}>Klasse {k}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField label="Krankenkasse" fullWidth value={form.healthInsuranceProvider} onChange={(e) => set('healthInsuranceProvider', e.target.value)} placeholder="z.B. AOK, TK, Barmer" />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField label="Steuernummer" fullWidth value={form.steuernummer} onChange={(e) => set('steuernummer', e.target.value)} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          label="Sozialversicherungsnummer"
          fullWidth
          value={form.sozialversicherungsnummer}
          onChange={(e) => set('sozialversicherungsnummer', e.target.value)}
          helperText="12-stellige Nummer auf Sozialversicherungsausweis"
        />
      </Grid>
    </Grid>
  );
}

function Step3Bank({ form, set }: { form: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Alert severity="info" sx={{ mb: 1 }}>
          Ihre IBAN wird verschlüsselt gespeichert und nur für die Lohnzahlung verwendet.
        </Alert>
      </Grid>
      <Grid item xs={12}>
        <TextField
          label="IBAN"
          fullWidth
          value={form.iban}
          onChange={(e) => set('iban', e.target.value.toUpperCase().replace(/\s/g, ''))}
          helperText="z.B. DE89370400440532013000"
          inputProps={{ maxLength: 34 }}
        />
      </Grid>
    </Grid>
  );
}

function Step4Skills({
  form,
  setSkills,
  setLanguages,
}: {
  form: FormData;
  setSkills: (skills: string[]) => void;
  setLanguages: (langs: FormData['languages']) => void;
}) {
  const [langInput, setLangInput] = useState('');
  const [langLevel, setLangLevel] = useState<LanguageLevel>('conversational');

  const toggleSkill = (s: string) =>
    form.skills.includes(s)
      ? setSkills(form.skills.filter((x) => x !== s))
      : setSkills([...form.skills, s]);

  const addLanguage = () => {
    if (!langInput) return;
    if (form.languages.some((l) => l.language === langInput)) return;
    setLanguages([...form.languages, { language: langInput, level: langLevel }]);
    setLangInput('');
  };

  const removeLanguage = (lang: string) =>
    setLanguages(form.languages.filter((l) => l.language !== lang));

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle2" gutterBottom>Qualifikationen</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {SKILL_OPTIONS.map((s) => (
            <Chip
              key={s}
              label={s}
              onClick={() => toggleSkill(s)}
              color={form.skills.includes(s) ? 'primary' : 'default'}
              variant={form.skills.includes(s) ? 'filled' : 'outlined'}
              size="small"
            />
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
          Wählen Sie alle zutreffenden Qualifikationen aus.
        </Typography>
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom>Sprachkenntnisse</Typography>
        <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
          {LANGUAGE_OPTIONS.slice(0, 8).map((l) => (
            <Chip
              key={l}
              label={l}
              size="small"
              onClick={() => setLangInput(l)}
              variant={langInput === l ? 'filled' : 'outlined'}
              color={langInput === l ? 'secondary' : 'default'}
            />
          ))}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            label="Sprache"
            size="small"
            value={langInput}
            onChange={(e) => setLangInput(e.target.value)}
            sx={{ width: 180 }}
          />
          <FormControl size="small" sx={{ width: 180 }}>
            <InputLabel>Niveau</InputLabel>
            <Select label="Niveau" value={langLevel} onChange={(e) => setLangLevel(e.target.value as LanguageLevel)}>
              {(Object.entries(LEVEL_LABELS) as [LanguageLevel, string][]).map(([v, l]) => (
                <MenuItem key={v} value={v}>{l}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={addLanguage} disabled={!langInput}>Hinzufügen</Button>
        </Stack>
        {form.languages.length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={1} mt={2}>
            {form.languages.map((l) => (
              <Chip
                key={l.language}
                label={`${l.language} (${LEVEL_LABELS[l.level]})`}
                onDelete={() => removeLanguage(l.language)}
                color="secondary"
                size="small"
              />
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

function Step5Consent({ form, setConsent }: { form: FormData; setConsent: (v: boolean) => void }) {
  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2, maxHeight: 260, overflowY: 'auto' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Einwilligung zur Datenverarbeitung (DSGVO)
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Wir verarbeiten Ihre personenbezogenen Daten (Name, Adresse, Kontaktdaten, Steuer- und Sozialversicherungsnummern, Bankverbindung) zur Durchführung des Beschäftigungsverhältnisses, zur Erfüllung gesetzlicher Pflichten und zur Verwaltung Ihrer Einsätze.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Rechtsgrundlagen: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung), Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung). Besondere Kategorien von Daten (Gesundheitszeugnisse) werden nur mit Ihrer gesonderten Einwilligung gemäß Art. 9 Abs. 2 lit. a DSGVO verarbeitet.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Ihre Daten werden nicht an Dritte weitergegeben, außer an Kundenbetriebe im Rahmen Ihres Einsatzes sowie an Behörden auf Grundlage gesetzlicher Pflichten. Finanzdaten werden gemäß HGB § 257 zehn Jahre aufbewahrt.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung sowie das Recht auf Datenübertragbarkeit. Wenden Sie sich hierfür an Ihre Agentur.
        </Typography>
      </Paper>

      <FormControlLabel
        control={
          <Checkbox
            checked={form.dsgvoConsent}
            onChange={(e) => setConsent(e.target.checked)}
            color="primary"
          />
        }
        label={
          <Typography variant="body2">
            Ich habe die Datenschutzerklärung gelesen und bin mit der Verarbeitung meiner personenbezogenen Daten durch die Agentur einverstanden. Ich bestätige, dass meine Angaben vollständig und wahrheitsgemäß sind.
          </Typography>
        }
      />
    </Stack>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkerSelfRegistrationPage() {
  const { loginCode } = useParams<{ loginCode: string }>();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitError, setSubmitError] = useState('');

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const setStr = (key: keyof FormData, value: string) =>
    set(key, value as FormData[typeof key]);

  // Load agency info
  const { data: agencyInfo, isLoading: loadingInfo, error: infoError } = useQuery({
    queryKey: ['register-info', loginCode],
    queryFn: () =>
      apiClient.get<{ tenantName: string; loginCode: string }>(`/auth/register-info/${loginCode}`).then((r) => r.data),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiClient
        .post('/auth/register', {
          loginCode,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender || undefined,
          nationality: form.nationality || undefined,
          address: {
            street: form.street || undefined,
            postalCode: form.postalCode || undefined,
            city: form.city || undefined,
            country: 'DE',
          },
          steuerklasse: form.steuerklasse || undefined,
          steuernummer: form.steuernummer || undefined,
          sozialversicherungsnummer: form.sozialversicherungsnummer || undefined,
          healthInsuranceProvider: form.healthInsuranceProvider || undefined,
          iban: form.iban || undefined,
          skills: form.skills,
          languages: form.languages,
          dsgvoConsent: true,
        })
        .then((r) => r.data),
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.';
      setSubmitError(msg);
    },
  });

  const canProceed = () => {
    if (step === 0) return form.firstName.trim() && form.lastName.trim() && form.email.trim();
    if (step === 4) return form.dsgvoConsent;
    return true;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setSubmitError('');
      mutation.mutate();
    }
  };

  // ── Loading / error states ──────────────────────────────────────────────────

  if (loadingInfo) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (infoError || !agencyInfo) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3 }}>
        <Alert severity="error" sx={{ maxWidth: 480 }}>
          Dieser Registrierungslink ist ungültig oder nicht mehr aktiv. Bitte wenden Sie sich an Ihre Agentur.
        </Alert>
      </Box>
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  if (mutation.isSuccess) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3 }}>
        <Box sx={{ maxWidth: 480, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 72, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Registrierung abgeschlossen!
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            Ihre Daten wurden erfolgreich an <strong>{agencyInfo.tenantName}</strong> übermittelt. Die Agentur prüft Ihre Angaben und meldet sich in Kürze bei Ihnen.
          </Typography>
          <Alert severity="info">
            Sie erhalten eine E-Mail, sobald Ihr Konto freigeschaltet wurde und Sie sich einloggen können.
          </Alert>
        </Box>
      </Box>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4, px: 2 }}>
      <Box sx={{ maxWidth: 680, mx: 'auto' }}>
        {/* Header */}
        <Box textAlign="center" mb={4}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Mitarbeiter-Registrierung
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {agencyInfo.tenantName} · Schritt {step + 1} von {STEPS.length}
          </Typography>
        </Box>

        {/* Stepper */}
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step content */}
        <Paper sx={{ p: 3, mb: 3 }}>
          {step === 0 && <Step1Personal form={form} set={setStr} />}
          {step === 1 && <Step2Tax form={form} set={setStr} />}
          {step === 2 && <Step3Bank form={form} set={setStr} />}
          {step === 3 && (
            <Step4Skills
              form={form}
              setSkills={(skills) => set('skills', skills)}
              setLanguages={(languages) => set('languages', languages)}
            />
          )}
          {step === 4 && <Step5Consent form={form} setConsent={(v) => set('dsgvoConsent', v)} />}
        </Paper>

        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}

        {/* Navigation */}
        <Stack direction="row" justifyContent="space-between">
          <Button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            variant="outlined"
          >
            Zurück
          </Button>
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={!canProceed() || mutation.isPending}
          >
            {mutation.isPending
              ? 'Wird gesendet...'
              : step === STEPS.length - 1
              ? 'Registrierung abschließen'
              : 'Weiter'}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
