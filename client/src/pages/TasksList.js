import React, { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Stack, Typography, Button, TextField, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Select, MenuItem } from '@mui/material';
import { alpha } from '@mui/material/styles';

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

      <TableContainer component={Paper} sx={{ borderRadius: 2, border: (theme)=>`1px solid ${theme.palette.divider}` }}>
        <Table size="small" sx={(theme)=>({
          '& tbody tr:nth-of-type(odd)': { backgroundColor: alpha(theme.palette.primary.main, 0.03) },
          '& tbody tr:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
        })}>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Заголовок</TableCell>
              <TableCell>Приоритет</TableCell>
              <TableCell>Дедлайн</TableCell>
              <TableCell>Исполнитель</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Тэги</TableCell>
              <TableCell>Чек-лист</TableCell>
              <TableCell>Связи</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.id}</TableCell>
                <TableCell>{t.title}</TableCell>
                <TableCell>{t.priority}</TableCell>
                <TableCell>{t.deadline || '-'}</TableCell>
                <TableCell>{t.assignee || '-'}</TableCell>
                <TableCell>{t.status}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {(t.tags||[]).map((tag, i)=>(<Chip key={`${tag}-${i}`} size="small" label={`#${tag}`} variant="outlined" />))}
                  </Stack>
                </TableCell>
                <TableCell>{(t.checklist||[]).filter(c=>c.done).length}/{(t.checklist||[]).length}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {t.orderId && <Chip size="small" label={`Заказ: ${t.orderId}`} variant="outlined" />}
                    {t.workOrderId && <Chip size="small" label={`ПП: ${t.workOrderId}`} variant="outlined" />}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}