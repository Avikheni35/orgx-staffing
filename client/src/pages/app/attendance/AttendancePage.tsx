import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useTranslation } from 'react-i18next';
import { shiftsApi, AttendanceShift } from '../../../api/shifts';
import type { WorkerAssignmentStatus } from '../../../api/shifts';

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_COLOR: Record<WorkerAssignmentStatus, 'default' | 'info' | 'success' | 'error'> = {
  assigned: 'default',
  confirmed: 'info',
  completed: 'success',
  no_show: 'error',
};

const STATUS_LABEL: Record<WorkerAssignmentStatus, string> = {
  assigned: 'Zugeteilt',
  confirmed: 'Bestätigt',
  completed: 'Abgeschlossen',
  no_show: 'Nicht erschienen',
};

function WorkerRow({ w }: { w: AttendanceShift['workers'][number] }) {
  const checkedIn = !!w.checkInTime;
  const checkedOut = !!w.checkOutTime;

  return (
    <Stack direction="row" alignItems="center" spacing={2} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Avatar sx={{ width: 36, height: 36, fontSize: 14, bgcolor: checkedIn ? 'success.main' : 'grey.300' }}>
        {w.workerName.charAt(0)}
      </Avatar>
      <Box flex={1}>
        <Typography variant="body2" fontWeight={600}>{w.workerName}</Typography>
        <Stack direction="row" spacing={2} mt={0.5}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {checkedIn ? <CheckCircleIcon color="success" fontSize="inherit" /> : <RadioButtonUncheckedIcon color="disabled" fontSize="inherit" />}
            <Typography variant="caption" color="text.secondary">
              Ein: {fmtTime(w.checkInTime)}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {checkedOut ? <LogoutIcon color="action" fontSize="inherit" /> : <RadioButtonUncheckedIcon color="disabled" fontSize="inherit" />}
            <Typography variant="caption" color="text.secondary">
              Aus: {fmtTime(w.checkOutTime)}
            </Typography>
          </Stack>
          {w.checkInLocation && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <LocationOnIcon color="action" fontSize="inherit" />
              <Typography variant="caption" color="text.secondary">GPS</Typography>
            </Stack>
          )}
        </Stack>
      </Box>
      <Chip label={STATUS_LABEL[w.status]} color={STATUS_COLOR[w.status]} size="small" />
    </Stack>
  );
}

function ShiftCard({ shift }: { shift: AttendanceShift }) {
  const { t } = useTranslation();
  const now = new Date();
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const isActive = now >= start && now <= end && shift.status !== 'completed';
  const isEarlyCompleted = shift.status === 'completed' && !!shift.completedAt &&
    new Date(shift.completedAt) < new Date(end.getTime() - 30 * 60_000);
  const checkedInCount = shift.workers.filter((w) => w.checkInTime).length;

  return (
    <Card variant="outlined" sx={{ mb: 2, ...(isActive && { borderColor: 'primary.main', borderWidth: 2 }), ...(isEarlyCompleted && { borderColor: 'warning.main', borderWidth: 2 }) }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" fontWeight={700}>{shift.title}</Typography>
              {isActive && <Chip label="Läuft" color="primary" size="small" />}
              {isEarlyCompleted && <Chip label={t('shifts.earlyCompletion')} color="warning" size="small" />}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {shift.businessName}{shift.locationName ? ` · ${shift.locationName}` : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(shift.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {new Date(shift.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
          <Stack alignItems="flex-end" spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              Eingecheckt
            </Typography>
            <Typography variant="h6" fontWeight={700} color={checkedInCount === shift.workers.length ? 'success.main' : 'warning.main'}>
              {checkedInCount}/{shift.workers.length}
            </Typography>
          </Stack>
        </Stack>

        {shift.workers.length === 0 ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.disabled' }}>
            <PersonOffIcon fontSize="small" />
            <Typography variant="body2">Keine zugeteilten Mitarbeiter</Typography>
          </Stack>
        ) : (
          shift.workers.map((w) => <WorkerRow key={w.workerId.toString()} w={w} />)
        )}
      </CardContent>
    </Card>
  );
}

export default function AttendancePage() {
  const { t } = useTranslation();
  const today = toDateInput(new Date());
  const [date, setDate] = useState(today);

  const { data: shifts, isLoading } = useQuery({
    queryKey: ['attendance', date],
    queryFn: () => shiftsApi.getAttendance(date),
    refetchInterval: 30_000,
  });

  const activeShifts = (shifts ?? []).filter((s) => {
    const now = new Date();
    return now >= new Date(s.startTime) && now <= new Date(s.endTime) && s.status !== 'completed';
  });
  const upcomingShifts = (shifts ?? []).filter((s) => new Date() < new Date(s.startTime));
  // Includes early-completed shifts (status=completed but wall clock still within shift window)
  const pastShifts = (shifts ?? []).filter((s) => new Date() > new Date(s.endTime) || s.status === 'completed');

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>{t('nav.attendance')}</Typography>
          <Typography variant="body2" color="text.secondary">
            Echtzeit Check-in Übersicht · aktualisiert alle 30s
          </Typography>
        </Box>
        <TextField
          type="date"
          size="small"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          sx={{ width: 160 }}
          inputProps={{ max: toDateInput(new Date(Date.now() + 7 * 86400000)) }}
        />
      </Stack>

      {isLoading && <CircularProgress />}

      {!isLoading && (shifts ?? []).length === 0 && (
        <Alert severity="info">Keine Schichten für diesen Tag.</Alert>
      )}

      {activeShifts.length > 0 && (
        <>
          <Typography variant="subtitle2" color="primary" fontWeight={700} mb={1} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Aktuell laufend ({activeShifts.length})
          </Typography>
          {activeShifts.map((s) => <ShiftCard key={s._id} shift={s} />)}
        </>
      )}

      {upcomingShifts.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={700} mb={1} mt={3} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Bevorstehend ({upcomingShifts.length})
          </Typography>
          {upcomingShifts.map((s) => <ShiftCard key={s._id} shift={s} />)}
        </>
      )}

      {pastShifts.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={700} mb={1} mt={3} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Beendet ({pastShifts.length})
          </Typography>
          {pastShifts.map((s) => <ShiftCard key={s._id} shift={s} />)}
        </>
      )}
    </Box>
  );
}
