const fs = require('fs');
const path = require('path');

const contracts = require('../contracts/apiContracts');

function describeJoi(schema) {
  try { return schema.describe(); } catch (e) { return null; }
}

function collectJoiRequired(desc) {
  const req = new Set();
  if (!desc || !desc.keys) return req;
  for (const [k, v] of Object.entries(desc.keys)) {
    if (v.flags && v.flags.presence === 'required') req.add(k);
  }
  return req;
}

function collectMongooseRequired(model) {
  const req = new Set();
  if (!model || !model.schema || !model.schema.paths) return req;
  for (const [k, p] of Object.entries(model.schema.paths)) {
    if (k === '_id' || k === '__v') continue;
    if (p.isRequired || (p.options && p.options.required === true)) req.add(k);
  }
  return req;
}

function collectMongooseTypes(model) {
  const types = {};
  if (!model || !model.schema || !model.schema.paths) return types;
  for (const [k, p] of Object.entries(model.schema.paths)) {
    if (k === '_id' || k === '__v') continue;
    types[k] = p.instance;
  }
  return types;
}

function collectJoiTypes(desc) {
  const types = {};
  if (!desc || !desc.keys) return types;
  for (const [k, v] of Object.entries(desc.keys)) {
    types[k] = v.type || 'any';
  }
  return types;
}

function compareModel(name, model, joiSchema) {
  const report = [];
  const joiDesc = describeJoi(joiSchema);
  const joiReq = collectJoiRequired(joiDesc);
  const joiTypes = collectJoiTypes(joiDesc);
  const mReq = collectMongooseRequired(model);
  const mTypes = collectMongooseTypes(model);

  for (const k of mReq) {
    if (!joiReq.has(k)) report.push(`Model '${name}': field '${k}' is required in Mongoose but optional in Joi`);
  }
  for (const k of joiReq) {
    if (!mReq.has(k)) report.push(`Model '${name}': field '${k}' is required in Joi but optional in Mongoose`);
  }

  for (const [k, mt] of Object.entries(mTypes)) {
    const jt = joiTypes[k];
    if (!jt) continue; // unknown keys allowed in Joi
    const normJt = jt === 'array' ? 'Array' : (jt === 'string' ? 'String' : (jt === 'number' ? 'Number' : (jt === 'date' ? 'Date' : jt)));
    if (normJt !== mt) report.push(`Model '${name}': type mismatch for '${k}' (Mongoose=${mt}, Joi=${jt})`);
  }

  // Specific check: NotifyTemplate.channel has enum in Joi, but model lacks enum
  if (name === 'NotifyTemplate') {
    const channelDesc = joiDesc && joiDesc.keys && joiDesc.keys.channel;
    const hasEnumInJoi = channelDesc && channelDesc.allow && Array.isArray(channelDesc.allow) && channelDesc.allow.length > 0;
    const hasEnumInModel = model.schema && model.schema.paths.channel && model.schema.paths.channel.options && model.schema.paths.channel.options.enum;
    if (hasEnumInJoi && !hasEnumInModel) report.push("Model 'NotifyTemplate': Joi enum for 'channel' not enforced in Mongoose");
  }

  return report;
}

function main() {
  const reportsDir = path.join(__dirname, '..', 'storage', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  let NotifyTemplate; let
    DocTemplate;
  try { NotifyTemplate = require('../models/NotifyTemplate'); } catch (e) {}
  try { DocTemplate = require('../models/DocTemplate'); } catch (e) {}

  const out = [];
  out.push('# API Contracts vs Models Report');
  out.push('');
  const now = new Date();
  out.push(`Generated at: ${now.toISOString()}`);
  out.push('');

  if (NotifyTemplate) {
    out.push('## NotifyTemplate');
    const rpt = compareModel('NotifyTemplate', NotifyTemplate, contracts.notifyTemplateSchema);
    if (rpt.length === 0) out.push('No mismatches.'); else out.push(...rpt.map((s) => `- ${s}`));
    out.push('');
  } else {
    out.push('## NotifyTemplate');
    out.push('- Model not available (DEV mode).');
    out.push('');
  }

  if (DocTemplate) {
    out.push('## DocTemplate');
    const rpt = compareModel('DocTemplate', DocTemplate, contracts.docTemplateSchema);
    if (rpt.length === 0) out.push('No mismatches.'); else out.push(...rpt.map((s) => `- ${s}`));
    out.push('');
  } else {
    out.push('## DocTemplate');
    out.push('- Model not available (DEV mode).');
    out.push('');
  }

  const content = out.join('\n');
  const filename = `api-contracts-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.md`;
  const outPath = path.join(reportsDir, filename);
  fs.writeFileSync(outPath, content);
  console.log(`Report written: ${outPath}`);
}

main();
