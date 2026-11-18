import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
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
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { invoicesApi, InvoiceStatus } from '../../../api/invoices';

const STATUS_COLOR: Record<InvoiceStatus, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'error',
  cancelled: 'warning',
};

const TABS: Array<InvoiceStatus | undefined> = [undefined, 'draft', 'sent', 'paid', 'overdue', 'cancelled'];

export default function InvoiceListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [exportLoading, setExportLoading] = useState(false);

  const status = TABS[tab];

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', tab],
    queryFn: () => invoicesApi.list({ ...(status ? { status } : {}), limit: 100 }),
    placeholderData: (prev) => prev,
  });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const totalRevenue = (data?.invoices ?? [])
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.total, 0);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('invoices.title')}</Typography>
          {tab === 0 && data && (
            <Typography variant="body2" color="text.secondary">
              {t('invoices.totalRevenue')}: <strong>€ {totalRevenue.toFixed(2)}</strong>
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            disabled={exportLoading}
            onClick={async () => {
              setExportLoading(true);
              try { await invoicesApi.datevExport(); } finally { setExportLoading(false); }
            }}
          >
            DATEV Export
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/app/invoices/new')}
          >
            {t('invoices.createInvoice')}
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={t('shifts.all')} />
          <Tab label={t('invoices.statusLabel.draft')} />
          <Tab label={t('invoices.statusLabel.sent')} />
          <Tab label={t('invoices.statusLabel.paid')} />
          <Tab label={t('invoices.statusLabel.overdue')} />
          <Tab label={t('invoices.statusLabel.cancelled')} />
        </Tabs>
      </Paper>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{t('common.loadError')}</Alert>}

      {data && (
        <>
          <Typography variant="body2" color="text.secondary" mb={1}>
            {t('invoices.totalCount', { count: data.total })}
          </Typography>
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('invoices.invoiceNumber')}</TableCell>
                  <TableCell>{t('invoices.client')}</TableCell>
                  <TableCell>{t('invoices.invoiceDate')}</TableCell>
                  <TableCell>{t('invoices.dueDate')}</TableCell>
                  <TableCell align="right">{t('invoices.total')}</TableCell>
                  <TableCell>{t('invoices.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {t('invoices.noResults')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.invoices.map((inv) => (
                    <TableRow
                      key={inv._id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/app/invoices/${inv._id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>{inv.invoiceNumber}</Typography>
                      </TableCell>
                      <TableCell>{inv.businessName}</TableCell>
                      <TableCell>{fmt(inv.invoiceDate)}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={inv.status === 'overdue' ? 'error.main' : 'inherit'}
                        >
                          {fmt(inv.dueDate)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>€ {inv.total.toFixed(2)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={t(`invoices.statusLabel.${inv.status}`)}
                          color={STATUS_COLOR[inv.status]}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}
