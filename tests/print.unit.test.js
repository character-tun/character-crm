describe('print adapter unit tests', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('DRY_RUN writes to DEV outbox and does not create files', async () => {
    process.env.AUTH_DEV_MODE = '1';
    process.env.PRINT_DRY_RUN = '1';

    const TemplatesStore = require('../services/templatesStore');
    const {
      handleStatusActions, __devReset, getOutbox, getDevState,
    } = require('../services/statusActionsHandler');
    __devReset();

    const tpl = TemplatesStore.createDocTemplate({
      code: 'invoice', name: 'Invoice', bodyHtml: '<h1>Order {{order.id}}</h1>', variables: ['order.id'],
    });
    const orderId = 'ord-print-1';

    await handleStatusActions({
      orderId, statusCode: 'in_work', actions: [{ type: 'print', docId: tpl._id }], logId: 'pl1', userId: 'u1',
    });

    const out = getOutbox();
    const last = out[out.length - 1];
    expect(last && last.type).toBe('print');
    expect(last && last.orderId).toBe(orderId);
    expect(last && last.htmlPreview).toContain(orderId);

    const st = getDevState(orderId);
    const files = Array.isArray(st?.files) ? st.files : [];
    expect(files.length).toBe(0);
  });

  test('non-DRY generates and saves PDF (puppeteer mocked)', async () => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
    process.env.PRINT_DRY_RUN = '0';

    const pdfBuffer = Buffer.from('PDF');
    jest.doMock('puppeteer', () => ({
      launch: async () => ({
        newPage: async () => ({ setContent: async () => {}, pdf: async () => pdfBuffer }),
        close: async () => {},
      }),
    }), { virtual: true });

    const TemplatesStore = require('../services/templatesStore');
    const {
      handleStatusActions, __devReset, getDevState, getOutbox,
    } = require('../services/statusActionsHandler');
    __devReset();

    const tpl = TemplatesStore.createDocTemplate({
      code: 'act', name: 'Act', bodyHtml: '<h1>Order {{order.id}}</h1>', variables: ['order.id'],
    });
    const orderId = 'ord-print-2';

    await handleStatusActions({
      orderId, statusCode: 'in_work', actions: [{ type: 'print', docId: tpl._id }], logId: 'pl2', userId: 'u2',
    });

    const st = getDevState(orderId);
    const files = Array.isArray(st?.files) ? st.files : [];
    expect(files.length).toBe(1);
    expect(files[0].mime).toBe('application/pdf');

    const out = getOutbox();
    expect(out.some((i) => i && i.type === 'print' && i.orderId === orderId)).toBe(false);
  });
});