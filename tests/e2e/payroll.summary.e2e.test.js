const request = require('supertest');
const express = require('express');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../../middleware/auth').withUser);
  app.use('/api/payroll', require('../../routes/payrollAccruals'));
  app.use('/api/reports', require('../../routes/reports'));
  app.use(require('../../middleware/error'));
  return app;
}

describe('Payroll accruals and summary e2e', () => {
  const originalEnv = { ...process.env };
  let app;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.AUTH_DEV_MODE = '1';
    app = makeApp();
  });

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  test('create accruals and summarize by employee', async () => {
    const emp1 = '507f1f77bcf86cd799439011';
    const emp2 = '507f1f77bcf86cd799439012';

    // create three accruals (2 for emp1, 1 for emp2)
    const a1 = await request(app)
      .post('/api/payroll/accruals')
      .set('x-user-id', 'admin-1')
      .set('x-user-role', 'Admin')
      .send({ employeeId: emp1, orderId: 'ord-a', amount: 100, baseAmount: 1000, percent: 0.1, note: 'A1' });
    expect(a1.statusCode).toBe(201);
    expect(a1.body && a1.body.ok).toBe(true);

    const a2 = await request(app)
      .post('/api/payroll/accruals')
      .set('x-user-id', 'admin-1')
      .set('x-user-role', 'Admin')
      .send({ employeeId: emp1, orderId: 'ord-b', amount: 50, baseAmount: 500, percent: 0.1, note: 'A2' });
    expect(a2.statusCode).toBe(201);
    expect(a2.body && a2.body.ok).toBe(true);

    const a3 = await request(app)
      .post('/api/payroll/accruals')
      .set('x-user-id', 'admin-1')
      .set('x-user-role', 'Admin')
      .send({ employeeId: emp2, orderId: 'ord-c', amount: 25, baseAmount: 250, percent: 0.1, note: 'A3' });
    expect(a3.statusCode).toBe(201);
    expect(a3.body && a3.body.ok).toBe(true);

    // list accruals
    const list = await request(app)
      .get('/api/payroll/accruals')
      .set('x-user-role', 'Finance');
    expect(list.statusCode).toBe(200);
    expect(list.body && list.body.ok).toBe(true);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.length).toBeGreaterThanOrEqual(3);

    // summary report
    const summary = await request(app)
      .get('/api/reports/payroll-summary')
      .set('x-user-role', 'Finance');
    expect(summary.statusCode).toBe(200);
    expect(summary.body && summary.body.ok).toBe(true);
    const groups = summary.body.groups || [];
    const g1 = groups.find((g) => String(g.employeeId) === emp1);
    const g2 = groups.find((g) => String(g.employeeId) === emp2);
    expect(g1).toBeTruthy();
    expect(g2).toBeTruthy();
    expect(g1.amount).toBe(150);
    expect(g1.count).toBe(2);
    expect(g2.amount).toBe(25);
    expect(g2.count).toBe(1);
    // total should be sum of all groups
    const computedTotal = groups.reduce((acc, g) => acc + Number(g.amount || 0), 0);
    expect(summary.body.total).toBe(computedTotal);
  });
});
