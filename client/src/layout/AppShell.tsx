import React from 'react';
import { AppBar, Toolbar, Box, IconButton, Typography, Tooltip, Avatar } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import logo from '../assets/logo.svg';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeModeContext';

const drawerWidth = 280;
const appBarHeight = 64;

export default function AppShell() {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const { user, hasAnyRole } = useAuth();
  const { mode, toggle } = useThemeMode();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleToggleSidebar = () => setMobileOpen((v) => !v);
  const handleCloseSidebar = () => setMobileOpen(false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <AppBar position="fixed" color="default" elevation={0}>
        <Toolbar sx={{ height: appBarHeight, minHeight: appBarHeight, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Toggle only on small screens */}
            {!mdUp && (
              <IconButton onClick={handleToggleSidebar} sx={{ mr: 1 }} aria-label="Открыть меню">
                <MenuIcon />
              </IconButton>
            )}
            <Box component="img" src={logo} alt="logo" sx={{ height: 24, width: 24, mr: 1, filter: 'brightness(1.2)' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
              Character CRM
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={mode === 'dark' ? 'Тёмная тема' : 'Светлая тема'}>
              <IconButton aria-label="Переключить режим темы" onClick={toggle} sx={{ mr: 1 }}>
                {mode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
              </IconButton>
            </Tooltip>
            <IconButton aria-label="Профиль">
              <Avatar sx={{ width: 32, height: 32 }}>
                {(user?.email || user?.name || 'U').slice(0, 1).toUpperCase()}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar: persistent on md+, temporary on sm- */}
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={handleCloseSidebar}
        hasRole={(role) => hasAnyRole([role]) || hasAnyRole(['Admin'])}
      />

      {/* Content area */}
      <Box
        component="main"
        sx={{
          mt: `${appBarHeight}px`,
          ml: mdUp ? `${drawerWidth}px` : 0,
          width: mdUp ? `calc(100% - ${drawerWidth}px)` : '100%',
          minHeight: `calc(100dvh - ${appBarHeight}px)`,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          transition: 'margin-left 200ms ease, width 200ms ease',
        }}
      >
        <Box sx={{ maxWidth: 1440, mx: 'auto', px: 2, width: '100%' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}