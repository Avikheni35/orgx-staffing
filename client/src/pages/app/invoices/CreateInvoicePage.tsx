import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { businessesApi } from '../../../api/businesses';
import { invoicesApi } from '../../../api/invoices';
import type { Timesheet } from '../../../api/timesheets';

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function calcHours(ts: Timesheet): number {
  return ts.totalHours;
}

export default function CreateInvoicePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const today = new Date();
  const defaultDue = new Date(today);
  defaultDue.setDate(defaultDue.getDate() + 14);

  const [businessId, setBusinessId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [invoiceDate, setInvoiceDate] = useState(toDateInput(today));
  const [dueDate, setDueDate] = useState(toDateInput(defaultDue));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: bizData } = useQuery({
    queryKey: ['businesses-all'],
    queryFn: () => businessesApi.list({ limit: 200 }),
  });

  const { data: timesheets, isLoading: tsLoading } = useQuery({
    queryKey: ['invoiceable-ts', businessId],
    queryFn: () => invoicesApi.getInvoiceableTimesheets(businessId),
    enabled: !!businessId,
  });

  const createMutation = useMutation({
    mutationFn: invoicesApi.create,
    onSuccess: (inv) => navigate(`/app/invoices/${inv._id}`, { replace: true }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error');
      setError(msg);
    },
  });

  const toggleAll = () => {
    if (selected.size === (timesheets?.length ?? 0)) setSelected(new Set());
    else setSelected(new Set(timesheets?.map((ts) => ts._id) ?? []));
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedTs = (timesheets ?? []).filter((ts) => selected.has(ts._id));
  const subtotal = selectedTs.reduce((s, ts) => {
    const rate = ts.billingRatePerHour ?? ts.payRatePerHour;
    return s + ts.totalHours * rate;
  }, 0);
  const vatRate = 19;
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;

  const periodDates = selectedTs.length > 0
    ? {
        from: selectedTs.reduce((min, ts) => ts.shiftDate < min ? ts.shiftDate : min, selectedTs[0].shiftDate),
        to: selectedTs.reduce((max, ts) => ts.shiftDate > max ? ts.shiftDate : max, selectedTs[0].shiftDate),
      }
    : null;

  const handleSubmit = () => {
    if (!businessId) { setError(t('invoices.validation.selectBusiness')); return; }
    if (selected.size === 0) { setError(t('invoices.validation.selectTimesheets')); return; }
    if (new Date(dueDate) <= new Date(invoiceDate)) { setError(t('invoices.validation.dueAfterInvoice')); return; }
    setError('');

    createMutation.mutate({
      businessId,
      timesheetIds: Array.from(selected),
      invoiceDate: new Date(invoiceDate).toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      periodFrom: periodDates ? new Date(periodDates.from).toISOString() : new Date(invoiceDate).toISOString(),
      periodTo: periodDates ? new Date(periodDates.to).toISOString() : new Date(invoiceDate).toISOString(),
      notes: notes || undefined,
    });
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/invoices')} size="small">
          {t('common.back')}
        </Button>
        <Typography variant="h5" fontWeight={700}>{t('invoices.createInvoice')}</Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Step 1: Select client */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              1. {t('invoices.selectBusiness')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <FormControl fullWidth>
              <InputLabel>{t('invoices.client')}</InputLabel>
              <Select
                value={businessId}
                label={t('invoices.client')}
                onChange={(e) => { setBusinessId(e.target.value); setSelected(new Set()); }}
              >
                {bizData?.businesses.map((b) => (
                  <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>

          {/* Step 2: Select timesheets */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              2. {t('invoices.selectTimesheets')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {!businessId ? (
              <Typography variant="body2" color="text.secondary">{t('invoices.validation.selectBusiness')}</Typography>
            ) : tsLoading ? (
              <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>
            ) : !timesheets?.length ? (
              <Alert severity="info">{t('invoices.noInvoiceable')}</Alert>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  {t('invoices.selectedCount', { count: selected.size })}
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selected.size === timesheets.length}
                          indeterminate={selected.size > 0 && selected.size < timesheets.length}
                          onChange={toggleAll}
                        />
                      </TableCell>
                      <TableCell>{t('timesheets.worker')}</TableCell>
                      <TableCell>{t('timesheets.shiftDate')}</TableCell>
                      <TableCell align="right">{t('timesheets.actualHours')}</TableCell>
                      <TableCell align="right">{t('invoices.rate')}</TableCell>
                      <TableCell align="right">{t('invoices.amount')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {timesheets.map((ts) => {
                      const rate = ts.billingRatePerHour ?? ts.payRatePerHour;
                      const amount = ts.totalHours * rate;
                      return (
                        <TableRow key={ts._id} hover selected={selected.has(ts._id)} sx={{ cursor: 'pointer' }} onClick={() => toggle(ts._id)}>
                          <TableCell padding="checkbox">
                            <Checkbox checked={selected.has(ts._id)} onChange={() => toggle(ts._id)} onClick={(e) => e.stopPropagation()} />
                          </TableCell>
                          <TableCell>{ts.workerName}</TableCell>
                          <TableCell>{fmt(ts.shiftDate)}</TableCell>
                          <TableCell align="right">{calcHours(ts).toFixed(2)} h</TableCell>
                          <TableCell align="right">{rate.toFixed(2)} €</TableCell>
                          <TableCell align="right">€ {amount.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </Paper>

          {/* Step 3: Dates + notes */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              3. Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('invoices.invoiceDate')}
                  type="date"
                  fullWidth
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('invoices.dueDate')}
                  type="date"
                  fullWidth
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label={t('invoices.notes')}
                  fullWidth
                  multiline
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Preview panel */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, position: 'sticky', top: 24 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t('invoices.preview')}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {selected.size === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('invoices.validation.selectTimesheets')}</Typography>
            ) : (
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">{t('invoices.subtotal')}</Typography>
                  <Typography variant="body2">€ {subtotal.toFixed(2)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">{t('invoices.vat', { rate: vatRate })}</Typography>
                  <Typography variant="body2">€ {vatAmount.toFixed(2)}</Typography>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body1" fontWeight={700}>{t('invoices.total')}</Typography>
                  <Typography variant="body1" fontWeight={700}>€ {total.toFixed(2)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Positionen</Typography>
                  <Typography variant="body2">{selected.size}</Typography>
                </Stack>
              </Stack>
            )}

            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<ReceiptIcon />}
              sx={{ mt: 3 }}
              disabled={selected.size === 0 || !businessId || createMutation.isPending}
              onClick={handleSubmit}
            >
              {createMutation.isPending ? t('common.loading') : t('invoices.createInvoice')}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
