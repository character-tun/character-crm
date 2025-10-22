// DEV payments in-memory store shared across routes
// Used when AUTH_DEV_MODE=1 and Mongo is unavailable

const store = { items: [], idSeq: 1 };

function getItems() {
  return store.items;
}

function nextId() {
  return `pay-${store.idSeq++}`;
}

function pushItem(item) {
  store.items.push(item);
}

module.exports = {
  getItems,
  nextId,
  pushItem,
};