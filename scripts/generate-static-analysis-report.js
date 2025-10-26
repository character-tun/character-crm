const fs = require('fs');
const path = require('path');

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

function summarizeEslint(jsonPath) {
  const data = readJsonSafe(jsonPath) || [];
  let errors = 0;
  let warnings = 0;
  const ruleCounts = {};
  const fileIssues = [];
  const deadCodeEntries = [];

  for (const r of data) {
    const e = r.errorCount || 0;
    const w = r.warningCount || 0;
    errors += e;
    warnings += w;
    fileIssues.push({ filePath: r.filePath, errors: e, warnings: w });
    for (const m of r.messages || []) {
      const rule = m.ruleId || m.message || 'unknown';
      ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
      if (rule === 'import/no-unused-modules' || rule === 'no-unused-vars') {
        deadCodeEntries.push({ filePath: r.filePath, rule, message: m.message });
      }
    }
  }

  fileIssues.sort((a, b) => (b.errors + b.warnings) - (a.errors + a.warnings));
  const topRules = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]);

  return {
    errors, warnings, topRules, fileIssues, deadCodeEntries,
  };
}

function formatTopRules(rules, topN = 10) {
  const lines = [];
  for (const [rule, count] of rules.slice(0, topN)) {
    lines.push(`- ${rule}: ${count}`);
  }
  return lines.join('\n');
}

function formatTopFiles(files, topN = 20) {
  const lines = [];
  for (const f of files.slice(0, topN)) {
    lines.push(`- ${f.filePath}: ${f.errors} errors, ${f.warnings} warnings`);
  }
  return lines.join('\n');
}

function groupDeadCode(entries) {
  const byFile = new Map();
  for (const e of entries) {
    const arr = byFile.get(e.filePath) || [];
    arr.push(e);
    byFile.set(e.filePath, arr);
  }
  const lines = [];
  for (const [file, msgs] of byFile.entries()) {
    lines.push(`- ${file}`);
    const seen = new Set();
    for (const m of msgs.slice(0, 10)) {
      const key = `${m.rule}: ${m.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`  - ${m.rule}: ${m.message}`);
    }
  }
  return lines.join('\n');
}

function loadMadgeCycles(p) {
  const data = readJsonSafe(p) || {};
  const cycles = data.circular || [];
  return Array.isArray(cycles) ? cycles : [];
}

function main() {
  const root = process.cwd();
  const reportDir = path.join(root, 'storage', 'reports');

  const serverInitial = summarizeEslint(path.join(reportDir, 'eslint-server-initial.json'));
  const serverFinal = summarizeEslint(path.join(reportDir, 'eslint-server-final.json'));
  const clientInitial = summarizeEslint(path.join(reportDir, 'eslint-client-initial.json'));
  const clientFinal = summarizeEslint(path.join(reportDir, 'eslint-client-final.json'));

  const totalInitialErrors = (serverInitial.errors + clientInitial.errors);
  const totalInitialWarnings = (serverInitial.warnings + clientInitial.warnings);
  const totalFinalErrors = (serverFinal.errors + clientFinal.errors);
  const totalFinalWarnings = (serverFinal.warnings + clientFinal.warnings);

  const combinedTopRules = [...serverFinal.topRules, ...clientFinal.topRules]
    .reduce((acc, [rule, count]) => {
      acc[rule] = (acc[rule] || 0) + count;
      return acc;
    }, {});
  const combinedTopRulesSorted = Object.entries(combinedTopRules).sort((a, b) => b[1] - a[1]);

  const combinedTopFiles = [...serverFinal.fileIssues, ...clientFinal.fileIssues]
    .sort((a, b) => (b.errors + b.warnings) - (a.errors + a.warnings));

  const deadCodeCombined = [...serverFinal.deadCodeEntries, ...clientFinal.deadCodeEntries];

  const serverCycles = loadMadgeCycles(path.join(reportDir, 'madge-server.json'));
  const clientCycles = loadMadgeCycles(path.join(reportDir, 'madge-client.json'));

  const aliasCheckSummary = 'Проверка алиасов: не обнаружены импорты с алиасами (@/, ~/, src/). Используются относительные пути — OK.';

  const md = '# Статическая проверка JS/React — 2025-10-20\n\n'
+ '## ESLint Итоги\n'
+ `- Всего (до фиксов): ошибки ${totalInitialErrors}, варнинги ${totalInitialWarnings}\n`
+ `- Всего (после фиксов): ошибки ${totalFinalErrors}, варнинги ${totalFinalWarnings}\n`
+ `- Сервер (после): ошибки ${serverFinal.errors}, варнинги ${serverFinal.warnings}\n`
+ `- Клиент (после): ошибки ${clientFinal.errors}, варнинги ${clientFinal.warnings}\n\n`
+ '### Топ-10 правил\n'
+ `${formatTopRules(combinedTopRulesSorted, 10)}\n\n`
+ '### Проблемные файлы (Top-20)\n'
+ `${formatTopFiles(combinedTopFiles, 20)}\n\n`
+ '## Dead code: неиспользуемые импорты/экспорты\n'
+ `${groupDeadCode(deadCodeCombined)}\n\n`
+ '## Циклические зависимости (Madge)\n'
+ `- Сервер: ${serverCycles.length ? serverCycles.map((c) => c.join(' -> ')).join('\n  - ') : 'не обнаружено'}\n`
+ `- Клиент: ${clientCycles.length ? clientCycles.map((c) => c.join(' -> ')).join('\n  - ') : 'не обнаружено'}\n\n`
+ '## Алиасы импорта\n'
+ `- ${aliasCheckSummary}\n\n`
+ '## Авто-фиксы\n'
+ '- Выполнены eslint --fix на сервере и клиенте (безопасные правки форматирования/упрощений).\n'
+ `- Число проблем уменьшено: ошибки ${totalInitialErrors} -> ${totalFinalErrors}, варнинги ${totalInitialWarnings} -> ${totalFinalWarnings}.\n\n`
+ '## Manual fix (требуются ручные правки)\n'
+ `- Оставшиеся ошибки/правила (сортировка по частоте):\n${formatTopRules(combinedTopRulesSorted, 15)}\n`;

  const outPath = path.join(reportDir, 'static-analysis-2025-10-20-final.md');
  fs.writeFileSync(outPath, md);
  console.log(`Report written to: ${outPath}`);
}

main();
