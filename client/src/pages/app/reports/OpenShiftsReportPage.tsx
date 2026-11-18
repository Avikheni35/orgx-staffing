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
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BusinessIcon from '@mui/icons-material/Business';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../api/client';

interface OpenShiftRow {
  _id: string;
  title: string;
  businessId: string;
  businessName: string;
  locationName?: string;
  startTime: string;
  endTime: string;
  requiredWorkers: number;
  filledCount: number;
  openSlots: number;
  payRatePerHour: number;
  urgent: boolean;
  hoursUntilStart: number;
}

interface OpenShiftsResult {
  asOf: string;
  from: string;
  to: string;
  total: number;
  totalOpenSlots: number;
  urgentCount: number;
  byBusiness: Array<{ businessId: string; businessName: string; shiftCount: number; openSlots: number }>;
  rows: OpenShiftRow[];
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

const toInputDate = (d: Date) => d.toISOString().slice(0, 10);

function UrgencyChip({ row }: { row: OpenShiftRow }) {
  if (row.urgent) {
    return (
      <Chip
        icon={<WarningAmberIcon />}
        label={row.hoursUntilStart === 0 ? 'Jetzt' : `${row.hoursUntilStart}h`}
        color="error"
        size="small"
      />
    );
  }
  const days = Math.ceil(row.hoursUntilStart / 24);
  const color = days <= 3 ? 'warning' : 'default';
  return <Chip label={`${days}d`} color={color} size="small" variant="outlined" />;
}

export default function OpenShiftsReportPage() {
  const navigate = useNavigate();
  const now = new Date();

  const [from, setFrom] = useState(toInputDate(now));
  const [to, setTo] = useState(toInputDate(new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)));

  const { data, isLoading, error } = useQuery<OpenShiftsResult>({
    queryKey: ['report-open-shifts', from, to],
    queryFn: () =>
      apiClient
        .get<OpenShiftsResult>('/reports/open-shifts', { params: { from, to } })
        .then((r) => r.data),
  });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate('/app/reports')}>
          Berichte
        </Button>
        <Typography variant="h5" fontWeight={700}>Offene Schichten</Typography>
      </Stack>

      {/* Filters */}
      <Stack direction="row" spacing={2} mb={3} flexWrap="wrap">
        <TextField
          label="Von"
          type="date"
          size="small"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Bis"
          type="date"
          size="small"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Fehler beim Laden des Berichts.</Alert>}

      {data && (
        <>
          <Typography variant="caption" color="text.secondary" display="block" mb={3}>
            Stand: {new Date(data.asOf).toLocaleString('de-DE')}
          </Typography>

          {/* Summary tiles */}
          <Grid container spacing={2} mb={4}>
            <Grid item xs={6} md={3}>
              <Card variant="outlined">
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <EventBusyIcon color="primary" fontSize="small" />
                    <Typography variant="caption" color="text.secondary">Offene Schichten</Typography>
                  </Stack>
                  <Typography variant="h5" fontWeight={700}>{data.total}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card variant="outlined">
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <PeopleOutlineIcon color="primary" fontSize="small" />
                    <Typography variant="caption" color="text.secondary">Freie Plätze gesamt</Typography>
                  </Stack>
                  <Typography variant="h5" fontWeight={700}>{data.totalOpenSlots}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card variant="outlined">
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <WarningAmberIcon color="error" fontSize="small" />
                    <Typography variant="caption" color="text.secondary">Dringend (≤ 48 h)</Typography>
                  </Stack>
                  <Typography variant="h5" fontWeight={700} color={data.urgentCount > 0 ? 'error.main' : 'text.primary'}>
                    {data.urgentCount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card variant="outlined">
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <BusinessIcon color="primary" fontSize="small" />
                    <Typography variant="caption" color="text.secondary">Betroffene Kunden</Typography>
                  </Stack>
                  <Typography variant="h5" fontWeight={700}>{data.byBusiness.length}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {data.total === 0 && (
            <Alert severity="success">
              Alle veröffentlichten Schichten im gewählten Zeitraum sind vollständig besetzt.
            </Alert>
          )}

          {data.total > 0 && (
            <>
              {/* Per-business breakdown */}
              {data.byBusiness.length > 1 && (
                <Box mb={4}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Zusammenfassung nach Kundenbetrieb
                  </Typography>
                  <Paper variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Kundenbetrieb</TableCell>
                          <TableCell align="right">Offene Schichten</TableCell>
                          <TableCell align="right">Freie Plätze</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.byBusiness
                          .sort((a, b) => b.openSlots - a.openSlots)
                          .map((biz) => (
                            <TableRow key={biz.businessId} hover>
                              <TableCell>{biz.businessName}</TableCell>
                              <TableCell align="right">{biz.shiftCount}</TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight={700} color="warning.main">
                                  {biz.openSlots}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Box>
              )}

              {/* Shift-level detail */}
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Alle offenen Schichten
              </Typography>
              <Paper variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Schicht</TableCell>
                      <TableCell>Kundenbetrieb</TableCell>
                      <TableCell>Beginn</TableCell>
                      <TableCell align="center">Besetzt</TableCell>
                      <TableCell align="center">Offen</TableCell>
                      <TableCell align="right">Stundenlohn</TableCell>
                      <TableCell align="center">Dringlichkeit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.rows.map((row) => (
                      <TableRow
                        key={row._id}
                        hover
                        sx={{ cursor: 'pointer', bgcolor: row.urgent ? 'error.50' : undefined }}
                        onClick={() => navigate(`/app/shifts/${row._id}`)}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{row.title}</Typography>
                          {row.locationName && (
                            <Typography variant="caption" color="text.secondary">{row.locationName}</Typography>
                          )}
                        </TableCell>
                        <TableCell>{row.businessName}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            color={row.urgent ? 'error.main' : 'text.primary'}
                            fontWeight={row.urgent ? 700 : 400}
                          >
                            {fmtDateTime(row.startTime)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2">
                            {row.filledCount} / {row.requiredWorkers}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={`${row.openSlots} freier Platz${row.openSlots !== 1 ? 'e' : ''}`}>
                            <Chip
                              label={row.openSlots}
                              color={row.openSlots >= row.requiredWorkers ? 'error' : 'warning'}
                              size="small"
                            />
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          {row.payRatePerHour.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} / h
                        </TableCell>
                        <TableCell align="center">
                          <UrgencyChip row={row} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </>
          )}
        </>
      )}
    </Box>
  );
}
