import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
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
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { creditNotesApi } from '../../../api/creditNotes';

const STATUS_COLOR: Record<string, 'default' | 'primary' | 'success'> = {
  draft: 'default',
  issued: 'primary',
  applied: 'success',
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <Stack direction="row" gap={2} py={0.5}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>{label}</Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Stack>
  );
}

export default function CreditNoteDetailPage() {
  const { t } = useTranslation();
  const { creditNoteId } = useParams<{ creditNoteId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: note, isLoading, error } = useQuery({
    queryKey: ['credit-note', creditNoteId],
    queryFn: () => creditNotesApi.get(creditNoteId!),
    enabled: !!creditNoteId,
  });

  const issueMut = useMutation({
    mutationFn: () => creditNotesApi.issue(creditNoteId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit-note', creditNoteId] }),
  });

  if (isLoading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
  if (error || !note) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const invoiceId = typeof note.invoiceId === 'string' ? note.invoiceId : note.invoiceId._id;
  const invoiceNumber = typeof note.invoiceId === 'string' ? note.invoiceId : note.invoiceId.invoiceNumber;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" gap={2}>
          <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate(`/app/invoices/${invoiceId}/credit-notes`)}>
            {t('common.back')}
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700}>{note.creditNoteNumber}</Typography>
            <Chip size="small" label={note.status} color={STATUS_COLOR[note.status] ?? 'default'} sx={{ mt: 0.5 }} />
          </Box>
        </Stack>
        {note.status === 'draft' && (
          <Button
            variant="contained"
            disabled={issueMut.isPending}
            onClick={() => issueMut.mutate()}
          >
            {t('creditNotes.issue')}
          </Button>
        )}
      </Stack>

      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('creditNotes.details')}</Typography>
          <Divider sx={{ mb: 2 }} />
          <InfoRow label={t('creditNotes.number')} value={note.creditNoteNumber} />
          <InfoRow label={t('creditNotes.invoice')} value={invoiceNumber} />
          <InfoRow label={t('creditNotes.reason')} value={note.reason} />
          <InfoRow label={t('common.createdAt')} value={new Date(note.createdAt).toLocaleDateString('de-DE')} />
          {note.issuedAt && (
            <InfoRow label={t('creditNotes.issuedAt')} value={new Date(note.issuedAt).toLocaleDateString('de-DE')} />
          )}
        </Paper>

        <Paper sx={{ overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('invoices.description')}</TableCell>
                <TableCell align="right">{t('invoices.quantity')}</TableCell>
                <TableCell align="right">{t('invoices.unitPrice')}</TableCell>
                <TableCell align="right">{t('invoices.lineTotal')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {note.lineItems.map((li, idx) => (
                <TableRow key={idx}>
                  <TableCell>{li.description}</TableCell>
                  <TableCell align="right">{li.quantity}</TableCell>
                  <TableCell align="right">{li.unitPrice.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</TableCell>
                  <TableCell align="right">{li.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Divider />
          <Box p={2}>
            <Stack spacing={0.5} alignItems="flex-end">
              <Typography variant="body2">
                {t('invoices.subtotal')}: {note.subtotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </Typography>
              <Typography variant="body2">
                {t('invoices.vat')} ({note.vatRate}%): {note.vatAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </Typography>
              <Typography variant="body1" fontWeight={700}>
                {t('invoices.total')}: {note.totalAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </Typography>
            </Stack>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}
