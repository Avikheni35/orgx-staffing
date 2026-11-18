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
import AssignmentIcon from '@mui/icons-material/Assignment';
import BadgeIcon from '@mui/icons-material/Badge';
import GavelIcon from '@mui/icons-material/Gavel';
import PeopleIcon from '@mui/icons-material/People';
import EuroIcon from '@mui/icons-material/Euro';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EventBusyIcon from '@mui/icons-material/EventBusy';

interface ReportCard {
  title: string;
  subtitle: string;
  path: string;
  icon: React.ReactNode;
}

const CARDS: ReportCard[] = [
  {
    title: 'Mitarbeiterauslastung',
    subtitle: 'Geleistete Stunden und Bruttolohn je Mitarbeiter — monatliche Übersicht',
    path: '/app/reports/worker-utilization',
    icon: <PeopleIcon sx={{ fontSize: 32 }} />,
  },
  {
    title: 'Kundenumsätze',
    subtitle: 'Rechnungsumsatz und offene Beträge je Kundenunternehmen im gewählten Zeitraum',
    path: '/app/reports/client-revenue',
    icon: <EuroIcon sx={{ fontSize: 32 }} />,
  },
  {
    title: 'AÜG-Bericht',
    subtitle: 'Überlassungsmonate je Mitarbeiter und Kundenbetrieb — Warnungen und Sperrungen',
    path: '/app/compliance/aueg',
    icon: <GavelIcon sx={{ fontSize: 32 }} />,
  },
  {
    title: 'Ablaufende Dokumente',
    subtitle: 'Mitarbeiter mit Ausweisen, Arbeitserlaubnissen oder Gesundheitszeugnissen nahe dem Ablaufdatum',
    path: '/app/reports/documents',
    icon: <BadgeIcon sx={{ fontSize: 32 }} />,
  },
  {
    title: 'Schichtnachweis',
    subtitle: 'Detaillierte Schichtliste mit Zeiten, Stunden und Bruttolohn für einen beliebigen Zeitraum',
    path: '/app/reports/shift-details',
    icon: <AssignmentIcon sx={{ fontSize: 32 }} />,
  },
  {
    title: 'Offene-Posten-Analyse',
    subtitle: 'Offene Rechnungen nach Fälligkeit gruppiert — 0–30, 31–60, 61–90 und über 90 Tage',
    path: '/app/reports/invoice-aging',
    icon: <AccountBalanceWalletIcon sx={{ fontSize: 32 }} />,
  },
  {
    title: 'Offene Schichten',
    subtitle: 'Veröffentlichte Schichten mit freien Plätzen — sortiert nach Dringlichkeit und Startdatum',
    path: '/app/reports/open-shifts',
    icon: <EventBusyIcon sx={{ fontSize: 32 }} />,
  },
];

export default function ReportsPage() {
  const navigate = useNavigate();

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Berichte</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Compliance- und Betriebsberichte für Ihre Agentur
      </Typography>

      <Grid container spacing={3}>
        {CARDS.map((card) => (
          <Grid item xs={12} sm={6} key={card.path}>
            <Card>
              <CardActionArea onClick={() => navigate(card.path)}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box color="primary.main">{card.icon}</Box>
                    <ArrowForwardIcon color="action" />
                  </Stack>
                  <Typography variant="h6" fontWeight={700} gutterBottom>{card.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{card.subtitle}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
