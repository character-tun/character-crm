import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Stack, TextField, Button, Grid, MenuItem, IconButton, Tooltip, InputAdornment, Chip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SettingsBackBar from '../../components/SettingsBackBar';

const FIELD_TYPES = [
  { key: 'text', label: 'Текст' },
  { key: 'number', label: 'Число' },
  { key: 'date', label: 'Дата' },
  { key: 'select', label: 'Список' },
  { key: 'checkbox', label: 'Галочка' },
];

const FieldsBuilderPage = ({ title, storageKey }) => {
  const [fields, setFields] = useState([]);
  const [newField, setNewField] = useState({ name: '', label: '', type: 'text', options: [] });
  const [optionInput, setOptionInput] = useState('');

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
    setNewField((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'type' && value !== 'select' ? { options: [] } : {}),
    }));
  };

  const addOption = () => {
    const v = optionInput.trim();
    if (!v) return;
    setNewField((prev) => ({
      ...prev,
      options: Array.from(new Set([...(prev.options || []), v])),
    }));
    setOptionInput('');
  };

  const removeOption = (v) => {
    setNewField((prev) => ({
      ...prev,
      options: (prev.options || []).filter((o) => o !== v),
    }));
  };

  const addField = () => {
    if (!newField.name || !newField.label) return;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newField.name)) return; // валидируем системный код
    if (newField.type === 'select' && (!newField.options || newField.options.length === 0)) return;
    const updated = [...fields, { ...newField }];
    setFields(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setNewField({ name: '', label: '', type: 'text', options: [] });
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
              <TextField
                fullWidth
                label="Код поля (для системы)"
                name="name"
                value={newField.name}
                onChange={handleChangeNew}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    newField.name &&
                    newField.label &&
                    /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newField.name) &&
                    (newField.type !== 'select' || (newField.options && newField.options.length > 0))
                  ) {
                    e.preventDefault();
                    addField();
                  }
                }}
                placeholder="Например: client_phone"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Внутреннее имя. Используется системой.">
                        <IconButton size="small">
                          <InfoOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                error={!!newField.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newField.name)}
                helperText={
                  !!newField.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newField.name)
                    ? 'Допустимы латинские буквы, цифры и _; начните с буквы'
                    : 'Внутреннее имя. Используется системой.'
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Название для пользователей"
                name="label"
                value={newField.label}
                onChange={handleChangeNew}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    newField.name &&
                    newField.label &&
                    /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newField.name) &&
                    (newField.type !== 'select' || (newField.options && newField.options.length > 0))
                  ) {
                    e.preventDefault();
                    addField();
                  }
                }}
                placeholder="Например: Телефон клиента"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Этот текст будет виден пользователям">
                        <IconButton size="small">
                          <InfoOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                helperText="Этот текст будет виден в интерфейсе"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Тип поля"
                name="type"
                value={newField.type}
                onChange={handleChangeNew}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Выберите формат данных">
                        <IconButton size="small">
                          <InfoOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              >
                {FIELD_TYPES.map((t) => (
                  <MenuItem key={t.key} value={t.key}>
                    {t.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          {newField.type === 'select' && (
            <Box>
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  label="Вариант"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && optionInput.trim()) {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                  placeholder="Например: Серебристый"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Введите вариант и нажмите Enter">
                          <IconButton size="small">
                            <InfoOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button variant="outlined" onClick={addOption} disabled={!optionInput.trim()}>
                  Добавить вариант
                </Button>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                {(newField.options || []).map((opt) => (
                  <Chip key={opt} label={opt} onDelete={() => removeOption(opt)} sx={{ mr: 1, mb: 1 }} />
                ))}
                {(newField.options || []).length === 0 && (
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Добавьте хотя бы один вариант для типа «Список»
                  </Typography>
                )}
              </Stack>
            </Box>
          )}

          <Button
            variant="contained"
            onClick={addField}
            disabled={!(
              newField.name &&
              newField.label &&
              /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newField.name) &&
              (newField.type !== 'select' || (newField.options && newField.options.length > 0))
            )}
          >
            Добавить поле
          </Button>

          <Grid container spacing={2}>
            {fields.map((f, idx) => (
              <Grid item xs={12} md={6} key={`${f.name}-${idx}`}>
                <Paper sx={{ p: 1.5, borderRadius: 2, border: '1px solid #2a2f37' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {f.label}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        Код: {f.name} • Тип: {FIELD_TYPES.find((t) => t.key === f.type)?.label || f.type}
                      </Typography>
                      {f.type === 'select' && Array.isArray(f.options) && f.options.length > 0 && (
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          Варианты: {f.options.join(', ')}
                        </Typography>
                      )}
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
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  Нет полей. Добавьте первое.
                </Typography>
              </Grid>
            )}
          </Grid>
        </Stack>
      </Paper>
    </Box>
  );
};

export default FieldsBuilderPage;