import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PeopleIcon from '@mui/icons-material/People';
import EventIcon from '@mui/icons-material/Event';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { useNavigate } from 'react-router-dom';
import { superadminApi, CreateTenantData, TenantPlan, TenantModule } from '../../api/superadmin';

const PLANS: { value: TenantPlan; label: string; description: string }[] = [
  { value: 'starter', label: 'Starter', description: 'Bis zu 25 Nutzer' },
  { value: 'growth', label: 'Growth', description: 'Bis zu 100 Nutzer' },
  { value: 'pro', label: 'Pro', description: 'Bis zu 500 Nutzer' },
  { value: 'enterprise', label: 'Enterprise', description: 'Unbegrenzt' },
];

const MODULE_CONFIG: Record<TenantModule, { label: string; description: string; adminLabel: string; icon: React.ReactNode }> = {
  m1: {
    label: 'Staffing (M1)',
    description: 'Zeitarbeit · AÜG · Schichtverwaltung',
    adminLabel: 'Agentur-Admin',
    icon: <PeopleIcon />,
  },
  m2: {
    label: 'Event Staffing (M2)',
    description: 'Events · Venues · Eventpersonal',
    adminLabel: 'Koordinator-Admin',
    icon: <EventIcon />,
  },
  m3: {
    label: 'ERP (M3)',
    description: 'Buchhaltung · Rechnungen · DATEV',
    adminLabel: 'ERP-Admin',
    icon: <AccountBalanceIcon />,
  },
};

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

const EMPTY: CreateTenantData = {
  name: '',
  subdomain: '',
  loginCode: '',
  plan: 'starter',
  module: 'm1',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPassword: '',
};

export default function CreateTenantPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateTenantData>(EMPTY);
  const [autoSlug, setAutoSlug] = useState(true);
  const [autoCode, setAutoCode] = useState(true);
  const [apiError, setApiError] = useState('');

  const set = <K extends keyof CreateTenantData>(field: K, value: CreateTenantData[K]) =>
    setForm((p) => ({ ...p, [field]: value }));

  const handleNameChange = (name: string) => {
    set('name', name);
    if (autoSlug) set('subdomain', slugify(name));
    if (autoCode) {
      const code = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
      set('loginCode', code);
    }
  };

  const mutation = useMutation({
    mutationFn: superadminApi.createTenant,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sa-tenants'] });
      navigate(`/superadmin/tenants/${result.tenant._id}`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Fehler beim Erstellen des Tenants.';
      setApiError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    mutation.mutate(form);
  };

  const modCfg = MODULE_CONFIG[form.module];

  return (
    <Box maxWidth={720} mx="auto">
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/superadmin/tenants')}
          variant="text"
        >
          Zurück
        </Button>
        <Box>
          <Typography variant="h5" fontWeight={700}>Neuen Tenant anlegen</Typography>
          <Typography variant="body2" color="text.secondary">
            Neuen Mandanten auf der Plattform onboarden
          </Typography>
        </Box>
      </Stack>

      <Box component="form" onSubmit={handleSubmit}>
        {apiError && <Alert severity="error" sx={{ mb: 3 }}>{apiError}</Alert>}

        {/* Module selector */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} mb={1}>Modul</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Welches Produkt soll dieser Tenant nutzen?
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={form.module}
              onChange={(_, v) => { if (v) set('module', v as TenantModule); }}
              fullWidth
            >
              {(Object.entries(MODULE_CONFIG) as [TenantModule, typeof MODULE_CONFIG['m1']][]).map(([key, cfg]) => (
                <ToggleButton key={key} value={key} sx={{ py: 1.5, flexDirection: 'column', gap: 0.5 }}>
                  {cfg.icon}
                  <Typography variant="caption" fontWeight={600}>{cfg.label}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>
                    {cfg.description}
                  </Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </CardContent>
        </Card>

        {/* Tenant details */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} mb={2}>Tenant-Daten</Typography>
            <Divider sx={{ mb: 3 }} />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Name"
                  required
                  fullWidth
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={form.module === 'm3' ? 'z.B. Mustermann GmbH' : 'z.B. Zeitarbeit Nord GmbH'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Subdomain"
                  required
                  fullWidth
                  value={form.subdomain}
                  onChange={(e) => {
                    setAutoSlug(false);
                    set('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  }}
                  helperText="Nur Kleinbuchstaben, Zahlen und Bindestriche"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">.platform.de</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Login-Code"
                  required
                  fullWidth
                  value={form.loginCode}
                  onChange={(e) => {
                    setAutoCode(false);
                    set('loginCode', e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                  }}
                  helperText="Kürzel für die Login-Seite (z.B. demo)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Plan</InputLabel>
                  <Select
                    label="Plan"
                    value={form.plan ?? 'starter'}
                    onChange={(e) => set('plan', e.target.value as TenantPlan)}
                  >
                    {PLANS.map((p) => (
                      <MenuItem key={p.value} value={p.value}>
                        <Stack>
                          <Typography variant="body2" fontWeight={600}>{p.label}</Typography>
                          <Typography variant="caption" color="text.secondary">{p.description}</Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Admin account */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} mb={0.5}>{modCfg.adminLabel}</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Erstes Admin-Konto für diesen Tenant
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Vorname"
                  required
                  fullWidth
                  value={form.adminFirstName}
                  onChange={(e) => set('adminFirstName', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Nachname"
                  required
                  fullWidth
                  value={form.adminLastName}
                  onChange={(e) => set('adminLastName', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="E-Mail-Adresse"
                  type="email"
                  required
                  fullWidth
                  value={form.adminEmail}
                  onChange={(e) => set('adminEmail', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Passwort"
                  type="password"
                  required
                  fullWidth
                  value={form.adminPassword}
                  onChange={(e) => set('adminPassword', e.target.value)}
                  helperText="Mindestens 8 Zeichen"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Stack direction="row" justifyContent="flex-end" spacing={2}>
          <Button
            variant="outlined"
            onClick={() => navigate('/superadmin/tenants')}
            disabled={mutation.isPending}
          >
            Abbrechen
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Wird erstellt...' : 'Tenant erstellen'}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
