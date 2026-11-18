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
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EmailIcon from '@mui/icons-material/Email';
import { useAuthStore } from '../../../stores/authStore';
import { staffApi, StaffMember, StaffRole, StaffStatus } from '../../../api/staff';

const ROLE_LABEL: Record<StaffRole, string> = {
  agency_admin: 'Administrator',
  disponent: 'Disponent',
};

const STATUS_COLOR: Record<StaffStatus, 'success' | 'default' | 'error'> = {
  active: 'success',
  inactive: 'default',
  suspended: 'error',
};

const STATUS_LABEL: Record<StaffStatus, string> = {
  active: 'Aktiv',
  inactive: 'Eingeladen',
  suspended: 'Gesperrt',
};

function initials(m: StaffMember) {
  if (m.firstName && m.lastName) return `${m.firstName[0]}${m.lastName[0]}`;
  return m.email[0].toUpperCase();
}

function displayName(m: StaffMember) {
  const name = `${m.firstName} ${m.lastName}`.trim();
  return name || '(Einladung ausstehend)';
}

export default function StaffListPage() {
  const queryClient = useQueryClient();
  const { user: me } = useAuthStore();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('disponent');
  const [inviteError, setInviteError] = useState('');

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuMember, setMenuMember] = useState<StaffMember | null>(null);

  const { data: staff, isLoading, error } = useQuery({
    queryKey: ['staff'],
    queryFn: staffApi.list,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff'] });

  const inviteMutation = useMutation({
    mutationFn: () => staffApi.invite(email, role),
    onSuccess: () => { invalidate(); setInviteOpen(false); setEmail(''); setRole('disponent'); setInviteError(''); },
    onError: (err: unknown) => {
      setInviteError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Fehler beim Einladen');
    },
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => staffApi.resendInvite(id),
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StaffStatus }) => staffApi.setStatus(id, status),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => staffApi.remove(id),
    onSuccess: invalidate,
  });

  const openMenu = (e: React.MouseEvent<HTMLElement>, member: StaffMember) => {
    setMenuAnchor(e.currentTarget);
    setMenuMember(member);
  };
  const closeMenu = () => { setMenuAnchor(null); setMenuMember(null); };

  const fmt = (iso?: string) => iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Team verwalten</Typography>
          <Typography variant="body2" color="text.secondary">
            Administratoren und Disponenten dieser Agentur
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setInviteOpen(true)}>
          Mitarbeiter einladen
        </Button>
      </Stack>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Fehler beim Laden.</Alert>}

      {staff && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>E-Mail</TableCell>
                <TableCell>Rolle</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Letzter Login</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    Noch keine Teammitglieder. Laden Sie jetzt jemanden ein.
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((m) => {
                  const isMe = m._id === me?.id;
                  return (
                    <TableRow key={m._id} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'primary.main' }}>
                            {initials(m)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {displayName(m)}
                              {isMe && (
                                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                                  (Sie)
                                </Typography>
                              )}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{m.email}</TableCell>
                      <TableCell>
                        <Chip label={ROLE_LABEL[m.role]} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Chip
                            label={STATUS_LABEL[m.status]}
                            color={STATUS_COLOR[m.status]}
                            size="small"
                          />
                          {!m.emailVerified && m.status === 'inactive' && (
                            <Tooltip title="Einladung erneut senden">
                              <IconButton
                                size="small"
                                onClick={() => resendMutation.mutate(m._id)}
                                disabled={resendMutation.isPending}
                              >
                                <EmailIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>{fmt(m.lastLoginAt)}</TableCell>
                      <TableCell padding="checkbox">
                        {!isMe && (
                          <IconButton size="small" onClick={(e) => openMenu(e, m)}>
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Context menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        {menuMember && menuMember.status !== 'active' && (
          <MenuItem onClick={() => { statusMutation.mutate({ id: menuMember._id, status: 'active' }); closeMenu(); }}>
            Aktivieren
          </MenuItem>
        )}
        {menuMember && menuMember.status === 'active' && (
          <MenuItem onClick={() => { statusMutation.mutate({ id: menuMember._id, status: 'suspended' }); closeMenu(); }}>
            Sperren
          </MenuItem>
        )}
        {menuMember && menuMember.status === 'suspended' && (
          <MenuItem onClick={() => { statusMutation.mutate({ id: menuMember._id, status: 'active' }); closeMenu(); }}>
            Entsperren
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => { if (menuMember) removeMutation.mutate(menuMember._id); closeMenu(); }}
        >
          Entfernen
        </MenuItem>
      </Menu>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onClose={() => { setInviteOpen(false); setInviteError(''); }} maxWidth="xs" fullWidth>
        <DialogTitle>Teammitglied einladen</DialogTitle>
        <DialogContent>
          {inviteError && <Alert severity="error" sx={{ mb: 2 }}>{inviteError}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="E-Mail-Adresse"
              type="email"
              required
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <FormControl fullWidth>
              <InputLabel>Rolle</InputLabel>
              <Select
                value={role}
                label="Rolle"
                onChange={(e) => setRole(e.target.value as StaffRole)}
              >
                <MenuItem value="disponent">Disponent</MenuItem>
                <MenuItem value="agency_admin">Administrator</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">
              Die eingeladene Person erhält eine E-Mail mit einem Aktivierungslink.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setInviteOpen(false); setInviteError(''); }}>Abbrechen</Button>
          <Button
            variant="contained"
            startIcon={<EmailIcon />}
            disabled={!email || inviteMutation.isPending}
            onClick={() => inviteMutation.mutate()}
          >
            {inviteMutation.isPending ? 'Senden...' : 'Einladen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
