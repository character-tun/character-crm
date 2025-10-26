// In-memory templates store for DEV mode
const { randomUUID } = require('crypto');

const notifyTemplates = new Map(); // id -> template
const docTemplates = new Map();

function createNotifyTemplate(input) {
  const id = input._id || randomUUID();
  const tpl = { _id: id, ...input };
  notifyTemplates.set(id, tpl);
  return tpl;
}
function updateNotifyTemplate(id, patch) {
  const old = notifyTemplates.get(id);
  if (!old) return null;
  const next = { ...old, ...patch };
  notifyTemplates.set(id, next);
  return next;
}
function getNotifyTemplate(idOrCode) {
  for (const tpl of notifyTemplates.values()) {
    if (tpl._id === idOrCode || tpl.code === idOrCode) return tpl;
  }
  return null;
}
function listNotifyTemplates() {
  return Array.from(notifyTemplates.values());
}
function deleteNotifyTemplate(id) {
  return notifyTemplates.delete(id);
}

function createDocTemplate(input) {
  const id = input._id || randomUUID();
  const tpl = { _id: id, ...input };
  docTemplates.set(id, tpl);
  return tpl;
}
function updateDocTemplate(id, patch) {
  const old = docTemplates.get(id);
  if (!old) return null;
  const next = { ...old, ...patch };
  docTemplates.set(id, next);
  return next;
}
function getDocTemplate(idOrCode) {
  for (const tpl of docTemplates.values()) {
    if (tpl._id === idOrCode || tpl.code === idOrCode) return tpl;
  }
  return null;
}
function listDocTemplates() {
  return Array.from(docTemplates.values());
}
function deleteDocTemplate(id) {
  return docTemplates.delete(id);
}

module.exports = {
  // notify
  createNotifyTemplate,
  updateNotifyTemplate,
  getNotifyTemplate,
  listNotifyTemplates,
  deleteNotifyTemplate,
  // docs
  createDocTemplate,
  updateDocTemplate,
  getDocTemplate,
  listDocTemplates,
  deleteDocTemplate,
};
