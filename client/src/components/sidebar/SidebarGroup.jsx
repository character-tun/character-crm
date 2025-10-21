import React, { useState } from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import { AnimatePresence, motion } from 'framer-motion';
import SidebarItem from './SidebarItem';

// Renders a set of items recursively with an animated collapse/expand
export default function SidebarGroup({ items = [], depth = 0, collapsed = false, activeKey, setActiveKey }) {
  const [openMap, setOpenMap] = useState({});

  const toggle = (key) => setOpenMap((m) => ({ ...m, [key]: !m[key] }));

  return (
    <List disablePadding sx={{ p: 0 }}>
      {items.map((it) => {
        const key = `${depth}-${it.label}-${it.route || ''}`;
        const hasChildren = Array.isArray(it.children) && it.children.length > 0;
        const isOpen = !!openMap[key];
        return (
          <React.Fragment key={key}>
            <SidebarItem
              icon={it.icon}
              label={it.label}
              route={it.route}
              count={it.count}
              depth={depth}
              collapsed={collapsed}
              hasChildren={hasChildren}
              isOpen={isOpen}
              onToggle={() => toggle(key)}
              itemKey={key}
              activeKey={activeKey}
              setActiveKey={setActiveKey}
            />
            {hasChildren ? (
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    <Box sx={{ ml: 2 }}>
                      <SidebarGroup items={it.children} depth={depth + 1} collapsed={collapsed} activeKey={activeKey} setActiveKey={setActiveKey} />
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            ) : null}
          </React.Fragment>
        );
      })}
    </List>
  );
}