import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { businessesApi } from '../../../api/businesses';

export default function BusinessListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['businesses', search],
    queryFn: () => businessesApi.list(search ? { search } : undefined),
    placeholderData: (prev) => prev,
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>
          {t('nav.businesses')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/app/businesses/new')}
        >
          {t('businesses.addBusiness')}
        </Button>
      </Stack>

      <Paper sx={{ mb: 2, p: 2 }}>
        <TextField
          placeholder={t('businesses.searchPlaceholder')}
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 320 }}
        />
      </Paper>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{t('common.loadError')}</Alert>}

      {data && (
        <>
          <Typography variant="body2" color="text.secondary" mb={1}>
            {t('businesses.totalCount', { count: data.total })}
          </Typography>
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('businesses.name')}</TableCell>
                  <TableCell>{t('businesses.industry')}</TableCell>
                  <TableCell>{t('businesses.contacts')}</TableCell>
                  <TableCell>{t('businesses.locations')}</TableCell>
                  <TableCell>{t('businesses.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.businesses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {t('businesses.noResults')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.businesses.map((b) => (
                    <TableRow
                      key={b._id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/app/businesses/${b._id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{b.name}</Typography>
                        {b.address?.city && (
                          <Typography variant="caption" color="text.secondary">{b.address.city}</Typography>
                        )}
                      </TableCell>
                      <TableCell>{b.industry || '—'}</TableCell>
                      <TableCell>{b.contacts.length}</TableCell>
                      <TableCell>{b.locations.length}</TableCell>
                      <TableCell>
                        <Chip
                          label={t(`businesses.statusLabel.${b.status}`)}
                          color={b.status === 'active' ? 'success' : 'default'}
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
