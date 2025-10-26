describe('configValidator — validateEnv and logEnvValidation', () => {
  const ORIG_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIG_ENV };
    // Clear env
    delete process.env.MONGO_URI;
    delete process.env.MONGO_URL;
    delete process.env.REDIS_URL;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.JWT_SECRET;
    delete process.env.NOTIFY_DRY_RUN;
    delete process.env.PRINT_DRY_RUN;
    delete process.env.NODE_ENV;
    delete process.env.AUTH_DEV_MODE;
  });

  afterAll(() => {
    process.env = ORIG_ENV;
  });

  test('DEV mode with proper env yields ok=true and no warnings', () => {
    process.env.AUTH_DEV_MODE = '1';
    process.env.NODE_ENV = 'development';
    process.env.MONGO_URI = 'mongodb://localhost:27017/app';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.NOTIFY_DRY_RUN = '1';
    process.env.PRINT_DRY_RUN = '1';

    const { validateEnv } = require('../services/configValidator');
    const res = validateEnv(process.env);

    expect(res.ok).toBe(true);
    expect(res.warnings).toEqual([]);
    expect(res.summary).toContain('Config OK');
  });

  test('Missing core configs produce warnings and ok=false', () => {
    process.env.AUTH_DEV_MODE = '1';
    process.env.NODE_ENV = 'development';

    const { validateEnv } = require('../services/configValidator');
    const res = validateEnv(process.env);

    expect(res.ok).toBe(false);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.summary).toContain('Config WARNINGS');
    expect(res.warnings.join('\n')).toMatch(/Missing Mongo|Redis not configured/);
  });

  test('Conflict between MONGO_URI and MONGO_URL is reported as warning', () => {
    process.env.AUTH_DEV_MODE = '1';
    process.env.NODE_ENV = 'development';
    process.env.MONGO_URI = 'mongodb://one';
    process.env.MONGO_URL = 'mongodb://two';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.NOTIFY_DRY_RUN = '1';
    process.env.PRINT_DRY_RUN = '1';

    const { validateEnv } = require('../services/configValidator');
    const res = validateEnv(process.env);

    expect(res.ok).toBe(false);
    expect(res.warnings.some(w => /MONGO_URI/.test(w) && /MONGO_URL/.test(w))).toBe(true);
  });

  test('logEnvValidation prints info on ok=true and warns on problems', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // OK case
    process.env.AUTH_DEV_MODE = '1';
    process.env.NODE_ENV = 'development';
    process.env.MONGO_URI = 'mongodb://localhost:27017/app';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.NOTIFY_DRY_RUN = '1';
    process.env.PRINT_DRY_RUN = '1';
    let { validateEnv, logEnvValidation } = require('../services/configValidator');
    let res = validateEnv(process.env);
    logEnvValidation(res);
    expect(logSpy).toHaveBeenCalled();

    // Warning case
    jest.resetModules();
    ({ validateEnv, logEnvValidation } = require('../services/configValidator'));
    process.env = { ...ORIG_ENV, AUTH_DEV_MODE: '1', NODE_ENV: 'development' };
    res = validateEnv(process.env);
    logEnvValidation(res);
    expect(warnSpy).toHaveBeenCalled();

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});