describe('statusActionsHandler: missing template references throw', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.AUTH_DEV_MODE = '1';
    process.env.NOTIFY_DRY_RUN = '1';
    process.env.PRINT_DRY_RUN = '1';
  });

  test('notify: missing templateId/code → throws INVALID_REFERENCE_NOTIFY', async () => {
    const { handleStatusActions, __devReset } = require('../services/statusActionsHandler');
    __devReset();

    const missingNotifyId = `missing-${Date.now()}-notify`;
    const TemplatesStore = require('../services/templatesStore');
    expect(TemplatesStore.getNotifyTemplate(missingNotifyId)).toBeNull();

    await expect(handleStatusActions({
      orderId: 'ord-h-1', statusCode: 'new', logId: 'lh1', userId: 'u1',
      actions: [{ type: 'notify', templateId: missingNotifyId }],
    })).rejects.toThrow(new RegExp(`INVALID_REFERENCE_NOTIFY:${missingNotifyId}`));
  });

  test('print: missing docId/code → throws INVALID_REFERENCE_PRINT', async () => {
    const { handleStatusActions, __devReset } = require('../services/statusActionsHandler');
    __devReset();

    const missingDocId = `missing-${Date.now()}-doc`;
    const TemplatesStore = require('../services/templatesStore');
    expect(TemplatesStore.getDocTemplate(missingDocId)).toBeNull();

    await expect(handleStatusActions({
      orderId: 'ord-h-2', statusCode: 'new', logId: 'lh2', userId: 'u2',
      actions: [{ type: 'print', docId: missingDocId }],
    })).rejects.toThrow(new RegExp(`INVALID_REFERENCE_PRINT:${missingDocId}`));
  });
});
