import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GavelIcon from '@mui/icons-material/Gavel';
import DescriptionIcon from '@mui/icons-material/Description';

const GLOBAL_TEMPLATES = [
  {
    key: 'aueg_contract',
    label: 'AÜG-Arbeitnehmerüberlassungsvertrag (Standard)',
    description: 'Plattformweite Standardvorlage — Mandanten können eigene Varianten anlegen.',
    icon: <GavelIcon color="primary" />,
    scope: 'Plattform',
  },
  {
    key: 'employment_contract',
    label: 'Arbeitsvertrag (Standard)',
    description: 'Basis-Arbeitsvertragsvorlage nach deutschem Arbeitsrecht.',
    icon: <AssignmentIcon color="primary" />,
    scope: 'Plattform',
  },
  {
    key: 'gdpr_consent',
    label: 'DSGVO-Einwilligungserklärung',
    description: 'Standardvorlage zur Datenschutzeinwilligung — gem. DSGVO Art. 7.',
    icon: <ArticleIcon color="primary" />,
    scope: 'Plattform',
  },
  {
    key: 'invite_email',
    label: 'Einladungs-E-Mail (Mitarbeiter)',
    description: 'HTML-E-Mail-Vorlage für den Magic-Link bei Mitarbeiterregistrierung.',
    icon: <DescriptionIcon color="primary" />,
    scope: 'E-Mail',
  },
  {
    key: 'invite_staff_email',
    label: 'Einladungs-E-Mail (Personal)',
    description: 'HTML-E-Mail-Vorlage für Disponent- und Admin-Einladungen.',
    icon: <DescriptionIcon color="primary" />,
    scope: 'E-Mail',
  },
];

export default function SuperAdminTemplatesPage() {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Plattform-Vorlagen</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Globale Vertrags- und E-Mail-Vorlagen für alle Mandanten
          </Typography>
        </Box>
        <Chip label="Phase 2" color="info" size="small" />
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Die globale Vorlagen-Verwaltung wird in Phase 2 implementiert. Mandanten können
        Standardvorlagen überschreiben; plattformweite Änderungen hier wirken als Fallback.
        Aktuell werden Verträge aus dem hardcodierten HTML-Generator erzeugt.
      </Alert>

      <Grid container spacing={2}>
        {GLOBAL_TEMPLATES.map((tpl) => (
          <Grid item xs={12} md={6} key={tpl.key}>
            <Card variant="outlined" sx={{ opacity: 0.75 }}>
              <CardContent>
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                  <Box sx={{ mt: 0.25 }}>{tpl.icon}</Box>
                  <Box flex={1}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={0.5} flexWrap="wrap">
                      <Typography variant="subtitle2" fontWeight={700}>{tpl.label}</Typography>
                      <Chip label={tpl.scope} size="small" variant="outlined" color="primary" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{tpl.description}</Typography>
                  </Box>
                  <Chip label="Phase 2" size="small" variant="outlined" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box mt={3} p={2} sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Roadmap — Phase 2 Vorlagen-Engine</Typography>
        <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
          {[
            'Plattformweite Standardvorlagen (editierbar via Super Admin)',
            'Mandantenspezifische Überschreibungen',
            'Platzhalter-System mit auto-populate aus Datenbankfeldern',
            'PDF-Rendering via Puppeteer',
            'QES-Integration (eIDAS-konform)',
            'Versionierung & Genehmigungsworkflow',
          ].map((f) => (
            <Typography key={f} component="li" variant="body2" color="text.secondary">{f}</Typography>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
