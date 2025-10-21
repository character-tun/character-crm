import React from 'react';
import Box from '@mui/material/Box';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';

// SidebarItem renders a single item with optional counter on the right.
// It supports depth-based styling (top-level vs sub-items), active/hover styles
// following the Linear/Relate guidelines from the user's spec.
export default function SidebarItem({ icon: Icon, label, route, count, depth = 0, collapsed = false, onToggle, hasChildren = false, isOpen = false, itemKey, activeKey, setActiveKey }) {
  const location = useLocation();
  const navigate = useNavigate();

  const baseActive = (() => {
    if (!route) return false;
    if (depth === 0) {
      // top-level considered active when current path starts with its route
      return location.pathname === route || location.pathname.startsWith(route + '/') || (route === '/' && location.pathname === '/');
    }
    return location.pathname === route;
  })();

  const isActive = activeKey ? (activeKey === itemKey) : baseActive;

  const handleClick = () => {
    if (hasChildren) {
      onToggle && onToggle();
    } else if (route) {
      setActiveKey && itemKey && setActiveKey(itemKey);
      navigate(route);
    }
  };

  const iconSize = depth === 0 ? 16 : 14;
  const iconOpacity = depth === 0 ? 0.8 : 0.6;

  const baseStyles = {
    px: 1.75, // ~14px
    py: 1,    // 8px
    borderRadius: '8px',
    transition: 'background-color 0.15s ease-out, color 0.15s ease-out',
    color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
    backgroundColor: isActive ? 'rgba(var(--color-primary-rgb), 0.08)' : 'transparent',
    '&:hover': {
      backgroundColor: 'var(--color-surfaceAlt)',
      cursor: 'pointer',
      textShadow: '0 0 4px rgba(255,255,255,0.05)'
    },
    minHeight: '32px',
  };

  const wrapperStyles = {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    ml: depth === 0 ? 0 : 3, // 24px for sub-items (via button pl), visual indent
    pl: depth === 0 ? 0 : 0,
    borderLeft: isActive ? '2px solid var(--color-primary)' : (depth > 0 ? '1px solid rgba(var(--color-border-rgb), 0.2)' : 'none'),
  };

  const contentStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: 1, // ~8px
    width: '100%'
  };

  const rightBadgeStyles = {
    ml: 'auto',
    borderRadius: '6px',
    px: 0.75, // ~6px
    py: 0.25,
    fontSize: '12px',
    color: isActive ? 'var(--color-primary)' : 'var(--color-textMuted)',
    backgroundColor: isActive ? 'rgba(var(--color-primary-rgb), 0.1)' : 'var(--color-surfaceAlt)'
  };

  const renderedIcon = Icon ? <Icon size={iconSize} style={{ opacity: iconOpacity, color: isActive ? 'var(--color-primary)' : 'var(--color-text)' }} /> : null;

  if (collapsed) {
    // In collapsed mode show only icon, with tooltip for the label
    return (
      <Tooltip title={label} placement="right" arrow>
        <Box sx={{ ...wrapperStyles }}>
          <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
            <ListItemButton onClick={handleClick} sx={{ ...baseStyles, justifyContent: 'center', px: 0 }}>
              {renderedIcon}
            </ListItemButton>
          </Box>
        </Box>
      </Tooltip>
    );
  }

  return (
    <Box sx={wrapperStyles}>
      <ListItemButton onClick={handleClick} sx={{ ...baseStyles, pl: depth === 0 ? 1.75 : 3.5 }}>
        <Box sx={contentStyles}>
          {renderedIcon ? (<ListItemIcon sx={{ minWidth: iconSize + 16 }}>{renderedIcon}</ListItemIcon>) : null}
          <ListItemText primary={<Typography sx={{ fontSize: 14, lineHeight: '20px', color: isActive ? 'var(--color-primary)' : (depth > 0 ? 'var(--color-textMuted)' : 'var(--color-text)') }}>{label}</Typography>} />
          {typeof count === 'number' ? (
            <Box sx={rightBadgeStyles}>{count}</Box>
          ) : null}
          {hasChildren ? (
            <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
              {isOpen ? <ChevronDown size={14} style={{ opacity: 0.6 }} /> : <ChevronRight size={14} style={{ opacity: 0.6 }} />}
            </Box>
          ) : null}
        </Box>
      </ListItemButton>
    </Box>
  );
}