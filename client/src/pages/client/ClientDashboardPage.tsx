import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ReceiptIcon from '@mui/icons-material/Receipt';
import EuroIcon from '@mui/icons-material/Euro';
import { clientPortalApi, ClientShift } from '../../api/clientPortal';

const SHIFT_STATUS_COLOR: Record<string, 'default' | 'primary' | 'success' | 'error'> = {
  published: 'primary',
  completed: 'success',
  cancelled: 'error',
  draft: 'default',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function ShiftRow({ shift }: { shift: ClientShift }) {
  const navigate = useNavigate();
  return (
    <Box
      onClick={() => navigate(`/client/shifts/${shift._id}`)}
      sx={{ py: 1.5, px: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1 }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="body2" fontWeight={500}>{shift.title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {fmtDate(shift.startTime)} – {fmtDate(shift.endTime)}
            {shift.locationName && ` · ${shift.locationName}`}
          </Typography>
        </Box>
        <Chip
          label={shift.status}
          color={SHIFT_STATUS_COLOR[shift.status]}
          size="small"
        />
      </Stack>
    </Box>
  );
}

export default function ClientDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['client-dashboard'],
    queryFn: clientPortalApi.dashboard,
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">Fehler beim Laden.</Alert>;
  if (!data) return null;

  const fmtEur = (n: number) =>
    n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Willkommen, {data.businessName}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Ihr Kundenportal — Schichten und Rechnungen auf einen Blick
      </Typography>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/client/shifts')}>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CalendarMonthIcon color="primary" />
                  <Box>
                    <Typography variant="h4" fontWeight={700}>{data.upcomingShiftsCount}</Typography>
                    <Typography variant="caption" color="text.secondary">Bevorstehende Schichten</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/client/invoices?status=open')}>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <ReceiptIcon color={data.openInvoicesCount > 0 ? 'warning' : 'action'} />
                  <Box>
                    <Typography variant="h4" fontWeight={700}>{data.openInvoicesCount}</Typography>
                    <Typography variant="caption" color="text.secondary">Offene Rechnungen</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/client/invoices')}>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <EuroIcon color="action" />
                  <Box>
                    <Typography variant="h4" fontWeight={700} fontSize={22}>{fmtEur(data.totalInvoiced)}</Typography>
                    <Typography variant="caption" color="text.secondary">Gesamt abgerechnet</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>

      {data.upcomingShifts.length > 0 && (
        <Card>
          <CardContent sx={{ pb: 0 }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600} mb={1}>
              NÄCHSTE SCHICHTEN
            </Typography>
          </CardContent>
          <Divider />
          {data.upcomingShifts.map((shift, i) => (
            <Box key={shift._id}>
              <ShiftRow shift={shift} />
              {i < data.upcomingShifts.length - 1 && <Divider />}
            </Box>
          ))}
        </Card>
      )}
    </Box>
  );
}
