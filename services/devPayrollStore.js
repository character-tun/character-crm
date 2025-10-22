// DEV in-memory store for payroll accrual records
// Mirrors the simple pattern used by devPaymentsStore

let __items = [];
let __seq = 1;

function getItems() {
  return __items.slice();
}

function nextId() {
  return String(__seq);
}

function pushItem(item) {
  const id = item && item._id ? String(item._id) : String(__seq);
  const nowIso = new Date().toISOString();
  const rec = {
    _id: id,
    createdAt: nowIso,
    updatedAt: nowIso,
    locked: false,
    ...item,
  };
  __items.push(rec);
  __seq = Number(id) + 1;
  return rec;
}

function clear() {
  __items = [];
  __seq = 1;
}

module.exports = {
  getItems,
  nextId,
  pushItem,
  clear,
};