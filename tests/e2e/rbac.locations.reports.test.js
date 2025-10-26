const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

/**
 * E2E: RBAC + Locations + Reports (DEV)
 * - 403 на платежи без Finance
 * - Видимость по фильтру locationId
 * - Отчёт cashflow по параметрам (dateFrom/dateTo/locationId)
 * - Репорт: storage/reports/rbac-locations-reports.md
 */

describe('RBAC + Locations + Reports e2e (DEV)', () => {
  let app;
  const locA = 'loc-A';
  const locB = 'loc-B';
  const cashId = 'dev-main';

  // Буферы результатов для репорта
  const results = {
    rbac403NoRole: null,
    rbac403Manager: null,
    listLocA: null,
    cashflowLocA: null,
  };

  beforeAll(() => {
    process.env.AUTH_DEV_MODE = '1';
    app = express();
    app.use(express.json());
    app.use(require('../../middleware/auth').withUser);
    app.use('/api/payments', require('../../routes/payments'));
    app.use('/api/reports', require('../../routes/reports'));
    app.use(require('../../middleware/error'));
  });

  describe('RBAC: /api/payments', () => {
    test('GET /api/payments без роли → 403', async () => {
      const res = await request(app).get('/api/payments');
      expect(res.statusCode).toBe(403);
      results.rbac403NoRole = res.statusCode;
    });

    test('GET /api/payments роль Manager → 200', async () => {
      const res = await request(app).get('/api/payments').set('x-user-role', 'Manager');
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
      results.rbac403Manager = res.statusCode;
    });

    test('GET /api/payments роль Finance → 200', async () => {
      const res = await request(app).get('/api/payments').set('x-user-role', 'Finance');
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
    });
  });

  describe('Данные: создание платежей в разных локациях', () => {
    test('создать income loc-A (120)', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send({ orderId: 'ord-locA-1', type: 'income', amount: 120, locationId: locA, cashRegisterId: cashId });
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
    });

    test('создать expense loc-A (20)', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send({ orderId: 'ord-locA-2', type: 'expense', amount: 20, locationId: locA, cashRegisterId: cashId });
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
    });

    test('создать refund loc-B (30)', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('x-user-role', 'Finance')
        .send({ orderId: 'ord-locB-1', type: 'refund', amount: 30, locationId: locB, cashRegisterId: cashId });
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
    });
  });

  describe('Фильтр locationId: список и totals', () => {
    test('GET /api/payments?locationId=loc-A (Finance) — только loc-A', async () => {
      const res = await request(app)
        .get(`/api/payments?locationId=${encodeURIComponent(locA)}`)
        .set('x-user-role', 'Finance');
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
      expect(Array.isArray(res.body.items)).toBe(true);
      // Все элементы относятся к loc-A
      for (const it of res.body.items) {
        expect(String(it.locationId)).toBe(locA);
      }
      // Totals по loc-A: income=120, expense=20, refund=0, balance=100
      const t = res.body.totals || {};
      expect(t.income).toBe(120);
      expect(t.expense).toBe(20);
      expect(t.refund).toBe(0);
      expect(t.balance).toBe(100);
      results.listLocA = { count: res.body.items.length, totals: t };
    });
  });

  describe('Cashflow report: группировки по кассам и итог по фильтру', () => {
    test('GET /api/reports/cashflow?locationId=loc-A — balance=100, касса dev-main', async () => {
      const df = '1970-01-01';
      const dt = '2100-01-01';
      const res = await request(app)
        .get(`/api/reports/cashflow?locationId=${encodeURIComponent(locA)}&dateFrom=${df}&dateTo=${dt}`)
        .set('x-user-role', 'Finance');
      expect(res.statusCode).toBe(200);
      expect(res.body && res.body.ok).toBe(true);
      expect(typeof res.body.balance).toBe('number');
      expect(res.body.balance).toBe(100);
      expect(Array.isArray(res.body.groups)).toBe(true);
      const g = res.body.groups.find((x) => String(x.cashRegisterId) === cashId) || { totals: {} };
      expect(g && g.totals && g.totals.income).toBe(120);
      expect(g && g.totals && g.totals.expense).toBe(20);
      expect(g && g.totals && g.totals.refund).toBe(0);
      expect(g && g.totals && g.totals.balance).toBe(100);
      results.cashflowLocA = { balance: res.body.balance, groupDevMain: g.totals };
    });
  });

  describe('Сохранение артефакта репорта', () => {
    test('write storage/reports/rbac-locations-reports.md', () => {
      const reportDir = path.join(__dirname, '..', '..', 'storage', 'reports');
      const reportPath = path.join(reportDir, 'rbac-locations-reports.md');
      try { fs.mkdirSync(reportDir, { recursive: true }); } catch {}
      const md = [
        '# RBAC + Locations + Reports — E2E (DEV)',
        `Дата: ${new Date().toISOString()}`,
        '',
        '## RBAC — доступ к платежам',
        `- GET /api/payments без роли: ${results.rbac403NoRole}`,
        `- GET /api/payments роль Manager: ${results.rbac403Manager}`,
        '',
        `## Видимость по locationId=\`${locA}\``,
        `- Кол-во элементов: ${results.listLocA ? results.listLocA.count : 'n/a'}`,
        `- Totals: income=${results.listLocA?.totals?.income || 0}, expense=${results.listLocA?.totals?.expense || 0}, refund=${results.listLocA?.totals?.refund || 0}, balance=${results.listLocA?.totals?.balance || 0}`,
        '',
        `## Cashflow report (dateFrom=1970-01-01, dateTo=2100-01-01, locationId=${locA})`,
        `- Balance: ${results.cashflowLocA?.balance || 0}`,
        `- dev-main: income=${results.cashflowLocA?.groupDevMain?.income || 0}, expense=${results.cashflowLocA?.groupDevMain?.expense || 0}, refund=${results.cashflowLocA?.groupDevMain?.refund || 0}, balance=${results.cashflowLocA?.groupDevMain?.balance || 0}`,
      ].join('\n');
      fs.writeFileSync(reportPath, md, 'utf8');
      const exists = fs.existsSync(reportPath);
      expect(exists).toBe(true);
    });
  });
});
