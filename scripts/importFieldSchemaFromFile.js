#!/usr/bin/env node
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

let FieldSchema; try { FieldSchema = require('../server/models/FieldSchema'); } catch (e) {
  console.error('[importFieldSchema] Failed to load FieldSchema model:', e && e.message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { file: null, scope: null, name: null, note: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--file' || a === '-f') { args.file = argv[i + 1]; i += 1; }
    else if (a.startsWith('--file=')) { args.file = a.split('=')[1]; }
    else if (a === '--scope') { args.scope = argv[i + 1]; i += 1; }
    else if (a.startsWith('--scope=')) { args.scope = a.split('=')[1]; }
    else if (a === '--name') { args.name = argv[i + 1]; i += 1; }
    else if (a.startsWith('--name=')) { args.name = a.split('=')[1]; }
    else if (a === '--note') { args.note = argv[i + 1] || ''; i += 1; }
    else if (a.startsWith('--note=')) { args.note = a.split('=')[1] || ''; }
  }
  return args;
}

function inferDefaults(args) {
  const base = (args.file ? path.basename(args.file).toLowerCase() : '') || '';
  if (!args.scope) {
    if (base.includes('order')) args.scope = 'orders';
    else if (base.includes('client')) args.scope = 'clients';
    else args.scope = 'custom';
  }
  if (!args.name) {
    if (args.scope === 'orders') args.name = 'Форма заказа';
    else if (args.scope === 'clients') args.name = 'Форма клиента';
    else args.name = 'Пользовательская форма';
  }
}

function mapType(t) {
  switch (t) {
    case 'text': return 'text';
    case 'number': return 'number';
    case 'date': return 'date';
    case 'checkbox': return 'bool';
    case 'select': return 'list';
    case 'bool': return 'bool';
    case 'list': return 'list';
    case 'multilist': return 'multilist';
    default: return 'text';
  }
}

function normalizeInput(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.fields)) return raw.fields;
  if (raw && Array.isArray(raw.items)) return raw.items;
  return [];
}

function toFieldSpecs(arr) {
  const fields = [];
  for (let i = 0; i < arr.length; i += 1) {
    const f = arr[i] || {};
    const code = f.code || f.name;
    const type = mapType(f.type);
    const spec = { code, type, label: f.label || f.title || code, required: !!f.required };
    if (type === 'list' || type === 'multilist') {
      const options = Array.isArray(f.options) ? f.options : [];
      if (!options.length) {
        throw new Error(`FIELD_OPTIONS_REQUIRED at index ${i} (${code})`);
      }
      spec.options = options;
    }
    fields.push(spec);
  }
  return fields;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.file) {
    console.error('Usage: node scripts/importFieldSchemaFromFile.js --file <path.json> [--scope orders|clients|custom] [--name "Форма заказа"] [--note "..."]');
    process.exit(1);
  }
  inferDefaults(args);

  const uri = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/character-crm';
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    const raw = fs.readFileSync(path.resolve(args.file), 'utf-8');
    const json = JSON.parse(raw);
    const arr = normalizeInput(json);
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error('Input has no fields array');
    }
    const fields = toFieldSpecs(arr);

    const latest = await FieldSchema.findOne({ scope: args.scope, name: args.name }).sort({ version: -1 }).lean();
    const version = latest ? (latest.version || 0) + 1 : 1;

    const note = args.note || `Импортировано CLI • ${new Date().toLocaleString('ru-RU')}`;
    const doc = await FieldSchema.create({ scope: args.scope, name: args.name, fields, note, version, isActive: true });
    await FieldSchema.updateMany({ scope: args.scope, name: args.name, _id: { $ne: doc._id } }, { $set: { isActive: false } });

    console.log('[importFieldSchema] OK', {
      id: String(doc._id), scope: args.scope, name: args.name, version, fields: fields.length,
    });
    process.exit(0);
  } catch (e) {
    console.error('[importFieldSchema] FAIL', e && (e.message || e));
    process.exit(1);
  } finally {
    try { await mongoose.disconnect(); } catch (_) {}
  }
}

main();