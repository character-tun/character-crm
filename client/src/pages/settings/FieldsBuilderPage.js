import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Box, Typography, Paper, Stack, TextField, Button, Grid, MenuItem, IconButton, Tooltip, InputAdornment, Chip, Alert, Divider, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsBackBar from '../../components/SettingsBackBar';
import { fieldsService } from '../../services/fieldsService';
import { useAuth } from '../../context/AuthContext';

const FIELD_TYPES = [
  { key: 'text', label: 'Текст' },
  { key: 'number', label: 'Число' },
  { key: 'date', label: 'Дата' },
  { key: 'select', label: 'Список' },
  { key: 'checkbox', label: 'Галочка' },
];

// эвристика для подсветки системных полей
const SYSTEM_FIELD_PATTERNS = [/^client_/, /^order_/, /^(sys|system)_/, /^(created|updated)_(at|by)$/i, /^id$/i];
const isSystemCode = (code) => {
  if (typeof code !== 'string') return false;
  return SYSTEM_FIELD_PATTERNS.some((re) => re.test(code));
};

const FieldsBuilderPage = ({ title, storageKey }) => {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(['Admin','Manager']);

  const [fields, setFields] = useState([]);
  const [newField, setNewField] = useState({ name: '', label: '', type: 'text', options: [] });
  const [optionInput, setOptionInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState('');

  // toasts
  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });
  const openToast = (severity, message) => setToast({ open: true, severity, message });
  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  // confirmations
  const [confirmState, setConfirmState] = useState({ open: false, title: '', content: '', onConfirm: null });
  const openConfirm = (title, content, onConfirm) => setConfirmState({ open: true, title, content, onConfirm });
  const closeConfirm = () => setConfirmState((c) => ({ ...c, open: false }));

  // json import
  const fileInputRef = useRef(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const triggerImportJson = () => fileInputRef.current?.click();

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
    openToast('success', 'Поле добавлено');
  };

  const deleteField = (idx) => {
    const updated = fields.filter((_, i) => i !== idx);
    setFields(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    openToast('success', 'Поле удалено');
  };

  const saveAll = () => {
    localStorage.setItem(storageKey, JSON.stringify(fields));
    openToast('success', 'Изменения сохранены');
  };

  const getScopeAndName = useMemo(() => () => {
    if (storageKey === 'settings_order_fields') return { scope: 'orders', name: 'Форма заказа' };
    if (storageKey === 'settings_client_fields') return { scope: 'clients', name: 'Форма клиента' };
    return { scope: 'custom', name: title || 'Пользовательская форма' };
  }, [storageKey, title]);

  const loadVersions = useCallback(async () => {
    setVersionsError('');
    setVersionsLoading(true);
    try {
      const { scope, name } = getScopeAndName();
      const res = await fieldsService.listVersions(scope, name);
      setVersions(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      setVersionsError(e?.response?.data?.error || e?.message || 'Ошибка загрузки версий');
      openToast('error', e?.response?.data?.error || e?.message || 'Ошибка загрузки версий');
    } finally {
      setVersionsLoading(false);
    }
  }, [getScopeAndName]);

  useEffect(() => {
    // загружаем версии на монтирование
    loadVersions();
  }, [storageKey, loadVersions]);

  const importToServer = async () => {
    setImportError('');
    setImportSuccess('');
    setImporting(true);
    try {
      const mapType = (t) => {
        switch (t) {
          case 'text': return 'text';
          case 'number': return 'number';
          case 'date': return 'date';
          case 'checkbox': return 'bool';
          case 'select': return 'list';
          default: return 'text';
        }
      };
      const payloadFields = (fields || []).map((f) => ({
        code: f.name,
        type: mapType(f.type),
        label: f.label,
        required: false,
        ...(f.type === 'select' ? { options: Array.isArray(f.options) ? f.options : [] } : {}),
      }));

      if (!payloadFields.length) throw new Error('Нет полей для импорта');
      const invalid = payloadFields.some((f) => (f.type === 'list' && (!Array.isArray(f.options) || f.options.length === 0)));
      if (invalid) throw new Error('Для полей со списком добавьте варианты');

      const { scope, name } = getScopeAndName();
      const note = `Импортировано из браузера • ${new Date().toLocaleString('ru-RU')}`;
      const data = await fieldsService.importSchema({ scope, name, fields: payloadFields, note });
      if (data?.ok) {
        setImportSuccess(`Импорт выполнен: ${name} v${data?.item?.version || ''}`);
        openToast('success', 'Импорт выполнен');
        await loadVersions();
      } else {
        throw new Error(data?.error || 'Не удалось импортировать');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка импорта';
      setImportError(String(msg));
      openToast('error', String(msg));
    } finally {
      setImporting(false);
    }
  };

  const exportLocalFields = () => {
    const mapType = (t) => {
      switch (t) {
        case 'text': return 'text';
        case 'number': return 'number';
        case 'date': return 'date';
        case 'checkbox': return 'bool';
        case 'select': return 'list';
        default: return 'text';
      }
    };
    const payloadFields = (fields || []).map((f) => ({
      code: f.name,
      type: mapType(f.type),
      label: f.label,
      required: false,
      ...(f.type === 'select' ? { options: Array.isArray(f.options) ? f.options : [] } : {}),
    }));
    const { scope, name } = getScopeAndName();
    const obj = { scope, name, fields: payloadFields, note: 'Экспортировано из браузера' };
    const filename = `${scope}-${String(name).replace(/\s+/g,'_')}-local.json`;
    const dataStr = JSON.stringify(obj, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    openToast('success', 'Экспортировано в JSON');
  };

  const exportVersion = (v) => {
    if (!v) return;
    const obj = {
      scope: v.scope,
      name: v.name,
      version: v.version,
      isActive: v.isActive,
      note: v.note,
      fields: Array.isArray(v.fields) ? v.fields : [],
    };
    const filename = `${v.scope}-${String(v.name||'schema').replace(/\s+/g,'_')}-v${v.version}.json`;
    const dataStr = JSON.stringify(obj, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    openToast('success', 'Версия экспортирована в JSON');
  };

  const handleImportJsonFile = async (file) => {
    if (!file) return;
    setImportError('');
    setImportSuccess('');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const { scope, name, fields, note } = json || {};
      const fallback = getScopeAndName();
      const sc = scope || fallback.scope;
      const nm = name || fallback.name;
      if (!Array.isArray(fields) || fields.length === 0) throw new Error('JSON не содержит полей');
      const normalizedFields = fields.map((f) => {
        const type = f.type || 'text';
        const code = f.code || f.name || '';
        const obj = { code, type, label: f.label || '', required: !!f.required };
        if (type === 'list' || type === 'multilist') obj.options = Array.isArray(f.options) ? f.options : [];
        return obj;
      }).filter((f) => f.code && f.type);
      if (!normalizedFields.length) throw new Error('Не удалось распознать поля');
      const resp = await fieldsService.importSchema({ scope: sc, name: nm, fields: normalizedFields, note: note || `Импорт из JSON • ${file.name}` });
      if (resp?.ok) {
        setImportSuccess(`Импорт из JSON выполнен: ${nm} v${resp?.item?.version || ''}`);
        openToast('success', 'Импорт из JSON выполнен');
        await loadVersions();
      } else {
        throw new Error(resp?.error || 'Не удалось импортировать из JSON');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка импорта из JSON';
      setImportError(String(msg));
      openToast('error', String(msg));
    } finally {
      setFileInputKey(Date.now());
    }
  };

  const activateVersion = async (id) => {
    if (!id) return;
    try {
      await fieldsService.activate(id);
      await loadVersions();
      setImportSuccess('Версия активирована');
      setImportError('');
      openToast('success', 'Версия активирована');
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка активации';
      setImportError(msg);
      openToast('error', msg);
    }
  };

  const deactivateVersion = async (id) => {
    if (!id) return;
    try {
      await fieldsService.deactivate(id);
      await loadVersions();
      openToast('success', 'Версия деактивирована');
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Ошибка деактивации';
      setImportError(msg);
      openToast('error', msg);
    }
  };

  return (
    <Box>
      <SettingsBackBar title={title} onSave={saveAll} />
      <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid var(--color-border)' }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Конструктор полей</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportLocalFields} disabled={fields.length === 0}>Экспорт JSON</Button>
              <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={triggerImportJson} disabled={!canManage}>Импорт из JSON</Button>
              <input key={fileInputKey} ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => handleImportJsonFile(e.target.files?.[0])} />
              <Button variant="outlined" onClick={importToServer} disabled={!canManage || importing || fields.length === 0}>
                {importing ? 'Импорт...' : 'Импорт из браузера'}
              </Button>
            </Stack>
          </Stack>
          {importError && <Alert severity="error">{importError}</Alert>}
          {importSuccess && <Alert severity="success">{importSuccess}</Alert>}

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
                <Paper sx={{ p: 1.5, borderRadius: 2, border: '1px solid var(--color-border)', bgcolor: isSystemCode(f.name) ? 'color-mix(in oklab, var(--color-warning) 12%, transparent)' : undefined }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={1}>
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
                      {isSystemCode(f.name) && <Chip size="small" label="system" color="warning" />}
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
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Пока нет полей. Добавьте поля и сохраните, чтобы импортировать в серверную схему.
                </Typography>
              </Grid>
            )}
          </Grid>

          <Divider sx={{ my: 1 }} />

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Версии схемы</Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={loadVersions} disabled={versionsLoading}>Обновить</Button>
              <Button size="small" variant="outlined" startIcon={<UploadFileIcon />} onClick={triggerImportJson} disabled={!canManage}>Импорт из JSON</Button>
            </Stack>
          </Stack>
          {versionsError && <Alert severity="error">{versionsError}</Alert>}
          {!versionsError && versions.length === 0 && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>Версии ещё не созданы. Выполните импорт для первой версии.</Typography>
          )}
          <Grid container spacing={1}>
            {versions.map((v) => (
              <Grid key={String(v._id)} item xs={12} md={6}>
                <Paper sx={{ p: 1.5, borderRadius: 2, border: '1px solid #2a2f37' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{v.name} • v{v.version}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        Скоуп: {v.scope} • {v.isActive ? 'Активна' : 'Не активна'} • Полей: {(v.fields||[]).length}
                      </Typography>
                      {v.note && (
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>Заметка: {v.note}</Typography>
                      )}
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Chip size="small" label={v.isActive ? 'Активна' : 'Не активна'} color={v.isActive ? 'success' : 'default'} />
                      <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportVersion(v)}>Экспорт JSON</Button>
                      {!v.isActive && (
                        <Button size="small" variant="contained" disabled={!canManage} onClick={() => openConfirm('Активировать версию?', 'Текущая активная версия будет заменена.', () => activateVersion(v._id))}>Активировать</Button>
                      )}
                      {v.isActive && (
                        <Button size="small" variant="outlined" color="warning" disabled={!canManage} onClick={() => openConfirm('Деактивировать версию?', 'Версия станет неактивной.', () => deactivateVersion(v._id))}>Деактивировать</Button>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Paper>

      <Snackbar open={toast.open} autoHideDuration={2500} onClose={closeToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={closeToast} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>

      <Dialog open={confirmState.open} onClose={closeConfirm}>
        <DialogTitle>{confirmState.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{confirmState.content}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirm}>Отмена</Button>
          <Button onClick={async () => { try { await confirmState.onConfirm?.(); } finally { closeConfirm(); } }} variant="contained">Подтвердить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FieldsBuilderPage;