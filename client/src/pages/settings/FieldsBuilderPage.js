import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Stack, TextField, Button, Grid, MenuItem, Select, InputLabel, FormControl, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsBackBar from '../../components/SettingsBackBar';

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'checkbox'];

const FieldsBuilderPage = ({ title, storageKey }) => {
  const [fields, setFields] = useState([]);
  const [newField, setNewField] = useState({ name: '', label: '', type: 'text' });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setFields(parsed);
      } catch {}
    }
  }, [storageKey]);

  const handleChangeNew = (e) => {
    const { name, value } = e.target;
    setNewField((prev) => ({ ...prev, [name]: value }));
  };

  const addField = () => {
    if (!newField.name || !newField.label) return;
    const updated = [...fields, { ...newField }];
    setFields(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setNewField({ name: '', label: '', type: 'text' });
  };

  const deleteField = (idx) => {
    const updated = fields.filter((_, i) => i !== idx);
    setFields(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const saveAll = () => {
    localStorage.setItem(storageKey, JSON.stringify(fields));
  };

  return (
    <Box>
      <SettingsBackBar title={title} onSave={saveAll} />
      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #2a2f37' }}>
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField fullWidth label="Ключ" name="name" value={newField.name} onChange={handleChangeNew} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth label="Подпись" name="label" value={newField.label} onChange={handleChangeNew} />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="field-type">Тип</InputLabel>
                <Select labelId="field-type" label="Тип" name="type" value={newField.type} onChange={handleChangeNew}>
                  {FIELD_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Button variant="contained" onClick={addField}>Добавить поле</Button>

          <Grid container spacing={2}>
            {fields.map((f, idx) => (
              <Grid item xs={12} md={6} key={`${f.name}-${idx}`}>
                <Paper sx={{ p: 1.5, borderRadius: 2, border: '1px solid #2a2f37' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{f.label}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>Ключ: {f.name} • Тип: {f.type}</Typography>
                    </Stack>
                    <IconButton size="small" onClick={() => deleteField(idx)}>
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </Paper>
              </Grid>
            ))}
            {fields.length === 0 && (
              <Grid item xs={12}>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>Нет полей. Добавьте первое.</Typography>
              </Grid>
            )}
          </Grid>
        </Stack>
      </Paper>
    </Box>
  );
};

export default FieldsBuilderPage;