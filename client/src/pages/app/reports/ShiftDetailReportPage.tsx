import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, Chip, CircularProgress, FormControl, InputLabel,
  MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography, Pagination,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DownloadIcon from '@mui/icons-material/Download';
import apiClient from '../../../api/client';

interface ShiftRow {
  _id: string;
  workerName: string;
  businessName: string;
  shiftDate: string;
  actualStart: string;
  actualEnd: string;
  actualBreakMinutes: number;
  totalHours: number;
  payRatePerHour: number;
  grossPay: number;
  status: string;
}

interface ShiftDetailResult {
  from: string;
  to: string;
  page: number;
  limit: number;
  total: number;
  totalHours: number;
  totalGrossPay: number;
  rows: ShiftRow[];
}

const STATUS_LABEL: Record<string, string> = {
  pending:  'Ausstehend',
  approved: 'Freigegeben',
  disputed: 'Beanstandet',
  exported: 'Exportiert',
};
const STATUS_COLOR: Record<string, 'default' | 'success' | 'error' | 'primary'> = {
  pending:  'default',
  approved: 'success',
  disputed: 'error',
  exported: 'primary',
};

const fmt2 = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('de-DE');

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function ShiftDetailReportPage() {
  const now    = new Date();
  const [from,   setFrom]   = useState(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to,     setTo]     = useState(toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [status, setStatus] = useState('');
  const [page,   setPage]   = useState(1);

  const { data, isLoading, error } = useQuery<ShiftDetailResult>({
    queryKey: ['shift-details', from, to, status, page],
    queryFn:  () =>
      apiClient.get('/reports/shift-details', { params: { from, to, status: status || undefined, page, limit: 100 } })
        .then((r) => r.data),
  });

  const pageCount = data ? Math.ceil(data.total / 100) : 1;

  const handleCsvExport = () => {
    apiClient.get('/reports/shift-details', {
      params: { from, to, status: status || undefined, format: 'csv', limit: 10000 },
      responseType: 'blob',
    }).then((r) => {
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schichtbericht-${from}-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={1} mb={3}>
        <AssignmentIcon color="action" />
        <Typography variant="h5" fontWeight={700}>Schichtnachweis</Typography>
      </Stack>

      {/* Filters */}
      <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
          <TextField
            label="Von"
            type="date"
            size="small"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Bis"
            type="date"
            size="small"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            InputLabelProps={{ shrink: true }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <MenuItem value="">Alle</MenuItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={handleCsvExport} sx={{ ml: 'auto' }}>
            CSV exportieren
          </Button>
        </Stack>
      </Card>

      {/* Summary tiles */}
      {data && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} mb={3}>
          <Card variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {data.total.toLocaleString('de-DE')}
            </Typography>
            <Typography variant="body2" color="text.secondary">Schichten gesamt</Typography>
          </Card>
          <Card variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmt2(data.totalHours)} h
            </Typography>
            <Typography variant="body2" color="text.secondary">Stunden gesamt</Typography>
          </Card>
          <Card variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              € {fmt2(data.totalGrossPay)}
            </Typography>
            <Typography variant="body2" color="text.secondary">Bruttolohn gesamt</Typography>
          </Card>
        </Stack>
      )}

      {/* Table */}
      <Card variant="outlined">
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
        ) : error ? (
          <Box p={3}><Alert severity="error">Fehler beim Laden der Daten.</Alert></Box>
        ) : !data || data.rows.length === 0 ? (
          <Box textAlign="center" py={8}>
            <AssignmentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">Keine Schichten im gewählten Zeitraum.</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Datum</TableCell>
                    <TableCell>Mitarbeiter</TableCell>
                    <TableCell>Kunde</TableCell>
                    <TableCell align="center">Beginn</TableCell>
                    <TableCell align="center">Ende</TableCell>
                    <TableCell align="right">Pause (min)</TableCell>
                    <TableCell align="right">Std.</TableCell>
                    <TableCell align="right">Stundenlohn</TableCell>
                    <TableCell align="right">Bruttolohn</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r._id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(r.shiftDate)}</TableCell>
                      <TableCell>{r.workerName}</TableCell>
                      <TableCell>{r.businessName}</TableCell>
                      <TableCell align="center" sx={{ fontFamily: 'monospace' }}>{fmtTime(r.actualStart)}</TableCell>
                      <TableCell align="center" sx={{ fontFamily: 'monospace' }}>{fmtTime(r.actualEnd)}</TableCell>
                      <TableCell align="right">{r.actualBreakMinutes}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmt2(r.totalHours)}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>€ {fmt2(r.payRatePerHour)}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>€ {fmt2(r.grossPay)}</TableCell>
                      <TableCell>
                        <Chip
                          label={STATUS_LABEL[r.status] ?? r.status}
                          color={STATUS_COLOR[r.status] ?? 'default'}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: 10, height: 20 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {pageCount > 1 && (
              <Box display="flex" justifyContent="center" py={2}>
                <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} color="primary" />
              </Box>
            )}
          </>
        )}
      </Card>
    </Box>
  );
}
