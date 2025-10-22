const { handleStatusActions, __devReset } = require('../services/statusActionsHandler');
const devPaymentsStore = require('../services/devPaymentsStore');

// Ensure DEV mode (no Mongo) for this unit test
process.env.AUTH_DEV_MODE = '1';

describe('statusActionsHandler — chargeInit (DEV)', () => {
  beforeEach(() => {
    __devReset();
    // Clear DEV payments store
    const arr = devPaymentsStore.getItems();
    arr.length = 0;
  });

  test('creates payment with provided amount', async () => {
    const orderId = 'ord-dev-1';
    const userId = 'u-dev-1';

    const res = await handleStatusActions({
      orderId,
      statusCode: 'in_work',
      actions: [{ type: 'charge', amount: 123.45 }],
      logId: 'log-1',
      userId,
    });

    expect(res && res.ok).toBe(true);
    const items = devPaymentsStore.getItems();
    const found = items.find((i) => String(i.orderId) === String(orderId));
    expect(found).toBeTruthy();
    expect(found.type).toBe('income');
    expect(Number(found.amount)).toBeCloseTo(123.45);
    expect(found.note).toMatch(/chargeInit/);
  });

  test('throws when payments are locked (via closeWithoutPayment)', async () => {
    const orderId = 'ord-dev-2';
    const userId = 'u-dev-2';

    // First, mark order as closed without payment (locks payments)
    await handleStatusActions({
      orderId,
      statusCode: 'closed_unpaid',
      actions: [{ type: 'closeWithoutPayment' }],
      logId: 'log-2',
      userId,
    });

    // Then, attempt to charge => should throw
    let threw = false;
    try {
      await handleStatusActions({
        orderId,
        statusCode: 'in_work',
        actions: [{ type: 'charge', amount: 10 }],
        logId: 'log-3',
        userId,
      });
    } catch (e) {
      threw = true;
      expect(String(e.message || '')).toMatch(/PAYMENTS_LOCKED|ORDER_CLOSED/);
    }
    expect(threw).toBe(true);
  });
});