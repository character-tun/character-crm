import React, { useState, useEffect, useMemo } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import InventoryIcon from '@mui/icons-material/Inventory';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PaymentIcon from '@mui/icons-material/Payment';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import StorefrontIcon from '@mui/icons-material/Storefront';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import Avatar from '@mui/material/Avatar';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import DescriptionIcon from '@mui/icons-material/Description';
import NotificationsIcon from '@mui/icons-material/Notifications';
import logo from '../assets/logo.svg';
import Sidebar from '../layout/Sidebar';
import useMediaQuery from '@mui/material/useMediaQuery';
// lucide icons for Linear-style sidebar
import { LayoutDashboard, Calendar as CalendarIconLucide, ShoppingCart as ShoppingCartLucide, CreditCard, Users as UsersLucide, BarChart2, Settings as SettingsLucide, Briefcase, Folder, Zap, Wand2, CheckCircle2 } from 'lucide-react';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useThemeMode } from '../context/ThemeModeContext';

const drawerWidth = 280;
const WIDTH_LG = 260;
const WIDTH_MD_MINI = 80;

// AppBarStyled removed; using standard AppBar position="sticky"

const StyledDrawer = styled(Drawer)(() => ({
  width: drawerWidth,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    boxSizing: 'border-box',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    borderRight: '1px solid var(--color-border)'
  },
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2, 2),
  ...theme.mixins.toolbar,
  justifyContent: 'space-between',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-text)',
  height: '70px',
}));

const StyledListItem = styled(ListItem)(({ theme, selected }) => ({
  margin: '4px 0',
  padding: '0 8px',
  '& .MuiListItemButton-root': {
    position: 'relative',
    borderRadius: '8px',
    padding: '8px 16px',
    '&:hover': {
      backgroundColor: 'var(--color-surfaceAlt)',
    },
    ...(selected && {
      backgroundColor: 'var(--color-surfaceAlt)',
      '&::before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: '12%',
        bottom: '12%',
        width: '2px',
        borderRadius: '2px',
        backgroundColor: 'var(--color-primary)'
      },
      '&:hover': {
        backgroundColor: 'var(--color-surfaceAlt)',
      },
    }),
  },
  '& .MuiListItemIcon-root': {
    minWidth: '40px',
    color: selected ? 'var(--color-text)' : 'var(--color-textMuted)'
  },
  '& .MuiListItemText-primary': {
    fontSize: '14px',
    fontWeight: selected ? '700' : '400',
    color: selected ? 'var(--color-text)' : 'var(--color-textMuted)'
  },
}));

const RBAC_MENU = {
  '/': null,
  '/tasks': ['Admin','Manager','Employee'],
  '/orders': ['Admin','Manager'],
  '/payments': ['Admin','Finance'],
  '/clients': ['Admin','Manager'],
  '/marketing': ['Admin','Manager'],
  '/services': ['Admin','Manager'],
  '/production': ['Admin','Manager'],
  '/inventory': ['Admin','Manager'],
  '/shop': ['Admin','Manager'],
  '/settings': ['Admin'],
};

export default function Layout({ children }) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasAnyRole } = useAuth();
  const { mode, toggle } = useThemeMode();
  const [profileAnchor, setProfileAnchor] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [activeKey, setActiveKey] = useState(null);

  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const isSmDown = useMediaQuery(theme.breakpoints.down('md'));
  const isMdOnly = !isLgUp && !isSmDown;
  const sidebarOffset = isLgUp ? WIDTH_LG : isMdOnly ? WIDTH_MD_MINI : 0;
  // динамическая высота AppBar: 56px на xs/sm, 64px на md+
  const isSmToolbar = useMediaQuery(theme.breakpoints.down('sm'));
  const appBarHeight = isSmToolbar ? 56 : 64;

  const isAllowed = (path) => {
    const allowed = RBAC_MENU[path];
    if (!allowed) return true;
    return hasAnyRole(allowed);
  };

  const sectionsRaw = useMemo(() => [
    { label: 'Наш гараж', items: [
      { label: 'Дашборд', icon: LayoutDashboard, route: '/' },
      { label: 'Календарь', icon: CalendarIconLucide, route: '/calendar' },
    ]},
    { label: 'Задачи', items: [
      { label: 'Задачи', icon: Briefcase, route: '/tasks', children: [
        { icon: Folder, label: 'Backlog', route: '/tasks/backlog', count: 24 },
        { icon: Zap, label: 'In progress', route: '/tasks/in-progress', count: 4 },
        { icon: Wand2, label: 'Validation', route: '/tasks/validation', count: 7 },
        { icon: CheckCircle2, label: 'Done', route: '/tasks/done', count: 13 },
      ]},
    ]},
    { label: 'Заказы', items: [
      { label: 'Заказы', icon: ShoppingCartLucide, route: '/orders', children: [
        { label: 'Все заказы', route: '/orders' },
        { label: 'Детали', route: '/orders/parts' },
        { label: 'Детейлинг', route: '/orders/detailing' },
        { label: 'Кузовной ремонт', route: '/orders/bodywork' },
        { label: 'Автохимия', route: '/inventory/products' },
      ]},
    ]},
    { label: 'Деньги', items: [
      { label: 'Платежи', icon: CreditCard, route: '/payments', children: [
        { label: 'Добавить доход', route: '/payments' },
        { label: 'Добавить расход', route: '/payments' },
        { label: 'ДДС', route: '/reports' },
        { label: 'Сводные отчеты', route: '/reports' },
      ]},
    ]},
    { label: 'Клиенты', items: [
      { label: 'Клиенты', icon: UsersLucide, route: '/clients', children: [
        { label: 'Добавить', route: '/clients?modal=new' },
        { label: 'Список клиентов', route: '/clients' },
      ]},
    ]},
    { label: 'Отчёты', items: [
      { label: 'Отчёты', icon: BarChart2, route: '/reports' },
    ]},
    { label: 'Настройки', items: [
      { label: 'Настройки', icon: SettingsLucide, route: '/settings' },
    ]},
  ], []);

  // При первом заходе по прямому URL выбираем подходящий ключ (по умолчанию — верхний уровень)
  useEffect(() => {
    if (activeKey) return;
    const path = location.pathname;
    // Найти подходящий верхний пункт в sectionsRaw
    let found = null;
    sectionsRaw.forEach((section) => {
      (section.items || []).forEach((it) => {
        const topKey = `0-${it.label}-${it.route || ''}`;
        const topMatch = (path === it.route) || (path.startsWith((it.route || '') + '/') && it.route !== '/');
        if (!found && topMatch) {
          found = topKey;
        }
        (it.children || []).forEach((child) => {
          const childKey = `1-${child.label}-${child.route || ''}`;
          if (!found && child.route && path === child.route) {
            found = childKey;
          }
        });
      });
    });
    if (found) setActiveKey(found);
  }, [location.pathname, activeKey, sectionsRaw]);

  return (
    <ThemeProvider>
      <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <AppBar position="sticky" color="default" elevation={0}>
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => setCollapsed((v) => !v)} sx={{ mr: 1, display: { xs: 'inline-flex', sm: 'inline-flex', md: 'none', lg: 'none' } }}>
                <MenuIcon />
              </IconButton>
              <Box component="img" src={logo} alt="logo" sx={{ height: (t) => t.spacing(3), width: (t) => t.spacing(3), mr: 1, filter: 'brightness(1.2)' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                Character CRM
              </Typography>
            </Box>
            <Box>
              <Tooltip title={mode === 'dark' ? 'Тёмная тема' : 'Светлая тема'}>
                <IconButton aria-label="Переключить режим темы" onClick={toggle} sx={{ mr: 1 }}>
                  {mode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
                </IconButton>
              </Tooltip>
              <IconButton onClick={(e) => setProfileAnchor(e.currentTarget)}>
                <Avatar sx={{ width: 32, height: 32 }}>
                  {(user?.email || user?.name || 'U').slice(0,1).toUpperCase()}
                </Avatar>
              </IconButton>
              <Menu anchorEl={profileAnchor} open={!!profileAnchor} onClose={() => setProfileAnchor(null)}>
                {/* ... menu items ... */}
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Старый кастомный Drawer удалён — используем новый Sidebar компонент */}
        {/* Новый простой сайдбар на MUI Drawer + List */}
        <Sidebar
          mobileOpen={collapsed}
          onClose={() => setCollapsed(false)}
          hasRole={(role) => hasAnyRole([role])}
        />

        <Box sx={{ p: (t) => t.spacing(2), ml: sidebarOffset, width: { xs: '100%', md: `calc(100% - ${sidebarOffset}px)` }, minHeight: `calc(100dvh - ${appBarHeight}px)`, overflow: 'auto', display: 'flex', flexDirection: 'column', transition: 'margin-left 200ms ease, width 200ms ease' }}>
           <Outlet />
         </Box>
      </Box>
    </ThemeProvider>
  );
}

// breakpoint hooks moved inside Layout component