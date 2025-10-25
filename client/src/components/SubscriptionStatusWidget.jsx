import React from 'react';
import { Chip, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getBilling } from '../services/billingService';

function statusColor(status) {
  switch (status) {
    case 'Active': return 'success';
    case 'Trial': return 'info';
    case 'Paused': return 'default';
    case 'Expired': return 'error';
    default: return 'default';
  }
}

export default function SubscriptionStatusWidget() {
  const navigate = useNavigate();
  const [billing, setBilling] = React.useState(() => getBilling());
  const [openRenew, setOpenRenew] = React.useState(false);

  React.useEffect(() => {
    const id = setInterval(() => setBilling(getBilling()), 30000);
    return () => clearInterval(id);
  }, []);

  const daysLeftTrial = (() => {
    if (!billing?.trialEndsAt) return null;
    const diff = Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / (24*60*60*1000));
    return Math.max(diff, 0);
  })();

  const label = (() => {
    if (billing.status === 'Trial') return `Триал: ${daysLeftTrial} дн.`;
    if (billing.status === 'Expired') return `Подписка истекла`;
    if (billing.status === 'Paused') return `Пауза`;
    return `${billing.plan}`;
  })();

  const handleClick = () => {
    if (billing.status === 'Expired') setOpenRenew(true);
    else navigate('/pricing');
  };

  return (
    <>
      <Tooltip title={`Статус: ${billing.status}. Тариф: ${billing.plan}.`}>
        <Chip color={statusColor(billing.status)} label={label} onClick={handleClick} sx={{ mr: 1 }} />
      </Tooltip>
      <Dialog open={openRenew} onClose={() => setOpenRenew(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Подписка истекла</DialogTitle>
        <DialogContent>
          <Typography>Чтобы продолжить работу, продлите подписку или выберите новый тариф.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRenew(false)}>Закрыть</Button>
          <Button variant="contained" onClick={() => { setOpenRenew(false); navigate('/pricing'); }}>Продлить</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}