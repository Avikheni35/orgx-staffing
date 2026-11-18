import { Box, Typography, Button } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';

export default function MaintenancePage() {
  return (
    <Box
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={3}
      sx={{ bgcolor: 'background.default', px: 3, textAlign: 'center' }}
    >
      <BuildIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
      <Box>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Wartungsarbeiten
        </Typography>
        <Typography variant="body1" color="text.secondary" maxWidth={440}>
          Die Plattform wird gerade gewartet. Wir sind in Kürze wieder für Sie da.
          Bitte versuchen Sie es in einigen Minuten erneut.
        </Typography>
      </Box>
      <Button variant="outlined" onClick={() => window.location.reload()}>
        Seite neu laden
      </Button>
    </Box>
  );
}
