import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import EuroIcon from '@mui/icons-material/Euro';
import BusinessIcon from '@mui/icons-material/Business';
import { workerPortalApi } from '../../api/workerPortal';

function formatDt(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString('de-DE', opts);
}

function timeUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function WorkerOfferDetailPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [declineNote, setDeclineNote] = useState('');
  const [showDeclineField, setShowDeclineField] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data: offers, isLoading } = useQuery({
    queryKey: ['worker-offers'],
    queryFn: workerPortalApi.getOffers,
  });

  const offer = offers?.find((o) => o._id === offerId);

  const acceptMutation = useMutation({
    mutationFn: () => workerPortalApi.acceptOffer(offerId!),
    onSuccess: ({ contractId }) => {
      queryClient.invalidateQueries({ queryKey: ['worker-offers'] });
      queryClient.invalidateQueries({ queryKey: ['worker-me'] });
      navigate(`/worker/contracts/${contractId}`);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setActionError(err.response?.data?.message ?? 'Fehler beim Annehmen des Angebots.');
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => workerPortalApi.declineOffer(offerId!, declineNote || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-offers'] });
      queryClient.invalidateQueries({ queryKey: ['worker-me'] });
      navigate('/worker/offers');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setActionError(err.response?.data?.message ?? 'Fehler beim Ablehnen des Angebots.');
    },
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (!offer) return <Alert severity="error">Angebot nicht gefunden.</Alert>;

  const shift = offer.shift;
  const isPending = offer.status === 'pending' && !offer.isExpired;
  const remaining = isPending ? timeUntil(offer.expiresAt) : null;

  const totalHours = shift
    ? (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3_600_000 - (shift.breakMinutes ?? 0) / 60
    : null;
  const estimatedPay = totalHours && shift ? (totalHours * shift.payRatePerHour).toFixed(2) : null;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/worker/offers')} sx={{ mb: 2 }} size="small">
        Zurück zu Angeboten
      </Button>

      <Typography variant="h5" fontWeight={700} mb={1}>
        Schichtangebot
      </Typography>

      {/* Status banner */}
      {isPending && remaining && (
        <Alert icon={<AccessTimeIcon />} severity="warning" sx={{ mb: 2 }}>
          Dieses Angebot läuft in <strong>{remaining}</strong> ab. Bitte antworten Sie rechtzeitig.
        </Alert>
      )}
      {offer.isExpired && (
        <Alert severity="info" sx={{ mb: 2 }}>Dieses Angebot ist abgelaufen.</Alert>
      )}
      {offer.status === 'accepted' && (
        <Alert icon={<CheckCircleIcon />} severity="success" sx={{ mb: 2 }}>
          Sie haben dieses Angebot angenommen. Ihr Vertrag wurde generiert.
        </Alert>
      )}
      {offer.status === 'declined' && (
        <Alert icon={<CancelIcon />} severity="error" sx={{ mb: 2 }}>
          Sie haben dieses Angebot abgelehnt.
          {offer.responseNote && <> Grund: „{offer.responseNote}"</>}
        </Alert>
      )}
      {offer.status === 'cancelled' && (
        <Alert severity="info" sx={{ mb: 2 }}>Dieses Angebot wurde von der Agentur zurückgezogen.</Alert>
      )}

      {/* Shift details */}
      {shift ? (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>{shift.title}</Typography>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <BusinessIcon color="action" fontSize="small" />
                <Box>
                  <Typography variant="body2" fontWeight={600}>{shift.businessName}</Typography>
                  {shift.locationName && (
                    <Typography variant="caption" color="text.secondary">{shift.locationName}</Typography>
                  )}
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <EventIcon color="action" fontSize="small" />
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {formatDt(shift.startTime, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDt(shift.startTime, { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {formatDt(shift.endTime, { hour: '2-digit', minute: '2-digit' })}
                    {shift.breakMinutes ? ` (${shift.breakMinutes} min Pause)` : ''}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <EuroIcon color="action" fontSize="small" />
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {shift.payRatePerHour?.toFixed(2)} €/h
                  </Typography>
                  {estimatedPay && (
                    <Typography variant="caption" color="text.secondary">
                      Geschätzte Vergütung: ca. {estimatedPay} € ({totalHours?.toFixed(1)}h netto)
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Stack>

            {shift.notes && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary">{shift.notes}</Typography>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert severity="warning" sx={{ mb: 3 }}>Schichtdetails nicht verfügbar.</Alert>
      )}

      {/* Message from disponent */}
      {offer.message && (
        <Card sx={{ mb: 3, bgcolor: 'action.hover' }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>Nachricht der Agentur</Typography>
            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>„{offer.message}"</Typography>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}

      {isPending && (
        <Card>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>Ihre Antwort</Typography>

            {!showDeclineField ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending || declineMutation.isPending}
                  fullWidth
                >
                  {acceptMutation.isPending ? 'Wird angenommen…' : 'Angebot annehmen'}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="large"
                  startIcon={<CancelIcon />}
                  onClick={() => setShowDeclineField(true)}
                  disabled={acceptMutation.isPending}
                  fullWidth
                >
                  Ablehnen
                </Button>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <TextField
                  label="Ablehnungsgrund (optional)"
                  multiline
                  rows={2}
                  fullWidth
                  value={declineNote}
                  onChange={(e) => setDeclineNote(e.target.value)}
                  placeholder="z.B. Ich habe an dem Tag schon einen Termin."
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<CancelIcon />}
                    onClick={() => declineMutation.mutate()}
                    disabled={declineMutation.isPending}
                  >
                    {declineMutation.isPending ? 'Wird abgelehnt…' : 'Ablehnen bestätigen'}
                  </Button>
                  <Button
                    variant="text"
                    onClick={() => setShowDeclineField(false)}
                    disabled={declineMutation.isPending}
                  >
                    Zurück
                  </Button>
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Stack direction="row" spacing={1} alignItems="center" mt={3}>
        <Chip label={offer.status === 'pending' && offer.isExpired ? 'Abgelaufen' : ({
          pending: 'Ausstehend', accepted: 'Angenommen', declined: 'Abgelehnt',
          cancelled: 'Widerrufen', expired: 'Abgelaufen',
        } as const)[offer.status]} size="small" />
        <Typography variant="caption" color="text.secondary">
          Gesendet am {formatDt(offer.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {' · '}
          Ablauf: {formatDt(offer.expiresAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </Stack>
    </Box>
  );
}
