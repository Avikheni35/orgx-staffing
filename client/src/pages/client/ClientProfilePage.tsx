import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import { clientPortalApi } from '../../api/clientPortal';

function ReadField({ label, value }: { label: string; value?: string | null }) {
  return (
    <TextField
      label={label}
      value={value || '—'}
      disabled
      fullWidth
      size="small"
    />
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box mb={3}>
      <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
        <Box color="primary.main">{icon}</Box>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
          {title}
        </Typography>
      </Stack>
      <Divider sx={{ mb: 2 }} />
      {children}
    </Box>
  );
}

export default function ClientProfilePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['client-me'],
    queryFn: clientPortalApi.getMe,
  });

  if (isLoading) return <CircularProgress />;
  if (error || !data) return <Alert severity="error">Fehler beim Laden des Profils.</Alert>;

  const { business, contact } = data;

  const fullAddress = [
    business.address?.street,
    business.address?.postalCode && business.address?.city
      ? `${business.address.postalCode} ${business.address.city}`
      : business.address?.city,
    business.address?.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Mein Profil</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Ihre Kontaktdaten und Unternehmensinformationen
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }} variant="outlined">
        Diese Informationen werden von Ihrer Agentur verwaltet. Bei Änderungsbedarf wenden Sie sich bitte an Ihren Ansprechpartner.
      </Alert>

      <Stack spacing={3}>
        {/* Contact person */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Section title="IHRE KONTAKTDATEN" icon={<PersonIcon />}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <ReadField label="Vorname" value={contact?.firstName} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <ReadField label="Nachname" value={contact?.lastName} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <ReadField label="E-Mail-Adresse" value={contact?.email} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <ReadField label="Telefon" value={contact?.phone} />
                </Grid>
                {contact?.position && (
                  <Grid item xs={12} md={6}>
                    <ReadField label="Position / Funktion" value={contact.position} />
                  </Grid>
                )}
              </Grid>
            </Section>
          </CardContent>
        </Card>

        {/* Company info */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Section title="UNTERNEHMEN" icon={<BusinessIcon />}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <ReadField label="Unternehmensname" value={business.name} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <ReadField label="Branche" value={business.industry} />
                </Grid>
                {fullAddress && (
                  <Grid item xs={12}>
                    <ReadField label="Anschrift" value={fullAddress} />
                  </Grid>
                )}
                {business.vatId && (
                  <Grid item xs={12} md={6}>
                    <ReadField label="USt-IdNr." value={business.vatId} />
                  </Grid>
                )}
                {business.website && (
                  <Grid item xs={12} md={6}>
                    <ReadField label="Website" value={business.website} />
                  </Grid>
                )}
              </Grid>
            </Section>

            {(business.billingEmail || business.billingAddress) && (
              <Section title="RECHNUNGSADRESSE" icon={<BusinessIcon fontSize="small" />}>
                <Grid container spacing={2}>
                  {business.billingEmail && (
                    <Grid item xs={12} md={6}>
                      <ReadField label="Rechnungs-E-Mail" value={business.billingEmail} />
                    </Grid>
                  )}
                  {business.billingAddress && (
                    <Grid item xs={12}>
                      <ReadField label="Rechnungsanschrift" value={business.billingAddress} />
                    </Grid>
                  )}
                </Grid>
              </Section>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
