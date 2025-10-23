import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, Paper, Stack, TextField, Button, Chip } from '@mui/material';
import SettingsBackBar from '../../components/SettingsBackBar';

const ListSettingsPage = ({ title, storageKey, placeholder = 'Название', initialItems = [] }) => {
  const [items, setItems] = useState([]);
  const [input, setInput] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setItems(parsed);
        else setItems(initialItems);
      } catch (e) {
        setItems(initialItems);
      }
    } else {
      setItems(initialItems);
    }
  }, [storageKey, initialItems]);

  const handleAdd = () => {
    const value = input.trim();
    if (!value) return;
    const updated = [...items, value];
    setItems(updated);
    setInput('');
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleDelete = (idx) => {
    const updated = items.filter((_, i) => i !== idx);
    setItems(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleReset = () => {
    setItems(initialItems);
    localStorage.setItem(storageKey, JSON.stringify(initialItems));
  };

  const handleExport = () => {
    try {
      const data = JSON.stringify(items, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${storageKey}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleImport = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (Array.isArray(parsed)) {
          setItems(parsed);
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        }
      } catch {}
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const saveAll = () => {
    localStorage.setItem(storageKey, JSON.stringify(items));
  };

  return (
    <Box>
      <SettingsBackBar title={title} onSave={saveAll} />
      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid var(--color-border)' }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              fullWidth
              label={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button variant="contained" onClick={handleAdd}>Добавить</Button>
            <Button variant="outlined" color="secondary" onClick={handleReset}>Сбросить</Button>
            <Button variant="outlined" onClick={handleExport}>Экспорт JSON</Button>
            <Button variant="outlined" onClick={() => fileInputRef.current && fileInputRef.current.click()}>Импорт JSON</Button>
          </Stack>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImport} />
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {items.map((item, idx) => (
              <Chip 
                key={`${item}-${idx}`} 
                label={item} 
                onDelete={() => handleDelete(idx)} 
                sx={{ m: 0.5 }}
              />
            ))}
            {items.length === 0 && (
              <Typography variant="body2" sx={{ opacity: 0.7 }}>Нет элементов. Добавьте первый.</Typography>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default ListSettingsPage;