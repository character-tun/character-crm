import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface NotifyOptions {
  severity?: AlertColor; // 'success' | 'info' | 'warning' | 'error'
  duration?: number; // milliseconds
  variant?: 'filled' | 'outlined' | 'standard';
}

interface NotifyContextValue {
  notify: (message: string, options?: NotifyOptions) => void;
}

const NotifyContext = createContext<NotifyContextValue | undefined>(undefined);

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');
  const [duration, setDuration] = useState<number>(3000);
  const [variant, setVariant] = useState<'filled' | 'outlined' | 'standard'>('filled');

  const notify = useCallback((msg: string, options?: NotifyOptions) => {
    setMessage(msg);
    setSeverity(options?.severity || 'info');
    setDuration(options?.duration ?? 3000);
    setVariant(options?.variant || 'filled');
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  const handleClose = (_?: any, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <NotifyContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleClose}
          severity={severity}
          variant={variant}
          sx={{
            minWidth: 280,
            boxShadow: 1,
            // ensure palette-based colors
            ...(variant === 'filled' && severity === 'success' ? { bgcolor: theme.palette.success.main, color: theme.palette.success.contrastText } : {}),
            ...(variant === 'filled' && severity === 'info' ? { bgcolor: theme.palette.info.main, color: theme.palette.info.contrastText } : {}),
            ...(variant === 'filled' && severity === 'warning' ? { bgcolor: theme.palette.warning.main, color: theme.palette.warning.contrastText } : {}),
            ...(variant === 'filled' && severity === 'error' ? { bgcolor: theme.palette.error.main, color: theme.palette.error.contrastText } : {}),
          }}
        >
          {message}
        </Alert>
      </Snackbar>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error('useNotify must be used within NotifyProvider');
  return ctx.notify;
}