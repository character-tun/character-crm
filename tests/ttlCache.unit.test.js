describe('ttlCache — basic operations and expiry', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('getDefaultTTL returns default when env invalid and custom when set', () => {
    const ORIG_ENV = { ...process.env };
    process.env.CACHE_TTL_SECS = 'not-a-number';
    let { getDefaultTTL } = require('../services/ttlCache');
    expect(getDefaultTTL()).toBe(60);

    jest.resetModules();
    process.env = { ...ORIG_ENV, CACHE_TTL_SECS: '120' };
    ({ getDefaultTTL } = require('../services/ttlCache'));
    expect(getDefaultTTL()).toBe(120);
  });

  test('set/get works and expires based on TTL', () => {
    const { getCache } = require('../services/ttlCache');
    const cache = getCache('test');

    const now = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);

    cache.set('k', { v: 1 }, 1); // 1 sec TTL
    expect(cache.get('k')).toEqual({ v: 1 });

    nowSpy.mockImplementation(() => now + 2000); // 2 seconds later -> expired
    expect(cache.get('k')).toBeNull();

    const stats = cache.stats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);

    nowSpy.mockRestore();
  });

  test('invalidateKey and invalidateAll clear entries', () => {
    const { getCache } = require('../services/ttlCache');
    const cache = getCache('test2');

    cache.set('a', 1, 60);
    cache.set('b', 2, 60);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);

    cache.invalidateKey('a');
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);

    cache.invalidateAll();
    expect(cache.get('b')).toBeNull();
  });
});