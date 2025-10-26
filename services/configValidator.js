const { z } = require('zod');

// Define ENV schema with DEV/PROD distinctions
const EnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  AUTH_DEV_MODE: z.enum(['0', '1']).default('0'),

  // Mongo connection (support legacy MONGO_URL alias for MONGO_URI)
  MONGO_URI: z.string().optional(),
  MONGO_URL: z.string().optional(),

  // Queue / Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),

  // SMTP (mail)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Status actions DRY run flags
  NOTIFY_DRY_RUN: z.enum(['0', '1']).optional(),
  PRINT_DRY_RUN: z.enum(['0', '1']).optional(),

  // Payments feature flags
  PAYMENTS_REFUND_ENABLED: z.enum(['0', '1']).optional(),
  DEFAULT_CASH_REGISTER: z.string().optional(),
  CASH_LOCK_STRICT: z.enum(['0', '1']).optional(),

  // JWT for auth middleware fallback
  JWT_SECRET: z.string().optional(),
});

function validateEnv(env) {
  const parsed = EnvSchema.safeParse(env || process.env);
  const warnings = [];

  if (!parsed.success) {
    // zod validation errors, collect issues but don't crash (we produce friendly output)
    parsed.error.issues.forEach((issue) => {
      warnings.push(`[ENV] ${issue.path.join('.')}: ${issue.message}`);
    });
  }

  const data = parsed.success ? parsed.data : env || process.env;

  const devMode = String(data.AUTH_DEV_MODE || '0') === '1';
  const nodeEnv = (data.NODE_ENV || '').toLowerCase();
  const isProd = nodeEnv === 'production' || (!devMode && nodeEnv === '');

  // Mongo URI/URL checks
  const mongoUri = data.MONGO_URI || data.MONGO_URL || '';
  if (!mongoUri) {
    warnings.push('[ENV] Missing Mongo connection: set MONGO_URI (or legacy MONGO_URL)');
    if (devMode) warnings.push('[ENV] DEV mode: Mongo warnings do not block startup.');
  }
  if (data.MONGO_URI && data.MONGO_URL) {
    warnings.push('[ENV] Conflict: both MONGO_URI and MONGO_URL provided. Prefer MONGO_URI.');
  }

  // Redis checks (warn if neither URL/host provided)
  const hasRedis = !!data.REDIS_URL || !!data.REDIS_HOST;
  if (!hasRedis) {
    warnings.push('[ENV] Redis not configured: set REDIS_URL or REDIS_HOST/REDIS_PORT for BullMQ.');
    if (devMode) warnings.push('[ENV] DEV mode: in-memory queue will be used when Redis is absent.');
  }

  // SMTP checks (only warn if full config missing and NOTIFY_DRY_RUN is off)
  const smtpConfigured = !!data.SMTP_HOST && !!data.SMTP_PORT && !!data.SMTP_USER && !!data.SMTP_PASS;
  const notifyDry = String(data.NOTIFY_DRY_RUN || '1') === '1';
  if (!smtpConfigured && !notifyDry) {
    warnings.push('[ENV] SMTP missing: set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS or enable NOTIFY_DRY_RUN=1.');
  }

  // Print checks (DRY)
  const printDry = String(data.PRINT_DRY_RUN || '1') === '1';
  if (!printDry) {
    warnings.push('[ENV] PRINT_DRY_RUN=0: ensure headless renderer is available (puppeteer).');
  }

  // JWT check (only warn if missing in production)
  const jwtSecret = data.JWT_SECRET || '';
  if (!jwtSecret && isProd) {
    warnings.push('[ENV] JWT_SECRET missing: set a strong secret in production.');
  }

  // Format output
  const ok = warnings.length === 0;
  const summary = ok ? 'Config OK' : `Config WARNINGS (${warnings.length})`;

  return { ok, warnings, data, summary, devMode, isProd };
}

function logEnvValidation(result) {
  const { ok, warnings, summary } = result;
  if (ok) {
    console.log(summary);
  } else {
    console.warn(summary);
    warnings.forEach((w) => console.warn(w));
  }
}

module.exports = { EnvSchema, validateEnv, logEnvValidation };