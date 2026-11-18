import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import NoEncryptionIcon from '@mui/icons-material/NoEncryption';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { businessesApi, ContactData, LocationData } from '../../../api/businesses';

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <Stack direction="row" spacing={1} py={0.75}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>{label}</Typography>
      <Typography variant="body2">{value ?? '—'}</Typography>
    </Stack>
  );
}

const emptyContact: ContactData = { firstName: '', lastName: '', role: '', email: '', phone: '' };
const emptyLocation: LocationData = { name: '', street: '', city: '', postalCode: '', country: 'DE', notes: '' };

export default function BusinessDetailPage() {
  const { t } = useTranslation();
  const { businessId } = useParams<{ businessId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | number>>({});
  const [contactDialog, setContactDialog] = useState(false);
  const [locationDialog, setLocationDialog] = useState(false);
  const [contactForm, setContactForm] = useState<ContactData>(emptyContact);
  const [locationForm, setLocationForm] = useState<LocationData>(emptyLocation);

  const { data: business, isLoading, error } = useQuery({
    queryKey: ['business', businessId],
    queryFn: () => businessesApi.get(businessId!),
    enabled: !!businessId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['business', businessId] });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => businessesApi.update(businessId!, data as never),
    onSuccess: () => { invalidate(); setEditing(false); },
  });

  const addContactMutation = useMutation({
    mutationFn: (data: ContactData) => businessesApi.addContact(businessId!, data),
    onSuccess: () => { invalidate(); setContactDialog(false); setContactForm(emptyContact); },
  });

  const removeContactMutation = useMutation({
    mutationFn: (contactId: string) => businessesApi.removeContact(businessId!, contactId),
    onSuccess: invalidate,
  });

  const addLocationMutation = useMutation({
    mutationFn: (data: LocationData) => businessesApi.addLocation(businessId!, data),
    onSuccess: () => { invalidate(); setLocationDialog(false); setLocationForm(emptyLocation); },
  });

  const removeLocationMutation = useMutation({
    mutationFn: (locationId: string) => businessesApi.removeLocation(businessId!, locationId),
    onSuccess: invalidate,
  });

  const grantAccessMutation = useMutation({
    mutationFn: (contactId: string) => businessesApi.grantPortalAccess(businessId!, contactId),
    onSuccess: invalidate,
  });

  const revokeAccessMutation = useMutation({
    mutationFn: (contactId: string) => businessesApi.revokePortalAccess(businessId!, contactId),
    onSuccess: invalidate,
  });

  if (isLoading) return <CircularProgress />;
  if (error || !business) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const startEdit = () => {
    setEditForm({
      name: business.name,
      industry: business.industry ?? '',
      vatNumber: business.vatNumber ?? '',
      hrbNumber: (business as never as { hrbNumber?: string }).hrbNumber ?? '',
      street: business.address?.street ?? '',
      city: business.address?.city ?? '',
      postalCode: business.address?.postalCode ?? '',
      country: business.address?.country ?? 'DE',
      defaultBillingRatePerHour: business.defaultBillingRatePerHour ?? '',
      notes: (business as never as { notes?: string }).notes ?? '',
    });
    setEditing(true);
  };

  const saveEdit = () => {
    const { street, city, postalCode, country, ...rest } = editForm;
    updateMutation.mutate({
      ...rest,
      address: { street, city, postalCode, country },
    });
  };

  return (
    <Box>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/businesses')} size="small">
            {t('common.back')}
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700}>{business.name}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
              <Chip
                label={t(`businesses.statusLabel.${business.status}`)}
                color={business.status === 'active' ? 'success' : 'default'}
                size="small"
              />
              {business.industry && (
                <Typography variant="caption" color="text.secondary">{business.industry}</Typography>
              )}
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          {editing ? (
            <>
              <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={saveEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t('common.loading') : t('common.save')}
              </Button>
              <Button variant="outlined" size="small" startIcon={<CloseIcon />} onClick={() => setEditing(false)}>
                {t('common.cancel')}
              </Button>
            </>
          ) : (
            <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={startEdit}>
              {t('common.edit')}
            </Button>
          )}
        </Stack>
      </Stack>

      {updateMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>{t('common.saveError')}</Alert>
      )}

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label={t('businesses.tab.info')} />
          <Tab label={`${t('businesses.tab.contacts')} (${business.contacts.length})`} />
          <Tab label={`${t('businesses.tab.locations')} (${business.locations.length})`} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Info Tab */}
          <TabPanel value={tab} index={0}>
            {editing ? (
              <Grid container spacing={2}>
                {[
                  ['name', t('businesses.name'), 'text', true],
                  ['industry', t('businesses.industry'), 'text', false],
                  ['vatNumber', t('businesses.vatNumber'), 'text', false],
                  ['hrbNumber', t('businesses.hrbNumber'), 'text', false],
                  ['street', t('businesses.location.street'), 'text', false],
                  ['postalCode', t('businesses.location.postalCode'), 'text', false],
                  ['city', t('businesses.location.city'), 'text', false],
                  ['country', t('businesses.location.country'), 'text', false],
                  ['defaultBillingRatePerHour', t('businesses.defaultBillingRate'), 'number', false],
                  ['notes', t('businesses.notes'), 'text', false],
                ].map(([field, label, type, required]) => (
                  <Grid item xs={12} md={field === 'notes' ? 12 : 6} key={field as string}>
                    <TextField
                      label={label as string}
                      type={type as string}
                      required={required as boolean}
                      fullWidth
                      multiline={field === 'notes'}
                      rows={field === 'notes' ? 3 : 1}
                      value={editForm[field as string] ?? ''}
                      onChange={(e) => setEditForm((p) => ({ ...p, [field as string]: e.target.value }))}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('businesses.section.general')}</Typography>
                  <Divider sx={{ mb: 1.5 }} />
                  <InfoRow label={t('businesses.vatNumber')} value={business.vatNumber} />
                  <InfoRow label={t('businesses.hrbNumber')} value={(business as never as { hrbNumber?: string }).hrbNumber} />
                  <InfoRow label={t('businesses.notes')} value={(business as never as { notes?: string }).notes} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('businesses.section.address')}</Typography>
                  <Divider sx={{ mb: 1.5 }} />
                  <InfoRow label={t('businesses.location.street')} value={business.address?.street} />
                  <InfoRow label={t('businesses.location.postalCode')} value={business.address?.postalCode} />
                  <InfoRow label={t('businesses.location.city')} value={business.address?.city} />
                  <InfoRow label={t('businesses.location.country')} value={business.address?.country} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('businesses.section.billing')}</Typography>
                  <Divider sx={{ mb: 1.5 }} />
                  <InfoRow
                    label={t('businesses.defaultBillingRate')}
                    value={business.defaultBillingRatePerHour ? `${business.defaultBillingRatePerHour} €/h` : undefined}
                  />
                </Grid>
              </Grid>
            )}
          </TabPanel>

          {/* Contacts Tab */}
          <TabPanel value={tab} index={1}>
            <Stack direction="row" justifyContent="flex-end" mb={2}>
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setContactDialog(true)}>
                {t('businesses.addContact')}
              </Button>
            </Stack>
            {business.contacts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('businesses.noContacts')}</Typography>
            ) : (
              business.contacts.map((c) => (
                <Paper key={c._id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={600}>{c.firstName} {c.lastName}</Typography>
                        {c.hasPortalAccess && (
                          <Chip label="Portalzugang" size="small" color="success" variant="outlined" icon={<VpnKeyIcon />} />
                        )}
                      </Stack>
                      {c.role && <Typography variant="caption" color="text.secondary">{c.role}</Typography>}
                      <Stack direction="row" spacing={2} mt={0.5}>
                        <Typography variant="caption">{c.email}</Typography>
                        {c.phone && <Typography variant="caption">{c.phone}</Typography>}
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      {c.email && !c.hasPortalAccess && (
                        <Tooltip title="Portalzugang aktivieren & Einladung senden">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => grantAccessMutation.mutate(c._id)}
                            disabled={grantAccessMutation.isPending}
                          >
                            <VpnKeyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {c.hasPortalAccess && (
                        <Tooltip title="Portalzugang entziehen">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => revokeAccessMutation.mutate(c._id)}
                            disabled={revokeAccessMutation.isPending}
                          >
                            <NoEncryptionIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={t('businesses.removeContact')}>
                        <IconButton size="small" onClick={() => removeContactMutation.mutate(c._id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Paper>
              ))
            )}
          </TabPanel>

          {/* Locations Tab */}
          <TabPanel value={tab} index={2}>
            <Stack direction="row" justifyContent="flex-end" mb={2}>
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setLocationDialog(true)}>
                {t('businesses.addLocation')}
              </Button>
            </Stack>
            {business.locations.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('businesses.noLocations')}</Typography>
            ) : (
              business.locations.map((l) => (
                <Paper key={l._id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{l.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[l.street, l.postalCode, l.city].filter(Boolean).join(', ')}
                      </Typography>
                    </Box>
                    <Tooltip title={t('businesses.removeLocation')}>
                      <IconButton size="small" onClick={() => removeLocationMutation.mutate(l._id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Paper>
              ))
            )}
          </TabPanel>
        </Box>
      </Paper>

      {/* Add Contact Dialog */}
      <Dialog open={contactDialog} onClose={() => setContactDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('businesses.addContact')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {(['firstName', 'lastName', 'role', 'email', 'phone'] as (keyof ContactData)[]).map((field) => (
              <TextField
                key={field}
                label={t(`businesses.contact.${field}`)}
                required={field === 'firstName' || field === 'lastName' || field === 'email'}
                fullWidth
                type={field === 'email' ? 'email' : 'text'}
                value={contactForm[field] ?? ''}
                onChange={(e) => setContactForm((p) => ({ ...p, [field]: e.target.value }))}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactDialog(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={!contactForm.firstName || !contactForm.lastName || !contactForm.email || addContactMutation.isPending}
            onClick={() => addContactMutation.mutate(contactForm)}
          >
            {addContactMutation.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Location Dialog */}
      <Dialog open={locationDialog} onClose={() => setLocationDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('businesses.addLocation')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {(['name', 'street', 'postalCode', 'city', 'country', 'notes'] as (keyof LocationData)[]).map((field) => (
              <TextField
                key={field}
                label={t(`businesses.location.${field}`)}
                required={field === 'name'}
                fullWidth
                multiline={field === 'notes'}
                rows={field === 'notes' ? 2 : 1}
                value={locationForm[field] ?? ''}
                onChange={(e) => setLocationForm((p) => ({ ...p, [field]: e.target.value }))}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLocationDialog(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={!locationForm.name || addLocationMutation.isPending}
            onClick={() => addLocationMutation.mutate(locationForm)}
          >
            {addLocationMutation.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
