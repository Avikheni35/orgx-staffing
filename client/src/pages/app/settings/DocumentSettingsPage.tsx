import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { useTranslation } from 'react-i18next';
import { workersApi } from '../../../api/workers';

const CATEGORIES = [
  { key: 'identity', color: 'primary' },
  { key: 'work_permit', color: 'warning' },
  { key: 'health_certificate', color: 'success' },
  { key: 'contract', color: 'secondary' },
  { key: 'other', color: 'default' },
] as const;

export default function DocumentSettingsPage() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['workers-all-docs'],
    queryFn: () => workersApi.list({ limit: 500 }),
  });

  const workers = data?.workers ?? [];

  const stats = CATEGORIES.map(({ key, color }) => {
    const count = workers.filter((w) => w.documents.some((d) => d.category === key)).length;
    const expiring = workers.filter((w) =>
      w.documents.some((d) => {
        if (d.category !== key || !d.expiryDate) return false;
        const diff = new Date(d.expiryDate).getTime() - Date.now();
        return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
      })
    ).length;
    return { key, color, count, expiring };
  });

  return (
    <Box maxWidth={720}>
      <Typography variant="h5" fontWeight={700} mb={1}>{t('settings.documents.title')}</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>{t('settings.documents.subtitle')}</Typography>

      <Paper>
        {isLoading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('settings.documents.category')}</TableCell>
                <TableCell>{t('settings.documents.description')}</TableCell>
                <TableCell align="center">{t('settings.documents.workersWithDoc')}</TableCell>
                <TableCell align="center">{t('settings.documents.expiringIn30')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stats.map(({ key, color, count, expiring }) => (
                <TableRow key={key}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FolderIcon fontSize="small" color="action" />
                      <Chip
                        label={t(`workers.docs.category.${key}`)}
                        color={color as 'primary' | 'warning' | 'success' | 'secondary' | 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {t(`settings.documents.categoryDesc.${key}`)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={count > 0 ? 600 : 400}>
                      {count} / {workers.length}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {expiring > 0 ? (
                      <Chip label={expiring} color="warning" size="small" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Paper sx={{ p: 3, mt: 3, bgcolor: 'action.hover' }}>
        <Typography variant="subtitle2" gutterBottom>{t('settings.documents.customCategoriesTitle')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('settings.documents.customCategoriesSoon')}</Typography>
      </Paper>
    </Box>
  );
}
