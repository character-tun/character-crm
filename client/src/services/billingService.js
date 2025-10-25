// Простая реализация биллинга через localStorage для DEMO/UX
// Хранит план, цикл, статус, даты окончания триала/периода

const STORAGE_KEY = 'billing_state_v1';

const DEFAULT_STATE = (() => {
  const trialDays = 14;
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
  return {
    plan: 'Starter',            // Starter | Pro | Enterprise
    cycle: 'monthly',           // monthly | annual
    status: 'Trial',            // Trial | Active | Paused | Expired
    trialEndsAt: trialEndsAt.toISOString(),
    currentPeriodEnd: null,     // ISO
    updatedAt: now.toISOString(),
  };
})();

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function write(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
  } catch {}
}

function daysUntil(dateIso) {
  if (!dateIso) return 0;
  const target = new Date(dateIso).getTime();
  const now = Date.now();
  const diff = Math.ceil((target - now) / (24 * 60 * 60 * 1000));
  return Math.max(diff, 0);
}

function refreshStatus(state) {
  const s = { ...state };
  const now = Date.now();
  const trialEndTs = s.trialEndsAt ? new Date(s.trialEndsAt).getTime() : null;
  const periodEndTs = s.currentPeriodEnd ? new Date(s.currentPeriodEnd).getTime() : null;

  if (s.status === 'Paused') return s; // не трогаем паузу

  if (periodEndTs && now > periodEndTs) {
    s.status = 'Expired';
  } else if (!periodEndTs && trialEndTs && now > trialEndTs) {
    s.status = 'Expired';
  } else if (periodEndTs || s.status === 'Active') {
    s.status = 'Active';
  } else {
    s.status = 'Trial';
  }
  return s;
}

export function getBilling() {
  const s = refreshStatus(read());
  write(s);
  return s;
}

export function updateBilling(patch) {
  const prev = read();
  const next = refreshStatus({ ...prev, ...patch });
  write(next);
  return next;
}

export function simulatePayment({ plan, cycle }) {
  const now = new Date();
  const next = read();
  next.plan = plan || next.plan;
  next.cycle = cycle || next.cycle;
  next.status = 'Active';
  const months = next.cycle === 'annual' ? 12 : 1;
  const end = new Date(now);
  end.setMonth(end.getMonth() + months);
  next.currentPeriodEnd = end.toISOString();
  write(next);
  return next;
}

export function getTrialDaysLeft() {
  const s = read();
  return daysUntil(s.trialEndsAt);
}

export function getPeriodDaysLeft() {
  const s = read();
  return daysUntil(s.currentPeriodEnd);
}

export function resetBilling() {
  write({ ...DEFAULT_STATE });
  return getBilling();
}

export const PLANS = [
  {
    id: 'Starter',
    title: 'Starter',
    popular: false,
    monthly: 0,
    annual: 0,
    features: ['До 3 сотрудников', 'Базовые заказы', 'Простая аналитика'],
  },
  {
    id: 'Pro',
    title: 'Pro',
    popular: true,
    monthly: 990,
    annual: 9990,
    features: ['Команда до 15', 'Склад и магазин', 'Расширенные отчёты'],
  },
  {
    id: 'Enterprise',
    title: 'Enterprise',
    popular: false,
    monthly: 3990,
    annual: 39900,
    features: ['Безлимит', 'RBAC и аудит', 'SLA и поддержка'],
  },
];