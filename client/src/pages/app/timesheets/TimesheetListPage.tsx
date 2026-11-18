import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { timesheetsApi, TimesheetStatus } from '../../../api/timesheets';

const STATUS_COLOR: Record<TimesheetStatus, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  pending: 'warning',
  approved: 'success',
  disputed: 'error',
  exported: 'info',
};

function monthRange(offset: number): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59);
  return { from: start.toISOString(), to: end.toISOString() };
}

export default function TimesheetListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 0=pending, 1=approved, 2=disputed, 3=exported, 4=all
  const [tab, setTab] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleTabChange = (_: React.SyntheticEvent, v: number) => {
    setTab(v);
    setMonthOffset(v === 0 ? 0 : -99); // pending → current month; all others → all-time
  };

  const STATUS_BY_TAB: Record<number, TimesheetStatus | undefined> = {
    0: 'pending',
    1: 'approved',
    2: 'disputed',
    3: 'exported',
    4: undefined,
  };
  const statusFilter = STATUS_BY_TAB[tab];

  const range = monthOffset === -99 ? {} : monthRange(monthOffset);

  const { data, isLoading, error } = useQuery({
    queryKey: ['timesheets', tab, monthOffset],
    queryFn: () =>
      timesheetsApi.list({
        ...range,
        ...(statusFilter ? { status: statusFilter } : {}),
        limit: 100,
      }),
    placeholderData: (prev) => prev,
  });

  const bulkMutation = useMutation({
    mutationFn: (ids: string[]) => timesheetsApi.bulkApprove(ids),
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    },
  });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => {
    const pendingIds = (data?.timesheets ?? [])
      .filter((t) => t.status === 'pending')
      .map((t) => t._id);
    if (selected.size === pendingIds.length) setSelected(new Set());
    else setSelected(new Set(pendingIds));
  };

  const pendingRows = data?.timesheets.filter((t) => t.status === 'pending') ?? [];
  const monthLabel = (offset: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return d.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('timesheets.title')}</Typography>
        {selected.size > 0 && (
          <Button
            variant="contained"
            startIcon={<CheckCircleIcon />}
            onClick={() => bulkMutation.mutate(Array.from(selected))}
            disabled={bulkMutation.isPending}
          >
            {t('timesheets.approveSelected', { count: selected.size })}
          </Button>
        )}
      </Stack>

      <Stack direction="row" spacing={1} mb={2}>
        {[-2, -1, 0].map((offset) => (
          <Button
            key={offset}
            size="small"
            variant={monthOffset === offset ? 'contained' : 'outlined'}
            onClick={() => setMonthOffset(offset)}
          >
            {monthLabel(offset)}
          </Button>
        ))}
        <Button
          size="small"
          variant={monthOffset === -99 ? 'contained' : 'outlined'}
          onClick={() => setMonthOffset(-99)}
        >
          {t('shifts.all')}
        </Button>
      </Stack>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => { handleTabChange(e, v); setSelected(new Set()); }}>
          <Tab label={t('timesheets.pending')} />
          <Tab label={t('timesheets.approved')} />
          <Tab label={t('timesheets.disputed')} />
          <Tab label={t('timesheets.exported')} />
          <Tab label={t('timesheets.all')} />
        </Tabs>
      </Paper>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{t('common.loadError')}</Alert>}

      {bulkMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t('timesheets.approvedCount', { count: bulkMutation.data?.approved ?? 0 })}
        </Alert>
      )}

      {data && (
        <>
          <Typography variant="body2" color="text.secondary" mb={1}>
            {t('timesheets.totalCount', { count: data.total })}
          </Typography>
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  {tab === 0 && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={pendingRows.length > 0 && selected.size === pendingRows.length}
                        indeterminate={selected.size > 0 && selected.size < pendingRows.length}
                        onChange={toggleAll}
                      />
                    </TableCell>
                  )}
                  <TableCell>{t('timesheets.worker')}</TableCell>
                  <TableCell>{t('timesheets.business')}</TableCell>
                  <TableCell>{t('timesheets.shiftDate')}</TableCell>
                  <TableCell align="right">{t('timesheets.plannedHours')}</TableCell>
                  <TableCell align="right">{t('timesheets.actualHours')}</TableCell>
                  <TableCell align="right">{t('timesheets.grossPay')}</TableCell>
                  <TableCell>{t('timesheets.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.timesheets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {t('timesheets.noResults')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.timesheets.map((ts) => {
                    const planned = calcHours(ts.plannedStart, ts.plannedEnd, ts.plannedBreakMinutes);
                    return (
                      <TableRow
                        key={ts._id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/app/timesheets/${ts._id}`)}
                      >
                        {tab === 0 && (
                          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                            {ts.status === 'pending' && (
                              <Checkbox
                                checked={selected.has(ts._id)}
                                onChange={() => toggleSelect(ts._id)}
                              />
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{ts.workerName}</Typography>
                        </TableCell>
                        <TableCell>{ts.businessName}</TableCell>
                        <TableCell>{fmt(ts.shiftDate)}</TableCell>
                        <TableCell align="right">{planned.toFixed(2)} h</TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={ts.totalHours !== planned ? 'warning.main' : 'inherit'}
                            fontWeight={ts.totalHours !== planned ? 600 : 400}
                          >
                            {ts.totalHours.toFixed(2)} h
                          </Typography>
                        </TableCell>
                        <TableCell align="right">€ {ts.grossPay.toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip
                            label={t(`timesheets.statusLabel.${ts.status}`)}
                            color={STATUS_COLOR[ts.status]}
                            size="small"
                          />
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

function calcHours(start: string, end: string, breakMin: number): number {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000 - breakMin / 60);
}
