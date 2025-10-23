import React from 'react';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import { nav, NavItem } from './sidebarConfig';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.svg';
import { isRouteActive, getActiveSection } from './useActiveMatch';

const DRAWER_WIDTH = 280;

export type SidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
  hasRole?: (role: string) => boolean;
};

// Compact path helper: active if pathname starts with path
const isActive = (path?: string, pathname?: string) => {
  if (!path || !pathname) return false;
  // root should match only exact '/'
  if (path === '/') return pathname === '/';
  // exact match or sub-route match like '/orders/...'
  return pathname === path || pathname.startsWith(path + '/');
};

function filterByRole(items: NavItem[], hasRole?: (role: string) => boolean): NavItem[] {
  if (!hasRole) return items;
  const filtered = items
    .filter((i) => !i.role || hasRole(i.role))
    .map((i) => ({
      ...i,
      children: i.children ? i.children.filter((c) => !c.role || hasRole(c.role)) : undefined,
    }));
  // Скрыть разделы без path и без видимых детей
  return filtered.filter((i) => Boolean(i.path) || (i.children && i.children.length > 0));
}

export default function Sidebar({ mobileOpen, onClose, hasRole }: SidebarProps) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const isMdOnly = useMediaQuery(theme.breakpoints.only('md'));
  const width = DRAWER_WIDTH;
  const variant: 'persistent' | 'temporary' = mdUp ? 'persistent' : 'temporary';
  const pathname = location.pathname;

  const handleKeyNav = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
    const buttons = Array.from(document.querySelectorAll('.MuiListItemButton-root')) as HTMLElement[];
    const idx = buttons.findIndex((el) => el === e.currentTarget);
    if (e.key === 'Enter') {
      (e.currentTarget as HTMLButtonElement).click();
      return;
    }
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const next = buttons[Math.max(0, Math.min(buttons.length - 1, idx + delta))];
    next?.focus();
    e.preventDefault();
  };
  const items = filterByRole(nav, hasRole);

  // Accordion: only one open section at a time
  const [openId, setOpenId] = React.useState<string | null>(null);

  // Keep open section in sync with current route
  // Логи: смена URL и результат матчинга
  React.useEffect(() => {
    const match = getActiveSection(items, pathname);
    console.log('pathname=', pathname, 'active section=', match.sectionId, 'active child=', match.childId);
    setOpenId(match.sectionId);
  }, [pathname, items]);

  // Логи: изменение открытой секции
  React.useEffect(() => {
    console.log('openId=', openId);
  }, [openId]);

  return (
    <Drawer
      variant={variant}
      open={variant === 'temporary' ? Boolean(mobileOpen) : true}
      onClose={variant === 'temporary' ? onClose : undefined}
      anchor="left"
      sx={{ '& .MuiDrawer-paper': { width, borderRight: 0, display: 'flex', flexDirection: 'column' } }}
    >
      {/* Top brand */}
      <Box sx={{ px: 1, py: 1.5 }}>
        <ListItemButton component={NavLink} to="/"
          onClick={() => console.log('clicked logo','to=/')}
          dense
          sx={{
            borderRadius: 1,
            minHeight: 40,
            px: 1.5,
            justifyContent: 'flex-start',
          }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <Box component="img" src={logo} alt="logo" sx={{ height: 24, width: 24 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary="" />
        </ListItemButton>
      </Box>
      <Divider />

      {/* Main navigation list */}
      <List dense sx={{ px: 1, py: 1, flex: '1 1 auto' }}>
        {items.map((section) => {
          const mini = false;
          const hasChildren = !!section.children?.length;
          const sectionActive = isRouteActive(section.path, pathname);
          const activeChild = section.children?.find((c) => c.path && pathname === c.path) || null;
          const childActive = Boolean(activeChild);
          const expanded = hasChildren && (openId === section.id || sectionActive || childActive);

          const onSectionClick = () => {
            if (hasChildren) {
              setOpenId((prev) => (prev === section.id ? null : section.id));
            }
            if (section.path) {
              navigate(section.path);
              if (variant === 'temporary' && onClose) onClose();
            }
          };

          return (
            <React.Fragment key={section.id}>
              <Tooltip disableInteractive title={mini ? section.label : ''} placement="right">
              <ListItemButton
                component={section.path ? NavLink : 'div'}
                to={section.path || undefined}
                selected={sectionActive || childActive}
                onClick={(e) => {
                  console.log('clicked section', section.id, 'to=', section.path);
                  if (hasChildren) {
                    setOpenId((prev) => (prev === section.id ? null : section.id));
                  }
                  if (variant === 'temporary' && onClose) onClose();
                }}
                onKeyDown={handleKeyNav}
                aria-expanded={hasChildren ? expanded : undefined}
                aria-current={sectionActive ? 'page' : undefined}
                dense
                sx={(t) => ({
                  borderRadius: 1,
                  minHeight: 40,
                  px: 2,
                  position: 'relative',
                  justifyContent: 'flex-start',
                  '& .MuiListItemIcon-root': { minWidth: 32, color: t.palette.text.secondary },
                  '&.Mui-selected': { backgroundColor: t.palette.action.selected },
                  '&.Mui-selected .MuiListItemIcon-root': { color: t.palette.primary.main },
                  '&.Mui-selected::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0, top: 6, bottom: 6,
                    width: 2, borderRadius: 1,
                    backgroundColor: t.palette.primary.main
                  }
                })}
              >
                {section.icon && (
                  <ListItemIcon>
                    {section.icon}
                  </ListItemIcon>
                )}
                <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={section.label} />
              </ListItemButton>
              </Tooltip>

              <Collapse in={!mini && expanded} timeout="auto" unmountOnExit>
                <List dense sx={{ ml: mini ? 0 : 3, mt: 0.5 }}>
                  {section.children?.map((child) => {
                    const active = activeChild ? child.id === activeChild.id : false;
                     return (
                       <ListItemButton
                         key={child.id}
                         component={NavLink as any}
                         to={child.path!}
                         selected={active}
                         onClick={(e) => {
                           console.log('clicked child', child.id, 'to=', child.path);
                           if (variant === 'temporary' && onClose) onClose();
                         }}
                         onKeyDown={handleKeyNav}
                         aria-current={active ? 'page' : undefined}
                         dense
                         sx={(t) => ({
                           borderRadius: 1,
                           minHeight: 36,
                           px: 2,
                           position: 'relative',
                           '& .MuiListItemIcon-root': { color: t.palette.text.secondary },
                           '&.Mui-selected': { backgroundColor: t.palette.action.selected },
                           '&.Mui-selected .MuiListItemIcon-root': { color: t.palette.primary.main },
                           '&.Mui-selected::before': {
                             content: '""', position: 'absolute',
                             left: 16, top: 6, bottom: 6, width: 2, borderRadius: 1,
                             backgroundColor: t.palette.primary.main
                           }
                         })}
                       >
                         <ListItemIcon sx={{ minWidth: 28 }}>
                           {child.icon}
                         </ListItemIcon>
                         <ListItemText primary={child.label} />
                       </ListItemButton
                       >
                     );
                   })}
                </List>
              </Collapse>
            </React.Fragment>
          );
        })}
      </List>

      {/* Bottom profile link */}
      <Box sx={{ px: 1, py: 1 }}>
        <Tooltip title={''} placement="right">
          <ListItemButton component={NavLink} to="/settings"
            onClick={() => console.log('clicked profile','to=/settings')}
            dense
            sx={{
              borderRadius: 1,
              minHeight: 40,
              px: 1.5,
              justifyContent: 'flex-start',
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Avatar sx={{ width: 24, height: 24 }}>
                {(user?.email || 'U').slice(0, 1).toUpperCase()}
              </Avatar>
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary="Профиль" />
          </ListItemButton>
        </Tooltip>
      </Box>
    </Drawer>
  );
}