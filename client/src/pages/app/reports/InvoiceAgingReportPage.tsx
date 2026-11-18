import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
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
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../api/client';
import Button from '@mui/material/Button';

type AgingBucket = '0_30' | '31_60' | '61_90' | '91_plus';

interface BucketSummary { count: number; total: number }

interface AgingRow {
  _id: string;
  invoiceNumber: string;
  businessId: string;
  businessName: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  status: string;
  daysPastDue: number;
  bucket: AgingBucket;
}

interface AgingResult {
  asOf: string;
  total: number;
  grandTotal: number;
  buckets: Record<AgingBucket, BucketSummary>;
  byBusiness: Array<{ businessId: string; businessName: string; buckets: Record<AgingBucket, BucketSummary> }>;
  rows: AgingRow[];
}

const BUCKETS: Array<{ key: AgingBucket; label: string; color: 'success' | 'info' | 'warning' | 'error' }> = [
  { key: '0_30',    label: '0 – 30 Tage',  color: 'success' },
  { key: '31_60',   label: '31 – 60 Tage', color: 'info' },
  { key: '61_90',   label: '61 – 90 Tage', color: 'warning' },
  { key: '91_plus', label: '> 90 Tage',    color: 'error' },
];

const fmt = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

const fmtDate = (d: string) => new Date(d).toLocaleDateString('de-DE');

function BucketIcon({ bucket }: { bucket: AgingBucket }) {
  if (bucket === '0_30')   return <CheckCircleOutlineIcon fontSize="small" color="success" />;
  if (bucket === '31_60')  return <CheckCircleOutlineIcon fontSize="small" color="info" />;
  if (bucket === '61_90')  return <WarningAmberIcon fontSize="small" color="warning" />;
  return <ErrorIcon fontSize="small" color="error" />;
}

export default function InvoiceAgingReportPage() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<AgingResult>({
    queryKey: ['report-invoice-aging'],
    queryFn: () => apiClient.get<AgingResult>('/reports/invoice-aging').then((r) => r.data),
  });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate('/app/reports')}>
          Berichte
        </Button>
        <Typography variant="h5" fontWeight={700}>Offene-Posten-Analyse (Fälligkeitsbericht)</Typography>
      </Stack>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Fehler beim Laden des Berichts.</Alert>}

      {data && (
        <>
          <Typography variant="caption" color="text.secondary" display="block" mb={3}>
            Stand: {fmtDate(data.asOf)} · {data.total} offene Rechnung{data.total !== 1 ? 'en' : ''} · Gesamtbetrag {fmt(data.grandTotal)}
          </Typography>

          {/* Bucket summary tiles */}
          <Grid container spacing={2} mb={4}>
            {BUCKETS.map(({ key, label, color }) => {
              const b = data.buckets[key];
              return (
                <Grid item xs={6} md={3} key={key}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Chip label={label} color={color} size="small" sx={{ mb: 1 }} />
                      <Typography variant="h6" fontWeight={700}>{fmt(b.total)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {b.count} Rechnung{b.count !== 1 ? 'en' : ''}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {data.total === 0 && (
            <Alert severity="success">Keine offenen Rechnungen. Alle Rechnungen sind bezahlt oder storniert.</Alert>
          )}

          {data.total > 0 && (
            <>
              {/* Per-business summary */}
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
                          {BUCKETS.map((b) => (
                            <TableCell key={b.key} align="right">
                              <Typography variant="caption" color={`${b.color}.main`}>{b.label}</Typography>
                            </TableCell>
                          ))}
                          <TableCell align="right">Gesamt</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.byBusiness.map((biz) => {
                          const bizTotal = BUCKETS.reduce((s, { key }) => s + biz.buckets[key].total, 0);
                          return (
                            <TableRow key={biz.businessId} hover>
                              <TableCell>{biz.businessName}</TableCell>
                              {BUCKETS.map(({ key, color }) => (
                                <TableCell key={key} align="right">
                                  {biz.buckets[key].total > 0 ? (
                                    <Typography variant="body2" color={`${color}.main`} fontWeight={key === '91_plus' ? 700 : 400}>
                                      {fmt(biz.buckets[key].total)}
                                    </Typography>
                                  ) : (
                                    <Typography variant="body2" color="text.disabled">—</Typography>
                                  )}
                                </TableCell>
                              ))}
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight={700}>{fmt(bizTotal)}</Typography>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Paper>
                </Box>
              )}

              {/* Invoice-level detail */}
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Alle offenen Rechnungen
              </Typography>
              <Paper variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Rechnungsnr.</TableCell>
                      <TableCell>Kundenbetrieb</TableCell>
                      <TableCell>Rechnungsdatum</TableCell>
                      <TableCell>Fälligkeitsdatum</TableCell>
                      <TableCell align="right">Betrag</TableCell>
                      <TableCell align="center">Tage überfällig</TableCell>
                      <TableCell align="center">Altersgruppe</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.rows.map((row) => {
                      const bucketMeta = BUCKETS.find((b) => b.key === row.bucket)!;
                      return (
                        <TableRow key={row._id} hover>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{ cursor: 'pointer', color: 'primary.main', textDecoration: 'underline' }}
                              onClick={() => navigate(`/app/invoices/${row._id}`)}
                            >
                              {row.invoiceNumber}
                            </Typography>
                          </TableCell>
                          <TableCell>{row.businessName}</TableCell>
                          <TableCell>{fmtDate(row.invoiceDate)}</TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              color={row.bucket === '91_plus' ? 'error.main' : row.bucket === '61_90' ? 'warning.main' : 'text.primary'}
                              fontWeight={row.bucket === '91_plus' ? 700 : 400}
                            >
                              {fmtDate(row.dueDate)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={600}>{fmt(row.total)}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title={`${row.daysPastDue} Tage seit Fälligkeit`}>
                              <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                                <BucketIcon bucket={row.bucket} />
                                <Typography
                                  variant="body2"
                                  color={row.daysPastDue === 0 ? 'text.secondary' : `${bucketMeta.color}.main`}
                                  fontWeight={row.daysPastDue > 60 ? 700 : 400}
                                >
                                  {row.daysPastDue === 0 ? 'Heute' : `+${row.daysPastDue}`}
                                </Typography>
                              </Stack>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={bucketMeta.label} color={bucketMeta.color} size="small" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
