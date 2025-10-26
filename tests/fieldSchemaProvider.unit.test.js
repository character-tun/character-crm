describe('fieldSchemaProvider — getActiveSchema and caching', () => {
  const ORIG_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIG_ENV };
  });

  afterAll(() => {
    process.env = ORIG_ENV;
  });

  test('returns schema when mongoose ready and caches subsequent calls', async () => {
    const schemaDoc = { _id: 'fs1', scope: 'orders', name: 'default', isActive: true };

    jest.doMock('mongoose', () => ({ connection: { readyState: 1 } }));
    const findOneMock = jest.fn(() => ({ lean: jest.fn().mockResolvedValue(schemaDoc) }));
    jest.doMock('../server/models/FieldSchema', () => ({ findOne: findOneMock }));

    const { resetAll } = require('../services/ttlCache');
    resetAll();

    const provider = require('../services/fieldSchemaProvider');

    const res1 = await provider.getActiveSchema('orders', 'default', 60);
    expect(res1).toEqual(schemaDoc);
    expect(findOneMock).toHaveBeenCalledTimes(1);

    const res2 = await provider.getActiveSchema('orders', 'default', 60);
    expect(res2).toEqual(schemaDoc);
    expect(findOneMock).toHaveBeenCalledTimes(1); // cached
  });

  test('returns null when mongoose not ready', async () => {
    jest.doMock('mongoose', () => ({ connection: { readyState: 0 } }));
    jest.doMock('../server/models/FieldSchema', () => ({ findOne: jest.fn() }));

    const { resetAll } = require('../services/ttlCache');
    resetAll();

    const provider = require('../services/fieldSchemaProvider');
    const res = await provider.getActiveSchema('orders', 'default', 60);
    expect(res).toBeNull();
  });
});