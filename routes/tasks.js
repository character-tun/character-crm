const express = require('express');

const router = express.Router();
const Task = require('../models/Task');
const { requireAuth, requireRoles } = require('../middleware/auth');

// DEV auth mode: enable in-memory tasks store when AUTH_DEV_MODE=1
const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const statusOrder = ['Назначено', 'В работе', 'Проверка', 'Готово'];
const isManagerUser = (user = {}) => {
  const role = (user.role || '').toLowerCase();
  const roles = Array.isArray(user.roles) ? user.roles.map((r) => String(r).toLowerCase()) : [];
  return role === 'admin' || role === 'manager' || roles.includes('admin') || roles.includes('manager');
};
const mem = { tasks: [], idSeq: 1 };
const nextId = () => `T-${mem.idSeq++}`;
const sortMem = (list) => list.slice().sort((a, b) => {
  const sDiff = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
  if (sDiff !== 0) return sDiff;
  const ao = a.order ?? 0; const
    bo = b.order ?? 0;
  if (ao !== bo) return ao - bo;
  const ad = new Date(a.createdAt || 0).getTime();
  const bd = new Date(b.createdAt || 0).getTime();
  return bd - ad;
});

// GET /api/tasks
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.user || {};
    if (DEV_MODE) {
      const isManager = isManagerUser(user);
      const list = isManager ? mem.tasks.slice() : mem.tasks.filter((t) => t.assignee === user.id);
      return res.json(sortMem(list));
    }
    const isManager = ['admin', 'manager'].includes(user.role) || (Array.isArray(user.roles) && (user.roles.includes('Admin') || user.roles.includes('Manager')));
    const filter = isManager ? {} : { assignee: user.id };
    const tasks = await Task.find(filter).sort({ status: 1, order: 1, createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// GET /api/tasks/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user || {};
    if (DEV_MODE) {
      const task = mem.tasks.find((t) => t.id === req.params.id || t._id === req.params.id);
      if (!task) return res.status(404).json({ msg: 'Задача не найдена' });
      const isManager = isManagerUser(user);
      const isAssignee = task.assignee && task.assignee === user.id;
      if (!isManager && !isAssignee) {
        return res.status(403).json({ msg: 'Недостаточно прав для просмотра задачи' });
      }
      return res.json(task);
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ msg: 'Задача не найдена' });

    const isManager = ['admin', 'manager'].includes(user.role);
    const isAssignee = task.assignee && task.assignee === user.id;
    if (!isManager && !isAssignee) {
      return res.status(403).json({ msg: 'Недостаточно прав для просмотра задачи' });
    }

    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// POST /api/tasks
router.post('/', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    if (DEV_MODE) {
      const creator = (req.user && req.user.id) || body.assignee || '';
      const task = {
        id: nextId(),
        title: body.title,
        status: body.status || 'Назначено',
        priority: body.priority || 'Средний',
        deadline: body.deadline || '',
        assignee: body.assignee || creator || '',
        orderId: body.orderId || '',
        workOrderId: body.workOrderId || '',
        tags: body.tags || [],
        checklist: body.checklist || [],
        order: typeof body.order === 'number' ? body.order : 0,
        activity: [{ type: 'create', message: 'Задача создана', user: creator }],
        createdAt: new Date().toISOString(),
      };
      mem.tasks.unshift(task);
      return res.json(task);
    }

    const task = new Task({
      title: body.title,
      status: body.status || 'Назначено',
      priority: body.priority || 'Средний',
      deadline: body.deadline || '',
      assignee: body.assignee || '',
      orderId: body.orderId || '',
      workOrderId: body.workOrderId || '',
      tags: body.tags || [],
      checklist: body.checklist || [],
      order: typeof body.order === 'number' ? body.order : 0,
      activity: [{ type: 'create', message: 'Задача создана', user: (req.user && req.user.id) || body.assignee || '' }],
    });
    const saved = await task.save();
    res.json(saved);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// PUT /api/tasks/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const patch = req.body || {};
    const user = req.user || {};

    if (DEV_MODE) {
      const idx = mem.tasks.findIndex((t) => t.id === req.params.id || t._id === req.params.id);
      if (idx === -1) return res.status(404).json({ msg: 'Задача не найдена' });
      const task = mem.tasks[idx];
      const isManager = isManagerUser(user);
      const isAssignee = task.assignee && task.assignee === user.id;
      if ('assignee' in patch && patch.assignee !== task.assignee && !isManager) {
        return res.status(403).json({ msg: 'Недостаточно прав для смены исполнителя' });
      }
      if (!isManager && !isAssignee) {
        return res.status(403).json({ msg: 'Недостаточно прав для обновления задачи' });
      }
      const activityEntry = patch.activityEntry || { type: 'update', message: 'Задача обновлена' };
      mem.tasks[idx] = { ...task, ...patch, activity: [...(task.activity || []), { ...activityEntry, user: user.id || task.assignee || '', at: new Date() }] };
      return res.json(mem.tasks[idx]);
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ msg: 'Задача не найдена' });

    const isManager = ['admin', 'manager'].includes(user.role);
    const isAssignee = task.assignee && task.assignee === user.id;

    if ('assignee' in patch && patch.assignee !== task.assignee && !isManager) {
      return res.status(403).json({ msg: 'Недостаточно прав для смены исполнителя' });
    }
    if (!isManager && !isAssignee) {
      return res.status(403).json({ msg: 'Недостаточно прав для обновления задачи' });
    }

    Object.assign(task, patch);

    const activityEntry = patch.activityEntry || { type: 'update', message: 'Задача обновлена' };
    task.activity = [...(task.activity || []), { ...activityEntry, user: user.id || task.assignee || '', at: new Date() }];

    const saved = await task.save();
    res.json(saved);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// PATCH /api/tasks/:id/position
router.patch('/:id/position', requireAuth, async (req, res) => {
  try {
    const { status, order } = req.body || {};
    const user = req.user || {};

    if (DEV_MODE) {
      const idx = mem.tasks.findIndex((t) => t.id === req.params.id || t._id === req.params.id);
      if (idx === -1) return res.status(404).json({ msg: 'Задача не найдена' });
      const task = mem.tasks[idx];
      const isManager = isManagerUser(user);
      const isAssignee = task.assignee && task.assignee === user.id;
      if (!isManager && !isAssignee) {
        return res.status(403).json({ msg: 'Недостаточно прав для перемещения задачи' });
      }
      const next = { ...task };
      if (typeof status === 'string') next.status = status;
      if (typeof order === 'number') next.order = order;
      next.activity = [...(task.activity || []), { type: 'move', message: `Перемещено в '${status}'`, user: user.id || task.assignee || '' }];
      mem.tasks[idx] = next;
      return res.json(next);
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ msg: 'Задача не найдена' });

    const isManager = ['admin', 'manager'].includes(user.role);
    const isAssignee = task.assignee && task.assignee === user.id;
    if (!isManager && !isAssignee) {
      return res.status(403).json({ msg: 'Недостаточно прав для перемещения задачи' });
    }

    if (typeof status === 'string') task.status = status;
    if (typeof order === 'number') task.order = order;
    task.activity = [...(task.activity || []), { type: 'move', message: `Перемещено в '${status}'`, user: user.id || task.assignee || '' }];
    const saved = await task.save();
    res.json(saved);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user || {};
    if (DEV_MODE) {
      const idx = mem.tasks.findIndex((t) => t.id === req.params.id || t._id === req.params.id);
      if (idx === -1) return res.status(404).json({ msg: 'Задача не найдена' });
      const task = mem.tasks[idx];
      const isManager = isManagerUser(user);
      const isAssignee = task.assignee && task.assignee === user.id;
      if (!isManager && !isAssignee) {
        return res.status(403).json({ msg: 'Недостаточно прав для удаления задачи' });
      }
      mem.tasks.splice(idx, 1);
      return res.json({ msg: 'Удалено' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ msg: 'Задача не найдена' });

    const isManager = ['admin', 'manager'].includes(user.role);
    const isAssignee = task.assignee && task.assignee === user.id;
    if (!isManager && !isAssignee) {
      return res.status(403).json({ msg: 'Недостаточно прав для удаления задачи' });
    }

    await Task.deleteOne({ _id: req.params.id });
    res.json({ msg: 'Удалено' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

module.exports = router;
