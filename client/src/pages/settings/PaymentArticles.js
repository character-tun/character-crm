import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Paper, Stack, Button, Grid, Tooltip } from '@mui/material';
import EmptyState from '../../components/EmptyState.jsx';
import { useNotify } from '../../components/NotifyProvider';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TreeEditor from '../../components/TreeEditor.jsx';

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



const wrapFlatToTree = (incArr = [], expArr = []) => {
  const income = incArr.length ? [{ name: 'Без категории (доход)', children: [...new Set(incArr)] }] : [];
  const expense = expArr.length ? [{ name: 'Без категории (расход)', children: [...new Set(expArr)] }] : [];
  const base = { income: income.length ? income : DEFAULT_TREE.income, expense: expense.length ? expense : DEFAULT_TREE.expense };
  return base;
};

const migrateArrayToTree = (arr = []) => {
  const tree = JSON.parse(JSON.stringify(DEFAULT_TREE));
  const unknownIncome = [];
  arr.forEach((name) => {
    if (KNOWN_INCOME.has(name)) {
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
  return tree;
};

export default function PaymentArticlesPage() {
  const fileRef = useRef(null);
  const notify = useNotify();

  const [categories, setCategories] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = JSON.parse(raw || 'null');
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.income) && parsed.income.every(x => typeof x === 'object')) {
        return parsed;
      }
      if (parsed && typeof parsed === 'object') {
        const inc = Array.isArray(parsed.income) ? parsed.income : [];
        const exp = Array.isArray(parsed.expense) ? parsed.expense : [];
        return wrapFlatToTree(inc, exp);
      }
      if (Array.isArray(parsed)) {
        return migrateArrayToTree(parsed);
      }
    } catch {}
    return DEFAULT_TREE;
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(categories));
  }, [categories]);

  const resetDefault = () => { setCategories(DEFAULT_TREE); notify('Список статей сброшен', { severity: 'success' }); };

  const exportJSON = () => {
    const data = JSON.stringify(categories, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payment_categories.json';
    a.click();
    URL.revokeObjectURL(url);
    notify('Экспортировано в JSON', { severity: 'success' });
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
        notify('Импорт из JSON выполнен', { severity: 'success' });
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.income) && parsed.income.some((x) => typeof x === 'object')) {
          setCategories(parsed);
          notify('Импорт из JSON выполнен', { severity: 'success' });
        } else {
          const inc = Array.isArray(parsed.income) ? parsed.income : [];
          const exp = Array.isArray(parsed.expense) ? parsed.expense : [];
          setCategories(wrapFlatToTree(inc, exp));
          notify('Импорт из JSON выполнен', { severity: 'success' });
        }
      }
    } catch (err) {
      console.error(err);
      notify('Ошибка импорта JSON', { severity: 'error' });
    }
    e.target.value = '';
  };

  const incomeCats = useMemo(() => categories.income, [categories]);
  const expenseCats = useMemo(() => categories.expense, [categories]);

  return (
    <Box sx={{ p: 2 }}>
      {incomeCats.length === 0 && expenseCats.length === 0 && (
        <Box sx={{ mb: 2 }}>
          <EmptyState title="Нет статей" description="Добавьте категории для прихода и расхода."
            actionLabel="Сбросить" onAction={resetDefault} />
        </Box>
      )}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h5">Статьи движения денежных средств</Typography>
          <Tooltip title="Статьи используются при создании платежей и в отчётах.">
            <InfoOutlinedIcon fontSize="small" color="action" />
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Сбросить к стандартному списку">
            <span>
              <Button variant="outlined" onClick={resetDefault}>Сбросить</Button>
            </span>
          </Tooltip>
          <Tooltip title="Экспорт категорий в JSON">
            <span>
              <Button variant="outlined" onClick={exportJSON}>Экспорт JSON</Button>
            </span>
          </Tooltip>
          <Tooltip title="Импорт категорий из JSON">
            <span>
              <Button variant="outlined" onClick={importJSON}>Импорт JSON</Button>
            </span>
          </Tooltip>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <TreeEditor
              title="Приход"
              color="#2e7d32" // green
              tree={incomeCats}
              onChange={(next) => setCategories((prev) => ({ ...prev, income: next }))}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <TreeEditor
              title="Расход"
              color="#d32f2f" // red
              tree={expenseCats}
              onChange={(next) => setCategories((prev) => ({ ...prev, expense: next }))}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}