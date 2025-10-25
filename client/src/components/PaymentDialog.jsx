import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Box, Stack, Typography, TextField, Select, MenuItem, Button, Chip, FormControl, InputLabel, Radio, FormControlLabel } from '@mui/material';

// Local formatter for article breadcrumbs
function formatArticleBreadcrumbs(path) {
  if (Array.isArray(path)) return path.join(' / ');
  if (typeof path === 'string') return path;
  return '';
}

/**
 * PaymentDialog — универсальная модалка для создания/редактирования/рефанда платежей.
 * Props:
 * - open: boolean
 * - mode: 'create' | 'edit' | 'refund'
 * - type: 'income' | 'expense' | 'refund'
 * - cashOptions: Array<{ _id?: string; id?: string; name?: string; code?: string }>
 * - articlePaths?: string[] // список путей вида "Приход/Продажи/Онлайн" (хлебные крошки)
 * - initialPayment?: { orderId?: string; amount?: number; method?: string; note?: string; cashRegisterId?: string; articlePath?: string[]; locked?: boolean }
 * - canSave?: boolean // управляет доступностью кнопки сохранения
 * - onClose: () => void
 * - onSubmit: (payload: { orderId: string; amount: number; method?: string; note?: string; cashRegisterId?: string; articlePath: string[]; type: string }) => void
 */
export default function PaymentDialog({ open, mode = 'create', type = 'income', cashOptions = [], articlePaths = [], initialPayment, canSave = true, onClose, onSubmit }) {
  const [local, setLocal] = React.useState(() => ({
    orderId: String(initialPayment?.orderId || ''),
    amount: Number(initialPayment?.amount || 0),
    method: String(initialPayment?.method || ''),
    note: String(initialPayment?.note || ''),
    cashRegisterId: String(initialPayment?.cashRegisterId || ''),
    articlePath: Array.isArray(initialPayment?.articlePath) ? initialPayment.articlePath : [],
  }));
  const [articlePickerOpen, setArticlePickerOpen] = React.useState(false);
  const locked = !!initialPayment?.locked;

  React.useEffect(() => {
    // reset when initialPayment changes
    setLocal({
      orderId: String(initialPayment?.orderId || ''),
      amount: Number(initialPayment?.amount || 0),
      method: String(initialPayment?.method || ''),
      note: String(initialPayment?.note || ''),
      cashRegisterId: String(initialPayment?.cashRegisterId || ''),
      articlePath: Array.isArray(initialPayment?.articlePath) ? initialPayment.articlePath : [],
    });
  }, [initialPayment]);

  const title = (() => {
    if (mode === 'edit') return 'Редактировать платёж';
    if (mode === 'refund') return 'Создать рефанд';
    return type === 'income' ? 'Создать приход' : 'Создать расход';
  })();

  const handleSubmit = () => {
    const payload = {
      orderId: local.orderId,
      amount: Number(local.amount || 0),
      method: local.method || undefined,
      note: local.note || undefined,
      cashRegisterId: local.cashRegisterId || undefined,
      articlePath: Array.isArray(local.articlePath) ? local.articlePath : [],
      type,
    };
    onSubmit && onSubmit(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Заказ (orderId)"
            value={local.orderId}
            onChange={(e) => setLocal((f) => ({ ...f, orderId: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Сумма"
            type="number"
            value={local.amount}
            onChange={(e) => setLocal((f) => ({ ...f, amount: Number(e.target.value) }))}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="method-label">Метод</InputLabel>
            <Select
              labelId="method-label"
              label="Метод"
              value={local.method}
              onChange={(e) => setLocal((f) => ({ ...f, method: e.target.value }))}
            >
              <MenuItem value="">Не выбрано</MenuItem>
              <MenuItem value="cash">Наличные</MenuItem>
              <MenuItem value="card">Карта</MenuItem>
              <MenuItem value="bank">Банк</MenuItem>
              <MenuItem value="other">Другое</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="cash-label">Касса</InputLabel>
            <Select
              labelId="cash-label"
              label="Касса"
              value={local.cashRegisterId}
              onChange={(e) => setLocal((f) => ({ ...f, cashRegisterId: e.target.value }))}
            >
              <MenuItem value="">Не выбрано</MenuItem>
              {cashOptions.map((c) => (
                <MenuItem key={String(c._id || c.id)} value={String(c._id || c.id)}>
                  {c.name} ({c.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Заметка"
            value={local.note}
            onChange={(e) => setLocal((f) => ({ ...f, note: e.target.value }))}
            fullWidth
          />

          <Stack>
            <Typography variant="body2" sx={{ mb: 1 }}>Статья (хлебные крошки)</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button size="small" variant="outlined" onClick={() => setArticlePickerOpen(true)}>Выбрать из дерева</Button>
              {Array.isArray(local.articlePath) && local.articlePath.length > 0 && (
                <Chip label={formatArticleBreadcrumbs(local.articlePath)} />
              )}
            </Stack>
          </Stack>

          {locked && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">Платёж заблокирован. Редактирование ограничено.</Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!canSave}>{mode === 'edit' ? 'Сохранить' : 'Создать'}</Button>
      </DialogActions>

      {/* Article picker */}
      <Dialog open={articlePickerOpen} onClose={() => setArticlePickerOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Выбор статьи</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>Выберите одну статью</Typography>
          <Stack spacing={0.5}>
            {articlePaths.length === 0 ? (
              <Typography sx={{ opacity: 0.7 }}>Здесь пока пусто</Typography>
            ) : null}
            {articlePaths.map((p) => (
              <FormControl key={p}>
                <FormControlLabel
                  control={<Radio checked={formatArticleBreadcrumbs(local.articlePath) === p} onChange={() => {
                    const segs = String(p).split('/').map((t) => t.trim()).filter(Boolean);
                    setLocal((f) => ({ ...f, articlePath: segs }));
                  }} />}
                  label={p}
                />
              </FormControl>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArticlePickerOpen(false)}>Готово</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}