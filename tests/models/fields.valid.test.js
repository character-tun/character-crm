const mongoose = require('mongoose');

const FieldSchema = require('../../server/models/FieldSchema');
const Dictionary = require('../../server/models/Dictionary');

describe('FieldSchema/Dictionary — valid cases', () => {
  afterAll(async () => {
    try { await mongoose.disconnect(); } catch (e) {}
  });

  test('FieldSchema: list type requires options — valid when provided', async () => {
    const doc = new FieldSchema({
      scope: 'settings',
      name: 'Order Form v1',
      fields: [
        { code: 'status', type: 'list', options: ['new', 'in-progress'] },
      ],
    });

    await expect(doc.validate()).resolves.toBeUndefined();
  });

  test('FieldSchema: multilist with options — valid', async () => {
    const doc = new FieldSchema({
      scope: 'orders',
      name: 'Order Search v1',
      fields: [
        { code: 'tags', type: 'multilist', options: ['aaa', 'bbb', 'ccc'] },
      ],
    });

    await expect(doc.validate()).resolves.toBeUndefined();
  });

  test('Dictionary: code normalized (trim+lower), values accepted', async () => {
    const d = new Dictionary({ code: '  My-Items  ', values: ['A', 'B'] });
    await expect(d.validate()).resolves.toBeUndefined();
    expect(d.code).toBe('my-items');
  });
});
