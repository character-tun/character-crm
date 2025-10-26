const _mongoose = require('mongoose');
const { statusActionQueue, getMemQueueSnapshot } = require('../queues/statusActionQueue');

function simplifyFailed(job) {
  return {
    id: job.id,
    orderId: job.data && job.data.orderId,
    statusCode: job.data && job.data.statusCode,
    logId: job.data && job.data.logId,
    error: job.failedReason || (Array.isArray(job.stacktrace) ? job.stacktrace[0] : ''),
    finishedAt: job.finishedOn || job.timestamp || Date.now(),
  };
}

async function getStatusActionsMetrics(n = 20) {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;

  if (!statusActionQueue) {
    const snap = getMemQueueSnapshot ? getMemQueueSnapshot(n) : {
      active: 0, waiting: 0, delayed: 0, failedLastN: [], failed24h: 0, processed24h: 0, failedLastHour: 0, completedLastN: [],
    };
    const {
      active, waiting, delayed, failedLastN, failed24h, processed24h, failedLastHour, completedLastN,
    } = snap;
    return {
      processed24h, failed24h, active, waiting, delayed, failedLastN, failedLastHour, completedLastN,
    };
  }

  // BullMQ metrics
  const counts = await statusActionQueue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
  const waiting = counts.waiting || 0;
  const active = counts.active || 0;
  const delayed = counts.delayed || 0;
  const completedCount = counts.completed || 0;
  const failedCount = counts.failed || 0;

  // Fetch recent completed jobs and filter by last 24h
  let completedJobs = [];
  if (completedCount > 0) {
    const start = Math.max(0, completedCount - 500);
    const end = Math.max(0, completedCount - 1);
    try {
      completedJobs = await statusActionQueue.getJobs(['completed'], start, end, false);
    } catch (e) {
      console.warn('[queueMetrics] completed fetch failed, fallback last 100', e.message);
      completedJobs = await statusActionQueue.getJobs(['completed'], Math.max(0, completedCount - 100), Math.max(0, completedCount - 1), false);
    }
  }
  const processed24h = completedJobs.filter((j) => (j.finishedOn || j.timestamp || 0) >= dayAgo).length;

  // Fetch recent failed jobs and compute stats
  let failedJobs = [];
  if (failedCount > 0) {
    const windowSize = Math.max(500, n);
    const start = Math.max(0, failedCount - windowSize);
    const end = Math.max(0, failedCount - 1);
    try {
      failedJobs = await statusActionQueue.getJobs(['failed'], start, end, false);
    } catch (e) {
      console.warn('[queueMetrics] failed fetch failed, fallback last 100', e.message);
      failedJobs = await statusActionQueue.getJobs(['failed'], Math.max(0, failedCount - Math.max(100, n)), Math.max(0, failedCount - 1), false);
    }
  }

  const failed24h = failedJobs.filter((j) => (j.finishedOn || j.timestamp || 0) >= dayAgo).length;
  const failedLastHour = failedJobs.filter((j) => (j.finishedOn || j.timestamp || 0) >= hourAgo).length;
  const failedLastN = failedJobs.slice(-n).map(simplifyFailed);

  return {
    processed24h, failed24h, active, waiting, delayed, failedLastN, failedLastHour,
  };
}

module.exports = { getStatusActionsMetrics };
