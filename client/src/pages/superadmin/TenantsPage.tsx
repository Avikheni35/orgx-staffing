import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
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
import AddIcon from '@mui/icons-material/Add';
import BusinessIcon from '@mui/icons-material/Business';
import { useNavigate } from 'react-router-dom';
import { superadminApi, TenantModule, TenantPlan, TenantStatus } from '../../api/superadmin';

const STATUS_COLOR: Record<TenantStatus, 'default' | 'success' | 'warning' | 'error'> = {
  trial: 'warning',
  active: 'success',
  suspended: 'error',
};

const STATUS_LABEL: Record<TenantStatus, string> = {
  trial: 'Testphase',
  active: 'Aktiv',
  suspended: 'Gesperrt',
};

const PLAN_LABEL: Record<TenantPlan, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const MODULE_COLOR: Record<TenantModule, 'primary' | 'secondary' | 'success'> = {
  m1: 'primary',
  m2: 'secondary',
  m3: 'success',
};

const MODULE_LABEL: Record<TenantModule, string> = {
  m1: 'Staffing',
  m2: 'Events',
  m3: 'ERP',
};

export default function TenantsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<TenantModule | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | 'all'>('all');

  const { data: tenants, isLoading, error } = useQuery({
    queryKey: ['sa-tenants'],
    queryFn: superadminApi.listTenants,
  });

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('de-DE');

  const filtered = tenants?.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.loginCode.includes(search.toLowerCase());
    const matchModule = moduleFilter === 'all' || (t.enabledModules ?? []).includes(moduleFilter);
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchModule && matchStatus;
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Tenants</Typography>
          <Typography variant="body2" color="text.secondary">
            Alle registrierten Mandanten · M1 Staffing · M2 Event Staffing · M3 ERP
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/superadmin/tenants/new')}>
          Neuer Tenant
        </Button>
      </Stack>

      {/* Filters */}
      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Name oder Login-Code suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Modul</InputLabel>
          <Select value={moduleFilter} label="Modul" onChange={(e) => setModuleFilter(e.target.value as TenantModule | 'all')}>
            <MenuItem value="all">Alle Module</MenuItem>
            <MenuItem value="m1">Staffing (M1)</MenuItem>
            <MenuItem value="m2">Event Staffing (M2)</MenuItem>
            <MenuItem value="m3">ERP (M3)</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value as TenantStatus | 'all')}>
            <MenuItem value="all">Alle Status</MenuItem>
            <MenuItem value="trial">Testphase</MenuItem>
            <MenuItem value="active">Aktiv</MenuItem>
            <MenuItem value="suspended">Gesperrt</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Fehler beim Laden der Tenants.</Alert>}

      {filtered && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tenant</TableCell>
                <TableCell>Modul</TableCell>
                <TableCell>Login-Code</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Nutzer</TableCell>
                <TableCell>Trial bis</TableCell>
                <TableCell>Erstellt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    <BusinessIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                    <Typography>Keine Tenants gefunden.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow
                    key={t._id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/superadmin/tenants/${t._id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.subdomain}.platform.de</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" gap={0.5} flexWrap="wrap">
                        {(t.enabledModules && t.enabledModules.length > 0 ? t.enabledModules : (['m1', 'm2', 'm3'] as TenantModule[])).map((m) => (
                          <Chip key={m} label={MODULE_LABEL[m]} color={MODULE_COLOR[m]} size="small" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">{t.loginCode}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={PLAN_LABEL[t.plan]} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_LABEL[t.status]}
                        color={STATUS_COLOR[t.status]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">{t._stats?.userCount ?? 0}</TableCell>
                    <TableCell>
                      {t.trialEndsAt ? (
                        <Typography
                          variant="body2"
                          color={new Date(t.trialEndsAt) < new Date() ? 'error.main' : 'text.primary'}
                        >
                          {fmt(t.trialEndsAt)}
                        </Typography>
                      ) : '—'}
                    </TableCell>
                    <TableCell>{fmt(t.createdAt)}</TableCell>
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
