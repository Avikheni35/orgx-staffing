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
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditNoteIcon from '@mui/icons-material/EditNote';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workersApi } from '../../../api/workers';

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  pending_review: 'warning',
  active: 'success',
  inactive: 'default',
  suspended: 'error',
  blacklisted: 'error',
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <Stack direction="row" gap={2} py={0.5}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>{label}</Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Stack>
  );
}

export default function WorkerOnboardingReviewPage() {
  const { t } = useTranslation();
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [changesNote, setChangesNote] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const { data: worker, isLoading, error } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => workersApi.get(workerId!),
    enabled: !!workerId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['worker', workerId] });

  const approveMut = useMutation({
    mutationFn: () => workersApi.approve(workerId!),
    onSuccess: () => { invalidate(); setSuccessMsg(t('workerReview.approved')); setErrMsg(''); },
    onError: (e: unknown) => setErrMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')),
  });

  const rejectMut = useMutation({
    mutationFn: () => workersApi.reject(workerId!, rejectNote || undefined),
    onSuccess: () => { invalidate(); setRejectOpen(false); setSuccessMsg(t('workerReview.rejected')); setErrMsg(''); },
    onError: (e: unknown) => setErrMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.error')),
  });

  const [changesLoading, setChangesLoading] = useState(false);

  if (isLoading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
  if (error || !worker) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const fullName = `${worker.firstName} ${worker.lastName}`;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" gap={2}>
          <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate(`/app/workers/${workerId}`)}>
            {t('common.back')}
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700}>{t('workerReview.title')}</Typography>
            <Stack direction="row" gap={1} mt={0.5} alignItems="center">
              <Typography variant="body2" color="text.secondary">{fullName}</Typography>
              <Chip
                size="small"
                label={worker.status}
                color={STATUS_COLOR[worker.status] ?? 'default'}
              />
            </Stack>
          </Box>
        </Stack>

        {worker.status !== 'active' && (
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button
              variant="outlined"
              color="warning"
              startIcon={<EditNoteIcon />}
              onClick={() => { setChangesNote(''); setChangesOpen(true); }}
            >
              {t('workerReview.requestChanges')}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => { setRejectNote(''); setRejectOpen(true); }}
            >
              {t('workerReview.reject')}
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon />}
              disabled={approveMut.isPending}
              onClick={() => approveMut.mutate()}
            >
              {approveMut.isPending ? t('common.loading') : t('workerReview.approve')}
            </Button>
          </Stack>
        )}
      </Stack>

      {worker.status === 'active' && (
        <Alert severity="success" sx={{ mb: 2 }}>{t('workerReview.alreadyActive')}</Alert>
      )}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
      {errMsg && <Alert severity="error" sx={{ mb: 2 }}>{errMsg}</Alert>}

      <Grid container spacing={3}>
        {/* Left: Personal info */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t('workerReview.personalInfo')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <InfoRow label={t('workers.firstName')} value={worker.firstName} />
            <InfoRow label={t('workers.lastName')} value={worker.lastName} />
            <InfoRow label={t('workers.email')} value={worker.email} />
            <InfoRow label={t('workers.phone')} value={worker.phone} />
            <InfoRow label={t('workers.dateOfBirth')} value={worker.dateOfBirth ? new Date(worker.dateOfBirth).toLocaleDateString('de-DE') : undefined} />
            <InfoRow label={t('workers.gender')} value={worker.gender} />
            <InfoRow label={t('workers.nationality')} value={worker.nationality} />
            <InfoRow
              label={t('workers.address')}
              value={worker.address
                ? [worker.address.street, worker.address.postalCode, worker.address.city, worker.address.country].filter(Boolean).join(', ')
                : undefined}
            />
            <Divider sx={{ my: 1.5 }} />
            <InfoRow label={t('workers.steuerklasse')} value={worker.steuerklasse} />
            <InfoRow label={t('workers.healthInsurance')} value={worker.healthInsuranceProvider} />
            {worker.skills.length > 0 && (
              <Stack direction="row" gap={0.5} pt={1} flexWrap="wrap">
                {worker.skills.map((s) => <Chip key={s} label={s} size="small" />)}
              </Stack>
            )}
            {worker.dsgvoConsentAt && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <InfoRow
                  label={t('workerReview.dsgvoConsent')}
                  value={new Date(worker.dsgvoConsentAt).toLocaleString('de-DE')}
                />
              </>
            )}
          </Paper>
        </Grid>

        {/* Right: Documents */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t('workerReview.documents')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {worker.documents.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('workerReview.noDocuments')}</Typography>
            ) : (
              <Stack spacing={1.5}>
                {worker.documents.map((doc) => (
                  <Stack key={doc._id} direction="row" alignItems="center" gap={1.5} sx={{ py: 0.5 }}>
                    <InsertDriveFileIcon fontSize="small" color="action" />
                    <Box flex={1}>
                      <Typography variant="body2" fontWeight={500}>{doc.label}</Typography>
                      <Stack direction="row" gap={1} mt={0.25}>
                        <Chip size="small" label={doc.category} variant="outlined" />
                        <Chip
                          size="small"
                          label={doc.verified ? t('workers.verified') : t('workers.unverified')}
                          color={doc.verified ? 'success' : 'default'}
                        />
                        {doc.expiryDate && (
                          <Typography variant="caption" color="text.secondary">
                            {t('workers.expiresOn')}: {new Date(doc.expiryDate).toLocaleDateString('de-DE')}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                    {doc.fileUrl && (
                      <Link href={doc.fileUrl} target="_blank" rel="noopener" underline="hover" variant="caption">
                        {t('common.view')}
                      </Link>
                    )}
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('workerReview.confirmReject')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('common.note')}
            fullWidth
            multiline
            rows={3}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" disabled={rejectMut.isPending} onClick={() => rejectMut.mutate()}>
            {t('workerReview.reject')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Request changes dialog */}
      <Dialog open={changesOpen} onClose={() => setChangesOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('workerReview.requestChanges')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('workerReview.changeNotes')}
            fullWidth
            multiline
            rows={3}
            value={changesNote}
            onChange={(e) => setChangesNote(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangesOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={changesLoading || !changesNote}
            onClick={() => {
              setChangesLoading(true);
              workersApi.setStatus(workerId!, 'pending_review', changesNote).then(() => {
                setChangesOpen(false);
                setSuccessMsg(t('workerReview.changesRequested'));
                invalidate();
              }).finally(() => setChangesLoading(false));
            }}
          >
            {t('common.send')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
