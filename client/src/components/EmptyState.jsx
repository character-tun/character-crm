import React from 'react';
import { Box, Stack, Typography, Button } from '@mui/material';

/**
 * EmptyState — простой переиспользуемый компонент пустого экрана.
 * Props:
 * - title?: string
 * - description?: string
 * - actionLabel?: string
 * - onAction?: () => void
 */
export default function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <Box sx={{ p: 3, textAlign: 'center', color: 'var(--color-textMuted)' }}>
      {title ? <Typography variant="h6" sx={{ mb: 0.5 }}>{title}</Typography> : null}
      {description ? <Typography variant="body2" sx={{ mb: 2, opacity: 0.8 }}>{description}</Typography> : null}
      {actionLabel ? (
        <Stack direction="row" justifyContent="center">
          <Button variant="contained" onClick={onAction}>{actionLabel}</Button>
        </Stack>
      ) : null}
    </Box>
  );
}