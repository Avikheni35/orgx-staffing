import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
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
  Typography,
} from '@mui/material';
import apiClient from '../../api/client';

interface AuditEntry {
  _id: string;
  tenantName: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetName?: string;
  details?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

interface Response { entries: AuditEntry[]; total: number; page: number; pages: number; }

const ACTION_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  'worker.aueg_override': 'error',
  'staff.removed': 'error',
  'portal_access.revoked': 'error',
  'shift.cancelled': 'error',
  'portal_access.granted': 'success',
  'staff.invited': 'success',
  'shift.published': 'success',
  'invoice.created': 'info',
  'settings.agency_updated': 'warning',
  'tenant.status_changed': 'warning',
};

export default function SuperAdminAuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  const { data, isLoading, error } = useQuery<Response>({
    queryKey: ['superadmin-audit-log', page, action],
    queryFn: () =>
      apiClient
        .get('/superadmin/audit-log', { params: { page, limit: 50, ...(action ? { action } : {}) } })
        .then((r) => r.data),
  });

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(iso));

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Plattform-Audit-Protokoll</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Alle sicherheitsrelevanten Aktionen plattformweit — mandantenübergreifend
      </Typography>

      <Stack direction="row" spacing={2} mb={2}>
        <TextField
          select
          size="small"
          label="Aktion filtern"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          sx={{ width: 280 }}
        >
          <MenuItem value="">Alle Aktionen</MenuItem>
          {['worker.created','worker.status_changed','worker.aueg_override','shift.published','shift.cancelled',
            'assignment.created','invoice.created','invoice.status_changed','timesheet.approved','timesheet.disputed',
            'staff.invited','staff.status_changed','staff.removed','portal_access.granted','portal_access.revoked',
            'settings.agency_updated','tenant.status_changed'].map((a) => (
            <MenuItem key={a} value={a}>{a}</MenuItem>
          ))}
        </TextField>
      </Stack>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Fehler beim Laden</Alert>}
      {data && (
        <>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Zeit</TableCell>
                  <TableCell>Mandant</TableCell>
                  <TableCell>Aktion</TableCell>
                  <TableCell>Akteur</TableCell>
                  <TableCell>Ziel</TableCell>
                  <TableCell>IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.entries.map((e) => (
                  <TableRow key={e._id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12, color: 'text.secondary' }}>
                      {fmt(e.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Chip label={e.tenantName} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={e.action}
                        size="small"
                        color={ACTION_COLOR[e.action] ?? 'default'}
                        sx={{ fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{e.actorName}</Typography>
                      <Typography variant="caption" color="text.secondary">{e.actorRole}</Typography>
                    </TableCell>
                    <TableCell>
                      {e.targetName && <Typography variant="body2">{e.targetName}</Typography>}
                      <Typography variant="caption" color="text.secondary">{e.targetType}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{e.ip ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {data.pages > 1 && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <Pagination count={data.pages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'right' }}>
            {data.total.toLocaleString('de-DE')} Einträge gesamt
          </Typography>
        </>
      )}
    </Box>
  );
}
