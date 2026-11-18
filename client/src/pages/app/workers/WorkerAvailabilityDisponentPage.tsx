import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workersApi } from '../../../api/workers';

const DAYS = [
  { key: 'monday', labelKey: 'availability.monday' },
  { key: 'tuesday', labelKey: 'availability.tuesday' },
  { key: 'wednesday', labelKey: 'availability.wednesday' },
  { key: 'thursday', labelKey: 'availability.thursday' },
  { key: 'friday', labelKey: 'availability.friday' },
  { key: 'saturday', labelKey: 'availability.saturday' },
  { key: 'sunday', labelKey: 'availability.sunday' },
] as const;

type DayKey = typeof DAYS[number]['key'];

type WeeklyPattern = Record<DayKey, boolean>;
type Exception = { date: string; available: boolean; note?: string };

export default function WorkerAvailabilityDisponentPage() {
  const { t } = useTranslation();
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();

  const [pattern, setPattern] = useState<WeeklyPattern>({
    monday: true, tuesday: true, wednesday: true, thursday: true,
    friday: true, saturday: false, sunday: false,
  });
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [radius, setRadius] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newAvailable, setNewAvailable] = useState(true);
  const [newNote, setNewNote] = useState('');

  const { data: worker } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => workersApi.get(workerId!),
    enabled: !!workerId,
  });

  const { isLoading } = useQuery({
    queryKey: ['worker-availability', workerId],
    queryFn: () => workersApi.getAvailability(workerId!),
    enabled: !!workerId,
    staleTime: 0,
    select: (data) => data,
    // populate local state on load
    gcTime: 0,
    refetchOnMount: true,
    placeholderData: undefined,
    // use onSettled pattern via enabled + select
  });

  // Sync remote availability into local state once
  useQuery({
    queryKey: ['worker-availability-init', workerId],
    queryFn: async () => {
      const data = await workersApi.getAvailability(workerId!);
      setPattern(data.weeklyPattern as WeeklyPattern);
      setExceptions(data.exceptions.map((e) => ({
        date: typeof e.date === 'string' ? e.date.slice(0, 10) : new Date(e.date).toISOString().slice(0, 10),
        available: e.available,
        note: e.note,
      })));
      setRadius(data.preferredRadiusKm != null ? String(data.preferredRadiusKm) : '');
      return data;
    },
    enabled: !!workerId,
    staleTime: Infinity,
    gcTime: 0,
  });

  const saveMut = useMutation({
    mutationFn: () =>
      workersApi.updateAvailability(workerId!, {
        weeklyPattern: pattern,
        exceptions,
        preferredRadiusKm: radius ? parseFloat(radius) : undefined,
      }),
    onSuccess: () => { setSuccessMsg(t('workerAvailability.saved')); setErrMsg(''); },
    onError: (e: unknown) => setErrMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')),
  });

  const toggleDay = (day: DayKey) =>
    setPattern((p) => ({ ...p, [day]: !p[day] }));

  const addException = () => {
    if (!newDate) return;
    setExceptions((ex) => [...ex, { date: newDate, available: newAvailable, note: newNote || undefined }]);
    setNewDate('');
    setNewAvailable(true);
    setNewNote('');
  };

  const removeException = (idx: number) =>
    setExceptions((ex) => ex.filter((_, i) => i !== idx));

  const workerName = worker ? `${worker.firstName} ${worker.lastName}` : '…';

  if (isLoading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate(`/app/workers/${workerId}`)}>
          {t('common.back')}
        </Button>
        <Typography variant="h5" fontWeight={700}>
          {t('workerAvailability.title', { name: workerName })}
        </Typography>
      </Stack>

      {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
      {errMsg && <Alert severity="error" sx={{ mb: 2 }}>{errMsg}</Alert>}

      <Stack spacing={3}>
        {/* Weekly pattern */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {t('workerAvailability.weeklyPattern')}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack direction="row" gap={1} flexWrap="wrap">
            {DAYS.map(({ key, labelKey }) => (
              <Chip
                key={key}
                label={t(labelKey)}
                color={pattern[key] ? 'primary' : 'default'}
                onClick={() => toggleDay(key)}
                sx={{ cursor: 'pointer', fontWeight: pattern[key] ? 600 : 400 }}
              />
            ))}
          </Stack>
        </Paper>

        {/* Preferred radius */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {t('availability.preferredRadius')}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TextField
            type="number"
            size="small"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            InputProps={{ endAdornment: <InputAdornment position="end">km</InputAdornment> }}
            sx={{ width: 180 }}
          />
        </Paper>

        {/* Exceptions */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {t('workerAvailability.exceptions')}
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {exceptions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" mb={2}>{t('availability.noExceptions')}</Typography>
          ) : (
            <Stack spacing={1} mb={2}>
              {exceptions.map((ex, idx) => (
                <Stack key={idx} direction="row" alignItems="center" gap={1}>
                  <Chip
                    size="small"
                    label={ex.available ? t('availability.available') : t('availability.unavailable')}
                    color={ex.available ? 'success' : 'error'}
                  />
                  <Typography variant="body2">{new Date(ex.date).toLocaleDateString('de-DE')}</Typography>
                  {ex.note && <Typography variant="caption" color="text.secondary">— {ex.note}</Typography>}
                  <Tooltip title={t('common.delete')}>
                    <IconButton size="small" onClick={() => removeException(idx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          )}

          <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
            <TextField
              type="date"
              size="small"
              label={t('workerAvailability.addException')}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 180 }}
            />
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Typography variant="body2">{t('availability.unavailable')}</Typography>
              <Switch checked={newAvailable} onChange={(e) => setNewAvailable(e.target.checked)} size="small" />
              <Typography variant="body2">{t('availability.available')}</Typography>
            </Stack>
            <TextField
              size="small"
              label={t('common.note')}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              sx={{ width: 200 }}
            />
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addException} disabled={!newDate}>
              {t('common.add')}
            </Button>
          </Stack>
        </Paper>

        <Box>
          <Button variant="contained" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? t('common.loading') : t('workerAvailability.save')}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
