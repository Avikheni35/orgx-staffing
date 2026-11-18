import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import apiClient from '../../api/client';

interface AttendanceEntry {
  workerName: string;
  status: 'assigned' | 'confirmed' | 'completed' | 'no_show';
  checkInTime?: string;
  checkOutTime?: string;
}

interface AttendanceResult {
  shiftId: string;
  title: string;
  startTime: string;
  endTime: string;
  attendance: AttendanceEntry[];
}

function fmtTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL: Record<AttendanceEntry['status'], string> = {
  assigned: 'Zugeteilt',
  confirmed: 'Bestätigt',
  completed: 'Abgeschlossen',
  no_show: 'Nicht erschienen',
};

const STATUS_COLOR: Record<AttendanceEntry['status'], 'default' | 'info' | 'success' | 'error'> = {
  assigned: 'default',
  confirmed: 'info',
  completed: 'success',
  no_show: 'error',
};

export default function ClientShiftAttendancePage() {
  const { shiftId } = useParams<{ shiftId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['client-shift-attendance', shiftId],
    queryFn: () => apiClient.get<AttendanceResult>(`/client-portal/shifts/${shiftId}/attendance`).then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (error || !data) return <Alert severity="error">Anwesenheitsdaten nicht verfügbar.</Alert>;

  const checkedInCount = data.attendance.filter((a) => a.checkInTime).length;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }} size="small">
        Zurück
      </Button>

      <Typography variant="h5" fontWeight={700} mb={0.5}>Anwesenheit</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {data.title} · {fmtTime(data.startTime)} – {fmtTime(data.endTime)}
      </Typography>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight={700}>Übersicht</Typography>
            <Chip
              label={`${checkedInCount}/${data.attendance.length} eingecheckt`}
              color={checkedInCount === data.attendance.length && data.attendance.length > 0 ? 'success' : 'default'}
            />
          </Stack>
        </CardContent>
      </Card>

      {data.attendance.length === 0 ? (
        <Alert severity="info">Keine Mitarbeiter zugeteilt.</Alert>
      ) : (
        <Stack spacing={1.5}>
          {data.attendance.map((entry, i) => (
            <Card variant="outlined" key={i}>
              <CardContent sx={{ py: '12px !important' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>{entry.workerName}</Typography>
                    <Stack direction="row" spacing={3} mt={0.5}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {entry.checkInTime
                          ? <CheckCircleIcon color="success" fontSize="inherit" />
                          : <RadioButtonUncheckedIcon color="disabled" fontSize="inherit" />}
                        <Typography variant="caption" color="text.secondary">
                          Eincheckzeit: {fmtTime(entry.checkInTime)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {entry.checkOutTime
                          ? <CheckCircleIcon color="primary" fontSize="inherit" />
                          : <RadioButtonUncheckedIcon color="disabled" fontSize="inherit" />}
                        <Typography variant="caption" color="text.secondary">
                          Auscheck: {fmtTime(entry.checkOutTime)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                  <Chip label={STATUS_LABEL[entry.status]} color={STATUS_COLOR[entry.status]} size="small" />
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Typography variant="caption" color="text.disabled" display="block" mt={3} textAlign="center">
        Wird jede Minute aktualisiert
      </Typography>
    </Box>
  );
}
