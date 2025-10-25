import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Container,
  Stack,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  Grid,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Chip,
  Alert,
  LinearProgress,
  Avatar,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import http from '../services/http';
import { useNotify } from '../components/NotifyProvider';

const LS_KEY = 'onboarding.v1';

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function OnboardingWizard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const notify = useNotify();

  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      company: { name: '', city: '', tz: 'Europe/Moscow', currency: 'RUB' },
      admin: { email: 'admin@localhost', name: 'Администратор', password: 'admin' },
      plan: 'start',
      brand: { color: '#00BFA6', logoName: '', logoDataUrl: '' },
      saved: { company: false, admin: false, plan: false, brand: false, done: false },
      savedAt: {},
    };
  });

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const steps = [
    { key: 'company', title: 'Данные студии' },
    { key: 'admin', title: 'Администратор' },
    { key: 'plan', title: 'Тариф' },
    { key: 'brand', title: 'Логотип и бренд' },
    { key: 'done', title: 'Готово' },
  ];

  const progress = useMemo(() => {
    const keys = ['company', 'admin', 'plan', 'brand', 'done'];
    const count = keys.reduce((acc, k) => acc + (state.saved[k] ? 1 : 0), 0);
    return Math.round((count / keys.length) * 100);
  }, [state.saved]);

  const markSaved = (key) => {
    setState((s) => ({
      ...s,
      saved: { ...s.saved, [key]: true },
      savedAt: { ...s.savedAt, [key]: new Date().toISOString() },
    }));
    notify('Сохранено ✓', { severity: 'success' });
  };

  const saveCurrentStep = async () => {
    setError('');
    const { key } = steps[step];
    if (key === 'admin') {
      try {
        setSaving(true);
        const payload = { email: state.admin.email, password: state.admin.password, name: state.admin.name };
        const { status } = await http.post('/auth/bootstrap-admin', payload);
        if (status === 201 || status === 200) {
          markSaved('admin');
        } else {
          setError('Не удалось создать администратора');
        }
      } catch (e) {
        setError(e?.response?.data?.error || e.message || 'Ошибка создания администратора');
      } finally {
        setSaving(false);
      }
    } else {
      markSaved(key);
    }
  };

  const next = () => setStep((i) => Math.min(steps.length - 1, i + 1));
  const back = () => setStep((i) => Math.max(0, i - 1));

  const onLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setState((s) => ({ ...s, brand: { ...s.brand, logoName: file.name, logoDataUrl: reader.result } }));
    };
    reader.readAsDataURL(file);
  };

  const finish = async () => {
    await saveCurrentStep();
    setState((s) => ({ ...s, saved: { ...s.saved, done: true } }));
    notify('Добро пожаловать в Character ERP Cloud!', { severity: 'success' });
    navigate('/bootstrap-first');
  };

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Typography variant="h4" fontWeight={700}>Онбординг</Typography>
        <LinearProgress variant="determinate" value={progress} />
        <Stepper activeStep={step} alternativeLabel>
          {steps.map((s, idx) => (
            <Step key={s.key}>
              <StepLabel optional={state.saved[s.key] ? <Chip size="small" color="success" label="Сохранено" /> : undefined}>
                {s.title}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ minHeight: 320 }}>
          <AnimatePresence mode="wait">
            {step === 0 && (
              <Box key="step-0" component={motion.div} {...fade}>
                <Typography variant="h6" sx={{ mb: 2 }}>Данные студии</Typography>
                <Stack spacing={2}>
                  <TextField label="Название студии" value={state.company.name} onChange={(e) => setState((s) => ({ ...s, company: { ...s.company, name: e.target.value } }))} />
                  <TextField label="Город" value={state.company.city} onChange={(e) => setState((s) => ({ ...s, company: { ...s.company, city: e.target.value } }))} />
                  <TextField label="Часовой пояс" value={state.company.tz} onChange={(e) => setState((s) => ({ ...s, company: { ...s.company, tz: e.target.value } }))} />
                  <TextField label="Валюта" value={state.company.currency} onChange={(e) => setState((s) => ({ ...s, company: { ...s.company, currency: e.target.value } }))} />
                </Stack>
              </Box>
            )}

            {step === 1 && (
              <Box key="step-1" component={motion.div} {...fade}>
                <Typography variant="h6" sx={{ mb: 2 }}>Администратор</Typography>
                <Stack spacing={2}>
                  <TextField label="Email" value={state.admin.email} onChange={(e) => setState((s) => ({ ...s, admin: { ...s.admin, email: e.target.value } }))} />
                  <TextField label="Имя" value={state.admin.name} onChange={(e) => setState((s) => ({ ...s, admin: { ...s.admin, name: e.target.value } }))} />
                  <TextField label="Пароль" type="password" value={state.admin.password} onChange={(e) => setState((s) => ({ ...s, admin: { ...s.admin, password: e.target.value } }))} />
                </Stack>
              </Box>
            )}

            {step === 2 && (
              <Box key="step-2" component={motion.div} {...fade}>
                <Typography variant="h6" sx={{ mb: 2 }}>Тариф</Typography>
                <Grid container spacing={2}>
                  {[
                    { key: 'start', name: 'Старт', price: '0 ₽' },
                    { key: 'pro', name: 'Про', price: '1 990 ₽/мес' },
                    { key: 'business', name: 'Бизнес', price: '4 990 ₽/мес' },
                  ].map((p) => (
                    <Grid item xs={12} sm={4} key={p.key}>
                      <Card variant={state.plan === p.key ? 'outlined' : undefined} sx={{ borderColor: state.plan === p.key ? theme.palette.primary.main : undefined }}>
                        <CardHeader title={p.name} subheader={p.price} />
                        <CardActions>
                          <Button fullWidth variant={state.plan === p.key ? 'contained' : 'outlined'} onClick={() => setState((s) => ({ ...s, plan: p.key }))}>Выбрать</Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {step === 3 && (
              <Box key="step-3" component={motion.div} {...fade}>
                <Typography variant="h6" sx={{ mb: 2 }}>Логотип и бренд</Typography>
                <Stack spacing={2}>
                  <TextField label="Цвет бренда" type="color" value={state.brand.color} onChange={(e) => setState((s) => ({ ...s, brand: { ...s.brand, color: e.target.value } }))} sx={{ width: 160 }} />
                  <Button component="label" variant="outlined">Загрузить логотип<input type="file" hidden accept="image/*" onChange={onLogoChange} /></Button>
                  {state.brand.logoDataUrl && (
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Avatar variant="rounded" src={state.brand.logoDataUrl} sx={{ width: 72, height: 72 }} />
                      <Typography variant="body2" color="text.secondary">{state.brand.logoName}</Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>
            )}

            {step === 4 && (
              <Box key="step-4" component={motion.div} {...fade}>
                <Typography variant="h6" sx={{ mb: 2 }}>Готово</Typography>
                <Stack spacing={1}>
                  <Typography color="text.secondary">Проверьте данные и завершите онбординг. После завершения откроется чек‑лист быстрых действий.</Typography>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2">Студия</Typography>
                      <Typography variant="body2" color="text.secondary">{state.company.name || '—'}, {state.company.city || '—'}, {state.company.tz}, {state.company.currency}</Typography>
                      <Typography variant="subtitle2" sx={{ mt: 2 }}>Администратор</Typography>
                      <Typography variant="body2" color="text.secondary">{state.admin.name} · {state.admin.email}</Typography>
                      <Typography variant="subtitle2" sx={{ mt: 2 }}>Тариф</Typography>
                      <Typography variant="body2" color="text.secondary">{state.plan}</Typography>
                      <Typography variant="subtitle2" sx={{ mt: 2 }}>Бренд</Typography>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 20, height: 20, bgcolor: state.brand.color, borderRadius: 0.75, border: '1px solid', borderColor: 'divider' }} />
                        <Typography variant="body2" color="text.secondary">{state.brand.color}</Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
              </Box>
            )}
          </AnimatePresence>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button disabled={step === 0} onClick={back}>Назад</Button>
            <Button variant="outlined" onClick={saveCurrentStep} disabled={saving}>{saving ? 'Сохраняю…' : 'Сохранить'}</Button>
          </Box>
          {step < steps.length - 1 ? (
            <Button variant="contained" onClick={next}>Далее</Button>
          ) : (
            <Button variant="contained" color="primary" onClick={finish}>Завершить</Button>
          )}
        </Box>
      </Stack>
    </Container>
  );
}