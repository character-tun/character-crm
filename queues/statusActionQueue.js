const { Queue, Worker } = require('bullmq');
const { handleStatusActions } = require('../services/statusActionsHandler');

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const { REDIS_URL } = process.env;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

// Use an in-memory queue when in DEV mode and Redis is not configured
const USE_MEM_QUEUE = DEV_MODE && !REDIS_URL;
const queueName = 'statusActionQueue';

if (USE_MEM_QUEUE) {
  // Simple in-memory queue + "worker" to simulate BullMQ behavior with metrics
  const memQueue = [];
  let processing = false;
  const memCompleted = []; // { jobId, data, finishedAt, startedAt, durationMs }
  const memFailed = []; // { jobId, data, finishedAt, error, attempts }

  const MEM_ATTEMPTS = parseInt(process.env.MEM_ATTEMPTS || '5', 10);
  const MEM_BACKOFF_BASE_MS = parseInt(process.env.MEM_BACKOFF_BASE_MS || '200', 10);

  function scheduleNextTick() {
    if (processing) return;
    if (memQueue.length === 0) return;
    const now = Date.now();
    const nextJob = memQueue.reduce((min, j) => (min == null || j.nextAt < min ? j.nextAt : min), null);
    const delay = Math.max(0, (nextJob || now) - now);
    setTimeout(processNext, delay);
  }

  async function processNext() {
    if (processing) return;
    const now = Date.now();
    const idx = memQueue.findIndex((j) => (j.nextAt || 0) <= now);
    if (idx === -1) {
      // No ready jobs, schedule at earliest nextAt
      return scheduleNextTick();
    }
    const job = memQueue.splice(idx, 1)[0];
    if (!job) return;
    processing = true;
    const { jobId, data } = job;
    const startedAt = Date.now();
    try {
      console.log(`[Worker:${queueName}] processing`, {
        jobId, orderId: data.orderId, statusCode: data.statusCode, logId: data.logId,
      });
      if (data && data.__forceFail) {
        throw new Error('Forced fail (test)');
      }
      const result = await handleStatusActions(data);
      console.log(`[Worker:${queueName}] completed`, { jobId, result });
      const finishedAt = Date.now();
      memCompleted.push({ jobId, data, startedAt, finishedAt, durationMs: finishedAt - startedAt });
    } catch (err) {
      const attempt = (job.attempt || 0) + 1;
      const errorMessage = err?.message;
      console.error(`[Worker:${queueName}] failed`, { jobId, data, attempt }, err);
      if (attempt < (job.maxAttempts || MEM_ATTEMPTS)) {
        const delayMs = (job.backoffBaseMs || MEM_BACKOFF_BASE_MS) * Math.pow(2, attempt);
        const nextAt = Date.now() + delayMs;
        console.log(`[Worker:${queueName}] retry scheduled`, { jobId, attempt, nextInMs: delayMs });
        memQueue.push({ ...job, attempt, nextAt });
      } else {
        memFailed.push({ jobId, data, finishedAt: Date.now(), error: { message: errorMessage }, attempts: attempt });
      }
    } finally {
      processing = false;
      scheduleNextTick();
    }
  }

  async function enqueueStatusActions({
    orderId, statusCode, actions, logId, userId, __forceFail,
  }) {
    const jobId = `${orderId}:${statusCode}:${logId}`;
    // prevent duplicates in queue
    if (memQueue.find((j) => j.jobId === jobId)) {
      console.log(`[Queue:${queueName}] job already exists (mem)`, { jobId });
      return;
    }
    memQueue.push({
      jobId,
      data: {
        orderId, statusCode, actions, logId, userId, __forceFail: !!__forceFail,
      },
      attempt: 0,
      maxAttempts: MEM_ATTEMPTS,
      backoffBaseMs: MEM_BACKOFF_BASE_MS,
      nextAt: Date.now(),
    });
    console.log(`[Queue:${queueName}] enqueued (mem)`, { jobId });
    scheduleNextTick();
  }

  function getMemQueueSnapshot(n = 20) {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const failedLastN = memFailed.slice(-n).map((f) => ({
      id: f.jobId,
      orderId: f.data?.orderId,
      statusCode: f.data?.statusCode,
      logId: f.data?.logId,
      error: f.error?.message || '',
      finishedAt: f.finishedAt,
      attempts: f.attempts || 0,
    }));
    const completedLastN = memCompleted.slice(-n).map((c) => ({
      id: c.jobId,
      finishedAt: c.finishedAt,
      durationMs: c.durationMs,
    }));
    const failed24h = memFailed.filter((f) => f.finishedAt >= dayAgo).length;
    const processed24h = memCompleted.filter((c) => c.finishedAt >= dayAgo).length;
    const failedLastHour = memFailed.filter((f) => f.finishedAt >= hourAgo).length;

    const waiting = memQueue.filter((j) => (j.nextAt || 0) <= now).length;
    const delayed = memQueue.filter((j) => (j.nextAt || 0) > now).length;

    return {
      active: processing ? 1 : 0,
      waiting,
      delayed,
      failedLastN,
      failed24h,
      processed24h,
      failedLastHour,
      completedLastN,
    };
  }

  module.exports = { statusActionQueue: null, enqueueStatusActions, getMemQueueSnapshot };
} else {
  const connection = REDIS_URL ? { url: REDIS_URL } : { host: REDIS_HOST, port: REDIS_PORT };
  const statusActionQueue = new Queue(queueName, { connection });

  // Worker processor
  const worker = new Worker(
    queueName,
    async (job) => {
      const {
        orderId, statusCode, actions, logId, userId,
      } = job.data || {};
      console.log(`[Worker:${queueName}] processing`, {
        jobId: job.id, orderId, statusCode, logId,
      });
      return handleStatusActions({
        orderId, statusCode, actions, logId, userId,
      });
    },
    { connection, concurrency: 5 },
  );

  worker.on('completed', (job, result) => {
    console.log(`[Worker:${queueName}] completed`, { jobId: job.id, result });
  });
  worker.on('failed', (job, err) => {
    console.error(`[Worker:${queueName}] failed`, { jobId: job?.id, data: job?.data }, err);
  });
  worker.on('error', (err) => {
    console.error(`[Worker:${queueName}] error`, err);
  });

  /**
   * Enqueue status actions job
   * @param {Object} params
   * @param {string} params.orderId
   * @param {string} params.statusCode
   * @param {Array} params.actions
   * @param {string} params.logId
   * @param {string} params.userId
   */
  async function enqueueStatusActions({
    orderId, statusCode, actions, logId, userId,
  }) {
    const jobId = `${orderId}:${statusCode}:${logId}`;
    try {
      const exists = await statusActionQueue.getJob(jobId);
      if (exists) {
        console.log(`[Queue:${queueName}] job already exists`, { jobId });
        return;
      }
      await statusActionQueue.add(
        'status-actions',
        {
          orderId, statusCode, actions, logId, userId,
        },
        {
          jobId,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      console.log(`[Queue:${queueName}] enqueued`, { jobId });
    } catch (err) {
      console.error(`[Queue:${queueName}] enqueue error`, { jobId }, err);
      throw err;
    }
  }

  module.exports = { statusActionQueue, enqueueStatusActions };
}