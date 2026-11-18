import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import apiClient from '../../api/client';

interface AuditEntry {
  _id: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pages: number;
}

const ACTION_LABEL: Record<string, string> = {
  'worker.status_changed':    'Mitarbeiterstatus geändert',
  'worker.created':           'Mitarbeiter angelegt',
  'worker.deleted':           'Mitarbeiter gelöscht',
  'worker.aueg_override':     'AÜG-Sperre aufgehoben',
  'shift.published':          'Schicht veröffentlicht',
  'shift.cancelled':          'Schicht storniert',
  'assignment.created':       'Zuweisung erstellt',
  'invoice.status_changed':   'Rechnungsstatus geändert',
  'invoice.created':          'Rechnung erstellt',
  'timesheet.approved':       'Stundenzettel genehmigt',
  'timesheet.disputed':       'Stundenzettel beanstandet',
  'staff.invited':            'Mitarbeiter eingeladen',
  'staff.status_changed':     'Personalstatus geändert',
  'staff.removed':            'Personal entfernt',
  'portal_access.granted':    'Portalzugang gewährt',
  'portal_access.revoked':    'Portalzugang entzogen',
  'settings.agency_updated':  'Agentureinstellungen geändert',
  'tenant.status_changed':    'Mandantenstatus geändert',
};

const ACTION_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  'worker.status_changed':    'warning',
  'worker.aueg_override':     'error',
  'staff.removed':            'error',
  'portal_access.revoked':    'error',
  'shift.cancelled':          'error',
  'portal_access.granted':    'success',
  'staff.invited':            'success',
  'shift.published':          'success',
  'invoice.created':          'info',
  'settings.agency_updated':  'warning',
};

const ROLE_LABEL: Record<string, string> = {
  agency_admin: 'Admin',
  disponent: 'Disponent',
  super_admin: 'Super Admin',
};

const ACTION_OPTIONS = [
  { value: '', label: 'Alle Aktionen' },
  ...Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label })),
];

function DetailChips({ details }: { details?: Record<string, unknown> }) {
  if (!details) return null;
  return (
    <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.5}>
      {Object.entries(details).map(([k, v]) => {
        if (v === undefined || v === null) return null;
        const display = Array.isArray(v) ? v.join(', ') : String(v);
        return (
          <Chip
            key={k}
            label={`${k}: ${display}`}
            size="small"
            variant="outlined"
            sx={{ fontSize: 11, maxWidth: 240 }}
          />
        );
      })}
    </Stack>
  );
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  const { data, isLoading, error } = useQuery<AuditLogResponse>({
    queryKey: ['audit-log', page, actionFilter],
    queryFn: () =>
      apiClient
        .get('/audit-log', { params: { page, limit: 50, ...(actionFilter ? { action: actionFilter } : {}) } })
        .then((r) => r.data),
  });

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Audit-Protokoll</Typography>
      <Typography variant="body2" color="text.secondary" mb={1}>
        Alle sicherheitsrelevanten Aktionen in Ihrer Agentur — gemäß DSGVO Art. 30 protokolliert
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }} variant="outlined">
        Einträge werden 10 Jahre aufbewahrt (HGB § 257). Das Protokoll ist schreibgeschützt und kann nicht verändert werden.
      </Alert>

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <TextField
          select
          label="Aktion filtern"
          size="small"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          sx={{ minWidth: 280 }}
        >
          {ACTION_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
        {data && (
          <Typography variant="body2" color="text.secondary">
            {data.total} Einträge
          </Typography>
        )}
      </Stack>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Fehler beim Laden.</Alert>}

      {data && (
        <>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Zeitpunkt</TableCell>
                  <TableCell>Aktion</TableCell>
                  <TableCell>Ausgeführt von</TableCell>
                  <TableCell>Zielobjekt</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" py={3}>
                        Keine Einträge gefunden
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {data.entries.map((entry, i) => (
                  <TableRow
                    key={entry._id}
                    sx={{ bgcolor: i % 2 === 0 ? 'inherit' : 'action.hover' }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      <Typography variant="body2">
                        {new Date(entry.createdAt).toLocaleDateString('de-DE')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(entry.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <Chip
                        label={ACTION_LABEL[entry.action] ?? entry.action}
                        size="small"
                        color={ACTION_COLOR[entry.action] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <Typography variant="body2">{entry.actorName || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ROLE_LABEL[entry.actorRole] ?? entry.actorRole}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {entry.targetName ? (
                        <>
                          <Typography variant="body2">{entry.targetName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {entry.targetType}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="caption" color="text.secondary">{entry.targetType}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top', maxWidth: 280 }}>
                      <DetailChips details={entry.details} />
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {entry.ip ? (
                        <Tooltip title="IP-Adresse des Handelnden">
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {entry.ip}
                          </Typography>
                        </Tooltip>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {data.pages > 1 && (
            <Stack alignItems="center" mt={2}>
              <Pagination
                count={data.pages}
                page={page}
                onChange={(_, v) => setPage(v)}
                color="primary"
              />
            </Stack>
          )}
          <Divider sx={{ mt: 2 }} />
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            Aufbewahrungsfrist: 10 Jahre · Unveränderlich · DSGVO Art. 30 konform
          </Typography>
        </>
      )}
    </Box>
  );
}
