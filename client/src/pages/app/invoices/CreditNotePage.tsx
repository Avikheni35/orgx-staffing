import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
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
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { creditNotesApi, type CreditNoteLineItem } from '../../../api/creditNotes';

const STATUS_COLOR: Record<string, 'default' | 'primary' | 'success'> = {
  draft: 'default',
  issued: 'primary',
  applied: 'success',
};

export default function CreditNotePage() {
  const { t } = useTranslation();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [lineItems, setLineItems] = useState<CreditNoteLineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [errMsg, setErrMsg] = useState('');

  const { data: notes, isLoading } = useQuery({
    queryKey: ['credit-notes', invoiceId],
    queryFn: () => creditNotesApi.list(invoiceId),
    enabled: !!invoiceId,
  });

  const createMut = useMutation({
    mutationFn: () =>
      creditNotesApi.create({ invoiceId: invoiceId!, reason, lineItems }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credit-notes', invoiceId] });
      setOpen(false);
      setReason('');
      setLineItems([{ description: '', quantity: 1, unitPrice: 0, total: 0 }]);
      setErrMsg('');
    },
    onError: (e: unknown) =>
      setErrMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')),
  });

  const updateLineItem = (idx: number, field: keyof CreditNoteLineItem, value: string | number) => {
    setLineItems((items) =>
      items.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        updated.total = Math.round(updated.quantity * updated.unitPrice * 100) / 100;
        return updated;
      })
    );
  };

  const subtotal = lineItems.reduce((s, li) => s + li.total, 0);
  const canCreate = reason.trim() && lineItems.every((li) => li.description.trim() && li.total > 0);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" gap={2}>
          <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate(`/app/invoices/${invoiceId}`)}>
            {t('common.back')}
          </Button>
          <Typography variant="h5" fontWeight={700}>{t('creditNotes.title')}</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          {t('creditNotes.create')}
        </Button>
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
      ) : (notes ?? []).length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">{t('creditNotes.empty')}</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('creditNotes.number')}</TableCell>
                <TableCell>{t('creditNotes.reason')}</TableCell>
                <TableCell align="right">{t('creditNotes.total')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
                <TableCell>{t('common.createdAt')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(notes ?? []).map((note) => (
                <TableRow key={note._id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{note.creditNoteNumber}</TableCell>
                  <TableCell sx={{ maxWidth: 250 }}>{note.reason}</TableCell>
                  <TableCell align="right">
                    {note.totalAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={note.status} color={STATUS_COLOR[note.status] ?? 'default'} />
                  </TableCell>
                  <TableCell>{new Date(note.createdAt).toLocaleDateString('de-DE')}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => navigate(`/app/credit-notes/${note._id}`)}>
                      {t('common.view')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('creditNotes.create')}</DialogTitle>
        <DialogContent>
          {errMsg && <Alert severity="error" sx={{ mb: 2 }}>{errMsg}</Alert>}
          <TextField
            label={t('creditNotes.reason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            multiline
            rows={2}
            sx={{ mt: 1, mb: 3 }}
          />

          <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('creditNotes.lineItems')}</Typography>
          <Divider sx={{ mb: 2 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('invoices.description')}</TableCell>
                <TableCell align="right" sx={{ width: 80 }}>{t('invoices.quantity')}</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>{t('invoices.unitPrice')}</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>{t('invoices.lineTotal')}</TableCell>
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {lineItems.map((li, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <TextField
                      size="small" fullWidth value={li.description}
                      onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small" type="number" value={li.quantity} sx={{ width: 70 }}
                      onChange={(e) => updateLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small" type="number" value={li.unitPrice} sx={{ width: 100 }}
                      onChange={(e) => updateLineItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {li.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={t('common.delete')}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={lineItems.length === 1}
                          onClick={() => setLineItems((items) => items.filter((_, i) => i !== idx))}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            size="small" startIcon={<AddIcon />} sx={{ mt: 1 }}
            onClick={() => setLineItems((items) => [...items, { description: '', quantity: 1, unitPrice: 0, total: 0 }])}
          >
            {t('common.addRow')}
          </Button>
          <Divider sx={{ mt: 2, mb: 1 }} />
          <Typography align="right" variant="body2">
            {t('creditNotes.subtotal')}: <strong>{subtotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={!canCreate || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {t('creditNotes.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
