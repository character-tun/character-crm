const { markCloseWithoutPayment, isPaymentsLocked, getDevState, __devReset } = require('../services/statusActionsHandler');

// Ensure DEV mode (no Mongo) for this unit test
process.env.AUTH_DEV_MODE = '1';

describe('statusActionsHandler — closeWithoutPayment', () => {
  beforeEach(() => {
    __devReset();
  });

  test('sets closed.success=false and paymentsLocked=true (DEV memory)', async () => {
    const orderId = 'ord-unit-1';
    const userId = 'u-unit-1';

    const res = await markCloseWithoutPayment({ orderId, userId, statusCode: 'closed_unpaid', logId: 'log-1' });
    expect(res && res.ok).toBe(true);

    expect(isPaymentsLocked(orderId)).toBe(true);
    const st = getDevState(orderId);
    expect(st && st.paymentsLocked).toBe(true);
    expect(st && st.closed && st.closed.success).toBe(false);
    expect(st && st.closed && typeof st.closed.at).toBe('string');
    expect(st && st.closed && st.closed.by).toBe(userId);
  });
});