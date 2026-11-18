import { Box, Container, IconButton, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function LegalPage({ title, children }: Props) {
  const navigate = useNavigate();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 6 }}>
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
          <Tooltip title="Zurück">
            <IconButton onClick={() => navigate(-1)} size="small">
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="h5" fontWeight={600}>{title}</Typography>
        </Box>
        <Box
          sx={{
            '& h2': { mt: 4, mb: 1, fontSize: '1.1rem', fontWeight: 600 },
            '& p':  { mb: 1.5, color: 'text.secondary', lineHeight: 1.7 },
            '& ul': { pl: 3, mb: 1.5, color: 'text.secondary' },
            '& li': { mb: 0.5, lineHeight: 1.7 },
            '& strong': { color: 'text.primary' },
          }}
        >
          {children}
        </Box>
      </Container>
    </Box>
  );
}
