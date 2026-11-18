import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PeopleIcon from '@mui/icons-material/People';
import { clientPortalApi } from '../../api/clientPortal';

const STATUS_COLOR: Record<string, 'default' | 'primary' | 'success' | 'error'> = {
  published: 'primary',
  completed: 'success',
  cancelled: 'error',
  draft: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  published: 'Geplant',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  draft: 'Entwurf',
};
const WORKER_STATUS_LABEL: Record<string, string> = {
  assigned: 'Eingeplant',
  confirmed: 'Bestätigt',
  completed: 'Anwesend',
  no_show: 'Nicht erschienen',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ClientShiftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: shift, isLoading, error } = useQuery({
    queryKey: ['client-shift', id],
    queryFn: () => clientPortalApi.shift(id!),
    enabled: Boolean(id),
  });

  if (isLoading) return <CircularProgress />;
  if (error || !shift) return <Alert severity="error">Schicht nicht gefunden.</Alert>;

  const durationMs = new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime();
  const netHours = (durationMs / 3600000 - shift.breakMinutes / 60).toFixed(2);

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/client/shifts')}>
          Zurück
        </Button>
        <Button
          variant="outlined"
          startIcon={<HowToRegIcon />}
          onClick={() => navigate(`/client/shifts/${id}/attendance`)}
          size="small"
        >
          Anwesenheit
        </Button>
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{shift.title}</Typography>
          {shift.locationName && (
            <Typography variant="body2" color="text.secondary">{shift.locationName}</Typography>
          )}
        </Box>
        <Chip
          label={STATUS_LABEL[shift.status] ?? shift.status}
          color={STATUS_COLOR[shift.status]}
        />
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={600} gutterBottom>
                ZEITRAUM
              </Typography>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon fontSize="small" color="action" />
                  <Box>
                    <Typography variant="body2">{fmtDate(shift.startTime)}</Typography>
                    <Typography variant="body2" color="text.secondary">bis {new Date(shift.endTime).toLocaleTimeString('de-DE', { timeStyle: 'short' })} Uhr</Typography>
                  </Box>
                </Stack>
                {shift.locationName && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LocationOnIcon fontSize="small" color="action" />
                    <Typography variant="body2">{shift.locationName}</Typography>
                  </Stack>
                )}
                <Stack direction="row" spacing={1} alignItems="center">
                  <PeopleIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    {shift.assignedWorkers.length} von {shift.requiredWorkers} Mitarbeitern eingeplant
                  </Typography>
                </Stack>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Pause</Typography>
                  <Typography variant="body2" fontWeight={500}>{shift.breakMinutes} Min.</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Nettozeit</Typography>
                  <Typography variant="body2" fontWeight={500}>{netHours} h</Typography>
                </Grid>
              </Grid>

              {shift.notes && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="caption" color="text.secondary">Hinweise</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{shift.notes}</Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={600} gutterBottom>
                EINGESETZTE MITARBEITER
              </Typography>
              {shift.assignedWorkers.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Noch keine Mitarbeiter eingeplant.</Typography>
              ) : (
                <List disablePadding>
                  {shift.assignedWorkers.map((w, i) => (
                    <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 13 }}>{w.workerName[0]}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={w.workerName}
                        secondary={WORKER_STATUS_LABEL[w.status] ?? w.status}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
