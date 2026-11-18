import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { clientPortalApi } from '../../api/clientPortal';
import apiClient from '../../api/client';

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'error',
  cancelled: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Entwurf',
  sent: 'Offen',
  paid: 'Bezahlt',
  overdue: 'Überfällig',
  cancelled: 'Storniert',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE');
}

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function ClientInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['client-invoice', id],
    queryFn: () => clientPortalApi.invoice(id!),
    enabled: Boolean(id),
  });

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setPdfLoading(true);
    try {
      const response = await apiClient.get(`/client-portal/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  };

  if (isLoading) return <CircularProgress />;
  if (error || !invoice) return <Alert severity="error">Rechnung nicht gefunden.</Alert>;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/client/invoices')} sx={{ mb: 2 }}>
        Zurück
      </Button>

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Rechnung {invoice.invoiceNumber}</Typography>
          <Typography variant="body2" color="text.secondary">
            Zeitraum: {fmtDate(invoice.periodFrom)} – {fmtDate(invoice.periodTo)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
          >
            {pdfLoading ? 'Laden...' : 'PDF herunterladen'}
          </Button>
          <Chip
            label={STATUS_LABEL[invoice.status] ?? invoice.status}
            color={STATUS_COLOR[invoice.status] ?? 'default'}
          />
        </Stack>
      </Stack>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={600} gutterBottom>
                RECHNUNGSSTELLER
              </Typography>
              <Typography variant="body2" fontWeight={500}>{invoice.agencyName}</Typography>
              {invoice.agencyAddress && (
                <Typography variant="body2" color="text.secondary">{invoice.agencyAddress}</Typography>
              )}
              {invoice.agencyVatId && (
                <Typography variant="body2" color="text.secondary">USt-ID: {invoice.agencyVatId}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={600} gutterBottom>
                RECHNUNGSDATEN
              </Typography>
              <Stack spacing={0.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Rechnungsdatum</Typography>
                  <Typography variant="body2">{fmtDate(invoice.invoiceDate)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Fällig am</Typography>
                  <Typography
                    variant="body2"
                    color={invoice.status === 'overdue' ? 'error.main' : 'inherit'}
                    fontWeight={invoice.status === 'overdue' ? 700 : 400}
                  >
                    {fmtDate(invoice.dueDate)}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ pb: '0 !important' }}>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={600} gutterBottom>
            POSITIONEN
          </Typography>
        </CardContent>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Beschreibung</TableCell>
              <TableCell align="right">Stunden</TableCell>
              <TableCell align="right">Stundensatz</TableCell>
              <TableCell align="right">Betrag</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoice.lineItems.map((item, i) => (
              <TableRow key={i}>
                <TableCell>{item.description}</TableCell>
                <TableCell align="right">{item.hours.toFixed(2)}</TableCell>
                <TableCell align="right">{fmtEur(item.ratePerHour)}</TableCell>
                <TableCell align="right">{fmtEur(item.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Stack spacing={0.5} maxWidth={300} ml="auto">
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Nettobetrag</Typography>
              <Typography variant="body2">{fmtEur(invoice.subtotal)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">MwSt. ({invoice.vatRate}%)</Typography>
              <Typography variant="body2">{fmtEur(invoice.vatAmount)}</Typography>
            </Stack>
            <Divider sx={{ my: 0.5 }} />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body1" fontWeight={700}>Gesamtbetrag</Typography>
              <Typography variant="body1" fontWeight={700}>{fmtEur(invoice.total)}</Typography>
            </Stack>
          </Stack>
        </Box>

        {invoice.notes && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">Hinweise</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>{invoice.notes}</Typography>
          </Box>
        )}
      </Card>
    </Box>
  );
}
