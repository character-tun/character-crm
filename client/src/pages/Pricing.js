import React from 'react';
import { Box, Container, Grid, Stack, Typography, Card, CardHeader, CardContent, CardActions, Button, Chip, ToggleButtonGroup, ToggleButton, Dialog, DialogTitle, DialogContent, DialogActions, Divider } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { PLANS, getBilling, simulatePayment } from '../services/billingService';

const fadeIn = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function PricingPage() {
  const [cycle, setCycle] = React.useState('monthly');
  const [billing, setBilling] = React.useState(() => getBilling());
  const [openPay, setOpenPay] = React.useState(false);
  const [openSuccess, setOpenSuccess] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState(null);

  const handleCycle = (_, val) => {
    if (!val) return; setCycle(val);
  };

  const handleBuy = (plan) => {
    setSelectedPlan(plan);
    setOpenPay(true);
  };

  const handleConfirmPay = () => {
    const next = simulatePayment({ plan: selectedPlan.id, cycle });
    setBilling(next);
    setOpenPay(false);
    setOpenSuccess(true);
  };

  return (
    <Container sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h4" fontWeight={700}>Тарифы</Typography>
          <ToggleButtonGroup size="small" value={cycle} exclusive onChange={handleCycle}>
            <ToggleButton value="monthly">Месяц</ToggleButton>
            <ToggleButton value="annual">Год</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Статус: <strong>{billing.status}</strong>{billing.status === 'Trial' ? ` • осталось дней триала: ${Math.max(0, Math.ceil((new Date(billing.trialEndsAt) - Date.now())/(24*60*60*1000)))}` : ''}
        </Typography>

        <Grid container spacing={2}>
          {PLANS.map((plan) => (
            <Grid item xs={12} sm={6} md={4} key={plan.id}>
              <motion.div variants={fadeIn} initial="hidden" animate="show" key={`${plan.id}-${cycle}`}>
                <Card variant={plan.popular ? 'outlined' : 'elevation'} sx={{ borderColor: plan.popular ? 'primary.main' : undefined }}>
                  <CardHeader title={plan.title} action={plan.popular ? <Chip label="Популярный" color="primary" size="small" /> : null} />
                  <CardContent>
                    <AnimatePresence mode="popLayout">
                      <motion.div key={cycle} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                        <Typography variant="h3" fontWeight={800}>
                          {cycle === 'monthly' ? `${plan.monthly} ₽` : `${plan.annual} ₽`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {cycle === 'monthly' ? 'в месяц' : 'в год'}
                        </Typography>
                      </motion.div>
                    </AnimatePresence>
                    <Divider sx={{ my: 2 }} />
                    <Stack spacing={1}>
                      {plan.features.map((f, i) => (
                        <Typography key={i} variant="body2">• {f}</Typography>
                      ))}
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Button fullWidth variant={plan.popular ? 'contained' : 'outlined'} onClick={() => handleBuy(plan)}>
                      {plan.monthly === 0 && cycle === 'monthly' ? 'Начать' : 'Оплатить'}
                    </Button>
                  </CardActions>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Stack>

      {/* Оплата */}
      <Dialog open={openPay} onClose={() => setOpenPay(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Оплата — {selectedPlan?.title} ({cycle === 'monthly' ? 'месяц' : 'год'})</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Демонстрационная модалка оплаты. Имитирует успешный платёж и активирует подписку на выбранный срок.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography>Сумма: <strong>{cycle === 'monthly' ? selectedPlan?.monthly : selectedPlan?.annual} ₽</strong></Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPay(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleConfirmPay}>Оплатить</Button>
        </DialogActions>
      </Dialog>

      {/* Платёж успешен */}
      <Dialog open={openSuccess} onClose={() => setOpenSuccess(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Платёж успешен</DialogTitle>
        <DialogContent>
          <Typography>Спасибо! Подписка «{billing.plan}» активна до {billing.currentPeriodEnd ? new Date(billing.currentPeriodEnd).toLocaleDateString() : new Date(billing.trialEndsAt).toLocaleDateString()}.</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setOpenSuccess(false)}>Ок</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}