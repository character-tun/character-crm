import React, { useEffect, useMemo, useState } from 'react';
import { Box, Grid, Paper, Stack, Typography, Button, TextField, Chip, Select, MenuItem, IconButton } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { DndContext, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useNavigate } from 'react-router-dom';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { tasksService } from '../services/tasksService';
import { ordersService } from '../services/ordersService';

const COLUMNS = ['Назначено', 'В работе', 'Проверка', 'Готово'];
const PRIORITIES = ['Низкий','Средний','Высокий','Критический'];

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('current_user');
    if (raw) return JSON.parse(raw).login || 'vblazhenov';
  } catch {}
  return 'vblazhenov';
};

const initialTasksFallback = [
  { id: 'T-1001', title: 'Промывка инжектора', priority: 'Средний', deadline: new Date().toISOString().slice(0,10), assignee: 'worker1', orderId: 'ORD-1002', workOrderId: 'WO-2001', tags: ['мотор'], checklist: [{text:'Подготовить химии', done:false}], status: 'Назначено', order: 0 },
  { id: 'T-1002', title: 'Полировка кузова', priority: 'Высокий', deadline: new Date().toISOString().slice(0,10), assignee: 'vblazhenov', orderId: 'ORD-1001', workOrderId: 'WO-2002', tags: ['кузов'], checklist: [{text:'Проверить лак', done:true},{text:'Заклеить молдинги', done:false}], status: 'В работе', order: 0 },
  { id: 'T-1003', title: 'Подбор стекла', priority: 'Низкий', deadline: new Date().toISOString().slice(0,10), assignee: 'manager1', orderId: 'ORD-1003', workOrderId: 'WO-2003', tags: ['стёкла'], checklist: [], status: 'Проверка', order: 0 },
  { id: 'T-1004', title: 'Отправка акта заказчику', priority: 'Средний', deadline: new Date().toISOString().slice(0,10), assignee: 'manager1', orderId: 'ORD-1003', workOrderId: 'WO-2003', tags: ['документы'], checklist: [{text:'Сформировать PDF', done:true}], status: 'Готово', order: 0 },
];

const mockSaveTask = (updated) => new Promise((resolve) => setTimeout(() => resolve(updated), 300));

function DraggableCard({ task, selected, onSelect, onOpenDetails, dragDisabled, orderName, workOrderName, onChangeAssignee, onChangeDeadline, assignees = [] }) {
  const theme = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id, disabled: !!dragDisabled });
  const [editingAssignee, setEditingAssignee] = React.useState(false);
  const [editingDeadline, setEditingDeadline] = React.useState(false);
  const [tmpAssignee, setTmpAssignee] = React.useState(task.assignee || '');
  const [tmpDeadline, setTmpDeadline] = React.useState(task.deadline || '');
  React.useEffect(() => { setTmpAssignee(task.assignee || ''); }, [task.assignee]);
  React.useEffect(() => { setTmpDeadline(task.deadline || ''); }, [task.deadline]);
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)',
    padding: 12,
    marginBottom: 8,
    cursor: dragDisabled ? 'default' : 'grab',
    backgroundColor: 'var(--color-surfaceAlt)',
    boxShadow: 'var(--shadow)'
  };
  const priorityColor = {
    'Низкий': 'default',
    'Средний': 'primary',
    'Высокий': 'warning',
    'Критический': 'error',
  }[task.priority] || 'default';
  return (
    <Paper ref={setNodeRef} style={style} onClick={() => onSelect(task.id)} className="kanban-pill" {...attributes}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton size="small" {...listeners} onClick={(e)=>e.stopPropagation()} disabled={!!dragDisabled}><DragIndicatorIcon fontSize="small" /></IconButton>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {task.title}
            </Typography>
          </Stack>
          <Chip size="small" label={task.priority} color={priorityColor} />
        </Stack>
        {/* Deadline inline edit */}
        {editingDeadline ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">Дедлайн:</Typography>
            <TextField size="small" type="date" value={tmpDeadline || ''}
                       onChange={(e)=>setTmpDeadline(e.target.value)}
                       onBlur={(e)=>{ setEditingDeadline(false); onChangeDeadline && onChangeDeadline(task.id, e.target.value); }}
                       onKeyDown={(e)=>{ if (e.key === 'Enter') { setEditingDeadline(false); onChangeDeadline && onChangeDeadline(task.id, tmpDeadline); } }}
                       sx={{ maxWidth: 180 }} />
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary" onClick={(e)=>{ e.stopPropagation(); setEditingDeadline(true); }}>
            Дедлайн: {task.deadline || '-'}
          </Typography>
        )}
        {/* Assignee inline edit */}
        {editingAssignee ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">Исполнитель:</Typography>
            <Select size="small" value={tmpAssignee || ''} onChange={(e)=>setTmpAssignee(e.target.value)}
                    onClose={()=>{ setEditingAssignee(false); onChangeAssignee && onChangeAssignee(task.id, tmpAssignee || ''); }}
                    sx={{ minWidth: 140 }}>
              <MenuItem value=""><em>-</em></MenuItem>
              {assignees.map((p) => (<MenuItem key={p} value={p}>{p}</MenuItem>))}
            </Select>
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary" onClick={(e)=>{ e.stopPropagation(); setEditingAssignee(true); }}>
            Исполнитель: {task.assignee || '-'}
          </Typography>
        )}
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {task.tags?.map((t, i) => (
            <Chip key={`${t}-${i}`} size="small" label={`#${t}`} variant="outlined" />
          ))}
          {task.orderId && <Chip size="small" label={`Заказ: ${orderName || task.orderId}`} variant="outlined" />}
          {task.workOrderId && <Chip size="small" label={`ПП: ${workOrderName || task.workOrderId}`} variant="outlined" />}
        </Stack>
        <Typography variant="caption" color="text.secondary">Чек-лист: {(task.checklist||[]).filter(c=>c.done).length}/{(task.checklist||[]).length}</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="small" variant="text" onClick={(e)=>{ e.stopPropagation(); onOpenDetails(task.id); }}>Подробнее</Button>
        </Box>
      </Stack>
    </Paper>
  );
}

function DroppableColumn({ id, children }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const style = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    minHeight: 80,
    borderRadius: 'var(--radius)',
    padding: 4,
    ...(isOver && { backgroundImage: 'linear-gradient(180deg, var(--secondary-a18), var(--primary-a14))' }),
  };
  return <Box ref={setNodeRef} className="kanban-column" sx={style}>{children}</Box>;
}

export default function TasksBoard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordersMap, setOrdersMap] = useState({});
  const [myOnly, setMyOnly] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('Средний');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const currentUser = useMemo(() => getCurrentUser(), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const list = await tasksService.list();
        if (!mounted) return;
        const normalized = list.map((t, i) => ({ ...t, id: t._id || t.id, order: typeof t.order === 'number' ? t.order : i }));
        setTasks(normalized);
        const ids = [...new Set(normalized.flatMap(t => [t.orderId, t.workOrderId].filter(Boolean)))];
        if (ids.length) {
          try {
            const map = await ordersService.getMany(ids);
            if (mounted) setOrdersMap(map);
          } catch (e) {
            console.warn('Не удалось загрузить названия заказов/ПП', e);
          }
        }
      } catch (e) {
        console.error('Failed to load tasks', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    return myOnly ? tasks.filter((t) => t.assignee === currentUser) : tasks;
  }, [tasks, myOnly, currentUser]);

  const byColumn = useMemo(() => {
    const obj = Object.fromEntries(COLUMNS.map((c) => [c, []]));
    for (const t of filtered) (obj[t.status] || (obj[t.status] = [])).push(t);
    for (const c of COLUMNS) obj[c] = (obj[c] || []).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
    return obj;
  }, [filtered]);

  const renormalize = (list) => {
    const updated = [...list];
    COLUMNS.forEach((col) => {
      const colTasks = updated.filter((t) => t.status === col).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
      colTasks.forEach((t, idx) => {
        const i = updated.findIndex((u) => u.id === t.id);
        updated[i] = { ...updated[i], order: idx };
      });
    });
    return updated;
  };

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    const tempId = `tmp-${Date.now()}`;
    const optimistic = { id: tempId, title: newTitle.trim(), priority: newPriority, deadline: new Date().toISOString().slice(0,10), assignee: currentUser, orderId: '', workOrderId: '', tags: [], checklist: [], status: 'Назначено', order: 0 };
    setTasks((prev) => renormalize([optimistic, ...prev]));
    setNewTitle('');
    try {
      const created = await tasksService.create({
        title: optimistic.title,
        priority: optimistic.priority,
        deadline: optimistic.deadline,
        assignee: optimistic.assignee,
        orderId: optimistic.orderId,
        workOrderId: optimistic.workOrderId,
        tags: optimistic.tags,
        checklist: optimistic.checklist,
        status: optimistic.status,
        order: optimistic.order,
      });
      const createdNormalized = { ...created, id: created._id || created.id };
      setTasks((prev) => renormalize(prev.map((t) => (t.id === tempId ? createdNormalized : t))));
    } catch (e) {
      console.error('Не удалось создать задачу', e);
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
    }
  };

  const handleAddSubtask = async () => {
    if (!selectedTaskId) return;
    const newItem = { id: `cl-${Date.now()}`, text: 'Подзадача', done: false };
    const prev = tasks;
    const next = renormalize(tasks.map((t) => (
      t.id === selectedTaskId ? { ...t, checklist: [...(t.checklist||[]), newItem] } : t
    )));
    setTasks(next);
    try {
      const updated = next.find((t) => t.id === selectedTaskId);
      await tasksService.update(selectedTaskId, { checklist: updated.checklist });
    } catch (e) {
      console.error('Не удалось добавить пункт чек-листа', e);
      setTasks(prev);
    }
  };

  const handleDragEnd = async ({ active, over }) => {
    if (!active?.id || !over?.id) return;
    const activeId = active.id;
    const overId = over.id;
    const sourceTask = tasks.find((t) => t.id === activeId);
    if (!sourceTask) return;
    if (sourceTask.assignee && sourceTask.assignee !== currentUser) return; // запрет перемещения чужих задач
    const overTask = tasks.find((t) => t.id === overId);
    const targetCol = overTask ? overTask.status : (COLUMNS.includes(overId) ? overId : sourceTask.status);

    if (sourceTask.status === targetCol && overTask) {
      // reorder внутри одной колонки
      const col = sourceTask.status;
      const colTasks = tasks.filter((t) => t.status === col).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
      const oldIndex = colTasks.findIndex((t) => t.id === activeId);
      const newIndex = colTasks.findIndex((t) => t.id === overId);
      const moved = arrayMove(colTasks, oldIndex, newIndex);
      let next = [...tasks];
      moved.forEach((t, idx) => {
        const i = next.findIndex((u) => u.id === t.id);
        next[i] = { ...next[i], order: idx };
      });
      next = renormalize(next);
      const prev = tasks;
      setTasks(next);
      try {
        const movedTask = next.find((t) => t.id === activeId);
        await tasksService.updatePosition(activeId, { status: movedTask.status, order: movedTask.order });
      } catch (e) {
        console.error('Не удалось обновить порядок', e);
        setTasks(prev);
      }
      return;
    }

    // перенос между колонками
    const prev = tasks;
    let next = tasks.map((t) => (t.id === activeId ? { ...t, status: targetCol, order: 0 } : t));
    next = renormalize(next);
    setTasks(next);
    try {
      const movedTask = next.find((t) => t.id === activeId);
      await tasksService.updatePosition(activeId, { status: movedTask.status, order: movedTask.order });
    } catch (e) {
      console.error('Не удалось переместить', e);
      setTasks(prev);
    }
  };

  const assignees = useMemo(() => {
    const base = [currentUser, 'manager1', 'worker1'];
    const set = new Set(base.concat(tasks.map(t => t.assignee).filter(Boolean)));
    return Array.from(set);
  }, [tasks, currentUser]);

  const updateTaskOptimistic = async (id, patch, activityEntry) => {
    const prev = tasks;
    const next = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    setTasks(next);
    try {
      await tasksService.update(id, { ...patch, activityEntry });
    } catch (e) {
      console.error('Не удалось сохранить изменения', e);
      setTasks(prev);
    }
  };

  const changeAssignee = (id, assignee) => {
    if (!id) return;
    updateTaskOptimistic(id, { assignee }, { type: 'assign', message: `Назначен: ${assignee}` });
  };

  const changeDeadline = (id, deadline) => {
    if (!id) return;
    updateTaskOptimistic(id, { deadline }, { type: 'deadline', message: `Срок: ${deadline}` });
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Задачи — Канбан</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant={myOnly ? 'contained' : 'outlined'} onClick={() => setMyOnly((v)=>!v)}>Мои задачи</Button>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField size="small" fullWidth placeholder="Новая задача" value={newTitle} onChange={(e)=>setNewTitle(e.target.value)} />
        <Select size="small" value={newPriority} onChange={(e)=>setNewPriority(e.target.value)}>
          {PRIORITIES.map((p)=>(<MenuItem key={p} value={p}>{p}</MenuItem>))}
        </Select>
        <Button variant="contained" onClick={handleAddTask}>+ Задача</Button>
        <Button variant="outlined" onClick={handleAddSubtask} disabled={!selectedTaskId}>+ Подзадача</Button>
      </Stack>

      <DndContext onDragEnd={handleDragEnd}>
        <Grid container spacing={2}>
          {COLUMNS.map((col) => (
            <Grid item xs={12} md={3} key={col}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.6)}` }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>{col}</Typography>
                <DroppableColumn id={col}>
                  <SortableContext items={byColumn[col].map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {byColumn[col].map((task) => (
                      <DraggableCard
                        key={task.id}
                        task={task}
                        selected={selectedTaskId===task.id}
                        onSelect={setSelectedTaskId}
                        onOpenDetails={(id)=>navigate(`/tasks/${id}`)}
                        dragDisabled={task.assignee && task.assignee !== currentUser}
                        orderName={ordersMap[task.orderId]?.service}
                        workOrderName={ordersMap[task.workOrderId]?.service}
                        onChangeAssignee={changeAssignee}
                        onChangeDeadline={changeDeadline}
                        assignees={assignees}
                      />
                    ))}
                  </SortableContext>
                </DroppableColumn>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </DndContext>
    </Box>
  );
}



export function TasksBoardDuplicate() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordersMap, setOrdersMap] = useState({});
  const [myOnly, setMyOnly] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('Средний');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const currentUser = useMemo(() => getCurrentUser(), []);

  const assignees = useMemo(() => {
    const base = [currentUser, 'manager1', 'worker1'];
    const set = new Set(base.concat(tasks.map(t => t.assignee).filter(Boolean)));
    return Array.from(set);
  }, [tasks, currentUser]);

  const updateTaskOptimistic = async (id, patch, activityEntry) => {
    const prev = tasks;
    const next = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    setTasks(next);
    try {
      await tasksService.update(id, { ...patch, activityEntry });
    } catch (e) {
      console.error('Не удалось сохранить изменения', e);
      setTasks(prev);
    }
  };

  const changeAssignee = (id, assignee) => {
    if (!id) return;
    updateTaskOptimistic(id, { assignee }, { type: 'assign', message: `Назначен: ${assignee}` });
  };

  const changeDeadline = (id, deadline) => {
    if (!id) return;
    updateTaskOptimistic(id, { deadline }, { type: 'deadline', message: `Срок: ${deadline}` });
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const list = await tasksService.list();
        if (!mounted) return;
        const normalized = list.map((t, i) => ({ ...t, id: t._id || t.id, order: typeof t.order === 'number' ? t.order : i }));
        setTasks(normalized);
        const ids = [...new Set(normalized.flatMap(t => [t.orderId, t.workOrderId].filter(Boolean)))];
        if (ids.length) {
          try {
            const map = await ordersService.getMany(ids);
            if (mounted) setOrdersMap(map);
          } catch (e) {
            console.warn('Не удалось загрузить названия заказов/ПП', e);
          }
        }
      } catch (e) {
        console.error('Failed to load tasks', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    return myOnly ? tasks.filter((t) => t.assignee === currentUser) : tasks;
  }, [tasks, myOnly, currentUser]);

  const byColumn = useMemo(() => {
    const obj = Object.fromEntries(COLUMNS.map((c) => [c, []]));
    for (const t of filtered) (obj[t.status] || (obj[t.status] = [])).push(t);
    for (const c of COLUMNS) obj[c] = (obj[c] || []).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
    return obj;
  }, [filtered]);

  const renormalize = (list) => {
    const updated = [...list];
    COLUMNS.forEach((col) => {
      const colTasks = updated.filter((t) => t.status === col).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
      colTasks.forEach((t, idx) => {
        const i = updated.findIndex((u) => u.id === t.id);
        updated[i] = { ...updated[i], order: idx };
      });
    });
    return updated;
  };

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    const tempId = `tmp-${Date.now()}`;
    const optimistic = { id: tempId, title: newTitle.trim(), priority: newPriority, deadline: new Date().toISOString().slice(0,10), assignee: currentUser, orderId: '', workOrderId: '', tags: [], checklist: [], status: 'Назначено', order: 0 };
    setTasks((prev) => renormalize([optimistic, ...prev]));
    setNewTitle('');
    try {
      const created = await tasksService.create({
        title: optimistic.title,
        priority: optimistic.priority,
        deadline: optimistic.deadline,
        assignee: optimistic.assignee,
        orderId: optimistic.orderId,
        workOrderId: optimistic.workOrderId,
        tags: optimistic.tags,
        checklist: optimistic.checklist,
        status: optimistic.status,
        order: optimistic.order,
      });
      const createdNormalized = { ...created, id: created._id || created.id };
      setTasks((prev) => renormalize(prev.map((t) => (t.id === tempId ? createdNormalized : t))));
    } catch (e) {
      console.error('Не удалось создать задачу', e);
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
    }
  };

  const handleAddSubtask = async () => {
    if (!selectedTaskId) return;
    const newItem = { id: `cl-${Date.now()}`, text: 'Подзадача', done: false };
    const prev = tasks;
    const next = renormalize(tasks.map((t) => (
      t.id === selectedTaskId ? { ...t, checklist: [...(t.checklist||[]), newItem] } : t
    )));
    setTasks(next);
    try {
      const updated = next.find((t) => t.id === selectedTaskId);
      await tasksService.update(selectedTaskId, { checklist: updated.checklist });
    } catch (e) {
      console.error('Не удалось добавить пункт чек-листа', e);
      setTasks(prev);
    }
  };

  const handleDragEnd = async ({ active, over }) => {
    if (!active?.id || !over?.id) return;
    const activeId = active.id;
    const overId = over.id;
    const sourceTask = tasks.find((t) => t.id === activeId);
    if (!sourceTask) return;
    if (sourceTask.assignee && sourceTask.assignee !== currentUser) return; // запрет перемещения чужих задач
    const overTask = tasks.find((t) => t.id === overId);
    const targetCol = overTask ? overTask.status : (COLUMNS.includes(overId) ? overId : sourceTask.status);

    if (sourceTask.status === targetCol && overTask) {
      // reorder внутри одной колонки
      const col = sourceTask.status;
      const colTasks = tasks.filter((t) => t.status === col).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
      const oldIndex = colTasks.findIndex((t) => t.id === activeId);
      const newIndex = colTasks.findIndex((t) => t.id === overId);
      const moved = arrayMove(colTasks, oldIndex, newIndex);
      let next = [...tasks];
      moved.forEach((t, idx) => {
        const i = next.findIndex((u) => u.id === t.id);
        next[i] = { ...next[i], order: idx };
      });
      next = renormalize(next);
      const prev = tasks;
      setTasks(next);
      try {
        const movedTask = next.find((t) => t.id === activeId);
        await tasksService.updatePosition(activeId, { status: movedTask.status, order: movedTask.order });
      } catch (e) {
        console.error('Не удалось обновить порядок', e);
        setTasks(prev);
      }
      return;
    }

    // перенос между колонками
    const prev = tasks;
    let next = tasks.map((t) => (t.id === activeId ? { ...t, status: targetCol, order: 0 } : t));
    next = renormalize(next);
    setTasks(next);
    try {
      const movedTask = next.find((t) => t.id === activeId);
      await tasksService.updatePosition(activeId, { status: movedTask.status, order: movedTask.order });
    } catch (e) {
      console.error('Не удалось переместить', e);
      setTasks(prev);
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Задачи — Канбан</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant={myOnly ? 'contained' : 'outlined'} onClick={() => setMyOnly((v)=>!v)}>Мои задачи</Button>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField size="small" fullWidth placeholder="Новая задача" value={newTitle} onChange={(e)=>setNewTitle(e.target.value)} />
        <Select size="small" value={newPriority} onChange={(e)=>setNewPriority(e.target.value)}>
          {PRIORITIES.map((p)=>(<MenuItem key={p} value={p}>{p}</MenuItem>))}
        </Select>
        <Button variant="contained" onClick={handleAddTask}>+ Задача</Button>
        <Button variant="outlined" onClick={handleAddSubtask} disabled={!selectedTaskId}>+ Подзадача</Button>
      </Stack>

      <DndContext onDragEnd={handleDragEnd}>
        <Grid container spacing={2}>
          {COLUMNS.map((col) => (
            <Grid item xs={12} md={3} key={col}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.6)}` }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>{col}</Typography>
                <DroppableColumn id={col}>
                  <SortableContext items={byColumn[col].map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {byColumn[col].map((task) => (
                      <DraggableCard
                        key={task.id}
                        task={task}
                        selected={selectedTaskId===task.id}
                        onSelect={setSelectedTaskId}
                        onOpenDetails={(id)=>navigate(`/tasks/${id}`)}
                        dragDisabled={task.assignee && task.assignee !== currentUser}
                        orderName={ordersMap[task.orderId]?.service}
                        workOrderName={ordersMap[task.workOrderId]?.service}
                        onChangeAssignee={changeAssignee}
                        onChangeDeadline={changeDeadline}
                        assignees={assignees}
                      />
                    ))}
                  </SortableContext>
                </DroppableColumn>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </DndContext>
    </Box>
  );
}