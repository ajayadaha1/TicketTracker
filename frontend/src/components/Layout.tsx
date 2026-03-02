import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import HistoryIcon from '@mui/icons-material/History';
import { useAuthStore } from '../services/auth';
import { apiService } from '../services/api';
import ActivityLogDrawer from './ActivityLogDrawer';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false);

  const tabMap: Record<string, number> = { '/': 0, '/changegear': 1, '/analytics': 2 };
  const currentTab = tabMap[location.pathname] ?? 0;

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    const paths = ['/', '/changegear', '/analytics'];
    navigate(paths[newValue]);
  };

  const handleLogout = async () => {
    await apiService.logout();
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700, mr: 4 }}>
            TicketTracker
          </Typography>

          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            sx={{ flexGrow: 1 }}
          >
            <Tab label="Jira Tickets" />
            <Tab label="ChangeGear Tickets" />
            <Tab label="Analytics" />
          </Tabs>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={() => setActivityDrawerOpen(true)}
              sx={{ fontSize: '0.8rem' }}
            >
              Activity Log
            </Button>
            {user && (
              <>
                <Avatar
                  src={user.avatar_url}
                  alt={user.display_name}
                  sx={{ width: 32, height: 32 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {user.display_name}
                </Typography>
              </>
            )}
            <Button
              size="small"
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Outlet />
      </Box>

      <ActivityLogDrawer
        open={activityDrawerOpen}
        onClose={() => setActivityDrawerOpen(false)}
      />
    </Box>
  );
}
