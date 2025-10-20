import React, { useState } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import MuiAppBar from '@mui/material/AppBar';
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
import ReceiptIcon from '@mui/icons-material/Receipt';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import SchoolIcon from '@mui/icons-material/School';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import logo from '../assets/logo.svg';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    flexGrow: 1,
    padding: 0,
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: 0,
    backgroundColor: theme.palette.background.default,
    minHeight: '100vh',
    ...(open && {
      transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
      marginLeft: 0,
    }),
  }),
);

const AppBarStyled = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  display: 'block',
}));

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: drawerWidth,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    boxSizing: 'border-box',
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(180deg, #0f172a 0%, #0b1220 100%)'
      : theme.palette.background.paper,
    color: theme.palette.text.primary,
    borderRight: `1px solid ${theme.palette.divider}`,
  },
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2, 2),
  ...theme.mixins.toolbar,
  justifyContent: 'space-between',
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  height: '70px',
}));

const StyledListItem = styled(ListItem)(({ theme, selected }) => ({
  margin: '4px 0',
  padding: '0 8px',
  '& .MuiListItemButton-root': {
    borderRadius: '8px',
    padding: '8px 16px',
    '&:hover': {
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
    },
    ...(selected && {
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      '&:hover': {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
      },
    }),
  },
  '& .MuiListItemIcon-root': {
    minWidth: '40px',
    color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
  },
  '& .MuiListItemText-primary': {
    fontSize: '14px',
    fontWeight: selected ? '500' : '400',
    color: selected ? theme.palette.text.primary : theme.palette.text.secondary,
  },
}));

export default function Layout() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, roles, logout, hasAnyRole } = useAuth();
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [profileAnchor, setProfileAnchor] = useState(null);

  const handleToggle = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const RBAC_MENU = {
    '/payments': ['Admin','Finance'],
    '/marketing': ['Admin','Manager'],
    '/services': ['Admin','Manager','Detailing'],
    '/production': ['Admin','Production'],
    '/inventory': ['Admin','Production'],
    '/inventory/products': ['Admin','Production'],
    '/inventory/orders': ['Admin','Production'],
    '/inventory/suppliers': ['Admin','Production'],
    '/shop': ['Admin','Manager'],
    '/reports': ['Admin','Manager'],
    '/announcements': ['Admin','Manager'],
    '/settings': ['Admin','Manager'],
    '/settings/order-statuses': ['Admin','settings.statuses:*','settings.statuses:list'],
    '/settings/forms/order-types': ['Admin'],
  };

  const isAllowed = (path) => {
    const allowed = RBAC_MENU[path];
    if (!allowed) return true;
    return hasAnyRole(allowed);
  };

  const rawMenuItems = [
    { text: 'Дашборд', icon: <DashboardIcon />, path: '/' },
    { text: 'Задачи', icon: <AssignmentIcon />, path: '/tasks', subItems: [
      { text: 'Доска', path: '/tasks' },
      { text: 'Список', path: '/tasks/list' }
    ] },
    { 
      text: 'Заказы', 
      icon: <ShoppingCartIcon />, 
      path: '/orders',
      subItems: [
        { text: 'Все заказы', path: '/orders' },
        { text: 'Детали', path: '/orders/parts' },
        { text: 'Детейлинг', path: '/orders/detailing' },
        { text: 'Кузовной ремонт', path: '/orders/bodywork' },
      ]
    },
    { text: 'Платежи', icon: <PaymentIcon />, path: '/payments' },
    { text: 'Клиенты', icon: <PeopleIcon />, path: '/clients' },
    { text: 'Маркетинг', icon: <LocalOfferIcon />, path: '/marketing' },
    { text: 'Услуги', icon: <InventoryIcon />, path: '/services' },
    { text: 'Производство', icon: <InventoryIcon />, path: '/production' },
    { 
      text: 'Склад', 
      icon: <StorefrontIcon />, 
      path: '/inventory',
      subItems: [
        { text: 'Товары', path: '/inventory/products' },
        { text: 'Заказы', path: '/inventory/orders' },
        { text: 'Поставщики', path: '/inventory/suppliers' },
      ]
    },
    { text: 'Магазин', icon: <ShoppingCartIcon />, path: '/shop' },
    { text: 'Отчеты', icon: <ReceiptIcon />, path: '/reports' },
    { text: 'Объявления', icon: <AnnouncementIcon />, path: '/announcements' },
    { text: 'Настройки', icon: <SettingsIcon />, path: '/settings', subItems: [
      { text: 'Статусы заказов', path: '/settings/order-statuses' },
      { text: 'Типы заказов', path: '/settings/forms/order-types' },
    ] },
    { text: 'База знаний', icon: <SchoolIcon />, path: '/knowledge' },
  ];

  const menuItems = rawMenuItems
    .filter((item) => isAllowed(item.path))
    .map((item) => ({
      ...item,
      subItems: item.subItems?.filter((si) => isAllowed(si.path))
    }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <AppBarStyled position="static" color="default" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box component="img" src={logo} alt="logo" sx={{ height: 24, width: 24, mr: 1, filter: 'brightness(1.2)' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: (theme) => theme.palette.primary.main }}>
              Character CRM
            </Typography>
          </Box>
          <Box>
            <IconButton onClick={(e) => setProfileAnchor(e.currentTarget)}>
              <Avatar sx={{ width: 32, height: 32 }}>
                {(user?.email || user?.name || 'U').slice(0,1).toUpperCase()}
              </Avatar>
            </IconButton>
            <Menu anchorEl={profileAnchor} open={!!profileAnchor} onClose={() => setProfileAnchor(null)}>
              <MenuItem onClick={() => { setProfileAnchor(null); navigate('/settings'); }}>Профиль</MenuItem>
              <MenuItem onClick={async () => { setProfileAnchor(null); await logout(); navigate('/login'); }}>Выйти</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBarStyled>

      <Box sx={{ display: 'flex' }}>
        <StyledDrawer
          variant="permanent"
          anchor="left"
        >
          <DrawerHeader>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box component="img" src={logo} alt="logo" sx={{ height: 24, width: 24, mr: 1, filter: 'brightness(1.2)' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: (theme) => theme.palette.primary.main }}>
                Character CRM
              </Typography>
            </Box>
          </DrawerHeader>
          
          <List sx={{ padding: '8px 16px' }}>
            {menuItems.map((item) => (
              <React.Fragment key={item.text}>
                <StyledListItem disablePadding selected={location.pathname === item.path}>
                  <ListItemButton
                    onClick={() => (item.subItems ? handleToggle(item.path) : navigate(item.path))}
                  >
                    <ListItemIcon>
                      {item.badge ? (
                        <Badge
                          color="primary"
                          badgeContent={item.badge}
                          sx={{ '& .MuiBadge-badge': { fontSize: '10px', height: '16px' } }}
                        >
                          {item.icon}
                        </Badge>
                      ) : (
                        item.icon
                      )}
                    </ListItemIcon>
                    <ListItemText primary={item.text} />
                    {item.subItems && (
                      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}
                           onClick={(e) => { e.stopPropagation(); handleToggle(item.path); }}>
                        {expanded[item.path] ? <ExpandLess /> : <ExpandMore />}
                      </Box>
                    )}
                  </ListItemButton>
                </StyledListItem>

                {item.subItems && (
                  <Collapse in={!!expanded[item.path]} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.subItems.map((subItem) => (
                        <StyledListItem key={subItem.text} disablePadding selected={location.pathname === subItem.path}>
                          <ListItemButton onClick={() => navigate(subItem.path)} sx={{ pl: 4 }}>
                            <ListItemText
                              primary={subItem.text}
                              primaryTypographyProps={{ fontSize: '13px' }}
                            />
                          </ListItemButton>
                        </StyledListItem>
                      ))}
                    </List>
                  </Collapse>
                )}
              </React.Fragment>
            ))}
          </List>
        </StyledDrawer>
        
        <Main open={open}>
          <Box component="div" sx={{ p: 3 }}>
            <Outlet />
          </Box>
        </Main>
      </Box>
    </Box>
  );
}