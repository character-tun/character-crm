import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, DialogProps } from '@mui/material';

export interface ModalBaseProps extends Pick<DialogProps, 'open' | 'onClose'> {
  title?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  actions?: React.ReactNode;
  children?: React.ReactNode;
  keepMounted?: boolean;
}

export default function ModalBase({
  open,
  onClose,
  title,
  actions,
  children,
  maxWidth = 'sm',
  keepMounted = true,
}: ModalBaseProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={maxWidth}
      disableScrollLock
      keepMounted={keepMounted}
      scroll="paper"
    >
      {title ? <DialogTitle>{title}</DialogTitle> : null}
      <DialogContent dividers>
        {children}
      </DialogContent>
      {actions ? (
        <DialogActions>
          {actions}
        </DialogActions>
      ) : null}
    </Dialog>
  );
}