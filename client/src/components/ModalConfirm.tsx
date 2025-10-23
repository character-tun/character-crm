import React from 'react';
import { Button, Stack, Typography } from '@mui/material';
import ModalBase from './ModalBase';

export interface ModalConfirmProps {
  open: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  maxWidth?: 'xs' | 'sm' | 'md';
}

export default function ModalConfirm({
  open,
  onClose,
  onConfirm,
  title = 'Подтвердите действие',
  description,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  maxWidth = 'xs',
}: ModalConfirmProps) {
  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title={title}
      maxWidth={maxWidth}
      actions={(
        <Stack direction="row" spacing={1} sx={{ px: 1 }}>
          <Button onClick={onClose}>{cancelText}</Button>
          <Button variant="contained" color="primary" onClick={onConfirm}>{confirmText}</Button>
        </Stack>
      )}
    >
      {description ? (
        <Typography variant="body1">{description}</Typography>
      ) : null}
    </ModalBase>
  );
}