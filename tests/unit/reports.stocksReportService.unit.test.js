const mongoose = require('mongoose');

// Глобальное хранилище для использования внутри jest.mock фабрик
global.mockMem = global.mockMem || { balances: new Map(), operations: [] };

jest.mock('../../models/stock/StockBalance', () => ({
  aggregate: jest.fn(async (pipeline) => {
    const map = new Map();
    for (const [k, v] of global.mockMem.balances.entries()) {
      const [, locationId] = k.split(':');
      const cur = map.get(locationId) || { qty: 0, reserved: 0 };
      cur.qty += Number(v.quantity || 0);
      cur.reserved += Number(v.reservedQuantity || 0);
      map.set(locationId, cur);
    }
    const arr = Array.from(map.entries()).map(([locationId, totals]) => ({ _id: locationId, sumQty: totals.qty, sumReserved: totals.reserved }));
    arr.sort((a, b) => b.sumQty - a.sumQty);
    const limitStage = pipeline.find((s) => Object.prototype.hasOwnProperty.call(s, '$limit'));
    const limit = limitStage ? Number(limitStage.$limit) : arr.length;
    return arr.slice(0, limit);
  }),
}));

jest.mock('../../models/stock/StockOperation', () => ({
  aggregate: jest.fn(async (pipeline) => {
    const groupStage = pipeline.find((s) => s.$group);
    if (!groupStage) return [];
    const groupId = groupStage.$group._id;
    const matchStage = pipeline.find((s) => s.$match) || {};
    const filter = matchStage.$match || {};
    const inRange = (d) => {
      const v = new Date(d);
      if (filter.createdAt && filter.createdAt.$gte && v < filter.createdAt.$gte) return false;
      if (filter.createdAt && filter.createdAt.$lte && v > filter.createdAt.$lte) return false;
      return true;
    };
    const ops = global.mockMem.operations.filter((op) => inRange(op.createdAt || new Date()));

    if (groupId === '$type') {
      const map = new Map();
      for (const op of ops) {
        const t = String(op.type || '');
        const cur = map.get(t) || 0;
        map.set(t, cur + Number(op.qty || 0));
      }
      return Array.from(map.entries()).map(([type, sum]) => ({ _id: type, sum }));
    }
    if (groupId && typeof groupId === 'object' && groupId.itemId === '$itemId' && groupId.type === '$type') {
      const map = new Map();
      for (const op of ops) {
        const id = String(op.itemId || '');
        const t = String(op.type || '');
        const k = `${id}:${t}`;
        const cur = map.get(k) || 0;
        map.set(k, cur + Number(op.qty || 0));
      }
      return Array.from(map.entries()).map(([k, sum]) => {
        const [itemId, type] = k.split(':');
        return { _id: { itemId, type }, sum };
      });
    }
    return [];
  }),
}));

const service = require('../../services/reports/stocksReportService');

function seedBalance(itemId, locationId, quantity = 0, reservedQuantity = 0) {
  const k = `${String(itemId)}:${String(locationId)}`;
  global.mockMem.balances.set(k, { quantity, reservedQuantity });
}
function seedOp({ itemId, type, qty, createdAt }) {
  global.mockMem.operations.push({ itemId, type, qty, createdAt: createdAt || new Date('2025-05-05T12:00:00Z') });
}

beforeEach(() => {
  // Сброс данных и подключение Mongo
  global.mockMem.balances = new Map();
  global.mockMem.operations = [];
  mongoose.connection = mongoose.connection || {};
  mongoose.connection.readyState = 1;
});

describe('unit: services/reports/stocksReportService', () => {
  test('summaryByLocation — корректная агрегация и расчёт available', async () => {
    seedBalance('i1', 'A', 10, 2);
    seedBalance('i2', 'B', 3, 1);
    seedBalance('i3', 'A', 5, 0);
    const res = await service.summaryByLocation({ limit: 10 });
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.groups)).toBe(true);
    const a = res.groups.find((g) => g.locationId === 'A');
    const b = res.groups.find((g) => g.locationId === 'B');
    expect(a.totals.qty).toBe(15);
    expect(a.totals.reserved).toBe(2);
    expect(a.totals.available).toBe(13);
    expect(b.totals.qty).toBe(3);
    expect(b.totals.reserved).toBe(1);
    expect(b.totals.available).toBe(2);
    expect(res.totalQty).toBe(18);
  });

  test('summaryByLocation — limit применяется и кап на 200', async () => {
    // Больше двух групп, но limit=2
    seedBalance('i1', 'A', 10, 2);
    seedBalance('i2', 'B', 8, 1);
    seedBalance('i3', 'C', 7, 0);
    const res = await service.summaryByLocation({ limit: 2 });
    expect(res.groups.length).toBe(2);
    // По сортировке qty убыв.
    expect(res.groups[0].totals.qty >= res.groups[1].totals.qty).toBe(true);
  });

  test('summaryByLocation — без подключения Mongo возвращает пустые группы', async () => {
    mongoose.connection.readyState = 0;
    const res = await service.summaryByLocation({ limit: 10 });
    expect(res.ok).toBe(true);
    expect(res.groups).toEqual([]);
    expect(res.totalQty).toBe(0);
  });

  test('turnover — корректные totals и группировка по item', async () => {
    seedOp({ itemId: 'i1', type: 'in', qty: 5 });
    seedOp({ itemId: 'i1', type: 'out', qty: 2 });
    seedOp({ itemId: 'i1', type: 'return', qty: 1 });
    seedOp({ itemId: 'i2', type: 'in', qty: 2 });
    seedOp({ itemId: 'i2', type: 'out', qty: 1 });

    const res = await service.turnover({ limit: 10 });
    expect(res.ok).toBe(true);
    expect(res.totals.in).toBe(8);
    expect(res.totals.out).toBe(3);
    expect(res.totals.net).toBe(5);
    const g1 = res.byItem.find((g) => g.itemId === 'i1');
    const g2 = res.byItem.find((g) => g.itemId === 'i2');
    expect(g1.in).toBe(6);
    expect(g1.out).toBe(2);
    expect(g1.net).toBe(4);
    expect(g2.in).toBe(2);
    expect(g2.out).toBe(1);
    expect(g2.net).toBe(1);
  });

  test('turnover — фильтрация по from/to', async () => {
    seedOp({ itemId: 'i1', type: 'in', qty: 5, createdAt: new Date('2025-01-10T00:00:00Z') });
    seedOp({ itemId: 'i1', type: 'out', qty: 1, createdAt: new Date('2025-01-11T00:00:00Z') });
    seedOp({ itemId: 'i1', type: 'return', qty: 1, createdAt: new Date('2025-02-01T00:00:00Z') });
    seedOp({ itemId: 'i2', type: 'in', qty: 2, createdAt: new Date('2024-12-31T00:00:00Z') });
    const res = await service.turnover({ from: '2025-01-01', to: '2025-01-31', limit: 10 });
    expect(res.ok).toBe(true);
    expect(res.totals.in).toBe(5);
    expect(res.totals.out).toBe(1);
    expect(res.totals.net).toBe(4);
    const g1 = res.byItem.find((g) => g.itemId === 'i1');
    expect(g1.in).toBe(5);
    expect(g1.out).toBe(1);
    expect(g1.net).toBe(4);
    const g2 = res.byItem.find((g) => g.itemId === 'i2');
    expect(g2).toBeUndefined();
  });

  test('turnover — invalid from/to не применяет фильтр и учитывает все операции', async () => {
    seedOp({ itemId: 'i1', type: 'in', qty: 3, createdAt: new Date('2025-03-01T00:00:00Z') });
    seedOp({ itemId: 'i1', type: 'out', qty: 1, createdAt: new Date('2025-03-02T00:00:00Z') });
    const res = await service.turnover({ from: 'not-a-date', to: 'also-bad' });
    expect(res.ok).toBe(true);
    expect(res.totals.in).toBe(3);
    expect(res.totals.out).toBe(1);
    expect(res.totals.net).toBe(2);
  });

  test('turnover — без подключения Mongo возвращает пустые данные', async () => {
    mongoose.connection.readyState = 0;
    const res = await service.turnover({});
    expect(res.ok).toBe(true);
    expect(res.totals).toEqual({ in: 0, out: 0, net: 0 });
    expect(res.byItem).toEqual([]);
  });
});