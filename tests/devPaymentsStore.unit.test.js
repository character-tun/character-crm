describe('devPaymentsStore — basic operations', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('nextId increments and pushItem adds records', () => {
    const store = require('../services/devPaymentsStore');

    const id1 = store.nextId();
    expect(id1).toMatch(/^pay-\d+$/);

    store.pushItem({ _id: id1, amount: 100, currency: 'USD' });
    const items1 = store.getItems();
    expect(items1.length).toBe(1);
    expect(items1[0]._id).toBe(id1);
    expect(items1[0].amount).toBe(100);

    const id2 = store.nextId();
    expect(id2).toMatch(/^pay-\d+$/);
    expect(id2).not.toBe(id1);

    store.pushItem({ _id: id2, amount: 50, currency: 'EUR' });
    const items2 = store.getItems();
    expect(items2.length).toBe(2);
    expect(items2.map(i => i._id)).toEqual([id1, id2]);
  });
});