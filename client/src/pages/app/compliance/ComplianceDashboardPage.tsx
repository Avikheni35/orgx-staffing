import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import BadgeIcon from '@mui/icons-material/Badge';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

interface ComplianceCard {
  title: string;
  subtitle: string;
  law: string;
  path: string;
  icon: React.ReactNode;
  color: string;
}

const CARDS: ComplianceCard[] = [
  {
    title: 'AÜG-Überlassungsgrenzen',
    subtitle: 'Mitarbeiter an oder nahe der 18-Monatsgrenzen — Gleichstellungsgebot ab Monat 9',
    law: 'AÜG § 1 Abs. 1b',
    path: '/app/compliance/aueg',
    icon: <GavelIcon sx={{ fontSize: 36 }} />,
    color: '#1976d2',
  },
  {
    title: 'Ablaufende Dokumente',
    subtitle: 'Ausweise, Arbeitserlaubnisse und Gesundheitszeugnisse mit nahendem Ablaufdatum',
    law: '§ 404 SGB III · AufenthG',
    path: '/app/reports/documents',
    icon: <BadgeIcon sx={{ fontSize: 36 }} />,
    color: '#d32f2f',
  },
];

export default function ComplianceDashboardPage() {
  const navigate = useNavigate();

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Compliance-Übersicht
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Rechtliche Anforderungen für Zeitarbeitsunternehmen in Deutschland
      </Typography>

      <Grid container spacing={3}>
        {CARDS.map((card) => (
          <Grid item xs={12} sm={6} key={card.path}>
            <Card sx={{ height: '100%' }}>
              <CardActionArea onClick={() => navigate(card.path)} sx={{ height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box sx={{ color: card.color }}>{card.icon}</Box>
                    <ArrowForwardIcon color="action" />
                  </Stack>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    {card.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {card.subtitle}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      bgcolor: 'action.hover',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      fontFamily: 'monospace',
                    }}
                  >
                    {card.law}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
