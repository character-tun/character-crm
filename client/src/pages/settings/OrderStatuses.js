import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, Stack, Chip, TextField, Checkbox, FormControlLabel, IconButton, Button, Alert, Divider } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { getStatuses, updateStatus, reorderStatuses } from '../../services/statusesService';
import SettingsBackBar from '../../components/SettingsBackBar';
import { useAuth } from '../../context/AuthContext';

const GROUP_LABELS = {
  draft: 'Черновики',
  in_progress: 'В работе',
  closed_success: 'Закрыто успешно',
  closed_fail: 'Закрыто неуспешно',
};

function normalizeActions(actions) {
  const set = new Set((actions || []).map(a => a?.type).filter(Boolean));
  return {
    charge: set.has('charge'),
    closeWithoutPayment: set.has('closeWithoutPayment'),
    payrollAccrual: set.has('payrollAccrual'),
    notify: set.has('notify'),
    print: set.has('print'),
  };
}

function actionsFromToggles(toggles) {
  const result = [];
  if (toggles.charge) result.push({ type: 'charge' });
  if (toggles.closeWithoutPayment) result.push({ type: 'closeWithoutPayment' });
  if (toggles.payrollAccrual) result.push({ type: 'payrollAccrual' });
  if (toggles.notify) result.push({ type: 'notify' });
  if (toggles.print) result.push({ type: 'print' });
  return result;
}

export default function OrderStatusesSettingsPage() {
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(['Admin']);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [groups, setGroups] = useState([]); // [{ group, items: [status] }]
  const [dirtyMap, setDirtyMap] = useState({}); // { id: true }

  const originals = useMemo(() => {
    const map = new Map();
    groups.forEach(g => g.items.forEach(s => map.set(s._id, s)));
    return map;
  }, [groups]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await getStatuses();
      const data = Array.isArray(res?.data) ? res.data : [];
      // augment items with toggles for actions
      const enhanced = data.map(gr => ({
        group: gr.group,
        items: (gr.items || []).map(it => ({
          ...it,
          _toggles: normalizeActions(it.actions),
        }))
      }));
      setGroups(enhanced);
      setDirtyMap({});
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Ошибка загрузки статусов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const markDirty = (id) => setDirtyMap(prev => ({ ...prev, [id]: true }));

  const handleNameChange = (groupIdx, itemIdx, value) => {
    setGroups(prev => {
      const next = [...prev];
      next[groupIdx] = { ...next[groupIdx] };
      next[groupIdx].items = [...next[groupIdx].items];
      next[groupIdx].items[itemIdx] = { ...next[groupIdx].items[itemIdx], name: value };
      return next;
    });
    markDirty(groups[groupIdx]?.items[itemIdx]?._id);
  };

  const handleColorChange = (groupIdx, itemIdx, value) => {
    setGroups(prev => {
      const next = [...prev];
      next[groupIdx] = { ...next[groupIdx] };
      next[groupIdx].items = [...next[groupIdx].items];
      next[groupIdx].items[itemIdx] = { ...next[groupIdx].items[itemIdx], color: value };
      return next;
    });
    markDirty(groups[groupIdx]?.items[itemIdx]?._id);
  };

  const handleToggle = (groupIdx, itemIdx, key, checked) => {
    setGroups(prev => {
      const next = [...prev];
      next[groupIdx] = { ...next[groupIdx] };
      next[groupIdx].items = [...next[groupIdx].items];
      const s = next[groupIdx].items[itemIdx];
      const toggles = { ...(s?._toggles || {}) };
      toggles[key] = checked;
      next[groupIdx].items[itemIdx] = { ...s, _toggles: toggles };
      return next;
    });
    markDirty(groups[groupIdx]?.items[itemIdx]?._id);
  };

  const moveItem = (groupIdx, itemIdx, delta) => {
    setGroups(prev => {
      const next = [...prev];
      const items = [...next[groupIdx].items];
      const newIndex = itemIdx + delta;
      if (newIndex < 0 || newIndex >= items.length) return prev; // no change
      const [moved] = items.splice(itemIdx, 1);
      items.splice(newIndex, 0, moved);
      // update order locally to reflect new index
      next[groupIdx] = { ...next[groupIdx], items: items.map((it, idx) => ({ ...it, order: idx })) };
      return next;
    });
  };

  const computeReorderPayload = () => {
    const payload = [];
    groups.forEach(gr => {
      (gr.items || []).forEach((s, idx) => {
        payload.push({ id: s._id, group: gr.group, order: idx });
      });
    });
    return payload;
  };

  const computeUpdates = () => {
    const updates = [];
    groups.forEach(gr => {
      (gr.items || []).forEach((s, idx) => {
        if (!dirtyMap[s._id]) return;
        const patch = {
          name: s.name,
          color: s.color,
          actions: actionsFromToggles(s._toggles || {}),
          group: gr.group,
          order: idx,
        };
        updates.push({ id: s._id, patch });
      });
    });
    return updates;
  };

  const onSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // First, persist ordering
      const reorderPayload = computeReorderPayload();
      if (reorderPayload.length) {
        await reorderStatuses(reorderPayload);
      }
      // Then, persist changed statuses
      const updates = computeUpdates();
      for (const u of updates) {
        await updateStatus(u.id, u.patch);
      }
      setSuccess('Изменения сохранены');
      setDirtyMap({});
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Ошибка сохранения изменений');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <SettingsBackBar title="Статусы заказов" onSave={isAdmin ? onSave : undefined} />

      {!isAdmin && (
        <Alert severity="info" sx={{ mb: 2 }}>
          У вас нет прав для изменения. Доступ на чтение. Обратитесь к администратору.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>
      )}

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Группы статусов</Typography>
        <Box sx={{ flex: 1 }} />
        {isAdmin && (
          <Button variant="contained" onClick={onSave} disabled={saving || loading}>
            Сохранить изменения
          </Button>
        )}
      </Stack>

      {loading && (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>Загрузка...</Typography>
      )}

      {!loading && groups.map((gr) => (
        <Box key={gr.group} sx={{ mb: 3 }}>
          <Chip label={GROUP_LABELS[gr.group] || gr.group || 'Группа'} sx={{ mb: 1, fontWeight: 700 }} />
          <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid var(--color-border)' }}>
            <Stack spacing={1}>
              {(gr.items || []).map((s, idx) => (
                <Box key={s._id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <IconButton size="small" onClick={() => moveItem(groups.findIndex(g => g.group === gr.group), idx, -1)} disabled={!isAdmin || idx === 0}>
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => moveItem(groups.findIndex(g => g.group === gr.group), idx, +1)} disabled={!isAdmin || idx === (gr.items.length - 1)}>
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>

                  <TextField
                    label="Название"
                    size="small"
                    value={s.name || ''}
                    onChange={(e) => handleNameChange(groups.findIndex(g => g.group === gr.group), idx, e.target.value)}
                    sx={{ minWidth: 220 }}
                    disabled={!isAdmin}
                  />

                  <TextField
                    label="Цвет"
                    size="small"
                    type="color"
                    value={s.color || '#000000'}
                    onChange={(e) => handleColorChange(groups.findIndex(g => g.group === gr.group), idx, e.target.value)}
                    sx={{ width: 72 }}
                    disabled={!isAdmin}
                  />

                  <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

                  <FormControlLabel
                    control={<Checkbox checked={!!(s._toggles?.charge)} onChange={(e) => handleToggle(groups.findIndex(g => g.group === gr.group), idx, 'charge', e.target.checked)} disabled={!isAdmin} />}
                    label="Начислить оплату"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={!!(s._toggles?.closeWithoutPayment)} onChange={(e) => handleToggle(groups.findIndex(g => g.group === gr.group), idx, 'closeWithoutPayment', e.target.checked)} disabled={!isAdmin} />}
                    label="Закрыть без оплаты"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={!!(s._toggles?.payrollAccrual)} onChange={(e) => handleToggle(groups.findIndex(g => g.group === gr.group), idx, 'payrollAccrual', e.target.checked)} disabled={!isAdmin} />}
                    label="Начислить в зарплату"
                  />

                  <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

                  <FormControlLabel
                    control={<Checkbox checked={!!(s._toggles?.notify)} onChange={(e) => handleToggle(groups.findIndex(g => g.group === gr.group), idx, 'notify', e.target.checked)} disabled />}
                    label="Уведомить (TODO)"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={!!(s._toggles?.print)} onChange={(e) => handleToggle(groups.findIndex(g => g.group === gr.group), idx, 'print', e.target.checked)} disabled />}
                    label="Печать (TODO)"
                  />

                  {s.system && (
                    <Chip label="Системный" size="small" sx={{ ml: 'auto', opacity: 0.7 }} />
                  )}
                </Box>
              ))}
            </Stack>
          </Paper>
        </Box>
      ))}
    </Box>
  );
}