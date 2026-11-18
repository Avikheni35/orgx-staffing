import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import StorageIcon from '@mui/icons-material/Storage';
import SecurityIcon from '@mui/icons-material/Security';
import BusinessIcon from '@mui/icons-material/Business';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          {icon}
          <Typography variant="overline" color="text.secondary">{title}</Typography>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        {children}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, chip }: { label: string; value?: string; chip?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" py={0.75}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      {chip ? (
        <Chip label={chip} size="small" variant="outlined" />
      ) : (
        <Typography variant="body2" fontWeight={600}>{value ?? '—'}</Typography>
      )}
    </Stack>
  );
}

export default function SuperAdminSettingsPage() {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Plattform-Einstellungen</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Globale Konstanten und Standardwerte der Plattform — schreibgeschützt
      </Typography>

      <Grid container spacing={3}>
        {/* German Compliance */}
        <Grid item xs={12} md={6}>
          <Section title="Deutsches Arbeitsrecht (AÜG / ArbZG / MiLoG)" icon={<GavelIcon color="primary" fontSize="small" />}>
            <Row label="AÜG Warnschwelle" value="9 Monate" />
            <Row label="AÜG Sperrfrist (Standard)" value="18 Monate" />
            <Row label="Mindestlohn (MiLoG)" value="€ 12,82 / Stunde" />
            <Row label="Mindestruhezeit (ArbZG)" value="11 Stunden" />
            <Row label="Max. Tägliche Arbeitszeit (ArbZG)" value="10 Stunden" />
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary">
              Individuelle Anpassungen pro Mandant unter Einstellungen → Compliance.
            </Typography>
          </Section>
        </Grid>

        {/* Default Plan Limits */}
        <Grid item xs={12} md={6}>
          <Section title="Standard-Plan-Limits" icon={<BusinessIcon color="primary" fontSize="small" />}>
            <Row label="Starter — Max. Mitarbeiter" value="50" />
            <Row label="Starter — Max. Disponenten" value="3" />
            <Row label="Growth — Max. Mitarbeiter" value="200" />
            <Row label="Growth — Max. Disponenten" value="10" />
            <Row label="Pro — Max. Mitarbeiter" value="1.000" />
            <Row label="Pro — Max. Disponenten" value="25" />
            <Row label="Enterprise — Max. Mitarbeiter" value="Unbegrenzt" />
            <Row label="Enterprise — Max. Disponenten" value="Unbegrenzt" />
          </Section>
        </Grid>

        {/* Data Retention */}
        <Grid item xs={12} md={6}>
          <Section title="Datenschutz & Aufbewahrung (DSGVO / HGB)" icon={<SecurityIcon color="primary" fontSize="small" />}>
            <Row label="Audit-Log TTL" value="10 Jahre (HGB §257)" />
            <Row label="Finanzbelege Aufbewahrung" value="10 Jahre" />
            <Row label="Refresh-Token Lebensdauer" value="7 Tage" />
            <Row label="Access-Token Lebensdauer" value="15 Minuten" />
            <Row label="Magic-Link / Einladung" value="30 Minuten – 7 Tage" />
            <Row label="Account-Sperrung nach" value="5 fehlgeschlagenen Versuchen" />
            <Row label="Datenspeicherung" value="EU only" />
          </Section>
        </Grid>

        {/* Platform Info */}
        <Grid item xs={12} md={6}>
          <Section title="Plattform-Metadaten" icon={<StorageIcon color="primary" fontSize="small" />}>
            <Row label="Phase" chip="Phase 1" />
            <Row label="E-Signatur" chip="Canvas (eIDAS Phase 2)" />
            <Row label="Zahlungsabwicklung" chip="DATEV Export (kein eigenes Payroll)" />
            <Row label="PWA" chip="Worker + Business Portal" />
            <Row label="QES" chip="Phase 2 geplant" />
            <Row label="Cross-Tenant Sharing" chip="Out of Scope" />
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary">
              Weitere Konfigurationen (E-Mail, SMS, Push, S3, PDF) werden in Phase 2 über Umgebungsvariablen konfiguriert.
            </Typography>
          </Section>
        </Grid>
      </Grid>
    </Box>
  );
}
