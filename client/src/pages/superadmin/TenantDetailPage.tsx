import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { useNavigate, useParams } from 'react-router-dom';
import { superadminApi, TenantStatus, TenantPlan, TenantModule, UpdateTenantData } from '../../api/superadmin';
import { useAuthStore } from '../../stores/authStore';
import type { AuthUser, UserRole } from '../../types';

const MODULE_COLOR: Record<TenantModule, 'primary' | 'secondary' | 'success'> = {
  m1: 'primary', m2: 'secondary', m3: 'success',
};
const MODULE_LABEL: Record<TenantModule, string> = {
  m1: 'Staffing (M1)', m2: 'Event Staffing (M2)', m3: 'ERP (M3)',
};
const MODULE_DESC: Record<TenantModule, string> = {
  m1: 'Zeitarbeit, AÜG, Schichtverwaltung, Mitarbeiterpool',
  m2: 'Event-Management, Venues, Eventpersonal',
  m3: 'Doppelte Buchführung, Ausgangs-/Eingangsrechnungen, DATEV',
};

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

const ROLE_LABEL: Record<string, string> = {
  agency_admin: 'Admin',
  disponent: 'Disponent',
  worker: 'Mitarbeiter',
  business_contact: 'Kundenkontakt',
};

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <Stack direction="row" spacing={1} py={0.75}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 200 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value ?? '—'}</Typography>
    </Stack>
  );
}

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startImpersonation } = useAuthStore();
  const [tab, setTab] = useState(0);
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState<UpdateTenantData>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['sa-tenant', tenantId],
    queryFn: () => superadminApi.getTenant(tenantId!),
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (!data) return;
    const t = data.tenant;
    setSettings({
      name: t.name,
      status: t.status,
      plan: t.plan,
      trialEndsAt: t.trialEndsAt ? t.trialEndsAt.slice(0, 10) : '',
      companyDetails: { ...t.companyDetails },
      invoiceSettings: { ...t.invoiceSettings },
      complianceSettings: { ...t.complianceSettings },
      planLimits: { ...t.planLimits },
      enabledModules: t.enabledModules ?? [],
    });
  }, [data]);

  const impersonateMutation = useMutation({
    mutationFn: (userId: string) => superadminApi.impersonate(tenantId!, userId),
    onSuccess: (data) => {
      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        role: data.user.role as UserRole,
        tenantId: data.user.tenantId,
        language: (data.user.language as 'de' | 'en') ?? 'de',
      };
      startImpersonation(authUser, data.accessToken, data.tenantName);
      navigate('/app/dashboard');
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => superadminApi.updateTenant(tenantId!, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sa-tenant', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['sa-tenants'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const setField = <K extends keyof UpdateTenantData>(key: K, value: UpdateTenantData[K]) =>
    setSettings((p) => ({ ...p, [key]: value }));

  const setNested = <K extends 'companyDetails' | 'invoiceSettings' | 'complianceSettings' | 'planLimits'>(
    section: K,
    field: string,
    value: string | number
  ) =>
    setSettings((p) => ({
      ...p,
      [section]: { ...(p[section] as Record<string, unknown>), [field]: value },
    }));

  if (isLoading) return <CircularProgress />;
  if (error || !data) return <Alert severity="error">Tenant nicht gefunden.</Alert>;

  const { tenant, users, workerByStatus } = data;
  const totalWorkers = Object.values(workerByStatus).reduce((a: number, b) => a + (b as number), 0);

  const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString('de-DE') : '—';
  const fmtDt = (iso?: string) => iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/superadmin/tenants')} size="small">
          Zurück
        </Button>
        <Box flex={1}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <Typography variant="h5" fontWeight={700}>{tenant.name}</Typography>
            <Chip
              label={STATUS_LABEL[tenant.status as TenantStatus]}
              color={STATUS_COLOR[tenant.status as TenantStatus]}
              size="small"
            />
            <Chip label={tenant.plan} size="small" variant="outlined" />
            {(tenant.enabledModules && tenant.enabledModules.length > 0
              ? tenant.enabledModules
              : (['m1', 'm2', 'm3'] as TenantModule[])
            ).map((m) => (
              <Chip key={m} label={MODULE_LABEL[m]} color={MODULE_COLOR[m]} size="small" variant="filled" />
            ))}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {tenant.subdomain}.platform.de · Code: <strong>{tenant.loginCode}</strong>
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={saved ? <CheckIcon /> : <SaveIcon />}
          color={saved ? 'success' : 'primary'}
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? 'Speichern...' : saved ? 'Gespeichert' : 'Speichern'}
        </Button>
      </Stack>

      {saveMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(saveMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Fehler beim Speichern'}
        </Alert>
      )}
      {impersonateMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(impersonateMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Impersonation fehlgeschlagen'}
        </Alert>
      )}

      {/* Quick stats */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Mitarbeiter gesamt', value: totalWorkers },
          { label: 'Aktive Mitarbeiter', value: workerByStatus['active'] ?? 0 },
          { label: 'Nutzerkonten', value: users.length },
          { label: 'Erstellt am', value: fmt(tenant.createdAt) },
        ].map((s) => (
          <Grid key={s.label} item xs={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label="Einstellungen" />
          <Tab label="Nutzer" />
          <Tab label="Compliance" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Settings Tab */}
          <TabPanel value={tab} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Allgemein</Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <TextField
                    label="Name"
                    fullWidth
                    value={settings.name ?? ''}
                    onChange={(e) => setField('name', e.target.value)}
                  />
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={settings.status ?? tenant.status}
                      label="Status"
                      onChange={(e) => setField('status', e.target.value as TenantStatus)}
                    >
                      <MenuItem value="trial">Testphase</MenuItem>
                      <MenuItem value="active">Aktiv</MenuItem>
                      <MenuItem value="suspended">Gesperrt</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Plan</InputLabel>
                    <Select
                      value={settings.plan ?? tenant.plan}
                      label="Plan"
                      onChange={(e) => setField('plan', e.target.value as TenantPlan)}
                    >
                      <MenuItem value="starter">Starter</MenuItem>
                      <MenuItem value="growth">Growth</MenuItem>
                      <MenuItem value="pro">Pro</MenuItem>
                      <MenuItem value="enterprise">Enterprise</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="Trial endet am"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={settings.trialEndsAt ?? ''}
                    onChange={(e) => setField('trialEndsAt', e.target.value)}
                  />
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Firmendaten</Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <TextField
                    label="Adresse"
                    fullWidth
                    value={settings.companyDetails?.address ?? ''}
                    onChange={(e) => setNested('companyDetails', 'address', e.target.value)}
                  />
                  <TextField
                    label="HRB-Nummer"
                    fullWidth
                    value={settings.companyDetails?.hrbNumber ?? ''}
                    onChange={(e) => setNested('companyDetails', 'hrbNumber', e.target.value)}
                  />
                  <TextField
                    label="AÜG-Erlaubnisnummer"
                    fullWidth
                    value={settings.companyDetails?.auegLicenseNumber ?? ''}
                    onChange={(e) => setNested('companyDetails', 'auegLicenseNumber', e.target.value)}
                  />
                  <TextField
                    label="Umsatzsteuer-ID"
                    fullWidth
                    value={settings.companyDetails?.vatId ?? ''}
                    onChange={(e) => setNested('companyDetails', 'vatId', e.target.value)}
                  />
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Rechnungseinstellungen</Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <TextField
                    label="Rechnungspräfix"
                    fullWidth
                    value={settings.invoiceSettings?.prefix ?? ''}
                    onChange={(e) => setNested('invoiceSettings', 'prefix', e.target.value)}
                  />
                  <TextField
                    label="MwSt. (%)"
                    type="number"
                    fullWidth
                    value={settings.invoiceSettings?.vatRate ?? ''}
                    onChange={(e) => setNested('invoiceSettings', 'vatRate', parseFloat(e.target.value))}
                  />
                  <TextField
                    label="Zahlungsziel (Tage)"
                    type="number"
                    fullWidth
                    value={settings.invoiceSettings?.paymentTermsDays ?? ''}
                    onChange={(e) => setNested('invoiceSettings', 'paymentTermsDays', parseInt(e.target.value))}
                  />
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Plan-Limits</Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <TextField
                    label="Max. Mitarbeiter"
                    type="number"
                    fullWidth
                    value={settings.planLimits?.maxWorkers ?? ''}
                    onChange={(e) => setNested('planLimits', 'maxWorkers', parseInt(e.target.value))}
                  />
                  <TextField
                    label="Max. Disponenten"
                    type="number"
                    fullWidth
                    value={settings.planLimits?.maxDisponents ?? ''}
                    onChange={(e) => setNested('planLimits', 'maxDisponents', parseInt(e.target.value))}
                  />
                </Stack>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Aktivierte Module</Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1}>
                  {(['m1', 'm2', 'm3'] as TenantModule[]).map((m) => {
                    const enabled = (settings.enabledModules ?? []).includes(m);
                    return (
                      <Paper key={m} variant="outlined" sx={{ px: 2, py: 1.5 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={enabled}
                              color={MODULE_COLOR[m]}
                              onChange={(e) => {
                                const current = settings.enabledModules ?? [];
                                const next = e.target.checked
                                  ? [...current, m]
                                  : current.filter((x) => x !== m);
                                setField('enabledModules', next);
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{MODULE_LABEL[m]}</Typography>
                              <Typography variant="caption" color="text.secondary">{MODULE_DESC[m]}</Typography>
                            </Box>
                          }
                        />
                      </Paper>
                    );
                  })}
                </Stack>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Users Tab */}
          <TabPanel value={tab} index={1}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>E-Mail</TableCell>
                  <TableCell>Rolle</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Letzter Login</TableCell>
                  <TableCell>Erstellt</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Keine Nutzer gefunden.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u: import('../../api/superadmin').TenantUser) => (
                    <TableRow key={u._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {u.firstName} {u.lastName}
                        </Typography>
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Chip label={ROLE_LABEL[u.role] ?? u.role} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={u.status === 'active' ? 'Aktiv' : u.status === 'suspended' ? 'Gesperrt' : 'Inaktiv'}
                          color={u.status === 'active' ? 'success' : u.status === 'suspended' ? 'error' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{fmtDt(u.lastLoginAt)}</TableCell>
                      <TableCell>{fmt(u.createdAt)}</TableCell>
                      <TableCell align="right">
                        {(u.role === 'agency_admin' || u.role === 'disponent') && u.status === 'active' && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            startIcon={<SupervisorAccountIcon />}
                            disabled={impersonateMutation.isPending}
                            onClick={() => impersonateMutation.mutate(u._id)}
                          >
                            Impersonieren
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabPanel>

          {/* Compliance Tab */}
          <TabPanel value={tab} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>AÜG-Einstellungen</Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <TextField
                    label="Warngrenze (Monate)"
                    type="number"
                    fullWidth
                    value={settings.complianceSettings?.auegWarnMonths ?? ''}
                    onChange={(e) => setNested('complianceSettings', 'auegWarnMonths', parseInt(e.target.value))}
                    helperText="Standard: 9 Monate (Gleichbehandlungspflicht)"
                  />
                  <TextField
                    label="Blockierungsgrenze (Monate)"
                    type="number"
                    fullWidth
                    value={settings.complianceSettings?.auegBlockMonths ?? ''}
                    onChange={(e) => setNested('complianceSettings', 'auegBlockMonths', parseInt(e.target.value))}
                    helperText="Standard: 18 Monate (gesetzliches Maximum)"
                  />
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Arbeitszeit & Lohn</Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <TextField
                    label="Mindestpause zwischen Schichten (Stunden)"
                    type="number"
                    fullWidth
                    value={settings.complianceSettings?.minRestHoursBetweenShifts ?? ''}
                    onChange={(e) => setNested('complianceSettings', 'minRestHoursBetweenShifts', parseFloat(e.target.value))}
                    helperText="Standard: 11 Stunden (ArbZG §5)"
                  />
                  <TextField
                    label="Mindestlohn-Override (€/h)"
                    type="number"
                    fullWidth
                    inputProps={{ step: 0.01 }}
                    value={settings.complianceSettings?.mindestlohnOverride ?? ''}
                    onChange={(e) => setNested('complianceSettings', 'mindestlohnOverride', parseFloat(e.target.value))}
                    helperText="Leer = gesetzlicher Mindestlohn (€12,82)"
                  />
                </Stack>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Aktuelle Werte (gespeichert)</Typography>
                <Divider sx={{ mb: 1.5 }} />
                <InfoRow label="AÜG-Warnschwelle" value={`${tenant.complianceSettings.auegWarnMonths} Monate`} />
                <InfoRow label="AÜG-Sperrschwelle" value={`${tenant.complianceSettings.auegBlockMonths} Monate`} />
                <InfoRow label="Mindestpause" value={`${tenant.complianceSettings.minRestHoursBetweenShifts} Stunden`} />
                <InfoRow label="Mindestlohn-Override" value={tenant.complianceSettings.mindestlohnOverride ? `€${tenant.complianceSettings.mindestlohnOverride}/h` : 'Nicht gesetzt'} />
              </Grid>
            </Grid>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}
