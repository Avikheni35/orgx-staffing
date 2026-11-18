import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import { settingsApi, UpdateAgencySettings } from '../../../api/settings';

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

export default function AgencySettingsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['agency-settings'],
    queryFn: settingsApi.getAgency,
  });

  // Form state
  const [general, setGeneral] = useState({ name: '', primaryColor: '#1976d2' });
  const [company, setCompany] = useState({
    address: '', hrbNumber: '', auegLicenseNumber: '', vatId: '', iban: '',
  });
  const [invoice, setInvoice] = useState({
    prefix: 'RE', vatRate: 19, paymentTermsDays: 14,
  });
  useEffect(() => {
    if (!data) return;
    setGeneral({ name: data.name, primaryColor: data.branding?.primaryColor ?? '#1976d2' });
    setCompany({
      address: data.companyDetails?.address ?? '',
      hrbNumber: data.companyDetails?.hrbNumber ?? '',
      auegLicenseNumber: data.companyDetails?.auegLicenseNumber ?? '',
      vatId: data.companyDetails?.vatId ?? '',
      iban: data.companyDetails?.iban ?? '',
    });
    setInvoice({
      prefix: data.invoiceSettings?.prefix ?? 'RE',
      vatRate: data.invoiceSettings?.vatRate ?? 19,
      paymentTermsDays: data.invoiceSettings?.paymentTermsDays ?? 14,
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: UpdateAgencySettings) => settingsApi.updateAgency(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-settings'] });
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
      name: general.name,
      branding: { primaryColor: general.primaryColor },
      companyDetails: { ...company },
      invoiceSettings: {
        prefix: invoice.prefix,
        vatRate: Number(invoice.vatRate),
        paymentTermsDays: Number(invoice.paymentTermsDays),
      },
    });
  };

  if (isLoading) return <CircularProgress />;
  if (!data) return <Alert severity="error">Einstellungen konnten nicht geladen werden.</Alert>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Agentur-Einstellungen</Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.name} · {data?.loginCode}
          </Typography>
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
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label="Allgemein" />
          <Tab label="Firmendaten" />
          <Tab label="Rechnungsstellung" />
        </Tabs>

        <CardContent sx={{ p: 3 }}>
          {/* ── Allgemein ───────────────────────────────── */}
          <TabPanel value={tab} index={0}>
            <Section title="AGENTURDATEN">
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Agenturname"
                    fullWidth
                    required
                    value={general.name}
                    onChange={(e) => setGeneral((p) => ({ ...p, name: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Anmelde-Code (Login)"
                    fullWidth
                    value={data?.loginCode ?? ''}
                    disabled
                    helperText="Wird von Disponenten zur Anmeldung verwendet. Kontaktieren Sie den Support, um ihn zu ändern."
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Subdomain"
                    fullWidth
                    value={data?.subdomain ?? ''}
                    disabled
                    helperText="Technische Kennung — nicht änderbar."
                  />
                </Grid>
              </Grid>
            </Section>

            <Section title="DARSTELLUNG">
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Primärfarbe"
                    fullWidth
                    value={general.primaryColor}
                    onChange={(e) => setGeneral((p) => ({ ...p, primaryColor: e.target.value }))}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Box
                            sx={{
                              width: 20, height: 20, borderRadius: 0.5,
                              bgcolor: general.primaryColor,
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                          />
                        </InputAdornment>
                      ),
                    }}
                    helperText="Hex-Farbcode, z. B. #1976d2"
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Box
                    sx={{
                      width: 56, height: 56, borderRadius: 2,
                      bgcolor: general.primaryColor,
                    }}
                  />
                </Grid>
              </Grid>
            </Section>

            <Section title="PLAN & STATUS">
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField label="Plan" value={data?.plan ?? ''} disabled fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Status" value={data?.status ?? ''} disabled fullWidth />
                </Grid>
                {data?.trialEndsAt && (
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Trial endet am"
                      value={new Date(data.trialEndsAt).toLocaleDateString('de-DE')}
                      disabled
                      fullWidth
                    />
                  </Grid>
                )}
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Max. Mitarbeiter"
                    value={data?.planLimits?.maxWorkers ?? ''}
                    disabled
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Max. Disponenten"
                    value={data?.planLimits?.maxDisponents ?? ''}
                    disabled
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Section>
          </TabPanel>

          {/* ── Firmendaten ──────────────────────────────── */}
          <TabPanel value={tab} index={1}>
            <Section title="FIRMENANGABEN (PFLICHTFELDER FÜR RECHNUNGEN)">
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Diese Daten erscheinen auf allen ausgestellten Rechnungen (UStG-Pflicht).
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Firmenanschrift (vollständig)"
                    fullWidth
                    multiline
                    rows={3}
                    value={company.address}
                    onChange={(e) => setCompany((p) => ({ ...p, address: e.target.value }))}
                    placeholder={'Musteragentur GmbH\nMusterstraße 1\n12345 Musterstadt'}
                    helperText="Name, Straße, PLZ Ort — wird 1:1 auf die Rechnung gedruckt"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Umsatzsteuer-ID (USt-ID)"
                    fullWidth
                    value={company.vatId}
                    onChange={(e) => setCompany((p) => ({ ...p, vatId: e.target.value }))}
                    placeholder="DE123456789"
                    helperText="Pflichtangabe auf Rechnungen ab 250 €"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Handelsregisternummer (HRB)"
                    fullWidth
                    value={company.hrbNumber}
                    onChange={(e) => setCompany((p) => ({ ...p, hrbNumber: e.target.value }))}
                    placeholder="HRB 123456 AG Berlin"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="AÜG-Erlaubniszertifikat-Nummer"
                    fullWidth
                    value={company.auegLicenseNumber}
                    onChange={(e) => setCompany((p) => ({ ...p, auegLicenseNumber: e.target.value }))}
                    helperText="Zugelassen durch die Bundesagentur für Arbeit"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="IBAN (Bankverbindung)"
                    fullWidth
                    value={company.iban}
                    onChange={(e) => setCompany((p) => ({ ...p, iban: e.target.value }))}
                    placeholder="DE89 3704 0044 0532 0130 00"
                    helperText="Erscheint auf Rechnungen als Zahlungsziel"
                  />
                </Grid>
              </Grid>
            </Section>
          </TabPanel>

          {/* ── Rechnungsstellung ────────────────────────── */}
          <TabPanel value={tab} index={2}>
            <Section title="RECHNUNGSNUMMERN">
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Präfix"
                    fullWidth
                    value={invoice.prefix}
                    onChange={(e) => setInvoice((p) => ({ ...p, prefix: e.target.value }))}
                    inputProps={{ maxLength: 10 }}
                    helperText={`Rechnungsnummern werden als ${invoice.prefix || 'RE'}-1001, ${invoice.prefix || 'RE'}-1002 usw. erzeugt`}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Nächste Nummer"
                    fullWidth
                    value={data?.invoiceSettings?.currentNumber ?? ''}
                    disabled
                    helperText="Wird automatisch erhöht — nicht manuell änderbar"
                  />
                </Grid>
              </Grid>
            </Section>

            <Section title="STEUER & ZAHLUNGSKONDITIONEN">
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Mehrwertsteuersatz"
                    type="number"
                    fullWidth
                    value={invoice.vatRate}
                    onChange={(e) => setInvoice((p) => ({ ...p, vatRate: Number(e.target.value) }))}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                    helperText="Standard: 19 % — Zeitarbeit üblich"
                    inputProps={{ min: 0, max: 100, step: 1 }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Zahlungsziel"
                    type="number"
                    fullWidth
                    value={invoice.paymentTermsDays}
                    onChange={(e) => setInvoice((p) => ({ ...p, paymentTermsDays: Number(e.target.value) }))}
                    InputProps={{ endAdornment: <InputAdornment position="end">Tage</InputAdornment> }}
                    helperText="Ab Rechnungsdatum"
                    inputProps={{ min: 0, max: 365, step: 1 }}
                  />
                </Grid>
              </Grid>
            </Section>
          </TabPanel>

        </CardContent>
      </Card>
    </Box>
  );
}
