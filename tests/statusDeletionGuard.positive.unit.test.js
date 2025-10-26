describe('statusDeletionGuard — positive path', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('returns true when OrderType.exists finds a match', async () => {
    const existsMock = jest.fn(async ({ startStatusCode }) => startStatusCode === 'st_new');
    jest.doMock('../models/OrderType', () => ({ exists: existsMock }), { virtual: true });
    const { isStatusInOrderTypes } = require('../services/statusDeletionGuard');

    await expect(isStatusInOrderTypes('st_new')).resolves.toBe(true);
    await expect(isStatusInOrderTypes('st_old')).resolves.toBe(false);

    expect(existsMock).toHaveBeenCalled();
  });
});