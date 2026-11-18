import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { complianceApi, AuegSeverity } from '../../../api/compliance';

const AUEG_WARN = 9;
const AUEG_BLOCK = 18;

const SEVERITY_COLOR: Record<AuegSeverity, 'warning' | 'error'> = {
  warning: 'warning',
  blocked: 'error',
};

function MonthBar({ months }: { months: number }) {
  const pct = Math.min((months / AUEG_BLOCK) * 100, 100);
  const color = months >= AUEG_BLOCK ? '#d32f2f' : months >= AUEG_WARN ? '#ed6c02' : '#2e7d32';
  return (
    <Box sx={{ position: 'relative', height: 8, borderRadius: 4, bgcolor: 'grey.200', width: '100%' }}>
      <Box
        sx={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${pct}%`, borderRadius: 4, bgcolor: color,
          transition: 'width 0.4s ease',
        }}
      />
      {/* 9-month marker */}
      <Box
        sx={{
          position: 'absolute', left: `${(AUEG_WARN / AUEG_BLOCK) * 100}%`,
          top: -2, width: 2, height: 12, bgcolor: 'warning.main', borderRadius: 1,
        }}
      />
    </Box>
  );
}

export default function ComplianceAuegPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: workers, isLoading, error } = useQuery({
    queryKey: ['compliance-aueg'],
    queryFn: complianceApi.auegList,
    refetchInterval: 60_000,
  });

  const blocked = workers?.filter((w) => w.auegEntries.some((e) => e.severity === 'blocked')) ?? [];
  const warned = workers?.filter((w) => w.auegEntries.every((e) => e.severity === 'warning')) ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
        <WarningAmberIcon color="warning" />
        <Typography variant="h5" fontWeight={700}>{t('compliance.auegTitle')}</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {t('compliance.auegSubtitle')}
      </Typography>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{t('common.loadError')}</Alert>}

      {workers?.length === 0 && (
        <Alert severity="success" icon={<CheckCircleIcon />}>
          {t('compliance.auegNoIssues')}
        </Alert>
      )}

      {blocked.length > 0 && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
            <BlockIcon color="error" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700} color="error.main">
              {t('compliance.auegBlocked')} ({blocked.length})
            </Typography>
          </Stack>
          <Stack spacing={2} mb={3}>
            {blocked.map((w) => (
              <WorkerAuegCard
                key={w._id}
                worker={w}
                onClick={() => navigate(`/app/workers/${w._id}`)}
              />
            ))}
          </Stack>
        </>
      )}

      {warned.length > 0 && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
            <WarningAmberIcon color="warning" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700} color="warning.main">
              {t('compliance.auegWarning')} ({warned.length})
            </Typography>
          </Stack>
          <Stack spacing={2}>
            {warned.map((w) => (
              <WorkerAuegCard
                key={w._id}
                worker={w}
                onClick={() => navigate(`/app/workers/${w._id}`)}
              />
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}

function WorkerAuegCard({
  worker,
  onClick,
}: {
  worker: ReturnType<typeof complianceApi.auegList> extends Promise<infer T> ? (T extends (infer U)[] ? U : never) : never;
  onClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }} onClick={onClick}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {worker.firstName} {worker.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary">{worker.email}</Typography>
          </Box>
          <Chip
            label={worker.auegEntries.some((e) => e.severity === 'blocked')
              ? t('compliance.blocked')
              : t('compliance.equalPayRequired')}
            color={worker.auegEntries.some((e) => e.severity === 'blocked') ? 'error' : 'warning'}
            size="small"
            icon={worker.auegEntries.some((e) => e.severity === 'blocked')
              ? <BlockIcon />
              : <WarningAmberIcon />}
          />
        </Stack>

        <Stack spacing={1.5}>
          {worker.auegEntries.map((entry) => (
            <Box key={entry.businessId.toString()}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="body2" fontWeight={600}>{entry.businessName}</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={`${entry.monthsWorked} / ${AUEG_BLOCK} ${t('compliance.months')}`}
                    color={SEVERITY_COLOR[entry.severity]}
                    size="small"
                    variant="outlined"
                  />
                  {entry.lastAssignmentDate && (
                    <Typography variant="caption" color="text.secondary">
                      {t('compliance.lastAssignment')}: {new Date(entry.lastAssignmentDate).toLocaleDateString('de-DE')}
                    </Typography>
                  )}
                </Stack>
              </Stack>
              <MonthBar months={entry.monthsWorked} />
              <Divider sx={{ mt: 1.5 }} />
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
