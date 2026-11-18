import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  CardContent,
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
import EuroIcon from '@mui/icons-material/Euro';
import BusinessIcon from '@mui/icons-material/Business';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../api/client';

interface ClientRevenueRow {
  businessId: string;
  businessName: string;
  invoiceCount: number;
  totalRevenue: number;
  outstandingAmount: number;
  totalHours: number;
}

interface ClientRevenueResult {
  from: string;
  to: string;
  total: number;
  grandTotal: number;
  grandOutstanding: number;
  rows: ClientRevenueRow[];
}

const fmtEur = (n: number) =>
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

export default function ClientRevenueReportPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [fromMonth, setFromMonth] = useState(toMonthInput(new Date(now.getFullYear(), 0, 1)));
  const [toMonth, setToMonth] = useState(toMonthInput(now));

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports-client-revenue', fromMonth, toMonth],
    queryFn: () =>
      apiClient
        .get<ClientRevenueResult>('/reports/client-revenue', {
          params: { from: monthStart(fromMonth), to: monthEnd(toMonth) },
        })
        .then((r) => r.data),
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Kundenumsätze</Typography>
          <Typography variant="body2" color="text.secondary">
            Rechnungsumsatz und offene Beträge je Kundenunternehmen im gewählten Zeitraum
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
        </Stack>
      </Stack>

      {/* Summary cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <BusinessIcon color="primary" />
                <Box>
                  <Typography variant="h5" fontWeight={700}>{data?.total ?? 0}</Typography>
                  <Typography variant="body2" color="text.secondary">Kunden mit Rechnungen</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <EuroIcon color="success" />
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    € {fmtEur(data?.grandTotal ?? 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Gesamtumsatz (netto+MwSt.)</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <PendingActionsIcon color={(data?.grandOutstanding ?? 0) > 0 ? 'warning' : 'action'} />
                <Box>
                  <Typography
                    variant="h5"
                    fontWeight={700}
                    color={(data?.grandOutstanding ?? 0) > 0 ? 'warning.main' : 'text.primary'}
                  >
                    € {fmtEur(data?.grandOutstanding ?? 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Offen (gesendet + überfällig)</Typography>
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
          Keine Rechnungen im gewählten Zeitraum.
        </Alert>
      )}

      {data && data.rows.length > 0 && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Kunde</TableCell>
                <TableCell align="right">Rechnungen</TableCell>
                <TableCell align="right">Stunden</TableCell>
                <TableCell align="right">Umsatz</TableCell>
                <TableCell align="right">Offen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow
                  key={row.businessId}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/app/businesses/${row.businessId}`)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{row.businessName}</Typography>
                  </TableCell>
                  <TableCell align="right">{row.invoiceCount}</TableCell>
                  <TableCell align="right">
                    {row.totalHours > 0
                      ? `${row.totalHours.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`
                      : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      € {fmtEur(row.totalRevenue)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {row.outstandingAmount > 0 ? (
                      <Typography variant="body2" color="warning.main" fontWeight={600}>
                        € {fmtEur(row.outstandingAmount)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="success.main">✓</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Divider />
          <Box px={2} py={1.5}>
            <Stack direction="row" justifyContent="flex-end" spacing={4}>
              <Typography variant="body2" color="text.secondary">
                Gesamtumsatz: <strong>€ {fmtEur(data.grandTotal)}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Offen: <strong>€ {fmtEur(data.grandOutstanding)}</strong>
              </Typography>
            </Stack>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
