const request = require('supertest');
const express = require('express');
const Joi = require('joi');

// Ensure DEV mode for GET list fallback
process.env.AUTH_DEV_MODE = '1';

// Mock OrderStatus model to avoid Mongo dependency for write operations
jest.mock('../models/OrderStatus', () => ({
  GROUPS: ['draft', 'in_progress', 'closed_success', 'closed_fail'],
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
}));

const OrderStatus = require('../models/OrderStatus');
const {
  groupedStatusesResponseSchema,
  orderStatusSchema,
  createStatusRequestSchema,
  updateStatusRequestSchema,
  statusesReorderResponseSchema,
} = require('../contracts/apiContracts');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/auth').withUser);
  app.use('/api/statuses', require('../routes/statuses'));
  app.use(require('../middleware/error'));
  return app;
}

const joiOk = (schema, payload) => {
  const { error } = schema.validate(payload, { allowUnknown: true });
  if (error) throw new Error(`Joi validation failed: ${error.message}`);
};

describe('API /api/statuses contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/statuses', () => {
    test('returns grouped statuses when authorized (DEV fallback)', async () => {
      const app = makeApp();
      const res = await request(app)
        .get('/api/statuses')
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:list');

      expect(res.status).toBe(200);
      joiOk(groupedStatusesResponseSchema, res.body);
      // Basic shape assertions
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.every((g) => Array.isArray(g.items))).toBe(true);
    });

    test('returns 403 without required role', async () => {
      const app = makeApp();
      const res = await request(app)
        .get('/api/statuses')
        .set('x-user-id', 'u1');
      expect(res.status).toBe(403);
      expect(res.body && res.body.msg).toBe('Недостаточно прав');
    });
  });

  describe('POST /api/statuses', () => {
    const validPayload = {
      code: 'custom_status',
      name: 'Пользовательский',
      color: '#123456',
      group: 'in_progress',
      order: 1,
      actions: [],
      system: false,
    };

    test('creates status (201) and returns matching status schema', async () => {
      const createdDoc = {
        _id: 'st-100',
        ...validPayload,
      };
      OrderStatus.create.mockResolvedValue(createdDoc);

      const app = makeApp();
      // Validate request contract prior to sending
      joiOk(createStatusRequestSchema, validPayload);

      const res = await request(app)
        .post('/api/statuses')
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:create')
        .send(validPayload);

      expect(res.status).toBe(201);
      joiOk(orderStatusSchema, res.body);
      expect(res.body.code).toBe(validPayload.code);
    });

    test('returns 400 on invalid code', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/statuses')
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:create')
        .send({ ...validPayload, code: 'x' });
      expect(res.status).toBe(400);
      expect(res.body && res.body.error).toBe('Invalid code');
      expect(OrderStatus.create).not.toHaveBeenCalled();
    });

    test('returns 400 on invalid group', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/statuses')
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:create')
        .send({ ...validPayload, group: 'bad_group' });
      expect(res.status).toBe(400);
      expect(res.body && res.body.error).toBe('Invalid group');
      expect(OrderStatus.create).not.toHaveBeenCalled();
    });

    test('returns 409 on duplicate code', async () => {
      OrderStatus.create.mockRejectedValue({ code: 11000 });
      const app = makeApp();
      const res = await request(app)
        .post('/api/statuses')
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:create')
        .send(validPayload);
      expect(res.status).toBe(409);
      expect(res.body && res.body.error).toBe('Status code already exists');
    });

    test('returns 403 without create role', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/statuses')
        .set('x-user-id', 'u1')
        .send(validPayload);
      expect(res.status).toBe(403);
      expect(res.body && res.body.msg).toBe('Недостаточно прав');
    });
  });

  describe('PUT /api/statuses/:id', () => {
    const STATUS_ID = 'st-200';
    const curDoc = {
      _id: STATUS_ID, code: 'custom_status', name: 'Обычный', group: 'draft', order: 0, actions: [], system: false,
    };

    test('updates status and returns updated doc', async () => {
      OrderStatus.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(curDoc) });
      OrderStatus.findByIdAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue({ ...curDoc, name: 'Обновлён' }) });
      const app = makeApp();

      const patch = { name: 'Обновлён' };
      joiOk(updateStatusRequestSchema, patch);

      const res = await request(app)
        .put(`/api/statuses/${STATUS_ID}`)
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:update')
        .send(patch);
      expect(res.status).toBe(200);
      joiOk(orderStatusSchema, res.body);
      expect(res.body.name).toBe('Обновлён');
    });

    test('returns 404 when status not found', async () => {
      OrderStatus.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const app = makeApp();
      const res = await request(app)
        .put(`/api/statuses/${STATUS_ID}`)
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:update')
        .send({ name: 'X' });
      expect(res.status).toBe(404);
      expect(res.body && res.body.error).toBe('Status not found');
    });

    test('returns 400 on invalid group', async () => {
      OrderStatus.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(curDoc) });
      const app = makeApp();
      const res = await request(app)
        .put(`/api/statuses/${STATUS_ID}`)
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:update')
        .send({ group: 'bad_group' });
      expect(res.status).toBe(400);
      expect(res.body && res.body.error).toBe('Invalid group');
    });

    test('returns 400 when modifying system code/group', async () => {
      const sysDoc = { ...curDoc, system: true };
      OrderStatus.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(sysDoc) });
      const app = makeApp();
      const res = await request(app)
        .put(`/api/statuses/${STATUS_ID}`)
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:update')
        .send({ code: 'new_code' });
      expect(res.status).toBe(400);
      expect(res.body && res.body.error).toBe('System status: code/group cannot be modified');
    });

    test('returns 409 on duplicate code at update', async () => {
      OrderStatus.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(curDoc) });
      OrderStatus.findByIdAndUpdate.mockReturnValue({ lean: jest.fn().mockRejectedValue({ code: 11000 }) });
      const app = makeApp();
      const res = await request(app)
        .put(`/api/statuses/${STATUS_ID}`)
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:update')
        .send({ code: 'dup_code' });
      expect(res.status).toBe(409);
      expect(res.body && res.body.error).toBe('Status code already exists');
    });

    test('returns 403 without update role', async () => {
      OrderStatus.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(curDoc) });
      const app = makeApp();
      const res = await request(app)
        .put(`/api/statuses/${STATUS_ID}`)
        .set('x-user-id', 'u1')
        .send({ name: 'X' });
      expect(res.status).toBe(403);
      expect(res.body && res.body.msg).toBe('Недостаточно прав');
    });
  });

  describe('PATCH /api/statuses/reorder', () => {
    test('batch reorder updates statuses and reports ok', async () => {
      // st-1: editable
      OrderStatus.findById.mockImplementation((id) => ({
        lean: jest.fn().mockResolvedValue(id === 'st-1' ? { _id: 'st-1', group: 'draft', system: false } : { _id: id, group: 'in_progress', system: false }),
      }));
      OrderStatus.updateOne.mockResolvedValue({});

      const app = makeApp();
      const payload = [
        { id: 'st-1', group: 'in_progress', order: 10 },
        { id: 'st-2', order: 5 },
      ];

      const res = await request(app)
        .patch('/api/statuses/reorder')
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:reorder')
        .send(payload);

      expect(res.status).toBe(200);
      joiOk(statusesReorderResponseSchema, res.body);
      expect(res.body.ok).toBe(true);
      expect(res.body.updated).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.errors)).toBe(true);
    });

    test('returns 400 when array of items is missing', async () => {
      const app = makeApp();
      const res = await request(app)
        .patch('/api/statuses/reorder')
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:reorder')
        .send({ foo: 'bar' });
      expect(res.status).toBe(400);
      expect(res.body && res.body.error).toBe('Array of items is required');
    });

    test('reports item error when status not found', async () => {
      OrderStatus.findById.mockImplementation((id) => ({ lean: jest.fn().mockResolvedValue(id === 'missing' ? null : { _id: id, group: 'draft', system: false }) }));
      const app = makeApp();
      const res = await request(app)
        .patch('/api/statuses/reorder')
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:reorder')
        .send([{ id: 'missing', order: 1 }]);
      expect(res.status).toBe(200);
      joiOk(statusesReorderResponseSchema, res.body);
      expect(res.body.errors.some((e) => e.error === 'Status not found')).toBe(true);
    });

    test('returns error entry when modifying system group', async () => {
      OrderStatus.findById.mockImplementation((id) => ({ lean: jest.fn().mockResolvedValue({ _id: id, group: 'draft', system: true }) }));
      const app = makeApp();
      const res = await request(app)
        .patch('/api/statuses/reorder')
        .set('x-user-id', 'u1')
        .set('x-user-role', 'settings.statuses:reorder')
        .send([{ id: 'st-sys', group: 'in_progress' }]);
      expect(res.status).toBe(200);
      joiOk(statusesReorderResponseSchema, res.body);
      expect(res.body.errors.some((e) => e.error === 'System status: group cannot be modified')).toBe(true);
    });

    test('returns 403 without reorder role', async () => {
      const app = makeApp();
      const res = await request(app)
        .patch('/api/statuses/reorder')
        .set('x-user-id', 'u1')
        .send([{ id: 'st-1', order: 1 }]);
      expect(res.status).toBe(403);
      expect(res.body && res.body.msg).toBe('Недостаточно прав');
    });
  });
});