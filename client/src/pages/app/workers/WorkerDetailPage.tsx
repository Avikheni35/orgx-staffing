import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EmailIcon from '@mui/icons-material/Email';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import VerifiedIcon from '@mui/icons-material/Verified';
import DownloadIcon from '@mui/icons-material/Download';
import NoEncryptionIcon from '@mui/icons-material/NoEncryption';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workersApi, Worker } from '../../../api/workers';
import { useAuthStore } from '../../../stores/authStore';

const DAYS_DE: Array<{ key: string; short: string }> = [
  { key: 'monday', short: 'Mo' },
  { key: 'tuesday', short: 'Di' },
  { key: 'wednesday', short: 'Mi' },
  { key: 'thursday', short: 'Do' },
  { key: 'friday', short: 'Fr' },
  { key: 'saturday', short: 'Sa' },
  { key: 'sunday', short: 'So' },
];

const STATUS_COLORS: Record<Worker['status'], 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending_review: 'info',
  active: 'success',
  inactive: 'default',
  suspended: 'warning',
  blacklisted: 'error',
  anonymized: 'default',
};

const STATUS_OPTIONS: Worker['status'][] = ['pending_review', 'active', 'inactive', 'suspended', 'blacklisted'];

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <Stack direction="row" spacing={1} py={0.75}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Stack>
  );
}

export default function WorkerDetailPage() {
  const { t } = useTranslation();
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s: { user: { role?: string } | null }) => s.user);
  const isAdmin = user?.role === 'agency_admin' || user?.role === 'super_admin';
  const [tab, setTab] = useState(0);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<Worker['status']>('active');
  const [statusNote, setStatusNote] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docCategory, setDocCategory] = useState<string>('identity');
  const [docLabel, setDocLabel] = useState('');
  const [docExpiry, setDocExpiry] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [remarkDialogDocId, setRemarkDialogDocId] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [anonymizeDialogOpen, setAnonymizeDialogOpen] = useState(false);
  const [anonymizeReason, setAnonymizeReason] = useState('');
  const [anonymizeConfirmText, setAnonymizeConfirmText] = useState('');
  const [sensitiveDialogOpen, setSensitiveDialogOpen] = useState(false);
  const [sensitiveIban, setSensitiveIban] = useState('');
  const [sensitiveSteuernummer, setSensitiveSteuernummer] = useState('');
  const [sensitiveSvNummer, setSensitiveSvNummer] = useState('');
  const [sensitiveSaved, setSensitiveSaved] = useState(false);
  const [payslipMonth, setPayslipMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payslipLoading, setPayslipLoading] = useState(false);

  const { data: worker, isLoading, error } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => workersApi.get(workerId!),
    enabled: !!workerId,
  });

  const statusMutation = useMutation({
    mutationFn: () => workersApi.setStatus(workerId!, newStatus, statusNote || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker', workerId] });
      queryClient.invalidateQueries({ queryKey: ['worker-stats'] });
      setStatusDialogOpen(false);
      setStatusNote('');
    },
  });

  const addDocMutation = useMutation({
    mutationFn: () =>
      workersApi.addDocument(workerId!, {
        category: docCategory,
        label: docLabel,
        expiryDate: docExpiry || undefined,
        file: docFile,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker', workerId] });
      setDocDialogOpen(false);
      setDocLabel('');
      setDocExpiry('');
      setDocCategory('identity');
      setDocFile(null);
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => workersApi.deleteDocument(workerId!, docId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worker', workerId] }),
  });

  const verifyDocMutation = useMutation({
    mutationFn: (docId: string) => workersApi.verifyDocument(workerId!, docId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worker', workerId] }),
  });

  const remarkDocMutation = useMutation({
    mutationFn: (docId: string) => workersApi.remarkDocument(workerId!, docId, remarkText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker', workerId] });
      setRemarkDialogDocId(null);
      setRemarkText('');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () => workersApi.sendInvite(workerId!),
    onSuccess: () => setInviteSent(true),
  });

  const exportMutation = useMutation({
    mutationFn: () => workersApi.exportData(workerId!),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dsgvo-export-${workerId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const anonymizeMutation = useMutation({
    mutationFn: () => workersApi.anonymize(workerId!, anonymizeReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker', workerId] });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      setAnonymizeDialogOpen(false);
      setAnonymizeReason('');
      setAnonymizeConfirmText('');
    },
  });

  const sensitiveMutation = useMutation({
    mutationFn: () => workersApi.setSensitiveData(workerId!, {
      iban: sensitiveIban || null,
      steuernummer: sensitiveSteuernummer || null,
      sozialversicherungsnummer: sensitiveSvNummer || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker', workerId] });
      setSensitiveDialogOpen(false);
      setSensitiveSaved(true);
      setSensitiveIban('');
      setSensitiveSteuernummer('');
      setSensitiveSvNummer('');
      setTimeout(() => setSensitiveSaved(false), 4000);
    },
  });

  const handleDownloadPayslip = async () => {
    if (!workerId) return;
    setPayslipLoading(true);
    try {
      const blob = await workersApi.downloadPayslip(workerId, payslipMonth);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lohnnachweis-${payslipMonth}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPayslipLoading(false);
    }
  };

  if (isLoading) return <CircularProgress />;
  if (error || !worker)
    return <Alert severity="error">{t('common.loadError')}</Alert>;

  const maxAueg = worker.auegTracking.reduce((m, e) => Math.max(m, e.monthsWorked), 0);
  const auegPct = Math.min((maxAueg / 18) * 100, 100);
  const auegColor = maxAueg >= 18 ? 'error' : maxAueg >= 9 ? 'warning' : 'primary';

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/workers')} size="small">
            {t('common.back')}
          </Button>
          <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontWeight: 700 }}>
            {worker.firstName?.[0]}{worker.lastName?.[0]}
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {worker.firstName} {worker.lastName}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={t(`workers.statusLabel.${worker.status}`)}
                color={STATUS_COLORS[worker.status]}
                size="small"
              />
              {maxAueg >= 9 && (
                <Chip
                  icon={<WarningAmberIcon />}
                  label={t('workers.auegWarning', { months: maxAueg })}
                  color={maxAueg >= 18 ? 'error' : 'warning'}
                  size="small"
                />
              )}
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          {worker.status !== 'suspended' && worker.status !== 'blacklisted' && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EmailIcon />}
              disabled={inviteMutation.isPending || inviteSent}
              onClick={() => inviteMutation.mutate()}
            >
              {inviteSent
                ? t('workers.inviteSent')
                : inviteMutation.isPending
                ? t('common.loading')
                : worker.userId
                ? t('workers.resendInvite')
                : t('workers.sendInvite')}
            </Button>
          )}
          {worker.userId && (
            <Chip label={t('workers.registered')} color="success" size="small" variant="outlined" />
          )}
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setNewStatus(worker.status);
              setStatusDialogOpen(true);
            }}
          >
            {t('workers.changeStatus')}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/app/workers/${workerId}/edit`)}
          >
            {t('common.edit')}
          </Button>
          {isAdmin && worker.status !== 'anonymized' && (
            <Button
              variant="outlined"
              size="small"
              color="info"
              startIcon={<DownloadIcon />}
              disabled={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            >
              {exportMutation.isPending ? t('common.loading') : 'DSGVO Export'}
            </Button>
          )}
          {isAdmin && worker.status !== 'anonymized' && (
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<NoEncryptionIcon />}
              onClick={() => setAnonymizeDialogOpen(true)}
            >
              Anonymisieren
            </Button>
          )}
        </Stack>
      </Stack>

      {inviteSent && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t('workers.inviteSentDesc', { email: worker.email })}
        </Alert>
      )}
      {inviteMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(inviteMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')}
        </Alert>
      )}

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label={t('workers.tab.profile')} />
          <Tab label={t('workers.tab.skills')} />
          <Tab label={t('workers.tab.compliance')} />
          <Tab label={t('workers.tab.documents')} />
          <Tab label={t('workers.tab.availability')} />
          {isAdmin && <Tab label={t('workers.tab.sensitiveData')} icon={<LockOpenIcon fontSize="small" />} iconPosition="start" />}
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Profile Tab */}
          <TabPanel value={tab} index={0}>
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('workers.section.personal')}
                </Typography>
                <Divider sx={{ mb: 1.5 }} />
                <InfoRow label={t('workers.email')} value={worker.email} />
                <InfoRow label={t('workers.phone')} value={worker.phone} />
                <InfoRow
                  label={t('workers.dateOfBirth')}
                  value={worker.dateOfBirth ? new Date(worker.dateOfBirth).toLocaleDateString('de-DE') : undefined}
                />
                <InfoRow label={t('workers.nationality')} value={worker.nationality} />
                <InfoRow
                  label={t('workers.gender')}
                  value={worker.gender ? t(`workers.gender${worker.gender.charAt(0).toUpperCase() + worker.gender.slice(1)}`) : undefined}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('workers.section.address')}
                </Typography>
                <Divider sx={{ mb: 1.5 }} />
                <InfoRow label={t('workers.street')} value={worker.address?.street} />
                <InfoRow
                  label={t('workers.cityPostal')}
                  value={
                    [worker.address?.postalCode, worker.address?.city].filter(Boolean).join(' ') || undefined
                  }
                />
                <InfoRow label={t('workers.country')} value={worker.address?.country} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('workers.section.tax')}
                </Typography>
                <Divider sx={{ mb: 1.5 }} />
                <InfoRow
                  label={t('workers.steuerklasse')}
                  value={worker.steuerklasse ? t('workers.steuerklasseLabel', { number: worker.steuerklasse }) : undefined}
                />
                <InfoRow label={t('workers.healthInsurance')} value={worker.healthInsuranceProvider} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('workers.section.stats')}
                </Typography>
                <Divider sx={{ mb: 1.5 }} />
                <InfoRow
                  label={t('workers.totalHours')}
                  value={`${worker.totalHoursWorked.toFixed(1)} h`}
                />
                <InfoRow
                  label={t('workers.rating')}
                  value={worker.rating.count > 0 ? `${worker.rating.average.toFixed(1)} / 5 (${worker.rating.count})` : undefined}
                />
                <InfoRow
                  label={t('workers.addedOn')}
                  value={new Date(worker.createdAt).toLocaleDateString('de-DE')}
                />
              </Grid>
            </Grid>
          </TabPanel>

          {/* Skills Tab */}
          <TabPanel value={tab} index={1}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t('workers.skills')}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} mb={3}>
              {worker.skills.length > 0
                ? worker.skills.map((skill) => (
                    <Chip key={skill} label={skill} variant="outlined" />
                  ))
                : <Typography variant="body2" color="text.secondary">{t('workers.noSkills')}</Typography>}
            </Stack>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t('workers.languages')}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {worker.languages.length > 0
                ? worker.languages.map((lang) => (
                    <Chip
                      key={lang.language}
                      label={`${lang.language} · ${t(`workers.langLevel.${lang.level}`)}`}
                      variant="outlined"
                    />
                  ))
                : <Typography variant="body2" color="text.secondary">{t('workers.noLanguages')}</Typography>}
            </Stack>
          </TabPanel>

          {/* Compliance Tab */}
          <TabPanel value={tab} index={2}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t('workers.aueg.title')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {worker.auegTracking.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('workers.aueg.noEntries')}
              </Typography>
            ) : (
              worker.auegTracking.map((entry) => {
                const pct = Math.min((entry.monthsWorked / 18) * 100, 100);
                const col = entry.monthsWorked >= 18 ? 'error' : entry.monthsWorked >= 9 ? 'warning' : 'primary';
                return (
                  <Box key={`${entry.businessId}`} mb={2}>
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2" fontWeight={500}>
                        {entry.businessName}
                      </Typography>
                      <Typography variant="body2" color={`${col}.main`}>
                        {entry.monthsWorked} / 18 {t('workers.aueg.months')}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      color={col}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                );
              })
            )}

            {worker.auegTracking.length > 0 && (
              <Box mt={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('workers.aueg.overall')}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={auegPct}
                  color={auegColor}
                  sx={{ height: 10, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {t('workers.aueg.maxMonths', { months: maxAueg })}
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Documents Tab */}
          <TabPanel value={tab} index={3}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle2" color="text.secondary">
                {worker.documents.length} {worker.documents.length === 1 ? 'Dokument' : 'Dokumente'}
              </Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setDocDialogOpen(true)}
              >
                {t('workers.docs.add')}
              </Button>
            </Stack>
            {worker.documents.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('workers.docs.none')}
              </Typography>
            ) : (
              worker.documents.map((doc) => (
                <Paper key={doc._id} variant="outlined" sx={{ p: 2, mb: 1, borderColor: doc.remark ? 'warning.main' : undefined }}>
                  {doc.remark && (
                    <Alert severity="warning" sx={{ mb: 1.5 }} icon={false}>
                      <Typography variant="caption" fontWeight={700} display="block">
                        Anmerkung an Mitarbeiter
                      </Typography>
                      <Typography variant="body2">{doc.remark}</Typography>
                      {doc.remarkAt && (
                        <Typography variant="caption" color="text.secondary">
                          {new Date(doc.remarkAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      )}
                    </Alert>
                  )}
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {doc.label || t(`workers.docs.category.${doc.category}`)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(`workers.docs.category.${doc.category}`)}
                        {doc.expiryDate && ` · ${t('workers.docs.expires')}: ${new Date(doc.expiryDate).toLocaleDateString('de-DE')}`}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
                      <Chip
                        label={doc.verified ? t('workers.docs.verified') : doc.remark ? 'Überarbeitung angefordert' : t('workers.docs.unverified')}
                        color={doc.verified ? 'success' : doc.remark ? 'warning' : 'default'}
                        size="small"
                      />
                      {doc.fileUrl && (
                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Datei ansehen
                        </Button>
                      )}
                      {!doc.verified && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<VerifiedIcon />}
                          disabled={verifyDocMutation.isPending}
                          onClick={() => verifyDocMutation.mutate(doc._id)}
                        >
                          Verifizieren
                        </Button>
                      )}
                      {!doc.verified && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          onClick={() => {
                            setRemarkDialogDocId(doc._id);
                            setRemarkText(doc.remark ?? '');
                          }}
                        >
                          {doc.remark ? 'Anmerkung bearbeiten' : 'Anmerkung hinzufügen'}
                        </Button>
                      )}
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        disabled={deleteDocMutation.isPending}
                        onClick={() => {
                          if (window.confirm(t('workers.docs.deleteConfirm'))) {
                            deleteDocMutation.mutate(doc._id);
                          }
                        }}
                      >
                        {t('common.delete')}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))
            )}
          </TabPanel>

          {/* Availability Tab */}
          <TabPanel value={tab} index={4}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t('availability.weeklyPattern')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack direction="row" spacing={1} mb={3}>
              {DAYS_DE.map(({ key, short }) => {
                const avail = (worker.availability?.weeklyPattern as Record<string, boolean> | undefined)?.[key] ?? false;
                return (
                  <Chip
                    key={key}
                    label={short}
                    color={avail ? 'primary' : 'default'}
                    variant={avail ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 700 }}
                  />
                );
              })}
            </Stack>

            {worker.availability?.preferredRadiusKm && (
              <Typography variant="body2" color="text.secondary" mb={3}>
                {t('availability.radius')}: <strong>{worker.availability.preferredRadiusKm} km</strong>
              </Typography>
            )}

            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t('availability.exceptions')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {(!worker.availability?.exceptions || worker.availability.exceptions.length === 0) ? (
              <Typography variant="body2" color="text.secondary">
                {t('availability.noExceptions')}
              </Typography>
            ) : (
              <Stack spacing={1}>
                {(worker.availability.exceptions as Array<{ date: string; available: boolean; note?: string }>)
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((ex, i) => (
                    <Stack key={i} direction="row" spacing={2} alignItems="center">
                      <Typography variant="body2" sx={{ minWidth: 110 }}>
                        {new Date(ex.date).toLocaleDateString('de-DE', {
                          weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
                        })}
                      </Typography>
                      {ex.available
                        ? <CheckCircleIcon color="success" fontSize="small" />
                        : <CancelIcon color="error" fontSize="small" />}
                      <Typography variant="body2" color="text.secondary">
                        {ex.available ? t('availability.available') : t('availability.unavailable')}
                        {ex.note ? ` — ${ex.note}` : ''}
                      </Typography>
                    </Stack>
                  ))}
              </Stack>
            )}
          </TabPanel>

          {/* Tab 5: Sensitive Data — agency_admin only */}
          {isAdmin && (
            <TabPanel value={tab} index={5}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                {t('workers.sensitiveData.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {t('workers.sensitiveData.subtitle')}
              </Typography>
              {sensitiveSaved && (
                <Alert severity="success" sx={{ mb: 2 }}>{t('workers.sensitiveData.saved')}</Alert>
              )}
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <InfoRow label={t('workers.sensitiveData.iban')} value={worker.iban || t('workers.sensitiveData.notSet')} />
                <InfoRow label={t('workers.sensitiveData.steuernummer')} value={worker.steuernummer || t('workers.sensitiveData.notSet')} />
                <InfoRow label={t('workers.sensitiveData.sozialversicherungsnummer')} value={worker.sozialversicherungsnummer || t('workers.sensitiveData.notSet')} />
              </Paper>
              <Button
                variant="contained"
                startIcon={<LockOpenIcon />}
                onClick={() => {
                  setSensitiveIban(worker.iban ?? '');
                  setSensitiveSteuernummer(worker.steuernummer ?? '');
                  setSensitiveSvNummer(worker.sozialversicherungsnummer ?? '');
                  setSensitiveDialogOpen(true);
                }}
              >
                {t('workers.sensitiveData.edit')}
              </Button>

              <Box mt={4}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {t('workers.payslip.title')}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <TextField
                    label={t('workers.payslip.month')}
                    type="month"
                    size="small"
                    value={payslipMonth}
                    onChange={(e) => setPayslipMonth(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 180 }}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadPayslip}
                    disabled={payslipLoading}
                  >
                    {payslipLoading ? t('common.loading') : t('workers.payslip.download')}
                  </Button>
                </Stack>
              </Box>
            </TabPanel>
          )}
        </Box>
      </Paper>

      {/* Add Document Dialog */}
      <Dialog open={docDialogOpen} onClose={() => setDocDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('workers.docs.addTitle')}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>{t('workers.tab.documents')}</InputLabel>
            <Select
              value={docCategory}
              label={t('workers.tab.documents')}
              onChange={(e) => setDocCategory(e.target.value)}
            >
              {(['identity', 'work_permit', 'health_certificate', 'contract', 'other'] as const).map((c) => (
                <MenuItem key={c} value={c}>{t(`workers.docs.category.${c}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label={t('workers.tab.documents') + ' – Bezeichnung'}
            placeholder={t('workers.docs.labelPlaceholder')}
            fullWidth
            value={docLabel}
            onChange={(e) => setDocLabel(e.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            label={t('workers.docs.expiryDate')}
            type="date"
            fullWidth
            value={docExpiry}
            onChange={(e) => setDocExpiry(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 2 }}
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Datei (optional — PDF, JPG, PNG, DOCX, max. 10 MB)
            </Typography>
            <Button variant="outlined" component="label" size="small" fullWidth>
              {docFile ? docFile.name : 'Datei auswählen'}
              <input
                type="file"
                hidden
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              />
            </Button>
          </Box>
          {addDocMutation.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {t('common.error')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDocDialogOpen(false); setDocFile(null); }}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={!docLabel.trim() || addDocMutation.isPending}
            onClick={() => addDocMutation.mutate()}
          >
            {addDocMutation.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remark Dialog */}
      <Dialog open={!!remarkDialogDocId} onClose={() => { setRemarkDialogDocId(null); setRemarkText(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>Anmerkung an Mitarbeiter</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Die Anmerkung wird dem Mitarbeiter in seinem Portal angezeigt und fordert ihn zur erneuten Einreichung auf.
          </Typography>
          <TextField
            label="Anmerkung"
            placeholder="z. B. Dokument ist nicht gut lesbar, bitte erneut hochladen."
            fullWidth
            multiline
            rows={3}
            value={remarkText}
            onChange={(e) => setRemarkText(e.target.value)}
            autoFocus
          />
          {remarkDocMutation.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>{t('common.error')}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRemarkDialogDocId(null); setRemarkText(''); }}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={!remarkText.trim() || remarkDocMutation.isPending}
            onClick={() => remarkDialogDocId && remarkDocMutation.mutate(remarkDialogDocId)}
          >
            {remarkDocMutation.isPending ? t('common.loading') : 'Anmerkung senden'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DSGVO Anonymize Dialog */}
      <Dialog open={anonymizeDialogOpen} onClose={() => { setAnonymizeDialogOpen(false); setAnonymizeReason(''); setAnonymizeConfirmText(''); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>
          Mitarbeiterdaten anonymisieren (DSGVO Art. 17)
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Achtung: Diese Aktion ist unwiderruflich.</strong> Alle personenbezogenen Daten werden gelöscht.
            Finanz- und AÜG-Compliance-Daten bleiben gemäß HGB §257 für 10 Jahre erhalten.
          </Alert>
          <TextField
            label="Begründung (Pflichtfeld)"
            placeholder="z. B. Antrag des Mitarbeiters auf Löschung gemäß DSGVO Art. 17"
            fullWidth
            multiline
            rows={3}
            value={anonymizeReason}
            onChange={(e) => setAnonymizeReason(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary" mb={1}>
            Zur Bestätigung bitte <strong>LÖSCHEN</strong> eingeben:
          </Typography>
          <TextField
            fullWidth
            value={anonymizeConfirmText}
            onChange={(e) => setAnonymizeConfirmText(e.target.value)}
            placeholder="LÖSCHEN"
            size="small"
          />
          {anonymizeMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(anonymizeMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAnonymizeDialogOpen(false); setAnonymizeReason(''); setAnonymizeConfirmText(''); }}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={
              !anonymizeReason.trim() ||
              anonymizeConfirmText !== 'LÖSCHEN' ||
              anonymizeMutation.isPending
            }
            onClick={() => anonymizeMutation.mutate()}
          >
            {anonymizeMutation.isPending ? t('common.loading') : 'Unwiderruflich anonymisieren'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sensitive Data Edit Dialog */}
      <Dialog open={sensitiveDialogOpen} onClose={() => setSensitiveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('workers.sensitiveData.editTitle')}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('workers.sensitiveData.editHint')}
          </Alert>
          <TextField
            label={t('workers.sensitiveData.iban')}
            fullWidth
            value={sensitiveIban}
            onChange={(e) => setSensitiveIban(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
            placeholder="DE89 3704 0044 0532 0130 00"
            inputProps={{ maxLength: 34 }}
          />
          <TextField
            label={t('workers.sensitiveData.steuernummer')}
            fullWidth
            value={sensitiveSteuernummer}
            onChange={(e) => setSensitiveSteuernummer(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="12/345/67890"
            inputProps={{ maxLength: 20 }}
          />
          <TextField
            label={t('workers.sensitiveData.sozialversicherungsnummer')}
            fullWidth
            value={sensitiveSvNummer}
            onChange={(e) => setSensitiveSvNummer(e.target.value)}
            placeholder="65 050577 B 004"
            inputProps={{ maxLength: 20 }}
          />
          {sensitiveMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>{t('common.error')}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSensitiveDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={sensitiveMutation.isPending}
            onClick={() => sensitiveMutation.mutate()}
          >
            {sensitiveMutation.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('workers.changeStatus')}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>{t('workers.status')}</InputLabel>
            <Select
              value={newStatus}
              label={t('workers.status')}
              onChange={(e) => setNewStatus(e.target.value as Worker['status'])}
            >
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {t(`workers.statusLabel.${s}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label={t('workers.statusNote')}
            fullWidth
            multiline
            rows={2}
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={() => statusMutation.mutate()}
            disabled={statusMutation.isPending}
          >
            {statusMutation.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
