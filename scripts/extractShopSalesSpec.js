#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function pick(obj, keys) {
  const out = {};
  keys.forEach(k => { if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k]; });
  return out;
}

(function main() {
  const root = process.cwd();
  const sourcePath = path.join(root, 'artifacts', 'swagger.json');
  if (!fs.existsSync(sourcePath)) {
    console.error('[extractShopSalesSpec] Source not found: ' + sourcePath + '. Run scripts/generateSwagger.js first.');
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

  const paths = spec.paths || {};
  const keepPaths = [
    '/api/shop/sales',
    '/api/shop/sales/{id}',
    '/api/shop/sales/{id}/refund',
  ];
  const filteredPaths = {};
  keepPaths.forEach(p => { if (paths[p]) filteredPaths[p] = paths[p]; });

  const neededSchemas = [
    'ShopSaleItem',
    'ShopSaleTotals',
    'ShopSale',
    'ShopSaleCreateRequest',
    'ShopSaleCreateResponse',
    'ShopSaleRefundRequest',
    'ShopSalesListResponse',
    'ShopSaleItemResponse',
    'ErrorResponse',
  ];
  const schemas = spec.components && spec.components.schemas ? spec.components.schemas : {};
  const filteredSchemas = {};
  neededSchemas.forEach(n => { if (schemas[n]) filteredSchemas[n] = schemas[n]; });

  const outSpec = {
    openapi: spec.openapi || '3.0.0',
    info: {
      title: ((spec.info && spec.info.title) ? spec.info.title : 'API') + ' — Shop Sales',
      version: (spec.info && spec.info.version) ? spec.info.version : '1.0.0',
      description: 'Subset of OpenAPI spec for /api/shop/sales endpoints.'
    },
    servers: Array.isArray(spec.servers) ? spec.servers : [],
    security: Array.isArray(spec.security) ? spec.security : [{ bearerAuth: [] }],
    paths: filteredPaths,
    components: {
      securitySchemes: pick(spec.components || {}, ['securitySchemes']).securitySchemes || {},
      schemas: filteredSchemas,
    },
  };

  const outDir = path.join(root, 'storage', 'reports', 'api-contracts');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'shop-sales.json');
  fs.writeFileSync(outFile, JSON.stringify(outSpec, null, 2), 'utf8');
  console.log('[extractShopSalesSpec] Wrote ' + outFile);
})();