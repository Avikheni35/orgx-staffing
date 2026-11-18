import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import EventIcon from '@mui/icons-material/Event';
import { useNavigate } from 'react-router-dom';
import { workerPortalApi, type ShiftOffer } from '../../api/workerPortal';

const STATUS_LABEL: Record<ShiftOffer['status'], string> = {
  pending:   'Ausstehend',
  accepted:  'Angenommen',
  declined:  'Abgelehnt',
  cancelled: 'Widerrufen',
  expired:   'Abgelaufen',
};

const STATUS_COLOR: Record<ShiftOffer['status'], 'warning' | 'success' | 'error' | 'default'> = {
  pending:   'warning',
  accepted:  'success',
  declined:  'error',
  cancelled: 'default',
  expired:   'default',
};

function timeUntil(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return 'Abgelaufen';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `noch ${h}h ${m}min` : `noch ${m}min`;
}

export default function WorkerOffersPage() {
  const navigate = useNavigate();

  const { data: offers, isLoading, error } = useQuery({
    queryKey: ['worker-offers'],
    queryFn: workerPortalApi.getOffers,
    refetchInterval: 30_000,
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Angebote konnten nicht geladen werden.</Alert>;

  const pending = offers?.filter((o) => o.status === 'pending' && !o.isExpired) ?? [];
  const past    = offers?.filter((o) => o.status !== 'pending' || o.isExpired) ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
        <LocalOfferIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>Schichtangebote</Typography>
        {pending.length > 0 && (
          <Badge badgeContent={pending.length} color="error">
            <Box />
          </Badge>
        )}
      </Stack>

      {pending.length === 0 && past.length === 0 && (
        <Alert severity="info">Sie haben aktuell keine Schichtangebote.</Alert>
      )}

      {pending.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Ausstehend ({pending.length})
          </Typography>
          <Stack spacing={2} mb={4}>
            {pending.map((offer) => (
              <OfferCard key={offer._id} offer={offer} onClick={() => navigate(`/worker/offers/${offer._id}`)} />
            ))}
          </Stack>
        </>
      )}

      {past.length > 0 && (
        <>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Frühere Angebote
          </Typography>
          <Stack spacing={1.5}>
            {past.map((offer) => (
              <OfferCard key={offer._id} offer={offer} onClick={() => navigate(`/worker/offers/${offer._id}`)} dim />
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}

function OfferCard({ offer, onClick, dim }: { offer: ShiftOffer; onClick: () => void; dim?: boolean }) {
  const shift = offer.shift;
  const isPending = offer.status === 'pending' && !offer.isExpired;

  return (
    <Card sx={{ opacity: dim ? 0.65 : 1, border: isPending ? '1px solid' : undefined, borderColor: 'warning.main' }}>
      <CardActionArea onClick={onClick}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                {shift?.title ?? 'Schicht'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {shift?.businessName}
              </Typography>
            </Box>
            <Chip
              label={offer.isExpired ? 'Abgelaufen' : STATUS_LABEL[offer.status]}
              color={offer.isExpired ? 'default' : STATUS_COLOR[offer.status]}
              size="small"
            />
          </Stack>

          {shift && (
            <Stack direction="row" spacing={2} mt={1.5} flexWrap="wrap">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <EventIcon fontSize="small" color="action" />
                <Typography variant="caption">
                  {new Date(shift.startTime).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  {' '}
                  {new Date(shift.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(shift.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Stack>
              <Typography variant="caption" color="success.main" fontWeight={600}>
                {shift.payRatePerHour?.toFixed(2)} €/h
              </Typography>
            </Stack>
          )}

          {isPending && (
            <Stack direction="row" spacing={0.5} alignItems="center" mt={1}>
              <AccessTimeIcon fontSize="small" color="warning" />
              <Typography variant="caption" color="warning.main">
                Ablauf: {timeUntil(offer.expiresAt)}
              </Typography>
            </Stack>
          )}

          {offer.message && (
            <Typography variant="caption" color="text.secondary" mt={1} display="block" sx={{ fontStyle: 'italic' }}>
              „{offer.message}"
            </Typography>
          )}

          {isPending && (
            <Stack direction="row" spacing={1} mt={2}>
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={(e) => { e.stopPropagation(); onClick(); }}
              >
                Details & Annehmen
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={(e) => { e.stopPropagation(); onClick(); }}
              >
                Ablehnen
              </Button>
            </Stack>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
