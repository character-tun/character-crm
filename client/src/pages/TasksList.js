import React, { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Stack, Typography, Button, TextField, Chip, Select, MenuItem } from '@mui/material';
import DataGridBase from '../components/DataGridBase';

const PRIORITIES = ['Низкий','Средний','Высокий','Критический'];
const getCurrentUser = () => {
  try { const raw = localStorage.getItem('current_user'); if (raw) return JSON.parse(raw).login || 'vblazhenov'; } catch {}
  return 'vblazhenov';
};

export default function TasksList() {
  const [tasks, setTasks] = useState(() => {
    try { const raw = localStorage.getItem('tasks'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [myOnly, setMyOnly] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('Средний');
  const currentUser = useMemo(() => getCurrentUser(), []);

  useEffect(() => { try { localStorage.setItem('tasks', JSON.stringify(tasks)); } catch {} }, [tasks]);

  const filtered = useMemo(() => (myOnly ? tasks.filter((t)=>t.assignee===currentUser) : tasks), [tasks, myOnly, currentUser]);

  const handleAddTask = () => {
    if (!newTitle.trim()) return;
    const id = `T-${Math.floor(1000 + Math.random()*9000)}`;
    const newTask = { id, title: newTitle.trim(), priority: newPriority, deadline: new Date().toISOString().slice(0,10), assignee: currentUser, orderId: '', workOrderId: '', tags: [], checklist: [], status: 'Назначено' };
    setTasks((prev)=>[newTask, ...prev]);
    setNewTitle('');
  };

  const columns = useMemo(() => [
    { field: 'id', headerName: 'ID', width: 120 },
    { field: 'title', headerName: 'Заголовок', flex: 2, minWidth: 220 },
    {
      field: 'priority',
      headerName: 'Приоритет',
      width: 140,
      renderCell: (params) => <Chip size="small" label={params.value} color={params.value==='Критический' ? 'error' : params.value==='Высокий' ? 'warning' : 'default'} variant="outlined" />,
    },
    { field: 'deadline', headerName: 'Дедлайн', width: 140 },
    { field: 'assignee', headerName: 'Исполнитель', width: 160 },
    { field: 'status', headerName: 'Статус', width: 140 },
    {
      field: 'tags',
      headerName: 'Тэги',
      flex: 1,
      minWidth: 200,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {(params.value||[]).map((tag, i)=>(<Chip key={`${tag}-${i}`} size="small" label={`#${tag}`} variant="outlined" />))}
        </Stack>
      ),
    },
    {
      field: 'checklist',
      headerName: 'Чек-лист',
      width: 120,
      valueGetter: (params) => `${(params.value||[]).filter(c=>c.done).length}/${(params.value||[]).length}`,
    },
    {
      field: 'links',
      headerName: 'Связи',
      flex: 1,
      minWidth: 220,
      sortable: false,
      valueGetter: (params) => params.row, // pass row to renderCell
      renderCell: (params) => (
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {params.value.orderId && <Chip size="small" label={`Заказ: ${params.value.orderId}`} variant="outlined" />}
          {params.value.workOrderId && <Chip size="small" label={`ПП: ${params.value.workOrderId}`} variant="outlined" />}
        </Stack>
      ),
    },
  ], []);

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Задачи — Список</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant={myOnly ? 'contained' : 'outlined'} onClick={() => setMyOnly((v)=>!v)}>Мои задачи</Button>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField size="small" fullWidth placeholder="Новая задача" value={newTitle} onChange={(e)=>setNewTitle(e.target.value)} />
        <Select size="small" value={newPriority} onChange={(e)=>setNewPriority(e.target.value)}>
          {PRIORITIES.map((p)=>(<MenuItem key={p} value={p}>{p}</MenuItem>))}
        </Select>
        <Button variant="contained" onClick={handleAddTask}>+ Задача</Button>
      </Stack>

      <Paper>
        <DataGridBase
          autoHeight
          rows={filtered}
          columns={columns}
          getRowId={(row)=>row.id}
          checkboxSelection={false}
        />
      </Paper>
    </Box>
  );
}