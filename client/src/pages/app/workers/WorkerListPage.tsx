import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Alert,
  InputAdornment,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  SelectChangeEvent,
  Avatar,
  FormControl,
  InputLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workersApi, Worker } from '../../../api/workers';

const STATUS_COLORS: Record<Worker['status'], 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending_review: 'info',
  active: 'success',
  inactive: 'default',
  suspended: 'warning',
  blacklisted: 'error',
  anonymized: 'default',
};

const STATUS_OPTIONS: Worker['status'][] = [
  'pending_review',
  'active',
  'inactive',
  'suspended',
  'blacklisted',
];

export default function WorkerListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState<Worker['status'] | ''>(
    (searchParams.get('status') as Worker['status']) ?? ''
  );
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['workers', { search, status, page }],
    queryFn: () =>
      workersApi.list({
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        page,
        limit: 20,
      }),
    placeholderData: (prev) => prev,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e: SelectChangeEvent<string>) => {
    const val = e.target.value as Worker['status'] | '';
    setStatus(val);
    setPage(1);
    setSearchParams(val ? { status: val } : {});
  };

  function initials(w: Worker) {
    return `${w.firstName[0] ?? ''}${w.lastName[0] ?? ''}`.toUpperCase();
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>
          {t('nav.workers')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => navigate('/app/workers/new')}
        >
          {t('workers.addWorker')}
        </Button>
      </Stack>

      {/* Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
        <TextField
          size="small"
          placeholder={t('workers.searchPlaceholder')}
          value={search}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 260 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t('workers.status')}</InputLabel>
          <Select
            value={status}
            label={t('workers.status')}
            onChange={handleStatusChange}
          >
            <MenuItem value="">{t('common.all')}</MenuItem>
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`workers.statusLabel.${s}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('common.loadError')}
        </Alert>
      )}

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('workers.name')}</TableCell>
                <TableCell>{t('workers.email')}</TableCell>
                <TableCell>{t('workers.phone')}</TableCell>
                <TableCell>{t('workers.skills')}</TableCell>
                <TableCell>{t('workers.status')}</TableCell>
                <TableCell>{t('workers.added')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : (data?.workers ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('workers.noResults')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (data?.workers ?? []).map((worker) => (
                  <TableRow
                    key={worker._id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/app/workers/${worker._id}`)}
                  >
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'primary.main' }}>
                          {initials(worker)}
                        </Avatar>
                        <Typography variant="body2" fontWeight={500}>
                          {worker.lastName}, {worker.firstName}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{worker.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{worker.phone ?? '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {(worker.skills ?? []).slice(0, 2).map((skill) => (
                          <Chip key={skill} label={skill} size="small" variant="outlined" />
                        ))}
                        {(worker.skills ?? []).length > 2 && (
                          <Chip
                            label={`+${worker.skills.length - 2}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`workers.statusLabel.${worker.status}`)}
                        color={STATUS_COLORS[worker.status]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(worker.createdAt).toLocaleDateString('de-DE')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {(data?.pages ?? 0) > 1 && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              count={data?.pages}
              page={page}
              onChange={(_, p) => setPage(p)}
              color="primary"
            />
          </Box>
        )}
      </Paper>

      {data && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {t('workers.totalCount', { count: data.total })}
        </Typography>
      )}
    </Box>
  );
}
