const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'files');
let initialized = false;
function ensureDir() {
  if (initialized) return;
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  initialized = true;
}

// In-memory meta map for quick lookup
const metaMap = new Map(); // id -> { name, mime, size, filePath, createdAt }

async function saveBuffer(buffer, mime, name) {
  ensureDir();
  const id = randomUUID();
  const filePath = path.join(STORAGE_DIR, `${id}.bin`);
  await fs.promises.writeFile(filePath, buffer);
  const meta = { id, name, mime, size: buffer.length, filePath, createdAt: new Date() };
  metaMap.set(id, meta);
  return id;
}

function getMeta(id) {
  return metaMap.get(id) || null;
}

async function getFileStream(id) {
  const meta = metaMap.get(id);
  if (!meta) return null;
  return fs.createReadStream(meta.filePath);
}

module.exports = {
  saveBuffer,
  getMeta,
  getFileStream,
};