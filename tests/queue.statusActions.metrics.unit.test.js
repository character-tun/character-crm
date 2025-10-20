const path = require('path');

describe('queueMetrics service (BullMQ mocked)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('computes metrics from BullMQ API (counts, last N, 24h/hour)', async () => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000 + 1000; // within last 24h
    const hourAgo = now - 60 * 60 * 1000 + 1000; // within last hour

    jest.doMock('../queues/statusActionQueue', () => {
      const completedJobs = [
        { id: 'c1', finishedOn: now },
        { id: 'c2', finishedOn: dayAgo },
        { id: 'c3', finishedOn: now - 48 * 60 * 60 * 1000 }, // older than 24h
        { id: 'c4', finishedOn: now - 10 * 60 * 60 * 1000 },
      ];
      const failedJobs = [
        { id: 'f1', finishedOn: hourAgo, data: { orderId: 'o1', statusCode: 's', logId: 'l1' }, failedReason: 'E1' },
        { id: 'f2', finishedOn: now, data: { orderId: 'o2', statusCode: 's', logId: 'l2' }, failedReason: 'E2' },
        { id: 'f3', finishedOn: dayAgo, data: { orderId: 'o3', statusCode: 's', logId: 'l3' }, failedReason: 'E3' },
        { id: 'f4', finishedOn: now - 2 * 24 * 60 * 60 * 1000, data: { orderId: 'o4', statusCode: 's', logId: 'l4' }, failedReason: 'E4' },
        { id: 'f5', finishedOn: now - 30 * 60 * 1000, data: { orderId: 'o5', statusCode: 's', logId: 'l5' }, failedReason: 'E5' },
      ];
      return {
        statusActionQueue: {
          async getJobCounts() {
            return { waiting: 2, active: 1, delayed: 3, failed: failedJobs.length, completed: completedJobs.length };
          },
          async getJobs(types, start, end) {
            if (types.includes('completed')) return completedJobs;
            if (types.includes('failed')) return failedJobs;
            return [];
          },
        },
      };
    });

    const { getStatusActionsMetrics } = require('../services/queueMetrics');
    const metrics = await getStatusActionsMetrics(2);

    expect(metrics.active).toBe(1);
    expect(metrics.waiting).toBe(2);
    expect(metrics.delayed).toBe(3);
    expect(metrics.processed24h).toBe(3); // c1, c2, c4
    expect(metrics.failed24h).toBe(4); // f1,f2,f3,f5
    expect(metrics.failedLastHour).toBeGreaterThanOrEqual(2); // f1,f2,f5 in last hour
    expect(metrics.failedLastN.length).toBe(2);
    expect(metrics.failedLastN[0]).toHaveProperty('id');
    expect(metrics.failedLastN[0]).toHaveProperty('error');
  });

  test('DEV mem snapshot fallback', async () => {
    jest.doMock('../queues/statusActionQueue', () => {
      return {
        statusActionQueue: null,
        getMemQueueSnapshot: (n) => ({
          active: 0,
          waiting: 5,
          delayed: 0,
          failedLastN: [{ id: 'x1', error: 'boom' }],
          failed24h: 7,
          processed24h: 12,
          failedLastHour: 3,
        }),
      };
    });

    const { getStatusActionsMetrics } = require('../services/queueMetrics');
    const metrics = await getStatusActionsMetrics(1);
    expect(metrics.active).toBe(0);
    expect(metrics.waiting).toBe(5);
    expect(metrics.failed24h).toBe(7);
    expect(metrics.processed24h).toBe(12);
    expect(metrics.failedLastHour).toBe(3);
    expect(metrics.failedLastN.length).toBe(1);
  });
});