import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import BadgeIcon from '@mui/icons-material/Badge';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import apiClient from '../../api/client';

type DocumentCategory = 'identity' | 'work_permit' | 'health_certificate' | 'contract' | 'other';

interface WorkerDocument {
  _id: string;
  category: DocumentCategory;
  label: string;
  fileUrl?: string;
  expiryDate?: string;
  verified: boolean;
  uploadedAt: string;
  remark?: string;
  remarkAt?: string;
}

const CATEGORY_META: Record<DocumentCategory, { label: string; icon: React.ReactNode; color: string }> = {
  identity:           { label: 'Ausweis / Pass',        icon: <BadgeIcon />,         color: '#1976d2' },
  work_permit:        { label: 'Arbeitserlaubnis',       icon: <AssignmentIcon />,    color: '#7b1fa2' },
  health_certificate: { label: 'Gesundheitszeugnis',    icon: <LocalHospitalIcon />, color: '#388e3c' },
  contract:           { label: 'Vertrag',                icon: <AssignmentIcon />,    color: '#f57c00' },
  other:              { label: 'Sonstiges',              icon: <FolderIcon />,        color: '#616161' },
};

const CATEGORIES: DocumentCategory[] = ['identity', 'work_permit', 'health_certificate', 'contract', 'other'];

function expiryStatus(expiryDate?: string): 'expired' | 'soon' | 'ok' | null {
  if (!expiryDate) return null;
  const diff = new Date(expiryDate).getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return 'expired';
  if (days <= 30) return 'soon';
  return 'ok';
}

function ExpiryChip({ expiryDate }: { expiryDate?: string }) {
  if (!expiryDate) return null;
  const status = expiryStatus(expiryDate);
  const formatted = new Date(expiryDate).toLocaleDateString('de-DE');
  const daysLeft = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (status === 'expired') {
    return <Chip icon={<WarningAmberIcon />} label={`Abgelaufen · ${formatted}`} size="small" color="error" />;
  }
  if (status === 'soon') {
    return <Chip icon={<WarningAmberIcon />} label={`Läuft ab ${formatted} (noch ${daysLeft} Tage)`} size="small" color="warning" />;
  }
  return <Chip label={`Gültig bis ${formatted}`} size="small" color="success" variant="outlined" />;
}

export default function WorkerDocumentsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>('identity');
  const [label, setLabel] = useState('');
  const [expiry, setExpiry] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const { data, isLoading, error } = useQuery<WorkerDocument[]>({
    queryKey: ['worker-documents'],
    queryFn: () => apiClient.get('/worker-portal/documents').then((r) => r.data),
  });

  const addMutation = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('category', category);
      form.append('label', label);
      if (expiry) form.append('expiryDate', expiry);
      if (file) form.append('file', file);
      return apiClient.post('/worker-portal/documents', form).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-documents'] });
      setDialogOpen(false);
      setLabel('');
      setExpiry('');
      setCategory('identity');
      setFile(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) =>
      apiClient.delete(`/worker-portal/documents/${docId}`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worker-documents'] }),
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">Fehler beim Laden der Dokumente.</Alert>;

  const grouped = CATEGORIES.reduce<Record<string, WorkerDocument[]>>((acc, cat) => {
    const docs = data?.filter((d) => d.category === cat) ?? [];
    if (docs.length) acc[cat] = docs;
    return acc;
  }, {});

  const hasExpiring = data?.some((d) => {
    const s = expiryStatus(d.expiryDate);
    return s === 'expired' || s === 'soon';
  });

  const hasRemarks = data?.some((d) => !!d.remark);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700} mb={0.5}>Meine Dokumente</Typography>
          <Typography variant="body2" color="text.secondary">
            Dokumente, die Sie oder Ihre Agentur hinterlegt haben
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ mt: 0.5 }}
        >
          Dokument hinzufügen
        </Button>
      </Stack>

      {hasRemarks && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Ihre Agentur hat Anmerkungen zu einem oder mehreren Dokumenten hinterlassen. Bitte überprüfen Sie die markierten Dokumente und laden Sie diese erneut hoch.
        </Alert>
      )}

      {hasExpiring && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Einige Ihrer Dokumente laufen bald ab oder sind bereits abgelaufen. Bitte wenden Sie sich an Ihre Agentur.
        </Alert>
      )}

      {(!data || data.length === 0) && (
        <Alert severity="info">
          Noch keine Dokumente vorhanden. Fügen Sie Ihr erstes Dokument hinzu.
        </Alert>
      )}

      <Stack spacing={3}>
        {Object.entries(grouped).map(([cat, docs]) => {
          const meta = CATEGORY_META[cat as DocumentCategory];
          return (
            <Card key={cat}>
              <CardContent sx={{ pb: '12px !important' }}>
                <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
                  <Box sx={{ color: meta.color }}>{meta.icon}</Box>
                  <Typography variant="subtitle1" fontWeight={700}>{meta.label}</Typography>
                  <Chip label={docs.length} size="small" />
                </Stack>
                <Divider sx={{ mb: 1.5 }} />
                <Stack spacing={1.5}>
                  {docs.map((doc, i) => (
                    <Box key={doc._id}>
                      {i > 0 && <Divider sx={{ mb: 1.5 }} />}
                      {doc.remark && (
                        <Alert severity="error" sx={{ mb: 1 }} icon={false}>
                          <Typography variant="caption" fontWeight={700} display="block">
                            Anmerkung Ihrer Agentur — Bitte erneut einreichen
                          </Typography>
                          <Typography variant="body2">{doc.remark}</Typography>
                          {doc.remarkAt && (
                            <Typography variant="caption" color="text.secondary">
                              {new Date(doc.remarkAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </Typography>
                          )}
                        </Alert>
                      )}
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>{doc.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Hinzugefügt: {new Date(doc.uploadedAt).toLocaleDateString('de-DE')}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                          <ExpiryChip expiryDate={doc.expiryDate} />
                          {doc.verified ? (
                            <Chip icon={<CheckCircleIcon />} label="Geprüft" size="small" color="success" variant="outlined" />
                          ) : doc.remark ? (
                            <Chip icon={<WarningAmberIcon />} label="Überarbeitung erforderlich" size="small" color="error" variant="outlined" />
                          ) : (
                            <Chip icon={<PendingIcon />} label="In Prüfung" size="small" variant="outlined" />
                          )}
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
                              color="error"
                              startIcon={<DeleteIcon />}
                              disabled={deleteMutation.isPending}
                              onClick={() => {
                                if (window.confirm('Dokument wirklich löschen?')) {
                                  deleteMutation.mutate(doc._id);
                                }
                              }}
                            >
                              Löschen
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Alert severity="info" sx={{ mt: 3 }} variant="outlined">
        Bereits verifizierte Dokumente können nicht gelöscht werden. Der direkte Download wird in einer zukünftigen Version verfügbar sein.
      </Alert>

      {/* Add Document Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Dokument hinzufügen</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Kategorie</InputLabel>
            <Select
              value={category}
              label="Kategorie"
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>{CATEGORY_META[c].label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Bezeichnung"
            placeholder="z. B. Personalausweis, Arbeitserlaubnis"
            fullWidth
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            label="Ablaufdatum (optional)"
            type="date"
            fullWidth
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 2 }}
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Datei hochladen (optional — PDF, JPG, PNG, DOCX, max. 10 MB)
            </Typography>
            <Button variant="outlined" component="label" size="small" fullWidth>
              {file ? file.name : 'Datei auswählen'}
              <input
                type="file"
                hidden
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Button>
          </Box>
          {addMutation.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>Fehler beim Speichern.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); setFile(null); }}>Abbrechen</Button>
          <Button
            variant="contained"
            disabled={!label.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            {addMutation.isPending ? 'Wird gespeichert…' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
