import React from 'react';
import { Stack, Button, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';

export default function SettingsBackBar({ title, onSave }) {
  const navigate = useNavigate();
  const handleBack = async () => {
    try {
      if (typeof onSave === 'function') {
        await onSave();
      }
    } catch (e) {
      // intentionally suppress
    }
    navigate('/settings');
  };

  const handleExitWithoutSave = () => {
    navigate('/settings');
  };

  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
      <Button variant="contained" color="success" startIcon={<ArrowBackIcon />} onClick={handleBack}>
        Сохранить и выйти
      </Button>
      <Button variant="contained" color="error" startIcon={<CloseIcon />} onClick={handleExitWithoutSave} sx={{ textTransform: 'none' }}>
        Выйти без сохранения
      </Button>
      {title && (
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {title}
        </Typography>
      )}
    </Stack>
  );
}