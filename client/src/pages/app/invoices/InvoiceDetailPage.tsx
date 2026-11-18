import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
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
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { invoicesApi, InvoiceStatus } from '../../../api/invoices';

const STATUS_COLOR: Record<InvoiceStatus, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'error',
  cancelled: 'warning',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function InvoiceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(id!),
    enabled: !!id,
  });

  const [pdfLoading, setPdfLoading] = useState(false);

  const statusMutation = useMutation({
    mutationFn: (status: InvoiceStatus) => invoicesApi.updateStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['client-invoices'] });
    },
  });

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await invoicesApi.downloadPdf(id!, invoice!.invoiceNumber);
    } finally {
      setPdfLoading(false);
    }
  };

  if (isLoading) return <CircularProgress />;
  if (error || !invoice) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const isActive = invoice.status !== 'cancelled';

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/invoices')} size="small">
            {t('common.back')}
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700}>{invoice.invoiceNumber}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
              <Chip label={t(`invoices.statusLabel.${invoice.status}`)} color={STATUS_COLOR[invoice.status]} size="small" />
              <Typography variant="caption" color="text.secondary">{invoice.businessName}</Typography>
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
          <Button
            size="small"
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
          >
            {pdfLoading ? t('common.loading') : t('invoices.downloadPdf')}
          </Button>
          {isActive && (
            <>
              {invoice.status === 'draft' && (
                <Button size="small" variant="contained" startIcon={<SendIcon />} onClick={() => statusMutation.mutate('sent')} disabled={statusMutation.isPending}>
                  {t('invoices.markSent')}
                </Button>
              )}
              {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                <>
                  <Button size="small" variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => statusMutation.mutate('paid')} disabled={statusMutation.isPending}>
                    {t('invoices.markPaid')}
                  </Button>
                  {invoice.status === 'sent' && (
                    <Button size="small" variant="outlined" color="warning" startIcon={<WarningAmberIcon />} onClick={() => statusMutation.mutate('overdue')} disabled={statusMutation.isPending}>
                      {t('invoices.markOverdue')}
                    </Button>
                  )}
                </>
              )}
              {invoice.status !== 'paid' && (
                <Button size="small" variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => statusMutation.mutate('cancelled')} disabled={statusMutation.isPending}>
                  {t('invoices.cancel')}
                </Button>
              )}
            </>
          )}
        </Stack>
      </Stack>

      {statusMutation.isError && <Alert severity="error" sx={{ mb: 2 }}>{t('common.saveError')}</Alert>}

      <Grid container spacing={3}>
        {/* Invoice document */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 4 }}>
            {/* Invoice header */}
            <Grid container justifyContent="space-between" mb={4}>
              <Grid item xs={6}>
                <Typography variant="h6" fontWeight={700}>{invoice.agencyName}</Typography>
                {invoice.agencyAddress && (
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                    {invoice.agencyAddress}
                  </Typography>
                )}
                {invoice.agencyVatId && (
                  <Typography variant="body2" color="text.secondary">USt-ID: {invoice.agencyVatId}</Typography>
                )}
              </Grid>
              <Grid item xs={5} textAlign="right">
                <Typography variant="h5" fontWeight={700} color="primary">{invoice.invoiceNumber}</Typography>
                <Typography variant="body2">{t('invoices.invoiceDate')}: {fmtDate(invoice.invoiceDate)}</Typography>
                <Typography variant="body2">{t('invoices.dueDate')}: <strong>{fmtDate(invoice.dueDate)}</strong></Typography>
              </Grid>
            </Grid>

            {/* Bill to */}
            <Box mb={3}>
              <Typography variant="caption" color="text.secondary" display="block">Rechnungsempfänger</Typography>
              <Typography variant="body1" fontWeight={600}>{invoice.businessName}</Typography>
              {invoice.businessAddress && (
                <Typography variant="body2" color="text.secondary">{invoice.businessAddress}</Typography>
              )}
              {invoice.businessVatId && (
                <Typography variant="body2" color="text.secondary">USt-ID: {invoice.businessVatId}</Typography>
              )}
            </Box>

            {/* Period */}
            <Box mb={3}>
              <Typography variant="body2" color="text.secondary">
                {t('invoices.period')}: {fmtDate(invoice.periodFrom)} – {fmtDate(invoice.periodTo)}
              </Typography>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Line items */}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('invoices.description')}</TableCell>
                  <TableCell align="right">{t('invoices.hours')}</TableCell>
                  <TableCell align="right">{t('invoices.rate')}</TableCell>
                  <TableCell align="right">{t('invoices.amount')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice.lineItems.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell align="right">{item.hours.toFixed(2)}</TableCell>
                    <TableCell align="right">{item.ratePerHour.toFixed(2)} €</TableCell>
                    <TableCell align="right">€ {item.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Divider sx={{ my: 2 }} />

            {/* Totals */}
            <Stack alignItems="flex-end" spacing={0.5}>
              <Stack direction="row" spacing={4}>
                <Typography variant="body2" color="text.secondary">{t('invoices.subtotal')}</Typography>
                <Typography variant="body2" sx={{ minWidth: 100, textAlign: 'right' }}>€ {invoice.subtotal.toFixed(2)}</Typography>
              </Stack>
              <Stack direction="row" spacing={4}>
                <Typography variant="body2" color="text.secondary">{t('invoices.vat', { rate: invoice.vatRate })}</Typography>
                <Typography variant="body2" sx={{ minWidth: 100, textAlign: 'right' }}>€ {invoice.vatAmount.toFixed(2)}</Typography>
              </Stack>
              <Divider sx={{ width: 250 }} />
              <Stack direction="row" spacing={4}>
                <Typography variant="body1" fontWeight={700}>{t('invoices.total')}</Typography>
                <Typography variant="body1" fontWeight={700} sx={{ minWidth: 100, textAlign: 'right' }}>€ {invoice.total.toFixed(2)}</Typography>
              </Stack>
            </Stack>

            {invoice.notes && (
              <Box mt={3} p={2} bgcolor="grey.50" borderRadius={1}>
                <Typography variant="caption" color="text.secondary" display="block">{t('invoices.notes')}</Typography>
                <Typography variant="body2">{invoice.notes}</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Side info */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Details</Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Positionen</Typography>
                <Typography variant="body2">{invoice.lineItems.length}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">MwSt.-Satz</Typography>
                <Typography variant="body2">{invoice.vatRate} %</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Erstellt am</Typography>
                <Typography variant="body2">{fmtDate(invoice.createdAt)}</Typography>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
