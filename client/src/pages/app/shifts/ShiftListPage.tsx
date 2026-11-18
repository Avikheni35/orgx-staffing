import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BoltIcon from '@mui/icons-material/Bolt';
import LayersIcon from '@mui/icons-material/Layers';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { shiftsApi, Shift, ShiftStatus } from '../../../api/shifts';

type ViewMode = 'list' | 'kanban' | 'calendar';

const STATUS_COLOR: Record<ShiftStatus | 'running', 'default' | 'info' | 'primary' | 'success' | 'error'> = {
  draft: 'default',
  published: 'info',
  running: 'primary',
  completed: 'success',
  cancelled: 'error',
};

const STATUS_BG: Record<ShiftStatus | 'running', string> = {
  draft: '#616161',
  published: '#0288d1',
  running: '#7b1fa2',
  completed: '#2e7d32',
  cancelled: '#c62828',
};

const KANBAN_STATUSES: Array<ShiftStatus | 'running'> = ['draft', 'published', 'running', 'completed', 'cancelled'];
const WEEKDAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function tabParams(tab: number): Record<string, string> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (tab === 0) {
    const end = new Date(startOfDay);
    end.setDate(end.getDate() + 1);
    return { from: startOfDay.toISOString(), to: end.toISOString() };
  }
  if (tab === 1) {
    const end = new Date(startOfDay);
    end.setDate(end.getDate() + 7);
    return { from: startOfDay.toISOString(), to: end.toISOString() };
  }
  if (tab === 2) return { from: now.toISOString() };
  if (tab === 3) return { to: now.toISOString(), status: 'published' };
  return {};
}

function shiftDuration(shift: Shift): string {
  const ms = new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime();
  return (ms / 3600000 - shift.breakMinutes / 60).toFixed(1);
}

function isRunning(s: Shift): boolean {
  const now = new Date();
  return s.status === 'published'
    && now >= new Date(s.startTime)
    && now <= new Date(s.endTime)
    && s.assignedWorkers.some((aw) => aw.checkInTime);
}

function staffFill(s: Shift) {
  const confirmed = s.assignedWorkers.filter(
    (aw) => aw.status === 'confirmed' || aw.status === 'completed'
  ).length;
  return { confirmed, pct: Math.min((confirmed / s.requiredWorkers) * 100, 100) };
}

// ── Kanban view ────────────────────────────────────────────────────────────
function ShiftKanban({ shifts, onNavigate }: { shifts: Shift[]; onNavigate: (id: string) => void }) {
  const { t } = useTranslation();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2, alignItems: 'flex-start' }}>
      {KANBAN_STATUSES.map((col) => {
        const colShifts = shifts.filter((s) =>
          col === 'running' ? isRunning(s) : s.status === col && !isRunning(s)
        );
        return (
          <Box key={col} sx={{ minWidth: 260, flex: '0 0 260px' }}>
            <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: STATUS_BG[col] }} />
              <Typography fontWeight={700} variant="body2">
                {t(`shifts.statusLabel.${col}`)}
              </Typography>
              <Chip label={colShifts.length} size="small" sx={{ ml: 'auto' }} />
            </Stack>
            <Stack gap={1.5}>
              {colShifts.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">—</Typography>
                </Paper>
              ) : (
                colShifts.map((s) => {
                  const { confirmed, pct } = staffFill(s);
                  return (
                    <Paper
                      key={s._id}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        cursor: 'pointer',
                        borderLeft: `3px solid ${STATUS_BG[col]}`,
                        '&:hover': { boxShadow: 2 },
                      }}
                      onClick={() => onNavigate(s._id)}
                    >
                      <Typography variant="body2" fontWeight={600} noWrap>{s.title}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {s.businessName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                        {fmt(s.startTime)} · {shiftDuration(s)} h
                      </Typography>
                      <Stack direction="row" alignItems="center" gap={0.5} mt={1}>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          color={confirmed >= s.requiredWorkers ? 'success' : 'primary'}
                          sx={{ flex: 1, height: 4, borderRadius: 2 }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {confirmed}/{s.requiredWorkers}
                        </Typography>
                      </Stack>
                    </Paper>
                  );
                })
              )}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

// ── Calendar view ──────────────────────────────────────────────────────────
function ShiftCalendar({
  shifts,
  month,
  onMonthChange,
  onNavigate,
}: {
  shifts: Shift[];
  month: Date;
  onMonthChange: (d: Date) => void;
  onNavigate: (id: string) => void;
}) {
  const { t } = useTranslation();

  const monthLabel = month.toLocaleString('de-DE', { month: 'long', year: 'numeric' });

  // Build the grid: Monday-first weeks
  const days = useMemo(() => {
    const year = month.getFullYear();
    const mon = month.getMonth();
    const firstDay = new Date(year, mon, 1);
    // ISO weekday: Mon=1..Sun=7; we want Mon=0..Sun=6
    const startPad = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, mon + 1, 0).getDate();
    const grid: Array<Date | null> = [];
    for (let i = 0; i < startPad; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, mon, d));
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [month]);

  // Map shifts to date key YYYY-MM-DD
  const byDate = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (const s of shifts) {
      const d = new Date(s.startTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      (map[key] ??= []).push(s);
    }
    return map;
  }, [shifts]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {/* Month navigation */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" px={2} py={1.5}
        sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <IconButton size="small" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography fontWeight={700} sx={{ textTransform: 'capitalize' }}>{monthLabel}</Typography>
        <IconButton size="small" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <ChevronRightIcon />
        </IconButton>
      </Stack>

      {/* Weekday headers */}
      <Box display="grid" gridTemplateColumns="repeat(7, 1fr)"
        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
        {WEEKDAYS_DE.map((d) => (
          <Box key={d} sx={{ p: 0.75, textAlign: 'center' }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">{d}</Typography>
          </Box>
        ))}
      </Box>

      {/* Day cells */}
      <Box display="grid" gridTemplateColumns="repeat(7, 1fr)">
        {days.map((day, idx) => {
          if (!day) return <Box key={`empty-${idx}`} sx={{ minHeight: 96, borderBottom: 1, borderRight: 1, borderColor: 'divider', bgcolor: 'action.disabledBackground', opacity: 0.4 }} />;
          const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const dayShifts = byDate[key] ?? [];
          const isToday = key === todayKey;
          return (
            <Box
              key={key}
              sx={{
                minHeight: 96,
                p: 0.5,
                borderBottom: 1,
                borderRight: 1,
                borderColor: 'divider',
                bgcolor: isToday ? 'primary.50' : undefined,
                verticalAlign: 'top',
              }}
            >
              <Typography
                variant="caption"
                fontWeight={isToday ? 800 : 400}
                sx={{
                  display: 'inline-flex',
                  width: 22,
                  height: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  bgcolor: isToday ? 'primary.main' : undefined,
                  color: isToday ? 'primary.contrastText' : 'text.secondary',
                  mb: 0.5,
                }}
              >
                {day.getDate()}
              </Typography>
              <Stack gap={0.25}>
                {dayShifts.slice(0, 3).map((s) => {
                  const col = isRunning(s) ? 'running' : s.status as ShiftStatus | 'running';
                  return (
                    <Box
                      key={s._id}
                      onClick={() => onNavigate(s._id)}
                      sx={{
                        bgcolor: STATUS_BG[col],
                        color: '#fff',
                        borderRadius: 0.5,
                        px: 0.5,
                        py: 0.125,
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.6,
                        '&:hover': { opacity: 0.85 },
                      }}
                      title={s.title}
                    >
                      {new Date(s.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} {s.title}
                    </Box>
                  );
                })}
                {dayShifts.length > 3 && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, pl: 0.5 }}>
                    {t('shifts.moreShifts', { count: dayShifts.length - 3 })}
                  </Typography>
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ShiftListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(2);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [instantMsg, setInstantMsg] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);

  // Build query params depending on view mode
  const queryParams = useMemo((): Record<string, string> => {
    if (viewMode === 'kanban') return { from: new Date().toISOString(), limit: '200' };
    if (viewMode === 'calendar') {
      const to = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0, 23, 59, 59);
      return { from: calMonth.toISOString(), to: to.toISOString(), limit: '200' };
    }
    const p = tabParams(tab);
    return Object.fromEntries(Object.entries({ ...p, limit: '100' }).filter(([, v]) => v !== undefined)) as Record<string, string>;
  }, [viewMode, tab, calMonth]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['shifts', viewMode, viewMode === 'list' ? tab : viewMode === 'calendar' ? calMonth.toISOString() : 'kanban'],
    queryFn: () => shiftsApi.list(queryParams),
    placeholderData: (prev) => prev,
  });

  const instantWorkerMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.instantWorker(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      if (res.mode === 'assigned') {
        setInstantMsg({ text: t('shifts.instantWorkerAssigned', { name: res.workerName }), severity: 'success' });
      } else {
        setInstantMsg({ text: t('shifts.instantWorkerActivated'), severity: 'success' });
      }
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setInstantMsg({ text: err.response?.data?.message ?? t('common.saveError'), severity: 'error' });
    },
  });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const shifts = data?.shifts ?? [];

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>{t('nav.shifts')}</Typography>
        <Stack direction="row" gap={1} alignItems="center">
          {/* View toggle */}
          <Paper variant="outlined" sx={{ display: 'flex', borderRadius: 1, overflow: 'hidden' }}>
            <Tooltip title={t('shifts.viewList')}>
              <IconButton
                size="small"
                onClick={() => setViewMode('list')}
                sx={{ borderRadius: 0, bgcolor: viewMode === 'list' ? 'action.selected' : undefined }}
              >
                <ViewListIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('shifts.viewKanban')}>
              <IconButton
                size="small"
                onClick={() => setViewMode('kanban')}
                sx={{ borderRadius: 0, bgcolor: viewMode === 'kanban' ? 'action.selected' : undefined }}
              >
                <ViewColumnIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('shifts.viewCalendar')}>
              <IconButton
                size="small"
                onClick={() => setViewMode('calendar')}
                sx={{ borderRadius: 0, bgcolor: viewMode === 'calendar' ? 'action.selected' : undefined }}
              >
                <CalendarMonthIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Paper>

          <Button variant="outlined" startIcon={<LayersIcon />} onClick={() => navigate('/app/shifts/templates')}>
            {t('shiftTemplates.title')}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/app/shifts/new')}>
            {t('shifts.addShift')}
          </Button>
        </Stack>
      </Stack>

      {/* Tabs — only in list mode */}
      {viewMode === 'list' && (
        <Paper sx={{ mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label={t('shifts.today')} />
            <Tab label={t('shifts.thisWeek')} />
            <Tab label={t('shifts.upcoming')} />
            <Tab label={t('shifts.overdue')} />
            <Tab label={t('shifts.all')} />
          </Tabs>
        </Paper>
      )}

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{t('common.loadError')}</Alert>}

      {instantMsg && (
        <Alert severity={instantMsg.severity} onClose={() => setInstantMsg(null)} sx={{ mb: 2 }}>
          {instantMsg.text}
        </Alert>
      )}

      {/* ── Kanban ── */}
      {!isLoading && viewMode === 'kanban' && (
        <ShiftKanban shifts={shifts} onNavigate={(id) => navigate(`/app/shifts/${id}`)} />
      )}

      {/* ── Calendar ── */}
      {!isLoading && viewMode === 'calendar' && (
        <ShiftCalendar
          shifts={shifts}
          month={calMonth}
          onMonthChange={setCalMonth}
          onNavigate={(id) => navigate(`/app/shifts/${id}`)}
        />
      )}

      {/* ── List ── */}
      {!isLoading && viewMode === 'list' && data && (
        <>
          <Typography variant="body2" color="text.secondary" mb={1}>
            {t('shifts.totalCount', { count: data.total })}
          </Typography>
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('shifts.title')}</TableCell>
                  <TableCell>{t('shifts.business')}</TableCell>
                  <TableCell>{t('shifts.startTime')}</TableCell>
                  <TableCell>{t('shifts.duration')}</TableCell>
                  <TableCell>{t('shifts.assignedWorkers')}</TableCell>
                  <TableCell>{t('shifts.status')}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {shifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {t('shifts.noResults')}
                    </TableCell>
                  </TableRow>
                ) : (
                  shifts.map((s) => {
                    const { confirmed, pct } = staffFill(s);
                    const totalAssigned = s.assignedWorkers.length;
                    const running = isRunning(s);
                    const displayStatus: ShiftStatus | 'running' = running ? 'running' : s.status;
                    const now = new Date();
                    const isUrgent = s.status === 'published'
                      && confirmed === 0
                      && now >= new Date(new Date(s.startTime).getTime() - 15 * 60_000)
                      && now < new Date(s.endTime);
                    return (
                      <TableRow
                        key={s._id}
                        hover
                        sx={{ cursor: 'pointer', bgcolor: isUrgent ? 'rgba(255, 152, 0, 0.09)' : undefined }}
                        onClick={() => navigate(`/app/shifts/${s._id}`)}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{s.title}</Typography>
                          {s.locationName && (
                            <Typography variant="caption" color="text.secondary">{s.locationName}</Typography>
                          )}
                        </TableCell>
                        <TableCell>{s.businessName}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{fmt(s.startTime)}</Typography>
                        </TableCell>
                        <TableCell>{shiftDuration(s)} h</TableCell>
                        <TableCell sx={{ minWidth: 140 }}>
                          <Typography variant="caption" color={confirmed >= s.requiredWorkers ? 'success.main' : 'text.secondary'}>
                            {t('shifts.staffed', { assigned: confirmed, required: s.requiredWorkers })}
                          </Typography>
                          {totalAssigned > confirmed && (
                            <Typography variant="caption" color="warning.main">
                              {t('shifts.pendingContract', { count: totalAssigned - confirmed })}
                            </Typography>
                          )}
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            color={confirmed >= s.requiredWorkers ? 'success' : 'primary'}
                            sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Stack spacing={0.5} alignItems="flex-start">
                            <Chip
                              label={t(`shifts.statusLabel.${displayStatus}`)}
                              color={STATUS_COLOR[displayStatus]}
                              size="small"
                            />
                            {s.isInstantBooking && (
                              <Chip label={t('shifts.instantBookingActive')} color="warning" size="small" icon={<BoltIcon />} />
                            )}
                            {s.status === 'completed' && s.completedAt &&
                              new Date(s.completedAt) < new Date(new Date(s.endTime).getTime() - 30 * 60_000) && (
                              <Chip label={t('shifts.earlyCompletion')} color="warning" size="small" variant="outlined" />
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          {isUrgent && !s.isInstantBooking && (
                            <Tooltip title={t('shifts.instantWorkerTooltip')}>
                              <Button
                                size="small"
                                variant="contained"
                                color="warning"
                                startIcon={<BoltIcon />}
                                disabled={instantWorkerMutation.isPending}
                                onClick={() => instantWorkerMutation.mutate(s._id)}
                              >
                                {t('shifts.instantWorker')}
                              </Button>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}
