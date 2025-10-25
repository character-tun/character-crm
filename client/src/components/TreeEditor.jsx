import React, { useMemo, useState } from 'react';
import { Box, Stack, Typography, TextField, IconButton, Button, Tooltip } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { TreeView, TreeItem } from '@mui/lab';

/**
 * TreeEditor — простой редактор дерева на основе MUI TreeView.
 * Предназначен для двухуровневой структуры: категории (узлы) и подстатьи (листья-строки).
 * Поддерживает:
 * - drag-n-drop категорий и подстатей (перемещение между категориями, изменение порядка)
 * - inline-редактирование названий
 * - добавление и удаление узлов
 *
 * Props:
 * - title?: string — заголовок блока
 * - color?: string — основной цвет лейблов (например, зелёный/красный)
 * - tree: Array<{ name: string; children: string[] }>
 * - onChange: (next: Array<{ name: string; children: string[] }>) => void
 */
export default function TreeEditor({ title, color = '#1976d2', tree = [], onChange }) {
  const [newCategory, setNewCategory] = useState('');
  const [editingCat, setEditingCat] = useState(null); // name
  const [editingLeaf, setEditingLeaf] = useState(null); // key `${catName}::${leafName}`
  const [newLeafByCat, setNewLeafByCat] = useState({});

  const nodeIds = useMemo(() => {
    // stable ids for rendering
    const ids = [];
    tree.forEach((cat, i) => {
      ids.push(`cat-${i}`);
      (cat.children || []).forEach((_, j) => ids.push(`leaf-${i}-${j}`));
    });
    return ids;
  }, [tree]);

  const commitTree = (next) => {
    onChange && onChange(next);
  };

  const addCategory = () => {
    const val = newCategory.trim();
    if (!val) return;
    const exists = (tree || []).some((c) => c.name.toLowerCase() === val.toLowerCase());
    if (exists) { setNewCategory(''); return; }
    commitTree([...(tree || []), { name: val, children: [] }]);
    setNewCategory('');
  };

  const removeCategory = (name) => {
    commitTree((tree || []).filter((c) => c.name !== name));
  };

  const addLeaf = (catName) => {
    const val = (newLeafByCat[catName] || '').trim();
    if (!val) return;
    const next = (tree || []).map((c) => {
      if (c.name !== catName) return c;
      const exists = (c.children || []).some((x) => x.toLowerCase() === val.toLowerCase());
      if (exists) return c;
      return { ...c, children: [...(c.children || []), val] };
    });
    commitTree(next);
    setNewLeafByCat((m) => ({ ...m, [catName]: '' }));
  };

  const removeLeaf = (catName, leaf) => {
    const next = (tree || []).map((c) => (c.name === catName ? { ...c, children: (c.children || []).filter((x) => x !== leaf) } : c));
    commitTree(next);
  };

  const renameCategory = (oldName, nextName) => {
    const name = (nextName || '').trim();
    if (!name) return;
    if (oldName === name) return;
    const exists = (tree || []).some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    commitTree((tree || []).map((c) => (c.name === oldName ? { ...c, name } : c)));
    setEditingCat(null);
  };

  const renameLeaf = (catName, oldLeaf, nextLeaf) => {
    const name = (nextLeaf || '').trim();
    if (!name) return;
    if (oldLeaf === name) return;
    const next = (tree || []).map((c) => {
      if (c.name !== catName) return c;
      if ((c.children || []).some((x) => x.toLowerCase() === name.toLowerCase())) return c;
      return { ...c, children: (c.children || []).map((x) => (x === oldLeaf ? name : x)) };
    });
    commitTree(next);
    setEditingLeaf(null);
  };

  // DnD helpers
  const onDragStart = (e, payload) => {
    try { e.dataTransfer.setData('application/json', JSON.stringify(payload)); } catch {}
  };
  const onDragOver = (e) => { e.preventDefault(); };
  const onDropOnCategory = (e, targetCat) => {
    e.preventDefault();
    let data = null;
    try { data = JSON.parse(e.dataTransfer.getData('application/json') || 'null'); } catch { data = null; }
    if (!data) return;
    if (data.type === 'category') {
      // reorder category: move source after target
      const src = String(data.name || '');
      if (!src || src === targetCat) return;
      const order = (tree || []).filter(Boolean);
      const srcIndex = order.findIndex((c) => c.name === src);
      const tgtIndex = order.findIndex((c) => c.name === targetCat);
      if (srcIndex < 0 || tgtIndex < 0) return;
      const item = order[srcIndex];
      const without = order.filter((c) => c.name !== src);
      const next = [];
      without.forEach((c, idx) => {
        next.push(c);
        if (idx === tgtIndex) next.push(item);
      });
      commitTree(next);
    } else if (data.type === 'leaf') {
      // reparent leaf to target category (append to end)
      const srcCat = String(data.catName || '');
      const leaf = String(data.name || '');
      if (!srcCat || !leaf) return;
      const next = (tree || []).map((c) => {
        if (c.name === srcCat) {
          return { ...c, children: (c.children || []).filter((x) => x !== leaf) };
        }
        return c;
      }).map((c) => {
        if (c.name === targetCat) {
          const exists = (c.children || []).includes(leaf);
          return exists ? c : { ...c, children: [...(c.children || []), leaf] };
        }
        return c;
      });
      commitTree(next);
    }
  };
  const onDropOnLeaf = (e, targetCat, targetLeaf) => {
    e.preventDefault();
    let data = null;
    try { data = JSON.parse(e.dataTransfer.getData('application/json') || 'null'); } catch { data = null; }
    if (!data) return;
    if (data.type === 'leaf') {
      const srcCat = String(data.catName || '');
      const leaf = String(data.name || '');
      if (!srcCat || !leaf) return;
      // If dropping onto another leaf: insert after target within its category
      const next = (tree || []).map((c) => {
        if (c.name === srcCat) {
          return { ...c, children: (c.children || []).filter((x) => x !== leaf) };
        }
        return c;
      }).map((c) => {
        if (c.name === targetCat) {
          const arr = [...(c.children || [])];
          const idx = arr.findIndex((x) => x === targetLeaf);
          const exists = arr.includes(leaf);
          if (exists) return c;
          const head = arr.slice(0, idx + 1);
          const tail = arr.slice(idx + 1);
          return { ...c, children: [...head, leaf, ...tail] };
        }
        return c;
      });
      commitTree(next);
    }
  };

  return (
    <Box>
      {title ? (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ color }}>{title}</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder={title === 'Расход' ? 'Категория расхода' : 'Категория прихода'}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={addCategory} disabled={!newCategory.trim()}>Добавить</Button>
          </Stack>
        </Stack>
      ) : null}

      <TreeView sx={{ '& .MuiTreeItem-content': { py: 0.5 } }}>
        {(tree || []).map((cat) => (
          <TreeItem
            key={cat.name}
            nodeId={`cat-${cat.name}`}
            label={
              <Stack direction="row" spacing={1} alignItems="center" sx={{ color }}>
                {editingCat === cat.name ? (
                  <TextField
                    size="small"
                    autoFocus
                    defaultValue={cat.name}
                    onBlur={(e) => renameCategory(cat.name, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') renameCategory(cat.name, e.target.value); }}
                  />
                ) : (
                  <Typography
                    onDoubleClick={() => setEditingCat(cat.name)}
                    draggable
                    onDragStart={(e) => onDragStart(e, { type: 'category', name: cat.name })}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDropOnCategory(e, cat.name)}
                    sx={{ cursor: 'grab', userSelect: 'none' }}
                  >
                    {cat.name}
                  </Typography>
                )}
                <Tooltip title="Добавить подстатью">
                  <IconButton size="small" onClick={() => setNewLeafByCat((m) => ({ ...m, [cat.name]: (m[cat.name] || '') }))}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Удалить категорию">
                  <IconButton size="small" onClick={() => removeCategory(cat.name)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            }
          >
            {(cat.children || []).map((leaf) => (
              <TreeItem
                key={`${cat.name}::${leaf}`}
                nodeId={`leaf-${cat.name}-${leaf}`}
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    {editingLeaf === `${cat.name}::${leaf}` ? (
                      <TextField
                        size="small"
                        autoFocus
                        defaultValue={leaf}
                        onBlur={(e) => renameLeaf(cat.name, leaf, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') renameLeaf(cat.name, leaf, e.target.value); }}
                      />
                    ) : (
                      <Typography
                        onDoubleClick={() => setEditingLeaf(`${cat.name}::${leaf}`)}
                        draggable
                        onDragStart={(e) => onDragStart(e, { type: 'leaf', name: leaf, catName: cat.name })}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDropOnLeaf(e, cat.name, leaf)}
                        sx={{ cursor: 'grab', userSelect: 'none' }}
                      >
                        {leaf}
                      </Typography>
                    )}
                    <Tooltip title="Удалить подстатью">
                      <IconButton size="small" onClick={() => removeLeaf(cat.name, leaf)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
              />
            ))}

            {/* Inline add leaf */}
            <Stack direction="row" spacing={1} sx={{ pl: 2, pr: 2, pb: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Новая подстатья"
                value={newLeafByCat[cat.name] || ''}
                onChange={(e) => setNewLeafByCat((m) => ({ ...m, [cat.name]: e.target.value }))}
              />
              <Button variant="text" startIcon={<AddIcon />} onClick={() => addLeaf(cat.name)} disabled={!((newLeafByCat[cat.name] || '').trim())}>Добавить</Button>
            </Stack>
          </TreeItem>
        ))}
      </TreeView>
    </Box>
  );
}