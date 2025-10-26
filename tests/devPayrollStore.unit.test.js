describe('devPayrollStore — basic operations', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('nextId increments; pushItem and getItems manage records', () => {
    const store = require('../services/devPayrollStore');

    const id1 = store.nextId();
    expect(id1).toMatch(/^\d+$/);

    store.pushItem({ _id: id1, employee: 'u1', amount: 1000 });
    const items1 = store.getItems();
    expect(items1.length).toBe(1);
    expect(items1[0]._id).toBe(id1);
    expect(items1[0].locked).toBe(false);

    const id2 = store.nextId();
    expect(id2).toMatch(/^\d+$/);
    expect(id2).not.toBe(id1);

    store.pushItem({ _id: id2, employee: 'u2', amount: 900 });
    const items2 = store.getItems();
    expect(items2.length).toBe(2);
    expect(items2.map((i) => i._id)).toEqual([id1, id2]);
  });
});