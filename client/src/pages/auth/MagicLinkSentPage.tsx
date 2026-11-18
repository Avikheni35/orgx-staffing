import { Box, Button, Stack, Typography } from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';

export default function MagicLinkSentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string })?.email ?? '';

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      bgcolor: '#f1f5f9', px: 3,
    }}>
      <Box sx={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <Box sx={{
          width: 80, height: 80, borderRadius: '50%',
          bgcolor: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
          mx: 'auto', mb: 3,
        }}>
          <MarkEmailReadIcon sx={{ fontSize: 42, color: '#fff' }} />
        </Box>

        <Typography variant="h5" fontWeight={700} gutterBottom>
          {t('auth.magicLinkSent.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={1}>
          {t('auth.magicLinkSent.description', { email: email || '…' })}
        </Typography>
        {email && (
          <Typography variant="body2" fontWeight={600} color="primary.main" mb={3}>
            {email}
          </Typography>
        )}
        <Typography variant="caption" color="text.disabled" display="block" mb={4}>
          Bitte prüfen Sie auch Ihren Spam-Ordner. Der Link ist 30 Minuten gültig.
        </Typography>

        <Stack spacing={1.5}>
          <Button
            variant="outlined" fullWidth size="large"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/login')}
          >
            {t('auth.magicLinkSent.back')}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
