import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workerPortalApi } from '../../api/workerPortal';
import type { TimesheetStatus } from '../../api/timesheets';

type TabVal = 'pending' | 'approved' | 'disputed' | 'exported' | 'all';

const STATUS_COLOR: Record<TimesheetStatus, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  pending: 'warning',
  approved: 'success',
  disputed: 'error',
  exported: 'info',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function WorkerTimesheetsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabVal>('pending');

  const { data: timesheets, isLoading, error } = useQuery({
    queryKey: ['worker-timesheets', tab],
    queryFn: () => workerPortalApi.getTimesheets(tab),
    placeholderData: (prev) => prev,
  });

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>{t('workerPortal.myTimesheets')}</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('timesheets.pending')} value="pending" />
        <Tab label={t('timesheets.approved')} value="approved" />
        <Tab label={t('timesheets.disputed')} value="disputed" />
        <Tab label={t('timesheets.exported')} value="exported" />
        <Tab label={t('workerPortal.all')} value="all" />
      </Tabs>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{t('common.loadError')}</Alert>}

      {timesheets && timesheets.length === 0 && (
        <Alert severity="info">{t('workerPortal.noTimesheets')}</Alert>
      )}

      <Stack spacing={2}>
        {(timesheets ?? []).map((ts) => (
          <Card key={ts._id}>
            <CardActionArea onClick={() => navigate(`/worker/timesheets/${ts._id}`)}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>{ts.businessName}</Typography>
                  <Typography variant="body2" color="text.secondary">{fmtDate(ts.shiftDate)}</Typography>
                </Box>
                <Chip
                  label={t(`timesheets.statusLabel.${ts.status}`)}
                  color={STATUS_COLOR[ts.status]}
                  size="small"
                />
              </Stack>

              <Divider sx={{ my: 1.5 }} />

              <Stack direction="row" spacing={3}>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">{t('timesheets.actualHours')}</Typography>
                  <Typography variant="body2" fontWeight={600}>{ts.totalHours.toFixed(2)} h</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">{t('timesheets.payRate')}</Typography>
                  <Typography variant="body2">{ts.payRatePerHour.toFixed(2)} €/h</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">{t('timesheets.grossPay')}</Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    € {ts.grossPay.toFixed(2)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
