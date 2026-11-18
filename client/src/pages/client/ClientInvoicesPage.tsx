import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import { clientPortalApi } from '../../api/clientPortal';

type TabKey = 'all' | 'open' | 'paid';

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

export default function ClientInvoicesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('all');

  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ['client-invoices', tab],
    queryFn: () => clientPortalApi.invoices(tab),
  });

  const totalOpen = invoices
    ?.filter((inv) => inv.status === 'sent' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.total, 0) ?? 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Typography variant="h5" fontWeight={700}>Rechnungen</Typography>
        {tab !== 'paid' && totalOpen > 0 && (
          <Box textAlign="right">
            <Typography variant="caption" color="text.secondary">Offener Betrag</Typography>
            <Typography variant="h6" fontWeight={700} color="warning.main">{fmtEur(totalOpen)}</Typography>
          </Box>
        )}
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Alle" value="all" />
        <Tab label="Offen" value="open" />
        <Tab label="Bezahlt" value="paid" />
      </Tabs>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Fehler beim Laden.</Alert>}

      {invoices && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Rechnungsnr.</TableCell>
                <TableCell>Zeitraum</TableCell>
                <TableCell>Datum</TableCell>
                <TableCell>Fällig</TableCell>
                <TableCell align="right">Betrag</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    Keine Rechnungen vorhanden.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow
                    key={inv._id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/client/invoices/${inv._id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{inv.invoiceNumber}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {fmtDate(inv.periodFrom)} – {fmtDate(inv.periodTo)}
                      </Typography>
                    </TableCell>
                    <TableCell>{fmtDate(inv.invoiceDate)}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={
                          inv.status === 'overdue' ? 'error.main' :
                          new Date(inv.dueDate) < new Date() && inv.status === 'sent'
                            ? 'warning.main' : 'inherit'
                        }
                      >
                        {fmtDate(inv.dueDate)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500}>{fmtEur(inv.total)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_LABEL[inv.status] ?? inv.status}
                        color={STATUS_COLOR[inv.status] ?? 'default'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
