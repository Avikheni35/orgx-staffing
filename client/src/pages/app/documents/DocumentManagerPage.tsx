import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Link,
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
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiClient from '../../../api/client';

interface AggregatedDoc {
  _id: string;
  workerId: string;
  workerName: string;
  category: string;
  label: string;
  fileUrl?: string;
  expiryDate?: string;
  verified: boolean;
  expiryStatus: 'valid' | 'expiringSoon' | 'expired' | 'noExpiry';
  createdAt: string;
}

function fetchAllDocuments() {
  return apiClient.get<AggregatedDoc[]>('/workers/documents/all').then((r) => r.data);
}

const EXPIRY_STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  valid: 'success',
  expiringSoon: 'warning',
  expired: 'error',
  noExpiry: 'default',
};

export default function DocumentManagerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [workerSearch, setWorkerSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['documents-all'],
    queryFn: fetchAllDocuments,
  });

  const docs = (data ?? []).filter((d) => {
    if (workerSearch && !d.workerName.toLowerCase().includes(workerSearch.toLowerCase())) return false;
    if (typeFilter !== 'all' && d.category !== typeFilter) return false;
    if (expiryFilter !== 'all' && d.expiryStatus !== expiryFilter) return false;
    return true;
  });

  const categories = Array.from(new Set((data ?? []).map((d) => d.category)));
  const expiredCount = (data ?? []).filter((d) => d.expiryStatus === 'expired').length;
  const expiringSoonCount = (data ?? []).filter((d) => d.expiryStatus === 'expiringSoon').length;

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('documentManager.title')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('documentManager.subtitle')}</Typography>
      </Box>

      {expiredCount > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('documentManager.expiredCount', { count: expiredCount })}
        </Alert>
      )}
      {expiringSoonCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('documentManager.expiringSoonCount', { count: expiringSoonCount })}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" gap={2} flexWrap="wrap">
          <TextField
            size="small"
            label={t('documentManager.filterWorker')}
            value={workerSearch}
            onChange={(e) => setWorkerSearch(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('documentManager.filterType')}</InputLabel>
            <Select value={typeFilter} label={t('documentManager.filterType')} onChange={(e) => setTypeFilter(e.target.value)}>
              <MenuItem value="all">{t('documentManager.all')}</MenuItem>
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('documentManager.filterExpiry')}</InputLabel>
            <Select value={expiryFilter} label={t('documentManager.filterExpiry')} onChange={(e) => setExpiryFilter(e.target.value)}>
              <MenuItem value="all">{t('documentManager.all')}</MenuItem>
              <MenuItem value="expired">{t('documentManager.expired')}</MenuItem>
              <MenuItem value="expiringSoon">{t('documentManager.expiringSoon')}</MenuItem>
              <MenuItem value="valid">{t('documentManager.valid')}</MenuItem>
              <MenuItem value="noExpiry">{t('documentManager.pending')}</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error">{t('common.loadError')}</Alert>
      ) : docs.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">{t('documentManager.noDocuments')}</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>{t('documentManager.worker')}</TableCell>
                <TableCell>{t('documentManager.documentType')}</TableCell>
                <TableCell>{t('workers.documents')}</TableCell>
                <TableCell>{t('documentManager.expires')}</TableCell>
                <TableCell>{t('documentManager.status')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc._id} hover>
                  <TableCell sx={{ width: 32 }}>
                    <InsertDriveFileIcon fontSize="small" color="action" />
                  </TableCell>
                  <TableCell>
                    <Link
                      component="button"
                      underline="hover"
                      variant="body2"
                      onClick={() => navigate(`/app/workers/${doc.workerId}`)}
                    >
                      {doc.workerName}
                    </Link>
                  </TableCell>
                  <TableCell>{doc.category}</TableCell>
                  <TableCell>{doc.label}</TableCell>
                  <TableCell>
                    {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('de-DE') : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t(`documentManager.${doc.expiryStatus === 'noExpiry' ? 'pending' : doc.expiryStatus}`)}
                      color={EXPIRY_STATUS_COLOR[doc.expiryStatus]}
                    />
                  </TableCell>
                  <TableCell>
                    {doc.fileUrl && (
                      <Link href={doc.fileUrl} target="_blank" rel="noopener" variant="caption" underline="hover">
                        {t('common.view')}
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
