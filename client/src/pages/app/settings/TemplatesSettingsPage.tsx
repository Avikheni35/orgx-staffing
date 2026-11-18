import { useState, useRef } from 'react';
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
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { contractTemplatesApi, ContractTemplate } from '../../../api/contractTemplates';

// ── Placeholder toolbar ───────────────────────────────────────────────────────

function PlaceholderToolbar({
  placeholders,
  onInsert,
}: {
  placeholders: Record<string, string>;
  onInsert: (key: string) => void;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
        Platzhalter einfügen — klicken Sie auf einen Platzhalter, um ihn an der Cursorposition einzufügen:
      </Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {Object.entries(placeholders).map(([key, label]) => (
          <Tooltip key={key} title={label} arrow>
            <Chip
              label={`{{${key}}}`}
              size="small"
              variant="outlined"
              onClick={() => onInsert(key)}
              sx={{ fontFamily: 'monospace', fontSize: '0.75rem', cursor: 'pointer', mb: 0.5 }}
            />
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
}

// ── Preview with dummy data ───────────────────────────────────────────────────

const PREVIEW_DATA: Record<string, string> = {
  worker_name: 'Max Mustermann',
  worker_firstname: 'Max',
  worker_lastname: 'Mustermann',
  worker_email: 'max.mustermann@example.de',
  agency_name: 'Demo Zeitarbeit GmbH',
  agency_address: 'Musterstraße 1, 10115 Berlin',
  business_name: 'Musterfirma AG',
  shift_title: 'Lagerhelfer',
  shift_start_time: 'Montag, 01.01.2024, 08:00 Uhr',
  shift_end_time: 'Montag, 01.01.2024, 17:00 Uhr',
  shift_break_minutes: '30',
  shift_net_hours: '8.50',
  shift_pay_rate: '15.00',
  shift_gross_pay: '127.50',
  contract_date: '01.01.2024',
};

function resolvePreview(html: string): string {
  let out = html;
  for (const [key, value] of Object.entries(PREVIEW_DATA)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  // Highlight any remaining unresolved placeholders
  out = out.replace(/\{\{[^}]+\}\}/g, (m) => `<mark style="background:#fff3cd;padding:0 2px;">${m}</mark>`);
  return out;
}

// ── Template editor dialog ────────────────────────────────────────────────────

function TemplateEditorDialog({
  open,
  onClose,
  template,
  placeholders,
  defaultHtml,
}: {
  open: boolean;
  onClose: () => void;
  template: ContractTemplate | null;
  placeholders: Record<string, string>;
  defaultHtml: string;
}) {
  const qc = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState(template?.name ?? '');
  const [html, setHtml] = useState(template?.html ?? defaultHtml);
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');

  const isEdit = !!template;

  const saveMutation = useMutation({
    mutationFn: () =>
      isEdit
        ? contractTemplatesApi.update(template!._id, { name, html, isDefault })
        : contractTemplatesApi.create({ name, html, isDefault }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-templates'] });
      onClose();
    },
    onError: (err: unknown) => {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Fehler beim Speichern');
    },
  });

  const insertPlaceholder = (key: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newHtml = html.slice(0, start) + `{{${key}}}` + html.slice(end);
    setHtml(newHtml);
    // Restore cursor after the inserted placeholder
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + `{{${key}}}`.length;
      ta.focus();
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { height: '90vh' } }}>
      <DialogTitle>
        {isEdit ? `Vorlage bearbeiten: ${template!.name}` : 'Neue Vertragsvorlage'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
        <Stack direction="row" spacing={2} alignItems="center" mt={1}>
          <TextField
            label="Name der Vorlage"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            size="small"
            sx={{ flex: 1 }}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={isDefault ? 'Standard-Vorlage' : 'Als Standard festlegen'}
              color={isDefault ? 'success' : 'default'}
              variant={isDefault ? 'filled' : 'outlined'}
              icon={isDefault ? <StarIcon /> : <StarBorderIcon />}
              onClick={() => setIsDefault((v) => !v)}
              sx={{ cursor: 'pointer' }}
            />
          </Stack>
        </Stack>

        <PlaceholderToolbar placeholders={placeholders} onInsert={insertPlaceholder} />

        <Paper variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="HTML bearbeiten" />
            <Tab label="Vorschau" />
          </Tabs>

          {tab === 0 && (
            <Box sx={{ flex: 1, overflow: 'auto', p: 0 }}>
              <textarea
                ref={textareaRef}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                spellCheck={false}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: 300,
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  padding: '12px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: 1.6,
                  boxSizing: 'border-box',
                  background: 'transparent',
                  color: 'inherit',
                }}
              />
            </Box>
          )}

          {tab === 1 && (
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Vorschau mit Beispieldaten. Gelb markierte Bereiche enthalten unbekannte Platzhalter.
              </Alert>
              <Paper variant="outlined" sx={{ p: 3 }}>
                <div dangerouslySetInnerHTML={{ __html: resolvePreview(html) }} />
              </Paper>
            </Box>
          )}
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button
          variant="contained"
          disabled={!name.trim() || !html.trim() || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? 'Speichern...' : isEdit ? 'Änderungen speichern' : 'Vorlage erstellen'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TemplatesSettingsPage() {
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['contract-templates'],
    queryFn: contractTemplatesApi.list,
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => contractTemplatesApi.setDefault(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contract-templates'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contractTemplatesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-templates'] });
      setDeleteTarget(null);
    },
  });

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (tpl: ContractTemplate) => { setEditing(tpl); setEditorOpen(true); };

  const copyHtml = (tpl: ContractTemplate) => {
    navigator.clipboard.writeText(tpl.html);
    setCopied(tpl._id);
    setTimeout(() => setCopied(null), 2000);
  };

  const templates = data?.templates ?? [];
  const placeholders = data?.placeholders ?? {};
  const defaultHtml = data?.defaultHtml ?? '';

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Vertragsvorlagen</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            HTML-Vorlagen für automatisch generierte Verträge bei Schichtgenehmigung
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          Neue Vorlage
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Die <strong>Standard-Vorlage</strong> wird automatisch verwendet, wenn ein Schichtantrag genehmigt wird.
        Ohne eigene Vorlage greift die eingebaute Systemvorlage. Verwenden Sie Platzhalter wie{' '}
        <code>{'{{worker_name}}'}</code> für dynamische Inhalte.
      </Alert>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Fehler beim Laden der Vorlagen.</Alert>}

      {templates.length === 0 && !isLoading && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Noch keine eigenen Vorlagen — die eingebaute Systemvorlage wird verwendet.
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={openNew} sx={{ mt: 1 }}>
            Erste Vorlage erstellen
          </Button>
        </Paper>
      )}

      <Stack spacing={2}>
        {templates.map((tpl) => (
          <Paper key={tpl._id} variant="outlined" sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
              <Box flex={1}>
                <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                  <Typography variant="subtitle1" fontWeight={700}>{tpl.name}</Typography>
                  {tpl.isDefault && (
                    <Chip label="Standard" color="success" size="small" icon={<StarIcon />} />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Zuletzt geändert: {new Date(tpl.updatedAt).toLocaleDateString('de-DE')}
                  {' · '}{tpl.html.length.toLocaleString()} Zeichen
                </Typography>
              </Box>

              <Stack direction="row" spacing={0.5}>
                {!tpl.isDefault && (
                  <Tooltip title="Als Standard-Vorlage festlegen">
                    <IconButton
                      size="small"
                      onClick={() => setDefaultMutation.mutate(tpl._id)}
                      disabled={setDefaultMutation.isPending}
                    >
                      <StarBorderIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={copied === tpl._id ? 'Kopiert!' : 'HTML kopieren'}>
                  <IconButton size="small" onClick={() => copyHtml(tpl)}>
                    {copied === tpl._id ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Bearbeiten">
                  <IconButton size="small" onClick={() => openEdit(tpl)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {!tpl.isDefault && (
                  <Tooltip title="Löschen">
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(tpl)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {/* Placeholder reference */}
      {Object.keys(placeholders).length > 0 && (
        <Box mt={4}>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>Verfügbare Platzhalter</Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={0.5}>
            {Object.entries(placeholders).map(([key, label]) => (
              <Stack key={key} direction="row" spacing={2} alignItems="center">
                <code style={{ minWidth: 200, fontFamily: 'monospace', fontSize: 13 }}>{`{{${key}}}`}</code>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      {/* Editor dialog */}
      {editorOpen && (
        <TemplateEditorDialog
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          template={editing}
          placeholders={placeholders}
          defaultHtml={defaultHtml}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Vorlage löschen?</DialogTitle>
        <DialogContent>
          <Typography>
            Möchten Sie die Vorlage <strong>„{deleteTarget?.name}"</strong> dauerhaft löschen?
            Bereits erstellte Verträge sind nicht betroffen.
          </Typography>
          {deleteMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(deleteMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Fehler'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
          >
            {deleteMutation.isPending ? 'Löschen...' : 'Löschen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
