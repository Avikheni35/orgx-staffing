import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import { APP_STAFFING } from '@/config/brand';
import { Outlet, Navigate, Link as RouterLink } from 'react-router-dom';
import { Link } from '@mui/material';
import { useAuthStore } from '../stores/authStore';
import { portalHome } from '../types';

export default function AuthLayout() {
  const { isAuthenticated, isInitializing, user } = useAuthStore();

  if (isInitializing) return null;

  if (isAuthenticated && user) {
    return <Navigate to={portalHome(user.role)} replace />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f1f5f9',
        py: 4,
        px: 2,
      }}
    >
      {/* Brand header */}
      <Stack direction="row" alignItems="center" spacing={1.5} mb={4}>
        <Box sx={{
          width: 40, height: 40, borderRadius: 1.5,
          background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BusinessCenterIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1} color="#0f172a">
            {APP_STAFFING}
          </Typography>
          <Typography variant="caption" color="text.disabled" lineHeight={1}>
            Personalvermittlung
          </Typography>
        </Box>
      </Stack>

      <Container maxWidth="sm" disableGutters>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            bgcolor: 'background.paper',
          }}
        >
          <Outlet />
        </Paper>
      </Container>

      {/* Footer */}
      <Stack direction="row" spacing={2} mt={4} flexWrap="wrap" justifyContent="center">
        <Link component={RouterLink} to="/impressum" variant="caption" color="text.disabled" underline="hover">Impressum</Link>
        <Link component={RouterLink} to="/datenschutz" variant="caption" color="text.disabled" underline="hover">Datenschutz</Link>
        <Link component={RouterLink} to="/agb" variant="caption" color="text.disabled" underline="hover">AGB</Link>
      </Stack>
    </Box>
  );
}
