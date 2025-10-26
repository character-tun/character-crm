const mongoose = require('mongoose');

const FieldSchema = require('../../server/models/FieldSchema');
const Dictionary = require('../../server/models/Dictionary');

describe('FieldSchema/Dictionary — invalid cases', () => {
  afterAll(async () => {
    try { await mongoose.disconnect(); } catch (e) {}
  });

  test('FieldSchema: list without options → validation error', async () => {
    const doc = new FieldSchema({
      scope: 'settings',
      name: 'Order Form v1',
      fields: [
        { code: 'status', type: 'list' },
      ],
    });

    await expect(doc.validate()).rejects.toThrow(/FIELD_OPTIONS_REQUIRED/);
  });

  test('FieldSchema: multilist with empty options → validation error', async () => {
    const doc = new FieldSchema({
      scope: 'orders',
      name: 'Order Search v1',
      fields: [
        { code: 'tags', type: 'multilist', options: [] },
      ],
    });

    await expect(doc.validate()).rejects.toThrow(/FIELD_OPTIONS_REQUIRED/);
  });

  test('Dictionary: missing code → validation error', async () => {
    const d = new Dictionary({ values: ['x'] });
    await expect(d.validate()).rejects.toThrow(mongoose.Error.ValidationError);
  });
});
