import { Component, type ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err?.message ?? 'Unknown error' };
  }

  componentDidCatch(err: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', err, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Box
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: 2, px: 3, textAlign: 'center',
        }}
      >
        <Typography variant="h5" fontWeight={700}>Something went wrong</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
          {this.state.message}
        </Typography>
        <Button variant="outlined" onClick={() => window.location.reload()}>Reload page</Button>
      </Box>
    );
  }
}
