import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LocationOffIcon from '@mui/icons-material/LocationOff';
import { workerPortalApi } from '../../api/workerPortal';

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function WorkerCheckInPage() {
  const { shiftId } = useParams<{ shiftId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [gpsError, setGpsError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  const { data: shift, isLoading } = useQuery({
    queryKey: ['worker-shift', shiftId],
    queryFn: () => workerPortalApi.getShift(shiftId!),
  });

  const checkInMutation = useMutation({
    mutationFn: (location?: { lat: number; lng: number; accuracy?: number }) =>
      workerPortalApi.checkIn(shiftId!, location),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-shift', shiftId] });
      queryClient.invalidateQueries({ queryKey: ['worker-me'] });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => workerPortalApi.checkOut(shiftId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-shift', shiftId] });
    },
  });

  async function handleCheckIn() {
    setGpsError('');
    setGpsLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10_000 })
      );
      await checkInMutation.mutateAsync({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    } catch {
      // GPS unavailable — check in without location
      try {
        await checkInMutation.mutateAsync(undefined);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } } };
        setGpsError(e.response?.data?.message ?? 'Fehler beim Einchecken.');
      }
    } finally {
      setGpsLoading(false);
    }
  }

  async function handleCheckOut() {
    try {
      await checkOutMutation.mutateAsync();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setGpsError(e.response?.data?.message ?? 'Fehler beim Auschecken.');
    }
  }

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (!shift) return <Alert severity="error">Schicht nicht gefunden.</Alert>;

  const checkedIn = !!shift.myCheckInTime;
  const checkedOut = !!shift.myCheckOutTime;
  const now = new Date();
  const shiftStart = new Date(shift.startTime);
  const contractSigned = shift.myContract?.status === 'signed';
  const canCheckIn = !checkedIn && contractSigned && now >= new Date(shiftStart.getTime() - 5 * 60_000);
  const canCheckOut = checkedIn && !checkedOut;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }} size="small">
        Zurück
      </Button>

      <Typography variant="h5" fontWeight={700} mb={0.5}>Check-in / Check-out</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {shift.title} · {shift.businessName}
      </Typography>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Schichtzeit</Typography>
          <Typography fontWeight={600}>{fmtDt(shift.startTime)}</Typography>
          <Typography variant="body2" color="text.secondary">
            bis {fmtTime(shift.endTime)}
            {shift.breakMinutes ? ` · ${shift.breakMinutes} min Pause` : ''}
          </Typography>
        </CardContent>
      </Card>

      {/* Status cards */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3}>
        <Card variant="outlined" sx={{ flex: 1, borderColor: checkedIn ? 'success.main' : 'divider' }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <LoginIcon color={checkedIn ? 'success' : 'disabled'} />
              <Typography variant="subtitle2" fontWeight={700}>Check-in</Typography>
            </Stack>
            {checkedIn ? (
              <>
                <Typography color="success.main" fontWeight={600}>{fmtTime(shift.myCheckInTime)}</Typography>
                {shift.myCheckInTime && (
                  <Typography variant="caption" color="text.secondary">
                    {new Date(shift.myCheckInTime).toLocaleDateString('de-DE')}
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.disabled">Noch nicht eingecheckt</Typography>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ flex: 1, borderColor: checkedOut ? 'primary.main' : 'divider' }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <LogoutIcon color={checkedOut ? 'primary' : 'disabled'} />
              <Typography variant="subtitle2" fontWeight={700}>Check-out</Typography>
            </Stack>
            {checkedOut ? (
              <>
                <Typography color="primary.main" fontWeight={600}>{fmtTime(shift.myCheckOutTime)}</Typography>
                {shift.myCheckOutTime && (
                  <Typography variant="caption" color="text.secondary">
                    {new Date(shift.myCheckOutTime).toLocaleDateString('de-DE')}
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.disabled">Noch nicht ausgecheckt</Typography>
            )}
          </CardContent>
        </Card>
      </Stack>

      {gpsError && <Alert severity="error" sx={{ mb: 2 }}>{gpsError}</Alert>}

      {checkInMutation.error && !gpsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(checkInMutation.error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Fehler.'}
        </Alert>
      )}

      {checkedIn && checkedOut && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
          Schicht abgeschlossen. Ein- und Ausgecheckt.
        </Alert>
      )}

      <Divider sx={{ mb: 3 }} />

      <Stack spacing={2}>
        {canCheckIn && (
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={gpsLoading ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
            onClick={handleCheckIn}
            disabled={checkInMutation.isPending || gpsLoading}
            fullWidth
          >
            {gpsLoading ? 'GPS wird ermittelt…' : checkInMutation.isPending ? 'Einchecken…' : 'Jetzt einchecken'}
          </Button>
        )}

        {!canCheckIn && !checkedIn && !contractSigned && (
          <Alert severity="warning">
            Bitte unterschreibe zuerst deinen Vertrag, bevor du einchecken kannst.
          </Alert>
        )}

        {!canCheckIn && !checkedIn && contractSigned && (
          <Alert severity="info">
            Check-in ist ab 5 Minuten vor Schichtbeginn verfügbar ({fmtTime(new Date(shiftStart.getTime() - 5 * 60_000).toISOString())}).
          </Alert>
        )}

        {canCheckOut && (
          <Button
            variant="outlined"
            color="primary"
            size="large"
            startIcon={<LogoutIcon />}
            onClick={handleCheckOut}
            disabled={checkOutMutation.isPending}
            fullWidth
          >
            {checkOutMutation.isPending ? 'Auschecken…' : 'Jetzt auschecken'}
          </Button>
        )}

        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.disabled' }}>
          {navigator.geolocation ? (
            <LocationOnIcon fontSize="small" />
          ) : (
            <LocationOffIcon fontSize="small" />
          )}
          <Typography variant="caption">
            {navigator.geolocation
              ? 'GPS-Standort wird für Check-in verwendet (wenn verfügbar)'
              : 'GPS nicht verfügbar — Check-in ohne Standort'}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
