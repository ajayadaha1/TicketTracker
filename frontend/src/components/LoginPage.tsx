import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Typography,
  Alert,
} from '@mui/material';
import { apiService } from '../services/api';
import { useAuthStore } from '../services/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If already authenticated, redirect to home
    if (isAuthenticated()) {
      navigate('/', { replace: true });
      return;
    }

    // Check for callback parameters
    const token = searchParams.get('token');
    const displayName = searchParams.get('display_name');
    const errorParam = searchParams.get('error');
    const expired = searchParams.get('expired');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    if (token) {
      setLoading(true);
      // We have a token from the OAuth callback - fetch user info
      localStorage.setItem('tt_auth_token', token);
      apiService
        .getCurrentUser()
        .then((user) => {
          setAuth(user, token);
          navigate('/', { replace: true });
        })
        .catch(() => {
          setError('Failed to get user information');
          localStorage.removeItem('tt_auth_token');
        })
        .finally(() => setLoading(false));
      return;
    }

    // Session expired - auto-trigger silent re-auth via OAuth
    if (expired === 'true') {
      setLoading(true);
      apiService
        .getAuthUrl()
        .then(({ auth_url }) => {
          window.location.href = auth_url;
        })
        .catch(() => {
          setError('Session expired. Please log in again.');
          setLoading(false);
        });
    }
  }, [searchParams, navigate, setAuth, isAuthenticated]);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { auth_url } = await apiService.getAuthUrl();
      window.location.href = auth_url;
    } catch {
      setError('Failed to initiate login');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            p: 5,
            textAlign: 'center',
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            TicketTracker
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Login to manage Jira ticket labels and comments
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            size="large"
            onClick={handleLogin}
            disabled={loading}
            sx={{ px: 4, py: 1.5 }}
          >
            Login with Atlassian
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}
