const { validateEnv } = require('../services/configValidator');

describe('ENV config validator', () => {
  const orig = { ...process.env };
  afterEach(() => {
    process.env = { ...orig };
  });

  test('DEV: minimal config with AUTH_DEV_MODE=1 logs warnings but ok for DEV', () => {
    process.env = {
      AUTH_DEV_MODE: '1',
      NODE_ENV: 'development',
      NOTIFY_DRY_RUN: '1',
      PRINT_DRY_RUN: '1',
    };
    const res = validateEnv(process.env);
    expect(res.devMode).toBe(true);
    expect(res.ok).toBe(false); // there will be warnings for missing Mongo/Redis
    expect(res.warnings.some((w) => w.includes('Missing Mongo'))).toBe(true);
    expect(res.warnings.some((w) => w.includes('Redis'))).toBe(true);
  });

  test('PROD-like: full config yields Config OK with no warnings', () => {
    process.env = {
      AUTH_DEV_MODE: '0',
      NODE_ENV: 'production',
      MONGO_URI: 'mongodb://localhost:27017/trae',
      REDIS_URL: 'redis://localhost:6379',
      SMTP_HOST: 'smtp.local',
      SMTP_PORT: '587',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      NOTIFY_DRY_RUN: '0',
      PRINT_DRY_RUN: '1',
      JWT_SECRET: 'strong-secret',
    };
    const res = validateEnv(process.env);
    expect(res.devMode).toBe(false);
    expect(res.isProd).toBe(true);
    expect(res.ok).toBe(true);
    expect(res.warnings.length).toBe(0);
  });

  test('Conflict: both MONGO_URI and MONGO_URL yields warning', () => {
    process.env = {
      AUTH_DEV_MODE: '0',
      NODE_ENV: 'production',
      MONGO_URI: 'mongodb://localhost:27017/trae',
      MONGO_URL: 'mongodb://localhost:27017/trae',
      REDIS_URL: 'redis://localhost:6379',
      NOTIFY_DRY_RUN: '1',
      PRINT_DRY_RUN: '1',
      JWT_SECRET: 'strong-secret',
    };
    const res = validateEnv(process.env);
    expect(res.ok).toBe(false);
    expect(res.warnings.some((w) => w.includes('Conflict: both MONGO_URI and MONGO_URL'))).toBe(true);
  });

  test('Notify: NOTIFY_DRY_RUN=0 without SMTP warns', () => {
    process.env = {
      AUTH_DEV_MODE: '0',
      NODE_ENV: 'production',
      MONGO_URI: 'mongodb://localhost:27017/trae',
      REDIS_URL: 'redis://localhost:6379',
      NOTIFY_DRY_RUN: '0',
      PRINT_DRY_RUN: '1',
      JWT_SECRET: 'strong-secret',
    };
    const res = validateEnv(process.env);
    expect(res.ok).toBe(false);
    expect(res.warnings.some((w) => w.includes('SMTP missing'))).toBe(true);
  });
});
