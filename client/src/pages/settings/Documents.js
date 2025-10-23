import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Stack, Typography, Button, IconButton, Divider, List, ListItemButton, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, Tooltip } from '@mui/material';
import FormField from '../../components/FormField';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AddIcon from '@mui/icons-material/Add';
import SettingsBackBar from '../../components/SettingsBackBar';
import ModalBase from '../../components/ModalBase';

const DOCS_KEY = 'settings_documents';
const DOC_META_KEY = 'document_meta';

const DEFAULT_DOCS = [
  { name: 'Акт выполненных работ', module: 'Заказы' },
  { name: 'Акт приема-передачи ТС', module: 'Заказы' },
  { name: 'Приемная квитанция', module: 'Заказы' },
  { name: 'Товарный чек', module: 'Магазин' },
  { name: 'Ценник ленточный', module: 'Склад' },
  { name: 'Этикетка ленточная', module: 'Склад' },
];

const MODULES = ['Заказы', 'Магазин', 'Склад', 'Прочее'];

const getDocsList = () => {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    const arr = JSON.parse(raw || '[]');
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {}
  // fallback to default names only (backward-compatible for OrderTypes)
  return DEFAULT_DOCS.map((d) => d.name);
};

const getMeta = () => {
  try {
    const raw = localStorage.getItem(DOC_META_KEY);
    const obj = JSON.parse(raw || '{}');
    if (obj && typeof obj === 'object') return obj;
  } catch {}
  // build defaults
  const meta = {};
  DEFAULT_DOCS.forEach((d) => { meta[d.name] = { module: d.module, page: { size: 'A4', margin: '12mm' } }; });
  return meta;
};

const setDocsAndMeta = (docs, meta) => {
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
    localStorage.setItem(DOC_META_KEY, JSON.stringify(meta));
  } catch {}
};

function HelpBlock() {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <HelpOutlineIcon sx={{ color: 'text.secondary' }} />
        <Typography variant="h6">Справка</Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Создавайте собственные документы. Ниже — ответы на частые вопросы.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>Документ не отображается в списке печати</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Перейдите в «Настройки → Типы заказа» и привяжите документ к нужному типу. У каждого типа может быть свой набор документов.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Как уменьшить QR-код в документе?</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Поместите переменную QR-кода в ячейку таблицы. Измените размер ячейки — ширина ячейки определяет размер QR-кода.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Текст накладывается на текст</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Увеличьте ширину столбцов/высоту строк, уменьшите размер шрифта, сократите текст или разделите его на несколько ячеек.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Как добавить логотип?</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        В редакторе: откройте блок «Переменные» справа, загрузите изображение логотипа и перетащите переменную в таблицу.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Как убрать браузерные колонтитулы (Дата/HelloClient)?</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        В Chrome в окне предварительного просмотра печати откройте «Дополнительные настройки» и снимите галочку «Верхние и нижние колонтитулы». Это элементы браузера, а не HelloClient.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Как создать свою квитанцию?</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Перейдите в «Настройки → Документы», выберите стандартную квитанцию или создайте новую. Используйте синие переменные на боковой панели — переменная вставляется по клику в позицию курсора.
      </Typography>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Печать ценников и этикеток</Typography>
      <Typography variant="body2">
        Используйте готовые шаблоны или создайте свои. Печать возможна на термопринтере (оптимизированные шаблоны) и обычном принтере (А4 и другие форматы).
      </Typography>
    </Paper>
  );
}

export default function DocumentsSettingsPage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [meta, setMeta] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newModule, setNewModule] = useState('Заказы');

  useEffect(() => {
    setDocs(getDocsList());
    setMeta(getMeta());
  }, []);

  const grouped = useMemo(() => {
    const g = {};
    docs.forEach((name) => {
      const m = meta?.[name]?.module || (DEFAULT_DOCS.find((d) => d.name === name)?.module) || 'Прочее';
      g[m] = g[m] || [];
      g[m].push(name);
    });
    return g;
  }, [docs, meta]);

  const openEditor = (name) => {
    navigate(`/settings/documents/${encodeURIComponent(name)}`);
  };

  const onCreate = () => {
    const name = (newName || '').trim();
    if (!name) return;
    if (docs.includes(name)) { setCreateOpen(false); setNewName(''); return; }
    const updatedDocs = [...docs, name];
    const updatedMeta = { ...meta, [name]: { module: newModule, page: { size: 'A4', margin: '12mm' } } };
    setDocs(updatedDocs);
    setMeta(updatedMeta);
    setDocsAndMeta(updatedDocs, updatedMeta);
    setCreateOpen(false);
    setNewName('');
  };

  return (
    <Box>
      <SettingsBackBar title="Документы" subtitle="Создавайте собственные документы" />

      <Stack direction="row" spacing={2} sx={{ mb: 2, justifyContent: 'flex-end' }}>
        <Tooltip title="Справка">
          <IconButton onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>
            <HelpOutlineIcon />
          </IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Документ</Button>
      </Stack>

      {Object.keys(grouped).map((mod) => (
        <Paper key={mod} variant="outlined" sx={{ mb: 2 }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{mod}</Typography>
          </Box>
          <Divider />
          <List>
            {(grouped[mod] || []).map((name) => (
              <ListItemButton key={name} onClick={() => openEditor(name)}>
                <ListItemText primary={name} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      ))}

      <HelpBlock />

      <ModalBase
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Документ"
        maxWidth="sm"
        actions={(
          <React.Fragment>
            <Button onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button variant="contained" onClick={onCreate}>Сохранить</Button>
          </React.Fragment>
        )}
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormField label="Название" required fullWidth>
            <TextField value={newName} onChange={(e) => setNewName(e.target.value)} fullWidth />
          </FormField>
          <FormField label="Модуль" fullWidth>
            <Select value={newModule} onChange={(e) => setNewModule(e.target.value)} fullWidth>
              {MODULES.map((m) => (<MenuItem key={m} value={m}>{m}</MenuItem>))}
            </Select>
          </FormField>
        </Stack>
      </ModalBase>
    </Box>
  );
}