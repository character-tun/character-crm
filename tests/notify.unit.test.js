const express = require('express');

describe('notify adapter unit tests', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
    process.env.NOTIFY_DRY_RUN = '1';
  });

  test('renders variables and writes to DEV outbox in DRY_RUN', async () => {
    const TemplatesStore = require('../services/templatesStore');
    const { handleStatusActions, __devReset, getOutbox } = require('../services/statusActionsHandler');
    __devReset();

    // Create template in DEV store
    const tpl = TemplatesStore.createNotifyTemplate({
      code: 'order-created', name: 'Order Created', channel: 'email', subject: 'Order {{order.id}} for {{client.name}}', bodyHtml: '<p>Email: {{client.email}}</p><p>Total: {{order.total}}</p>', variables: ['order.id', 'order.total', 'client.name', 'client.email'],
    });

    // Trigger action
    const orderId = 'ord-unit-1';
    await handleStatusActions({
      orderId, statusCode: 'new', actions: [{ type: 'notify', templateId: tpl._id }], logId: 'l1', userId: 'u1',
    });

    const out = getOutbox();
    expect(Array.isArray(out)).toBe(true);
    const last = out[out.length - 1];
    expect(last && last.type).toBe('notify');
    expect(last && last.orderId).toBe(orderId);
    expect(last && last.subject).toContain(orderId);
    // client vars not provided in context → rendered as empty strings
    expect(last && last.subject).toContain('for ');
    expect(last && last.html).toContain('<p>Email: </p>');
    expect(last && last.html).toContain('<p>Total: </p>');
  });

  test('sends email via nodemailer when NOTIFY_DRY_RUN=0', async () => {
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
    jest.doMock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }));

    const TemplatesStore = require('../services/templatesStore');
    const { handleStatusActions, __devReset, getOutbox } = require('../services/statusActionsHandler');
    __devReset();

    const tpl = TemplatesStore.createNotifyTemplate({
      code: 'order-notify', name: 'Order Notify', channel: 'email', subject: 'Order {{order.id}}', bodyHtml: '<b>Hello</b>', variables: [],
    });
    const orderId = 'ord-unit-2';
    await handleStatusActions({
      orderId, statusCode: 'in_work', actions: [{ type: 'notify', templateId: tpl._id }], logId: 'l2', userId: 'u2',
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const args = sendMail.mock.calls[0][0];
    expect(args).toHaveProperty('from', process.env.SMTP_FROM);
    expect(args).toHaveProperty('to', process.env.SMTP_TO);
    expect(args.subject).toContain(orderId);

    // In NOTIFY_DRY_RUN=0 we should not append to outbox
    const out = getOutbox();
    expect(out.some((i) => i && i.type === 'notify' && i.orderId === orderId)).toBe(false);
  });
});