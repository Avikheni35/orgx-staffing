import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
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
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import { workersApi, type Worker } from '../../../api/workers';
import apiClient from '../../../api/client';

const STATUS_COLOR: Record<Worker['status'], 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  active: 'success',
  pending_review: 'warning',
  inactive: 'default',
  suspended: 'error',
  blacklisted: 'error',
  anonymized: 'default',
};

export default function WorkerInvitePage() {
  const [search, setSearch] = useState('');
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const { data: agencyData } = useQuery({
    queryKey: ['agency-settings-logincode'],
    queryFn: () => apiClient.get<{ loginCode: string }>('/settings/agency').then((r) => r.data),
  });

  const registrationUrl = agencyData?.loginCode
    ? `${window.location.origin}/register/${agencyData.loginCode}`
    : null;

  const copyLink = () => {
    if (!registrationUrl) return;
    navigator.clipboard.writeText(registrationUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['workers-invite-list', search],
    queryFn: () => workersApi.list({ limit: 50, search, status: 'active' }),
    placeholderData: (prev) => prev,
  });

  const inviteMutation = useMutation({
    mutationFn: (workerId: string) => workersApi.sendInvite(workerId),
    onSuccess: (_data, workerId) => {
      setSent((prev) => new Set(prev).add(workerId));
      setErrors((prev) => { const n = { ...prev }; delete n[workerId]; return n; });
    },
    onError: (_err, workerId) => {
      setErrors((prev) => ({ ...prev, [workerId]: 'Fehler beim Senden' }));
    },
  });

  const workers = data?.workers ?? [];
  const noPortalAccess = workers.filter((w) => !w.userId);
  const withPortalAccess = workers.filter((w) => !!w.userId);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Registrierungslink senden</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Sende aktiven Mitarbeitern einen Magic-Link, damit sie sich im Worker-Portal registrieren können.
      </Typography>

      {/* Self-registration link */}
      {registrationUrl && (
        <Alert
          icon={<LinkIcon />}
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button size="small" startIcon={<ContentCopyIcon />} onClick={copyLink} color="inherit">
              {copied ? 'Kopiert!' : 'Kopieren'}
            </Button>
          }
        >
          <Typography variant="body2" fontWeight={600} gutterBottom>Selbstregistrierungs-Link</Typography>
          <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>{registrationUrl}</Typography>
        </Alert>
      )}

      <TextField
        placeholder="Name oder E-Mail suchen…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ mb: 3, width: 340 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Fehler beim Laden der Mitarbeiter</Alert>}

      {data && (
        <>
          {/* Workers without portal access */}
          <Typography variant="subtitle2" fontWeight={700} mb={1}>
            Ohne Portal-Zugang ({noPortalAccess.length})
          </Typography>
          {noPortalAccess.length === 0 ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              Alle aktiven Mitarbeiter haben bereits einen Portal-Zugang oder es wurden keine gefunden.
            </Alert>
          ) : (
            <TableContainer component={Paper} sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Mitarbeiter</TableCell>
                    <TableCell>E-Mail</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Aktion</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {noPortalAccess.map((w) => (
                    <TableRow key={w._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {w.firstName} {w.lastName}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{w.email}</TableCell>
                      <TableCell>
                        <Chip label={w.status} size="small" color={STATUS_COLOR[w.status]} />
                      </TableCell>
                      <TableCell align="right">
                        {sent.has(w._id) ? (
                          <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="flex-end">
                            <CheckCircleIcon color="success" fontSize="small" />
                            <Typography variant="caption" color="success.main">Gesendet</Typography>
                          </Stack>
                        ) : (
                          <Stack alignItems="flex-end" spacing={0.5}>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<SendIcon />}
                              onClick={() => inviteMutation.mutate(w._id)}
                              disabled={inviteMutation.isPending}
                            >
                              Link senden
                            </Button>
                            {errors[w._id] && (
                              <Typography variant="caption" color="error">{errors[w._id]}</Typography>
                            )}
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Workers already with portal access */}
          {withPortalAccess.length > 0 && (
            <>
              <Typography variant="subtitle2" fontWeight={700} mb={1} color="text.secondary">
                Bereits registriert ({withPortalAccess.length})
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Mitarbeiter</TableCell>
                      <TableCell>E-Mail</TableCell>
                      <TableCell align="right">Aktion</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {withPortalAccess.map((w) => (
                      <TableRow key={w._id} hover sx={{ opacity: 0.7 }}>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <CheckCircleIcon color="success" fontSize="small" />
                            <Typography variant="body2">{w.firstName} {w.lastName}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{w.email}</TableCell>
                        <TableCell align="right">
                          {sent.has(w._id) ? (
                            <Typography variant="caption" color="success.main">Erneut gesendet ✓</Typography>
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<SendIcon />}
                              onClick={() => inviteMutation.mutate(w._id)}
                              disabled={inviteMutation.isPending}
                            >
                              Erneut senden
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </>
      )}
    </Box>
  );
}
