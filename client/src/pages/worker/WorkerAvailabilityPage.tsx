import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import { workerPortalApi, WeeklyPattern, AvailabilityException } from '../../api/workerPortal';

const DAYS: Array<{ key: keyof WeeklyPattern; short: string }> = [
  { key: 'monday', short: 'Mo' },
  { key: 'tuesday', short: 'Di' },
  { key: 'wednesday', short: 'Mi' },
  { key: 'thursday', short: 'Do' },
  { key: 'friday', short: 'Fr' },
  { key: 'saturday', short: 'Sa' },
  { key: 'sunday', short: 'So' },
];

function toIsoDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export default function WorkerAvailabilityPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['worker-availability'],
    queryFn: workerPortalApi.getAvailability,
  });

  const [pattern, setPattern] = useState<WeeklyPattern | null>(null);
  const [exceptions, setExceptions] = useState<AvailabilityException[] | null>(null);
  const [radius, setRadius] = useState<string>('');
  const [newDate, setNewDate] = useState('');
  const [newAvailable, setNewAvailable] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [saved, setSaved] = useState(false);

  const currentPattern: WeeklyPattern = pattern ?? data?.weeklyPattern ?? {
    monday: true, tuesday: true, wednesday: true, thursday: true,
    friday: true, saturday: false, sunday: false,
  };
  const currentExceptions: AvailabilityException[] = exceptions ?? data?.exceptions ?? [];
  const currentRadius = radius !== '' ? radius : (data?.preferredRadiusKm?.toString() ?? '');

  const saveMutation = useMutation({
    mutationFn: () =>
      workerPortalApi.updateAvailability({
        weeklyPattern: currentPattern,
        exceptions: currentExceptions,
        preferredRadiusKm: currentRadius ? parseFloat(currentRadius) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-availability'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const toggleDay = (day: keyof WeeklyPattern) =>
    setPattern({ ...currentPattern, [day]: !currentPattern[day] });

  const addException = () => {
    if (!newDate) return;
    const already = currentExceptions.some((e) => toIsoDate(e.date) === newDate);
    if (already) return;
    setExceptions([
      ...currentExceptions,
      { date: newDate, available: newAvailable, note: newNote || undefined },
    ]);
    setNewDate('');
    setNewNote('');
    setNewAvailable(false);
  };

  const removeException = (date: string) =>
    setExceptions(currentExceptions.filter((e) => toIsoDate(e.date) !== date));

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{t('common.loadError')}</Alert>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('availability.title')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('availability.subtitle')}</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={saved ? <CheckIcon /> : <SaveIcon />}
          color={saved ? 'success' : 'primary'}
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? t('common.loading') : saved ? t('common.saved') : t('common.save')}
        </Button>
      </Stack>

      {saveMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>{t('common.saveError')}</Alert>
      )}

      {/* Weekly Pattern */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t('availability.weeklyPattern')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {DAYS.map(({ key, short }) => (
            <Chip
              key={key}
              label={short}
              onClick={() => toggleDay(key)}
              color={currentPattern[key] ? 'primary' : 'default'}
              variant={currentPattern[key] ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, fontSize: '0.9rem', px: 0.5, cursor: 'pointer' }}
            />
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {t('availability.weeklyPatternHint')}
        </Typography>
      </Paper>

      {/* Preferred Radius */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t('availability.radius')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <TextField
          type="number"
          inputProps={{ min: 1, max: 500, step: 5 }}
          value={currentRadius}
          onChange={(e) => setRadius(e.target.value)}
          placeholder="—"
          sx={{ maxWidth: 200 }}
          InputProps={{
            endAdornment: <InputAdornment position="end">km</InputAdornment>,
          }}
          helperText={t('availability.radiusHint')}
        />
      </Paper>

      {/* Exceptions */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t('availability.exceptions')}
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {currentExceptions.length === 0 && (
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t('availability.noExceptions')}
          </Typography>
        )}

        <Stack spacing={1} mb={3}>
          {currentExceptions
            .slice()
            .sort((a, b) => toIsoDate(a.date).localeCompare(toIsoDate(b.date)))
            .map((ex) => (
              <Stack
                key={toIsoDate(ex.date)}
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ py: 0.5 }}
              >
                <Typography variant="body2" sx={{ minWidth: 110 }}>
                  {new Date(ex.date).toLocaleDateString('de-DE', {
                    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
                  })}
                </Typography>
                <Chip
                  size="small"
                  label={ex.available ? t('availability.available') : t('availability.unavailable')}
                  color={ex.available ? 'success' : 'error'}
                  variant="outlined"
                />
                {ex.note && (
                  <Typography variant="body2" color="text.secondary" flex={1}>
                    {ex.note}
                  </Typography>
                )}
                <Tooltip title={t('common.remove')}>
                  <IconButton size="small" onClick={() => removeException(toIsoDate(ex.date))}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
        </Stack>

        <Typography variant="subtitle2" gutterBottom>{t('availability.addException')}</Typography>
        <Stack direction="row" spacing={2} alignItems="flex-start" flexWrap="wrap">
          <TextField
            type="date"
            label={t('availability.exceptionDate')}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ minWidth: 170 }}
          />
          <Stack direction="row" spacing={1}>
            <Chip
              label={t('availability.unavailable')}
              color={!newAvailable ? 'error' : 'default'}
              variant={!newAvailable ? 'filled' : 'outlined'}
              onClick={() => setNewAvailable(false)}
              sx={{ cursor: 'pointer' }}
            />
            <Chip
              label={t('availability.available')}
              color={newAvailable ? 'success' : 'default'}
              variant={newAvailable ? 'filled' : 'outlined'}
              onClick={() => setNewAvailable(true)}
              sx={{ cursor: 'pointer' }}
            />
          </Stack>
          <TextField
            label={t('availability.exceptionNote')}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={addException}
            disabled={!newDate}
          >
            {t('common.add')}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
