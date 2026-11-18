import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GavelIcon from '@mui/icons-material/Gavel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DrawIcon from '@mui/icons-material/Draw';
import DownloadIcon from '@mui/icons-material/Download';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { contractsApi } from '../../api/contracts';

function SignatureCanvas({ onSave }: { onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const { t } = useTranslation();

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    drawing.current = true;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.preventDefault();
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1976d2';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    e.preventDefault();
  }

  function stop() {
    drawing.current = false;
    const canvas = canvasRef.current!;
    onSave(canvas.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    onSave('');
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" mb={1}>{t('contract.drawSignatureHint')}</Typography>
      <Box
        sx={{
          border: '2px dashed',
          borderColor: 'primary.main',
          borderRadius: 1,
          bgcolor: '#f8f9ff',
          position: 'relative',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          style={{ display: 'block', width: '100%', height: 160, cursor: 'crosshair' }}
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={stop}
        />
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ position: 'absolute', bottom: 6, left: 10, pointerEvents: 'none', userSelect: 'none' }}
        >
          {t('contract.signHere')}
        </Typography>
      </Box>
      <Button size="small" onClick={clear} sx={{ mt: 0.5 }}>{t('contract.clearSignature')}</Button>
    </Box>
  );
}

export default function WorkerContractPage() {
  const { t } = useTranslation();
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [signatureCanvas, setSignatureCanvas] = useState('');
  const [typedName, setTypedName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [useCanvas, setUseCanvas] = useState(true);

  const { data: contract, isLoading, error } = useQuery({
    queryKey: ['worker-contract', contractId],
    queryFn: () => contractsApi.myContract(contractId!),
    enabled: !!contractId,
  });

  const signMutation = useMutation({
    mutationFn: () => {
      const sigData = useCanvas ? signatureCanvas : typedName.trim();
      return contractsApi.sign(contractId!, sigData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-contract', contractId] });
      queryClient.invalidateQueries({ queryKey: ['worker-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['worker-shift'] });
      queryClient.invalidateQueries({ queryKey: ['worker-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['worker-me'] });
    },
  });

  const signError = signMutation.isError
    ? ((signMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.saveError'))
    : null;

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (error || !contract) return <Alert severity="error">{t('common.loadError')}</Alert>;

  const isSigned = contract.status === 'signed';
  const isVoided = contract.status === 'voided';
  const canSign = !isVoided && agreed && (useCanvas ? signatureCanvas.length > 100 : typedName.trim().length >= 2);

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('de-DE', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} size="small">
            {t('common.back')}
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700}>{t('contract.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{contract.shiftTitle} · {contract.businessName}</Typography>
          </Box>
        </Stack>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          component="a"
          href={`/api/worker-portal/contracts/${contractId}/pdf`}
          target="_blank"
          rel="noopener"
        >
          PDF herunterladen
        </Button>
      </Stack>

      {isSigned && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
          <Typography fontWeight={600}>{t('contract.alreadySigned')}</Typography>
          <Typography variant="caption">
            {t('contract.signedAt')}: {fmtDateTime(contract.signedAt!)}
            {contract.signatureData && !contract.signatureData.startsWith('data:image') && (
              <> — {t('contract.signedAs')}: <strong>{contract.signatureData}</strong></>
            )}
          </Typography>
        </Alert>
      )}

      {isVoided && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography fontWeight={600}>{t('contract.voided')}</Typography>
          <Typography variant="body2">{t('contract.voidedReason')}</Typography>
        </Alert>
      )}

      {/* Contract body */}
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 }, mb: 3, overflowX: 'auto' }}>
        <div dangerouslySetInnerHTML={{ __html: contract.contractHtml }} />
      </Paper>

      {/* Signature section */}
      {!isSigned && !isVoided && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
            <GavelIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>{t('contract.signSection')}</Typography>
          </Stack>

          <Stack direction="row" spacing={1} mb={2}>
            <Button
              size="small"
              variant={useCanvas ? 'contained' : 'outlined'}
              startIcon={<DrawIcon />}
              onClick={() => setUseCanvas(true)}
            >
              {t('contract.drawSignature')}
            </Button>
            <Button
              size="small"
              variant={!useCanvas ? 'contained' : 'outlined'}
              onClick={() => setUseCanvas(false)}
            >
              {t('contract.typeSignature')}
            </Button>
          </Stack>

          {useCanvas ? (
            <SignatureCanvas onSave={setSignatureCanvas} />
          ) : (
            <TextField
              fullWidth
              label={t('contract.typeYourName')}
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              helperText={t('contract.typeNameHint')}
              sx={{ fontStyle: 'italic' }}
            />
          )}

          <Divider sx={{ my: 2.5 }} />

          <FormControlLabel
            control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} color="primary" />}
            label={
              <Typography variant="body2">
                {t('contract.agreeLabel', { agencyName: contract.agencyName })}
              </Typography>
            }
          />

          {signError && (
            <Alert severity="error" sx={{ mt: 2 }}>{signError}</Alert>
          )}

          <Button
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            startIcon={<GavelIcon />}
            disabled={!canSign || signMutation.isPending}
            onClick={() => signMutation.mutate()}
            sx={{ mt: 2 }}
          >
            {signMutation.isPending ? t('common.loading') : t('contract.signAndConfirm')}
          </Button>

          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={1}>
            {t('contract.legalNote')}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
