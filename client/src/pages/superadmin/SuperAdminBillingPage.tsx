import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
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
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import apiClient from '../../api/client';

interface MrrData {
  totalMrr: number;
  totalArr: number;
  activeCount: number;
  trialCount: number;
  byPlan: Record<string, number>;
  planPrices: Record<string, number>;
}

interface TenantRow {
  _id: string;
  name: string;
  loginCode: string;
  plan: string;
  status: string;
  trialEndsAt?: string;
  planLimits?: { maxWorkers?: number; maxDisponents?: number };
  _stats: { userCount: number; workerCount: number; activeWorkers: number };
}

const PLAN_COLOR: Record<string, 'default' | 'info' | 'primary' | 'success'> = {
  starter: 'default', growth: 'info', pro: 'primary', enterprise: 'success',
};
const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  active: 'success', trial: 'warning', suspended: 'error',
};

function EditDialog({ tenant, onClose }: { tenant: TenantRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState(tenant.plan);
  const [status, setStatus] = useState(tenant.status);
  const [maxWorkers, setMaxWorkers] = useState(String(tenant.planLimits?.maxWorkers ?? 50));
  const [maxDisponents, setMaxDisponents] = useState(String(tenant.planLimits?.maxDisponents ?? 3));
  const [trialEndsAt, setTrialEndsAt] = useState(
    tenant.trialEndsAt ? tenant.trialEndsAt.split('T')[0] : ''
  );

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/superadmin/tenants/${tenant._id}`, {
        plan,
        status,
        trialEndsAt: trialEndsAt || undefined,
        planLimits: { maxWorkers: Number(maxWorkers), maxDisponents: Number(maxDisponents) },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      onClose();
    },
  });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{tenant.name} — Plan bearbeiten</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField select label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)} fullWidth>
            {['starter','growth','pro','enterprise'].map((p) => (
              <MenuItem key={p} value={p}>{p}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} fullWidth>
            {['trial','active','suspended'].map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
          {status === 'trial' && (
            <TextField
              label="Trial endet am"
              type="date"
              value={trialEndsAt}
              onChange={(e) => setTrialEndsAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          )}
          <TextField
            label="Max. Mitarbeiter"
            type="number"
            value={maxWorkers}
            onChange={(e) => setMaxWorkers(e.target.value)}
            fullWidth
          />
          <TextField
            label="Max. Disponenten"
            type="number"
            value={maxDisponents}
            onChange={(e) => setMaxDisponents(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Speichern
        </Button>
      </DialogActions>
      {mutation.isError && <Alert severity="error" sx={{ m: 2 }}>Fehler beim Speichern</Alert>}
    </Dialog>
  );
}

const fmtEur = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function SuperAdminBillingPage() {
  const [editing, setEditing] = useState<TenantRow | null>(null);

  const { data, isLoading, error } = useQuery<TenantRow[]>({
    queryKey: ['superadmin-tenants'],
    queryFn: () => apiClient.get('/superadmin/tenants').then((r) => r.data),
  });

  const { data: mrr } = useQuery<MrrData>({
    queryKey: ['superadmin-mrr'],
    queryFn: () => apiClient.get('/superadmin/mrr').then((r) => r.data),
  });

  const fmt = (iso?: string) =>
    iso ? new Intl.DateTimeFormat('de-DE').format(new Date(iso)) : '—';

  if (isLoading) return <CircularProgress />;
  if (error || !data) return <Alert severity="error">Fehler beim Laden</Alert>;

  const trialCount = data.filter((t) => t.status === 'trial').length;
  const activeCount = data.filter((t) => t.status === 'active').length;
  const suspendedCount = data.filter((t) => t.status === 'suspended').length;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>Abrechnung & Pläne</Typography>

      {/* MRR / ARR tiles */}
      {mrr && (
        <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" useFlexGap>
          <Paper sx={{ px: 3, py: 2, minWidth: 160, borderLeft: 4, borderColor: 'primary.main' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TrendingUpIcon color="primary" />
              <Typography variant="caption" color="text.secondary">MRR</Typography>
            </Stack>
            <Typography variant="h5" fontWeight={700}>{fmtEur(mrr.totalMrr)}</Typography>
            <Typography variant="caption" color="text.secondary">monatlich wiederkehrend</Typography>
          </Paper>
          <Paper sx={{ px: 3, py: 2, minWidth: 160, borderLeft: 4, borderColor: 'success.main' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TrendingUpIcon color="success" />
              <Typography variant="caption" color="text.secondary">ARR</Typography>
            </Stack>
            <Typography variant="h5" fontWeight={700}>{fmtEur(mrr.totalArr)}</Typography>
            <Typography variant="caption" color="text.secondary">jährlich hochgerechnet</Typography>
          </Paper>
          {(['starter','growth','pro','enterprise'] as const).map((plan) => (
            <Paper key={plan} sx={{ px: 2, py: 2, minWidth: 110, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700}>{mrr.byPlan[plan] ?? 0}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                {plan}
              </Typography>
              <Typography variant="caption" color="text.disabled" display="block">
                {fmtEur(mrr.planPrices[plan] ?? 0)}/Mo
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}

      <Stack direction="row" spacing={2} mb={3}>
        {[
          { label: 'Aktiv', count: activeCount, color: 'success.main' },
          { label: 'Trial', count: trialCount, color: 'warning.main' },
          { label: 'Gesperrt', count: suspendedCount, color: 'error.main' },
        ].map(({ label, count, color }) => (
          <Paper key={label} sx={{ px: 3, py: 1.5, textAlign: 'center', minWidth: 100 }}>
            <Typography variant="h4" fontWeight={700} color={color}>{count}</Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Paper>
        ))}
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Agentur</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Trial bis</TableCell>
              <TableCell align="center">Mitarbeiter</TableCell>
              <TableCell align="center">Benutzer</TableCell>
              <TableCell align="center">Limits</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((t) => (
              <TableRow key={t._id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{t.loginCode}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={t.plan} size="small" color={PLAN_COLOR[t.plan] ?? 'default'} />
                </TableCell>
                <TableCell>
                  <Chip label={t.status} size="small" color={STATUS_COLOR[t.status] ?? 'default'} />
                </TableCell>
                <TableCell sx={{ fontSize: 13 }}>{fmt(t.trialEndsAt)}</TableCell>
                <TableCell align="center">
                  <Typography variant="body2">
                    {t._stats.activeWorkers} / {t._stats.workerCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    aktiv / gesamt
                  </Typography>
                </TableCell>
                <TableCell align="center">{t._stats.userCount}</TableCell>
                <TableCell align="center">
                  <Typography variant="caption" color="text.secondary">
                    {t.planLimits?.maxWorkers ?? 50}W / {t.planLimits?.maxDisponents ?? 3}D
                  </Typography>
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => setEditing(t)}
                  >
                    Bearbeiten
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {editing && <EditDialog tenant={editing} onClose={() => setEditing(null)} />}
    </Box>
  );
}
