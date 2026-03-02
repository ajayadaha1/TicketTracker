import { Box, Paper, Typography } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';

export default function ChangeGearPage() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
      }}
    >
      <Paper sx={{ p: 5, textAlign: 'center', maxWidth: 500 }}>
        <BuildIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          ChangeGear Tickets
        </Typography>
        <Typography variant="body1" color="text.secondary">
          ChangeGear integration coming soon. This will allow you to manage
          and update ChangeGear tickets directly from TicketTracker.
        </Typography>
      </Paper>
    </Box>
  );
}
