describe('notify adapter unit tests (Mongo-only, DRY_RUN)', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
  });

  test('DRY_RUN=1: does not send via nodemailer', async () => {
    process.env.NOTIFY_DRY_RUN = '1';

    const sendMail = jest.fn().mockResolvedValue({ messageId: 'mid-dry' });
    jest.doMock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }), { virtual: true });

    // Mock NotifyTemplate model to resolve template by id/code
    const tplDoc = { _id: 'tpl1', code: 'order-created', channel: 'email', subject: 'Order {{order.id}}', bodyHtml: '<p>Hello</p>' };
    jest.doMock('../models/NotifyTemplate', () => ({
      findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue(id === 'tpl1' ? tplDoc : null) })),
      findOne: jest.fn(({ code }) => ({ lean: jest.fn().mockResolvedValue(code === 'order-created' ? tplDoc : null) })),
    }));

    const { handleStatusActions } = require('../services/statusActionsHandler');

    const orderId = 'ord-unit-dry';
    const res = await handleStatusActions({
      orderId, statusCode: 'new', actions: [{ type: 'notify', templateId: 'tpl1' }], logId: 'l1', userId: 'u1',
    });

    expect(res && res.ok).toBe(true);
    expect(res.processed).toBe(1);
    expect(sendMail).not.toHaveBeenCalled();
  });

  test('DRY_RUN=0: sends email via nodemailer with rendered subject/html', async () => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
    process.env.NOTIFY_DRY_RUN = '0';
    process.env.SMTP_HOST = 'smtp.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    process.env.SMTP_FROM = 'from@test';
    process.env.SMTP_TO = 'to@test';

    const sendMail = jest.fn().mockResolvedValue({ messageId: 'mid-1' });
    jest.doMock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }), { virtual: true });

    // Mock NotifyTemplate model
    const tplDoc = { _id: 'tpl2', code: 'order-notify', channel: 'email', subject: 'Order {{order.id}}', bodyHtml: '<b>Hello {{order.id}}</b>' };
    jest.doMock('../models/NotifyTemplate', () => ({
      findById: jest.fn((id) => ({ lean: jest.fn().mockResolvedValue(id === 'tpl2' ? tplDoc : null) })),
      findOne: jest.fn(({ code }) => ({ lean: jest.fn().mockResolvedValue(code === 'order-notify' ? tplDoc : null) })),
    }));

    const { handleStatusActions } = require('../services/statusActionsHandler');

    const orderId = 'ord-unit-real';
    const res = await handleStatusActions({
      orderId, statusCode: 'in_work', actions: [{ type: 'notify', templateId: 'tpl2' }], logId: 'l2', userId: 'u2',
    });

    expect(res && res.ok).toBe(true);
    expect(res.processed).toBe(1);

    // Verify SMTP send args
    expect(sendMail).toHaveBeenCalledTimes(1);
    const args = sendMail.mock.calls[0][0];
    expect(args).toHaveProperty('from', process.env.SMTP_FROM);
    expect(args).toHaveProperty('to', process.env.SMTP_TO);
    expect(args.subject).toContain(orderId);
    expect(args.html).toContain(orderId);
  });
});
