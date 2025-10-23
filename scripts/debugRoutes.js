/*
Dump Express route map for debugging (DEV/test setup).
Writes to storage/reports/routes-debug.md
*/
process.env.AUTH_DEV_MODE = '1';
process.env.NODE_ENV = 'test';

const express = require('express');
const fs = require('fs');
const path = require('path');

const { withUser } = require('../middleware/auth');
const statusesRoute = require('../routes/statuses');
const docTemplatesRoute = require('../routes/docTemplates');
const ordersRoute = require('../routes/orders');
const queueRoute = require('../routes/queue');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(withUser);
  app.use('/api/statuses', statusesRoute);
  app.use('/api/doc-templates', docTemplatesRoute);
  app.use('/api/orders', ordersRoute);
  app.use('/api/queue', queueRoute);
  return app;
}

function dumpRoutes(app) {
  const stack = app._router && app._router.stack ? app._router.stack : [];
  const out = [];
  out.push('# Express Route Map');
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods || {}).filter((m) => layer.route.methods[m]).sort();
      out.push(`- ${methods.join('|').toUpperCase()} ${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle && layer.regexp) {
      // Nested router: list its stack
      const base = layer.regexp.toString();
      out.push(`- ROUTER ${base}`);
      const childStack = layer.handle.stack || [];
      for (const child of childStack) {
        if (child.route) {
          const methods = Object.keys(child.route.methods || {}).filter((m) => child.route.methods[m]).sort();
          out.push(`  - ${methods.join('|').toUpperCase()} ${child.route.path}`);
        }
      }
    }
  }
  return out.join('\n');
}

function ensureReportsDir() {
  const p = path.join(__dirname, '../storage/reports');
  fs.mkdirSync(p, { recursive: true });
  return p;
}

(function main() {
  const app = makeApp();
  const report = dumpRoutes(app);
  const reportsDir = ensureReportsDir();
  const fp = path.join(reportsDir, 'routes-debug.md');
  fs.writeFileSync(fp, report, 'utf8');
  console.log('Wrote routes to', fp);
})();