const mongoose = require('mongoose');
const { getCache } = require('./ttlCache');

let FieldSchemaModel; try { FieldSchemaModel = require('../server/models/FieldSchema'); } catch (e) {}

const DEV_MODE = process.env.AUTH_DEV_MODE === '1';
const cache = getCache('fieldSchema');

function mongoReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

async function loadActiveSchema(scope, name) {
  if (!FieldSchemaModel || !mongoReady()) return null;
  const doc = await FieldSchemaModel.findOne({ scope, name, isActive: true }).lean();
  return doc || null;
}

async function getActiveSchema(scope, name, ttlSecs = 60) {
  const key = `active:${scope}:${name}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const doc = await loadActiveSchema(scope, name);
  if (doc) cache.set(key, doc, ttlSecs);
  return doc;
}

module.exports = { getActiveSchema };
