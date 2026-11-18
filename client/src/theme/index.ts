import { createTheme } from '@mui/material/styles';
import type { PaletteOptions } from '@mui/material/styles';

const palette: PaletteOptions = {
  primary: { main: '#1976d2' },
  secondary: { main: '#7c3aed' },
  error: { main: '#dc2626' },
  warning: { main: '#d97706' },
  success: { main: '#16a34a' },
  background: {
    default: '#f8fafc',
    paper: '#ffffff',
  },
};

export const theme = createTheme({
  palette,
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: '1px solid #e2e8f0' },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderBottom: '1px solid #e2e8f0' },
      },
    },
  },
});
