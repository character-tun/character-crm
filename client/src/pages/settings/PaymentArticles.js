import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Paper, Stack, Button, Grid, TextField, Divider, List, ListItem, ListItemText, IconButton } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

const LS_KEY = 'payment_categories';

// Иерархические дефолты: категории и подкатегории
const DEFAULT_TREE = {
  income: [
    { name: 'Продажи', children: ['Оплата заказа', 'Оплата продажи', 'Оплата счета клиентом', 'Предоплата', 'Предоплата заказа'] },
    { name: 'Касса', children: ['Внесение в кассу'] },
    { name: 'Перемещения', children: ['Перемещение денег'] },
    { name: 'Прочие доходы', children: [] },
  ],
  expense: [
    { name: 'Операционные расходы', children: ['Аренда', 'Аутсорс', 'Доставка', 'Налоги', 'Расходники', 'Реклама', 'Выплата зарплаты'] },
    { name: 'Поставщики', children: ['Закупка товара', 'Оплата поставщику', 'Оплата счета'] },
    { name: 'Возвраты', children: ['Возврат заказа', 'Возврат предоплаты'] },
    { name: 'Касса', children: ['Изъятие из кассы'] },
    { name: 'Выкуп', children: ['Выкуп у клиента'] },
    { name: 'Прочие расходы', children: ['Прочие расходы'] },
  ],
};

// Наборы известных подстатей для миграции
const KNOWN_INCOME = new Set(['Внесение в кассу','Оплата заказа','Оплата продажи','Оплата счета клиентом','Перемещение денег','Предоплата','Предоплата заказа']);
const KNOWN_EXPENSE = new Set(['Аренда','Аутсорс','Возврат заказа','Возврат предоплаты','Выкуп у клиента','Выплата зарплаты','Доставка','Закупка товара','Изъятие из кассы','Налоги','Оплата поставщику','Оплата счета','Прочие расходы','Расходники','Реклама']);

const sortTree = (tree) => ({
  income: (tree.income || []).map(c => ({...c, children: [...(c.children||[])].sort((a,b)=>a.localeCompare(b,'ru-RU'))})).sort((a,b)=>a.name.localeCompare(b.name,'ru-RU')),
  expense: (tree.expense || []).map(c => ({...c, children: [...(c.children||[])].sort((a,b)=>a.localeCompare(b,'ru-RU'))})).sort((a,b)=>a.name.localeCompare(b.name,'ru-RU')),
});

const wrapFlatToTree = (incArr = [], expArr = []) => {
  // Если массивы строк, складываем их в единые категории «Без категории»
  const income = incArr.length ? [{ name: 'Без категории (доход)', children: [...new Set(incArr)].sort((a,b)=>a.localeCompare(b,'ru-RU')) }] : [];
  const expense = expArr.length ? [{ name: 'Без категории (расход)', children: [...new Set(expArr)].sort((a,b)=>a.localeCompare(b,'ru-RU')) }] : [];
  const base = { income: income.length ? income : DEFAULT_TREE.income, expense: expense.length ? expense : DEFAULT_TREE.expense };
  return sortTree(base);
};

const migrateArrayToTree = (arr = []) => {
  // Распределяем известные подстатьи по дефолтным категориям, прочие — в «Прочие доходы»
  const tree = JSON.parse(JSON.stringify(DEFAULT_TREE));
  const unknownIncome = [];
  arr.forEach((name) => {
    if (KNOWN_INCOME.has(name)) {
      // кладём в первую подходящую категорию
      for (const cat of tree.income) {
        if (cat.children.includes(name) || (cat.name === 'Прочие доходы')) {
          if (!cat.children.includes(name)) cat.children.push(name);
          break;
        }
      }
    } else if (KNOWN_EXPENSE.has(name)) {
      for (const cat of tree.expense) {
        if (cat.children.includes(name) || (cat.name === 'Прочие расходы')) {
          if (!cat.children.includes(name)) cat.children.push(name);
          break;
        }
      }
    } else {
      unknownIncome.push(name);
    }
  });
  const miscIncome = tree.income.find(c => c.name === 'Прочие доходы');
  unknownIncome.forEach(n => { if (!miscIncome.children.includes(n)) miscIncome.children.push(n); });
  return sortTree(tree);
};

export default function PaymentArticlesPage() {
  const [incomeCatInput, setIncomeCatInput] = useState('');
  const [expenseCatInput, setExpenseCatInput] = useState('');
  const [subInputs, setSubInputs] = useState({}); // ключ: `${group}:${catName}` -> значение
  const fileRef = useRef(null);

  const [categories, setCategories] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = JSON.parse(raw || 'null');
      // Новый формат: объект с массивами объектов {name, children}
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.income) && parsed.income.every(x => typeof x === 'object')) {
        return sortTree(parsed);
      }
      // Старый объект с массивами строк
      if (parsed && typeof parsed === 'object') {
        const inc = Array.isArray(parsed.income) ? parsed.income : [];
        const exp = Array.isArray(parsed.expense) ? parsed.expense : [];
        return wrapFlatToTree(inc, exp);
      }
      // Совсем старый плоский массив
      if (Array.isArray(parsed)) {
        return migrateArrayToTree(parsed);
      }
    } catch {}
    return sortTree(DEFAULT_TREE);
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(categories));
  }, [categories]);

  const addCategory = (group) => {
    const val = (group === 'income' ? incomeCatInput : expenseCatInput).trim();
    if (!val) return;
    setCategories((prev) => {
      const list = [...prev[group]];
      if (list.some((c) => c.name.toLowerCase() === val.toLowerCase())) return prev;
      list.push({ name: val, children: [] });
      return sortTree({ ...prev, [group]: list });
    });
    group === 'income' ? setIncomeCatInput('') : setExpenseCatInput('');
  };

  const removeCategory = (group, name) => {
    setCategories((prev) => ({ ...prev, [group]: prev[group].filter((c) => c.name !== name) }));
  };

  const addSub = (group, catName) => {
    const key = `${group}:${catName}`;
    const val = (subInputs[key] || '').trim();
    if (!val) return;
    setCategories((prev) => {
      const list = prev[group].map((c) => {
        if (c.name !== catName) return c;
        if (c.children.includes(val)) return c;
        return { ...c, children: sortStrings([...c.children, val]) };
      });
      return sortTree({ ...prev, [group]: list });
    });
    setSubInputs((s) => ({ ...s, [key]: '' }));
  };

  const removeSub = (group, catName, subName) => {
    setCategories((prev) => ({
      ...prev,
      [group]: prev[group].map((c) => c.name === catName ? { ...c, children: c.children.filter((x) => x !== subName) } : c)
    }));
  };

  const sortStrings = (arr) => [...arr].sort((a,b)=>a.localeCompare(b,'ru-RU'));

  const resetDefault = () => setCategories(sortTree(DEFAULT_TREE));

  const exportJSON = () => {
    const data = JSON.stringify(categories, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payment_categories.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = () => fileRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        setCategories(migrateArrayToTree(parsed));
      } else if (parsed && typeof parsed === 'object') {
        // если объекты с children — нормализуем; если строки — оборачиваем
        if (Array.isArray(parsed.income) && parsed.income.some((x) => typeof x === 'object')) {
          setCategories(sortTree(parsed));
        } else {
          const inc = Array.isArray(parsed.income) ? parsed.income : [];
          const exp = Array.isArray(parsed.expense) ? parsed.expense : [];
          setCategories(wrapFlatToTree(inc, exp));
        }
      }
    } catch {}
    e.target.value = '';
  };

  const incomeCats = useMemo(() => categories.income, [categories]);
  const expenseCats = useMemo(() => categories.expense, [categories]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Статьи движения денежных средств</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={resetDefault}>Сбросить</Button>
          <Button variant="outlined" onClick={exportJSON}>Экспорт JSON</Button>
          <Button variant="outlined" onClick={importJSON}>Импорт JSON</Button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Приход</Typography>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" placeholder="Название категории прихода" value={incomeCatInput} onChange={(e) => setIncomeCatInput(e.target.value)} />
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => addCategory('income')} disabled={!incomeCatInput.trim()}>Добавить</Button>
              </Stack>
              <Divider />
              <List>
                {incomeCats.map((cat) => (
                  <Box key={cat.name}>
                    <ListItem secondaryAction={<IconButton edge="end" aria-label="delete" onClick={() => removeCategory('income', cat.name)}><DeleteOutlineIcon /></IconButton>}>
                      <ListItemText primary={cat.name} />
                    </ListItem>
                    {(cat.children || []).map((sub) => (
                      <ListItem key={sub} sx={{ pl: 4 }} secondaryAction={<IconButton edge="end" aria-label="delete" onClick={() => removeSub('income', cat.name, sub)}><DeleteOutlineIcon /></IconButton>}>
                        <ListItemText primary={sub} />
                      </ListItem>
                    ))}
                    <Stack direction="row" spacing={1} sx={{ pl: 4, pr: 2, pb: 1 }}>
                      <TextField fullWidth size="small" placeholder="Подкатегория" value={subInputs[`income:${cat.name}`] || ''} onChange={(e) => setSubInputs((s) => ({ ...s, [`income:${cat.name}`]: e.target.value }))} />
                      <Button variant="text" startIcon={<AddIcon />} onClick={() => addSub('income', cat.name)} disabled={!((subInputs[`income:${cat.name}`] || '').trim())}>Добавить</Button>
                    </Stack>
                    <Divider />
                  </Box>
                ))}
              </List>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Расход</Typography>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" placeholder="Название категории расхода" value={expenseCatInput} onChange={(e) => setExpenseCatInput(e.target.value)} />
                <Button variant="contained" color="error" startIcon={<AddIcon />} onClick={() => addCategory('expense')} disabled={!expenseCatInput.trim()}>Добавить</Button>
              </Stack>
              <Divider />
              <List>
                {expenseCats.map((cat) => (
                  <Box key={cat.name}>
                    <ListItem secondaryAction={<IconButton edge="end" aria-label="delete" onClick={() => removeCategory('expense', cat.name)}><DeleteOutlineIcon /></IconButton>}>
                      <ListItemText primary={cat.name} />
                    </ListItem>
                    {(cat.children || []).map((sub) => (
                      <ListItem key={sub} sx={{ pl: 4 }} secondaryAction={<IconButton edge="end" aria-label="delete" onClick={() => removeSub('expense', cat.name, sub)}><DeleteOutlineIcon /></IconButton>}>
                        <ListItemText primary={sub} />
                      </ListItem>
                    ))}
                    <Stack direction="row" spacing={1} sx={{ pl: 4, pr: 2, pb: 1 }}>
                      <TextField fullWidth size="small" placeholder="Подкатегория" value={subInputs[`expense:${cat.name}`] || ''} onChange={(e) => setSubInputs((s) => ({ ...s, [`expense:${cat.name}`]: e.target.value }))} />
                      <Button variant="text" startIcon={<AddIcon />} onClick={() => addSub('expense', cat.name)} disabled={!((subInputs[`expense:${cat.name}`] || '').trim())}>Добавить</Button>
                    </Stack>
                    <Divider />
                  </Box>
                ))}
              </List>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}