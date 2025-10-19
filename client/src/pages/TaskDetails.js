import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Stack, Typography, TextField, Select, MenuItem, Chip, Button, Checkbox, IconButton, Paper } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { tasksService } from '../services/tasksService';

const PRIORITIES = ['Низкий','Средний','Высокий','Критический'];

const readTasks = () => {
  try { const raw = localStorage.getItem('tasks'); return raw ? JSON.parse(raw) : []; } catch { return []; }
};

export default function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const [task, setTask] = useState(null);
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await tasksService.get(id);
        const normalized = {
          id: data._id || data.id || id,
          title: data.title || '',
          status: data.status || 'Назначено',
          priority: data.priority || 'Средний',
          deadline: data.deadline || '',
          assignee: data.assignee || '',
          orderId: data.orderId || '',
          workOrderId: data.workOrderId || '',
          tags: data.tags || [],
          checklist: data.checklist || [],
          activity: data.activity || [],
        };
        if (!mounted) return;
        setTask(normalized);
      } catch (e) {
        const fromLs = readTasks().find(x=>x.id===id);
        setTask(fromLs || null);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (!task) {
    return (
      <Box>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>Задача не найдена</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="outlined" onClick={() => navigate(-1)}>Назад</Button>
        </Stack>
        <Typography color="text.secondary">ID: {id}</Typography>
      </Box>
    );
  }

  const setField = (key, value) => setTask((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { title: task.title, priority: task.priority, deadline: task.deadline, assignee: task.assignee, orderId: task.orderId, workOrderId: task.workOrderId, tags: task.tags, checklist: task.checklist };
      await tasksService.update(id, payload);
      navigate(-1);
    } catch (e) {
      console.error('Ошибка сохранения', e);
    } finally {
      setSaving(false);
    }
  };

  const addChecklistItem = () => {
    setTask((prev) => ({ ...prev, checklist: [...(prev.checklist||[]), { text: 'Новый пункт', done: false }] }));
  };

  const toggleChecklistItem = (i) => {
    setTask((prev) => ({
      ...prev,
      checklist: (prev.checklist||[]).map((c, idx) => idx === i ? { ...c, done: !c.done } : c)
    }));
  };

  const editChecklistItem = (i, text) => {
    setTask((prev) => ({
      ...prev,
      checklist: (prev.checklist||[]).map((c, idx) => idx === i ? { ...c, text } : c)
    }));
  };

  const removeChecklistItem = (i) => {
    setTask((prev) => ({
      ...prev,
      checklist: (prev.checklist||[]).filter((_, idx) => idx !== i)
    }));
  };

  const addTag = () => {
    const clean = tagsInput.trim();
    if (!clean) return;
    setTask((prev) => ({ ...prev, tags: [ ...(prev.tags||[]), clean ] }));
    setTagsInput('');
  };

  const removeTag = (t) => {
    setTask((prev) => ({ ...prev, tags: (prev.tags||[]).filter((x) => x !== t) }));
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Детали задачи</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" onClick={() => navigate(-1)} disabled={saving}>Назад</Button>
        <Button variant="contained" onClick={save} disabled={saving}>Сохранить</Button>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.6)}` }}>
        <Stack spacing={2}>
          <TextField label="Название" value={task.title || ''} onChange={(e)=>setField('title', e.target.value)} fullWidth />

          <Stack direction="row" spacing={2}>
            <Select fullWidth value={task.priority || 'Средний'} onChange={(e)=>setField('priority', e.target.value)}>
              {PRIORITIES.map((p)=>(<MenuItem key={p} value={p}>{p}</MenuItem>))}
            </Select>
            <TextField label="Дедлайн" type="date" value={task.deadline || ''} onChange={(e)=>setField('deadline', e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField label="Исполнитель" value={task.assignee || ''} onChange={(e)=>setField('assignee', e.target.value)} fullWidth />
            <TextField label="Заказ (orderId)" value={task.orderId || ''} onChange={(e)=>setField('orderId', e.target.value)} fullWidth />
            <TextField label="ПП (workOrderId)" value={task.workOrderId || ''} onChange={(e)=>setField('workOrderId', e.target.value)} fullWidth />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Теги</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField size="small" placeholder="Новый тег" value={tagsInput} onChange={(e)=>setTagsInput(e.target.value)} />
              <Button size="small" variant="outlined" onClick={addTag}>+ Тег</Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {(task.tags||[]).map((t) => (
                <Chip key={t} label={`#${t}`} onDelete={()=>removeTag(t)} />
              ))}
            </Stack>
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Чек-лист</Typography>
            <Button size="small" variant="outlined" onClick={addChecklistItem}>+ Пункт</Button>
            <Stack spacing={1}>
              {(task.checklist||[]).map((c, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <Checkbox checked={!!c.done} onChange={()=>toggleChecklistItem(i)} />
                  <TextField size="small" fullWidth value={c.text || ''} onChange={(e)=>editChecklistItem(i, e.target.value)} />
                  <IconButton color="error" onClick={()=>removeChecklistItem(i)}><DeleteOutlineIcon /></IconButton>
                </Stack>
              ))}
            </Stack>
          </Stack>

          {Array.isArray(task.activity) && task.activity.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Активность</Typography>
              <Stack spacing={0.5}>
                {task.activity.map((a, i) => (
                  <Typography key={i} variant="caption" color="text.secondary">{new Date(a.at || Date.now()).toLocaleString()} · {a.type}: {a.message}</Typography>
                ))}
              </Stack>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}