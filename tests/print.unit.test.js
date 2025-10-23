describe('print adapter unit tests (Mongo-only, DRY_RUN)', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
  });

  test('DRY_RUN=1: does not invoke puppeteer or fileStore', async () => {
    process.env.PRINT_DRY_RUN = '1';

    const launch = jest.fn();
    jest.doMock('puppeteer', () => ({ launch }), { virtual: true });

    const saveBuffer = jest.fn().mockResolvedValue('file-1');
    const getMeta = jest.fn(() => ({ name: 'order.pdf', size: 0, mime: 'application/pdf', createdAt: new Date().toISOString() }));
    jest.doMock('../services/fileStore', () => ({ saveBuffer, getMeta }), { virtual: true });

    const tplDoc = { _id: 'tpl-print-1', code: 'print-order', name: 'Print Order', html: '<p>Print {{order.id}}</p>' };
    jest.doMock('../models/DocTemplate', () => ({
      findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue(id === 'tpl-print-1' ? tplDoc : null) })),
      findOne: jest.fn(({ code }) => ({ lean: jest.fn().mockResolvedValue(code === 'print-order' ? tplDoc : null) })),
    }));

    const orderDoc = { _id: 'ord-print-dry', files: [], save: jest.fn().mockResolvedValue(true) };
    jest.doMock('../models/Order', () => ({
      findById: jest.fn(async () => orderDoc),
    }));

    jest.doMock('../models/OrderStatusLog', () => ({ create: jest.fn().mockResolvedValue({ _id: 'log1' }) }));

    const { handleStatusActions } = require('../services/statusActionsHandler');

    const res = await handleStatusActions({
      orderId: orderDoc._id,
      statusCode: 'new',
      actions: [{ type: 'print', docId: 'tpl-print-1' }],
      logId: 'l1',
      userId: 'u1',
    });

    expect(res && res.ok).toBe(true);
    expect(res.processed).toBe(1);
    expect(launch).not.toHaveBeenCalled();
    expect(saveBuffer).not.toHaveBeenCalled();
    expect(orderDoc.save).not.toHaveBeenCalled();
  });

  test('DRY_RUN=0: generates PDF via puppeteer and saves via fileStore', async () => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
    process.env.PRINT_DRY_RUN = '0';

    const pdfBuffer = Buffer.from('%PDF-1.4 mock');
    const page = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(pdfBuffer),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const browser = {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const launch = jest.fn().mockResolvedValue(browser);
    jest.doMock('puppeteer', () => ({ launch }), { virtual: true });

    const saveBuffer = jest.fn().mockResolvedValue('file-2');
    const getMeta = jest.fn(() => ({ name: 'order.pdf', size: pdfBuffer.length, mime: 'application/pdf', createdAt: new Date().toISOString() }));
    jest.doMock('../services/fileStore', () => ({ saveBuffer, getMeta }), { virtual: true });

    const tplDoc = { _id: 'tpl-print-2', code: 'print-order-2', name: 'Print Order 2', html: '<p>Order {{order.id}} total: {{order.total}}</p>' };
    jest.doMock('../models/DocTemplate', () => ({
      findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue(id === 'tpl-print-2' ? tplDoc : null) })),
      findOne: jest.fn(({ code }) => ({ lean: jest.fn().mockResolvedValue(code === 'print-order-2' ? tplDoc : null) })),
    }));

    const orderDoc = { _id: 'ord-print-real', files: [], total: 123.45, save: jest.fn().mockResolvedValue(true) };
    jest.doMock('../models/Order', () => ({
      findById: jest.fn(async () => orderDoc),
    }));

    jest.doMock('../models/OrderStatusLog', () => ({ create: jest.fn().mockResolvedValue({ _id: 'log2' }) }));

    const { handleStatusActions } = require('../services/statusActionsHandler');

    const res = await handleStatusActions({
      orderId: orderDoc._id,
      statusCode: 'in_work',
      actions: [{ type: 'print', docId: 'tpl-print-2' }],
      logId: 'l2',
      userId: 'u2',
    });

    expect(res && res.ok).toBe(true);
    expect(res.processed).toBe(1);

    expect(launch).toHaveBeenCalledTimes(1);
    expect(page.setContent).toHaveBeenCalledTimes(1);
    expect(page.pdf).toHaveBeenCalledTimes(1);
    expect(saveBuffer).toHaveBeenCalledTimes(1);

    // Order updated with attached file and saved
    expect(orderDoc.files.length).toBeGreaterThan(0);
    expect(orderDoc.save).toHaveBeenCalledTimes(1);
  });
});