describe('statusActionQueue (unit)', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1'; // dev mode -> use mem queue branch
    delete process.env.REDIS_URL; // ensure no Redis
  });

  test('inline processing in tests when ENABLE_STATUS_QUEUE != 1', async () => {
    process.env.ENABLE_STATUS_QUEUE = '0';

    const handleStatusActions = jest.fn(async (payload) => ({ ok: true, processed: payload.actions.length }));
    jest.doMock('../services/statusActionsHandler', () => ({ handleStatusActions }));

    const { enqueueStatusActions, getMemQueueSnapshot } = require('../queues/statusActionQueue');

    const actions = ['stockIssue'];
    await enqueueStatusActions({ orderId: 'o-1', statusCode: 'closed_paid', actions, logId: 'l-1' });

    expect(handleStatusActions).toHaveBeenCalledTimes(1);
    const snap = getMemQueueSnapshot ? getMemQueueSnapshot() : { waiting: 0, running: 0, processed: 0 };
    expect(snap.waiting).toBe(0);
  });
});