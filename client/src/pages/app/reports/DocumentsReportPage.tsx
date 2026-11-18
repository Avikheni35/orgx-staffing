import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  MenuItem,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { reportsApi, DocumentReportRow, ReportDocument } from '../../../api/reports';

const CATEGORY_LABEL: Record<string, string> = {
  identity: 'Ausweis / Pass',
  work_permit: 'Arbeitserlaubnis',
  health_certificate: 'Gesundheitszeugnis',
  contract: 'Vertrag',
  other: 'Sonstiges',
};

function urgencyColor(daysLeft: number): 'error' | 'warning' | 'default' {
  if (daysLeft < 0) return 'error';
  if (daysLeft <= 14) return 'error';
  if (daysLeft <= 30) return 'warning';
  return 'default';
}

function urgencyIcon(daysLeft: number) {
  if (daysLeft < 0) return <ErrorIcon fontSize="small" color="error" />;
  if (daysLeft <= 14) return <WarningAmberIcon fontSize="small" color="error" />;
  if (daysLeft <= 30) return <WarningAmberIcon fontSize="small" color="warning" />;
  return <CheckCircleIcon fontSize="small" color="disabled" />;
}

function daysLabel(daysLeft: number) {
  if (daysLeft < 0) return `Abgelaufen (${Math.abs(daysLeft)} Tage)`;
  if (daysLeft === 0) return 'Läuft heute ab';
  return `Noch ${daysLeft} Tag${daysLeft === 1 ? '' : 'e'}`;
}

function WorkerRow({ row }: { row: DocumentReportRow }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(row.hasExpired || row.minDaysLeft <= 14);

  return (
    <>
      <TableRow
        sx={{
          bgcolor: row.hasExpired
            ? 'error.50'
            : row.minDaysLeft <= 14
            ? 'warning.50'
            : 'inherit',
          '& > *': { borderBottom: 'unset' },
        }}
      >
        <TableCell sx={{ width: 40, pr: 0 }}>
          <IconButton size="small" onClick={() => setOpen((o) => !o)}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={1} alignItems="center">
            {urgencyIcon(row.minDaysLeft)}
            <Box>
              <Typography variant="body2" fontWeight={500}>
                {row.firstName} {row.lastName}
              </Typography>
              {row.nationality && (
                <Typography variant="caption" color="text.secondary">{row.nationality}</Typography>
              )}
            </Box>
          </Stack>
        </TableCell>
        <TableCell>
          <Chip
            label={row.hasExpired ? 'Abgelaufen' : daysLabel(row.minDaysLeft)}
            size="small"
            color={urgencyColor(row.minDaysLeft)}
          />
        </TableCell>
        <TableCell>
          <Typography variant="body2">{row.documents.length} Dokument{row.documents.length !== 1 ? 'e' : ''}</Typography>
        </TableCell>
        <TableCell align="right">
          <Tooltip title="Mitarbeiter öffnen">
            <IconButton size="small" onClick={() => navigate(`/app/workers/${row.workerId}`)}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ py: 0 }}>
          <Collapse in={open}>
            <Box sx={{ py: 1.5, pl: 7 }}>
              <Stack spacing={1}>
                {row.documents.map((doc: ReportDocument) => (
                  <Stack key={doc._id} direction="row" spacing={2} alignItems="center">
                    <Chip
                      label={CATEGORY_LABEL[doc.category] ?? doc.category}
                      size="small"
                      variant="outlined"
                      sx={{ minWidth: 160 }}
                    />
                    <Typography variant="body2" sx={{ flex: 1 }}>{doc.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(doc.expiryDate).toLocaleDateString('de-DE')}
                    </Typography>
                    <Chip
                      label={daysLabel(doc.daysLeft)}
                      size="small"
                      color={urgencyColor(doc.daysLeft)}
                      variant={doc.expired ? 'filled' : 'outlined'}
                    />
                    {doc.verified ? (
                      <Chip label="Geprüft" size="small" color="success" variant="outlined" />
                    ) : (
                      <Chip label="Ungeprüft" size="small" variant="outlined" />
                    )}
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

const HORIZON_OPTIONS = [
  { value: 14, label: '14 Tage' },
  { value: 30, label: '30 Tage' },
  { value: 60, label: '60 Tage' },
  { value: 90, label: '90 Tage' },
];

export default function DocumentsReportPage() {
  const [days, setDays] = useState(60);

  const { data, isLoading, error } = useQuery({
    queryKey: ['report-documents', days],
    queryFn: () => reportsApi.getDocuments(days),
  });

  const expired = data?.rows.filter((r) => r.hasExpired) ?? [];
  const expiringSoon = data?.rows.filter((r) => !r.hasExpired && r.minDaysLeft <= 30) ?? [];
  const upcoming = data?.rows.filter((r) => !r.hasExpired && r.minDaysLeft > 30) ?? [];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Ablaufende Dokumente
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Nur aktive und in Prüfung befindliche Mitarbeiter · Nur Dokumente mit Ablaufdatum
          </Typography>
        </Box>
        <TextField
          select
          label="Zeitraum"
          size="small"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          sx={{ minWidth: 130 }}
        >
          {HORIZON_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
      </Stack>

      {/* Legal notice */}
      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Rechtlicher Hinweis (§ 404 SGB III · AÜG § 1)
        </Typography>
        <Typography variant="body2">
          Die Beschäftigung von Mitarbeitenden mit abgelaufener Arbeitserlaubnis oder abgelaufenem Aufenthaltstitel
          ist eine Ordnungswidrigkeit und kann mit Bußgeldern bis zu 500.000 € geahndet werden.
          Stellen Sie sicher, dass alle relevanten Dokumente rechtzeitig erneuert werden.
        </Typography>
      </Alert>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Fehler beim Laden des Berichts.</Alert>}

      {data && data.total === 0 && (
        <Alert severity="success">
          Keine ablaufenden Dokumente im gewählten Zeitraum von {days} Tagen.
        </Alert>
      )}

      {data && data.total > 0 && (
        <TableContainer component={Paper}>
          {/* Expired section */}
          {expired.length > 0 && (
            <>
              <Box sx={{ px: 2, py: 1.5, bgcolor: 'error.50' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ErrorIcon color="error" fontSize="small" />
                  <Typography variant="subtitle2" color="error.main" fontWeight={700}>
                    ABGELAUFEN — {expired.length} Mitarbeiter · Sofortiger Handlungsbedarf
                  </Typography>
                </Stack>
              </Box>
              <Divider />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 40 }} />
                    <TableCell>Mitarbeiter</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Dokumente</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expired.map((row) => <WorkerRow key={row.workerId} row={row} />)}
                </TableBody>
              </Table>
            </>
          )}

          {/* Expiring within 30 days */}
          {expiringSoon.length > 0 && (
            <>
              {expired.length > 0 && <Divider />}
              <Box sx={{ px: 2, py: 1.5, bgcolor: 'warning.50' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <WarningAmberIcon color="warning" fontSize="small" />
                  <Typography variant="subtitle2" color="warning.dark" fontWeight={700}>
                    LÄUFT BALD AB (≤ 30 Tage) — {expiringSoon.length} Mitarbeiter
                  </Typography>
                </Stack>
              </Box>
              <Divider />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 40 }} />
                    <TableCell>Mitarbeiter</TableCell>
                    <TableCell>Verbleibend</TableCell>
                    <TableCell>Dokumente</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expiringSoon.map((row) => <WorkerRow key={row.workerId} row={row} />)}
                </TableBody>
              </Table>
            </>
          )}

          {/* Upcoming (31–horizon days) */}
          {upcoming.length > 0 && (
            <>
              {(expired.length > 0 || expiringSoon.length > 0) && <Divider />}
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>
                  DEMNÄCHST (31–{days} Tage) — {upcoming.length} Mitarbeiter
                </Typography>
              </Box>
              <Divider />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 40 }} />
                    <TableCell>Mitarbeiter</TableCell>
                    <TableCell>Verbleibend</TableCell>
                    <TableCell>Dokumente</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {upcoming.map((row) => <WorkerRow key={row.workerId} row={row} />)}
                </TableBody>
              </Table>
            </>
          )}
        </TableContainer>
      )}
    </Box>
  );
}
