import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  AvatarGroup,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { clientPortalApi, ClientShift } from '../../api/clientPortal';

type TabKey = 'upcoming' | 'past';

const STATUS_COLOR: Record<string, 'default' | 'primary' | 'success' | 'error'> = {
  published: 'primary',
  completed: 'success',
  cancelled: 'error',
  draft: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  published: 'Geplant',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  draft: 'Entwurf',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function durationHours(shift: ClientShift) {
  const ms = new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime();
  const net = ms / 3600000 - shift.breakMinutes / 60;
  return net.toFixed(1) + ' h';
}

export default function ClientShiftsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('upcoming');

  const { data: shifts, isLoading, error } = useQuery({
    queryKey: ['client-shifts', tab],
    queryFn: () => clientPortalApi.shifts(tab),
  });

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>Schichten</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Bevorstehend" value="upcoming" />
        <Tab label="Vergangen" value="past" />
      </Tabs>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Fehler beim Laden.</Alert>}

      {shifts && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Schicht</TableCell>
                <TableCell>Beginn</TableCell>
                <TableCell>Ende</TableCell>
                <TableCell>Dauer</TableCell>
                <TableCell>Mitarbeiter</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    {tab === 'upcoming' ? 'Keine bevorstehenden Schichten.' : 'Keine vergangenen Schichten.'}
                  </TableCell>
                </TableRow>
              ) : (
                shifts.map((shift) => (
                  <TableRow
                    key={shift._id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/client/shifts/${shift._id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{shift.title}</Typography>
                      {shift.locationName && (
                        <Typography variant="caption" color="text.secondary">{shift.locationName}</Typography>
                      )}
                    </TableCell>
                    <TableCell>{fmtDate(shift.startTime)}</TableCell>
                    <TableCell>{fmtDate(shift.endTime)}</TableCell>
                    <TableCell>{durationHours(shift)}</TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: 11 } }}>
                          {shift.assignedWorkers.map((w) => (
                            <Tooltip key={w.workerId} title={w.workerName}>
                              <Avatar>{w.workerName[0]}</Avatar>
                            </Tooltip>
                          ))}
                        </AvatarGroup>
                        <Typography variant="caption" color="text.secondary">
                          {shift.assignedWorkers.length}/{shift.requiredWorkers}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_LABEL[shift.status] ?? shift.status}
                        color={STATUS_COLOR[shift.status]}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
