describe('statusDeletionGuard — isStatusInOrderTypes', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.AUTH_DEV_MODE;
  });

  test('returns false when code is empty', async () => {
    const { isStatusInOrderTypes } = require('../services/statusDeletionGuard');
    await expect(isStatusInOrderTypes('')).resolves.toBe(false);
    await expect(isStatusInOrderTypes(null)).resolves.toBe(false);
  });

  test('returns false when OrderType module is missing', async () => {
    const { isStatusInOrderTypes } = require('../services/statusDeletionGuard');
    await expect(isStatusInOrderTypes('new')).resolves.toBe(false);
  });

  test('returns true when OrderType.exists is truthy', async () => {
    jest.doMock('../models/OrderType', () => ({
      exists: jest.fn(async () => ({ _id: 'type1' })),
    }), { virtual: true });
    const { isStatusInOrderTypes } = require('../services/statusDeletionGuard');
    await expect(isStatusInOrderTypes('new')).resolves.toBe(true);
  });

  test('returns false when OrderType.exists is falsy', async () => {
    jest.doMock('../models/OrderType', () => ({
      exists: jest.fn(async () => null),
    }), { virtual: true });
    const { isStatusInOrderTypes } = require('../services/statusDeletionGuard');
    await expect(isStatusInOrderTypes('new')).resolves.toBe(false);
  });

  test('returns false and warns on unexpected error inside check', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.doMock('../models/OrderType', () => ({
      exists: jest.fn(async () => { throw new Error('db unreachable'); }),
    }), { virtual: true });
    const { isStatusInOrderTypes } = require('../services/statusDeletionGuard');
    await expect(isStatusInOrderTypes('new')).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});