import { Box, Chip, Typography } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import { useAuthStore } from '../../stores/authStore';

interface Props {
  title: string;
}

export default function PlaceholderDashboard({ title }: Props) {
  const { user } = useAuthStore();
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h5">{title}</Typography>
        <Chip icon={<BuildIcon />} label="In Entwicklung" size="small" color="warning" />
      </Box>
      <Typography color="text.secondary">
        Willkommen, {user?.firstName} {user?.lastName}. Dieses Modul wird in der nächsten Phase implementiert.
      </Typography>
    </Box>
  );
}
