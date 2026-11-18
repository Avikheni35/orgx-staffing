import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PeopleIcon from '@mui/icons-material/People';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../api/client';

interface MonthlyEntry {
  month: string;
  hours: number;
  grossPay: number;
  shiftCount: number;
}

interface WorkerUtilizationRow {
  workerId: string;
  workerName: string;
  workerStatus: string;
  totalHours: number;
  totalGrossPay: number;
  shiftCount: number;
  monthly: MonthlyEntry[];
}

interface WorkerUtilizationResult {
  from: string;
  to: string;
  total: number;
  rows: WorkerUtilizationRow[];
}

const fmt = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toMonthInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function monthStart(ym: string) {
  return `${ym}-01`;
}
function monthEnd(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

function MiniBar({ monthly, maxHours }: { monthly: MonthlyEntry[]; maxHours: number }) {
  if (!monthly.length) return null;
  return (
    <Stack direction="row" spacing={0.25} alignItems="flex-end" height={24} width={100}>
      {monthly.map((m) => (
        <Box
          key={m.month}
          title={`${m.month}: ${m.hours}h`}
          sx={{
            flex: 1,
            height: `${Math.max(4, Math.round((m.hours / maxHours) * 24))}px`,
            bgcolor: 'primary.main',
            opacity: 0.7,
            borderRadius: '2px 2px 0 0',
          }}
        />
      ))}
    </Stack>
  );
}

export default function WorkerUtilizationReportPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [fromMonth, setFromMonth] = useState(toMonthInput(new Date(now.getFullYear(), 0, 1)));
  const [toMonth, setToMonth] = useState(toMonthInput(now));

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports-worker-utilization', fromMonth, toMonth],
    queryFn: () =>
      apiClient
        .get<WorkerUtilizationResult>('/reports/worker-utilization', {
          params: { from: monthStart(fromMonth), to: monthEnd(toMonth) },
        })
        .then((r) => r.data),
  });

  const totalHours = data?.rows.reduce((s, r) => s + r.totalHours, 0) ?? 0;
  const totalShifts = data?.rows.reduce((s, r) => s + r.shiftCount, 0) ?? 0;
  const maxMonthlyHours = data
    ? Math.max(...data.rows.flatMap((r) => r.monthly.map((m) => m.hours)), 1)
    : 1;

  const handleCsvExport = () => {
    apiClient.get('/reports/worker-utilization', {
      params: { from: monthStart(fromMonth), to: monthEnd(toMonth), format: 'csv' },
      responseType: 'blob',
    }).then((r) => {
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auslastung-${fromMonth}-${toMonth}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Mitarbeiterauslastung</Typography>
          <Typography variant="body2" color="text.secondary">
            Geleistete Stunden und Bruttolohn je Mitarbeiter im gewählten Zeitraum
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TextField
            label="Von"
            type="month"
            size="small"
            value={fromMonth}
            onChange={(e) => setFromMonth(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <TextField
            label="Bis"
            type="month"
            size="small"
            value={toMonth}
            onChange={(e) => setToMonth(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={handleCsvExport}>
            CSV
          </Button>
        </Stack>
      </Stack>

      {/* Summary cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <PeopleIcon color="primary" />
                <Box>
                  <Typography variant="h5" fontWeight={700}>{data?.total ?? 0}</Typography>
                  <Typography variant="body2" color="text.secondary">Mitarbeiter mit Einsätzen</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <AccessTimeIcon color="primary" />
                <Box>
                  <Typography variant="h5" fontWeight={700}>{totalHours.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h</Typography>
                  <Typography variant="body2" color="text.secondary">Gesamtstunden (freigegeben)</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <CalendarMonthIcon color="primary" />
                <Box>
                  <Typography variant="h5" fontWeight={700}>{totalShifts}</Typography>
                  <Typography variant="body2" color="text.secondary">Schichten (freigegeben)</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">Daten konnten nicht geladen werden.</Alert>}

      {data && data.rows.length === 0 && (
        <Alert severity="info">
          Keine freigegebenen Stundennachweise im gewählten Zeitraum.
        </Alert>
      )}

      {data && data.rows.length > 0 && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Mitarbeiter</TableCell>
                <TableCell align="right">Schichten</TableCell>
                <TableCell align="right">Stunden</TableCell>
                <TableCell align="right">Bruttolohn</TableCell>
                <TableCell>Verlauf</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow
                  key={row.workerId}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/app/workers/${row.workerId}`)}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={600}>{row.workerName}</Typography>
                      {row.workerStatus !== 'active' && (
                        <Chip label={row.workerStatus} size="small" color="default" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{row.shiftCount}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      {row.totalHours.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">€ {fmt(row.totalGrossPay)}</Typography>
                  </TableCell>
                  <TableCell>
                    <MiniBar monthly={row.monthly} maxHours={maxMonthlyHours} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Divider />
          <Box px={2} py={1.5}>
            <Stack direction="row" justifyContent="flex-end" spacing={4}>
              <Typography variant="body2" color="text.secondary">
                Gesamt: <strong>{totalHours.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Brutto gesamt: <strong>€ {fmt(data.rows.reduce((s, r) => s + r.totalGrossPay, 0))}</strong>
              </Typography>
            </Stack>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
