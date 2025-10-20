#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const changelogPath = path.join(repoRoot, 'CHANGELOG_TRAE.md');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  } catch (e) {
    return '';
  }
}

function formatEntry(dateIso, files, subject) {
  const filesStr = (files || []).filter(Boolean).join(', ');
  return `${dateIso} | ${filesStr} | ${subject}`;
}

function appendLine(line) {
  let prefix = '';
  try {
    const content = fs.readFileSync(changelogPath, 'utf8');
    if (content.length && !content.endsWith('\n')) {
      prefix = '\n';
    }
  } catch (e) {}
  fs.appendFileSync(changelogPath, `${prefix + line}\n`);
}

function getChangedFilesFor(hash) {
  const out = run(`git show --pretty="" --name-only ${hash}`);
  return out ? out.split('\n').filter(Boolean) : [];
}

function appendLatestCommit() {
  const hash = run('git rev-parse HEAD');
  const dateIso = run('git log -1 --pretty=%cI');
  const subject = run('git log -1 --pretty=%s');
  const files = getChangedFilesFor('HEAD');
  if (!dateIso || !subject) return;
  const entry = formatEntry(dateIso, files, subject);
  appendLine(entry);
}

function rebuildFromHistory() {
  const lines = run('git log --pretty=format:%H|%cI|%s --reverse');
  if (!lines) return;
  const entries = lines.split('\n').map((line) => {
    const [hash, dateIso, subject] = line.split('|');
    const files = getChangedFilesFor(hash);
    return formatEntry(dateIso, files, subject);
  });
  fs.writeFileSync(changelogPath, `${entries.join('\n')}\n`);
}

(function main() {
  const args = process.argv.slice(2);

  function getArgValue(key) {
    const idx = args.indexOf(key);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  }

  function appendManualFromArgs() {
    const subject = getArgValue('--summary') || 'Assistant update';
    const filesStr = getArgValue('--files') || '';
    const dateIso = getArgValue('--date') || new Date().toISOString();
    const files = filesStr ? filesStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const entry = formatEntry(dateIso, files, subject);
    appendLine(entry);
  }

  if (args.includes('--append-manual')) {
    appendManualFromArgs();
    console.log('CHANGELOG appended (manual)');
    return;
  }

  const mode = args.includes('--rebuild') ? 'rebuild' : 'append';
  if (mode === 'rebuild') {
    rebuildFromHistory();
    console.log('CHANGELOG rebuilt from git history');
  } else {
    appendLatestCommit();
    console.log('CHANGELOG appended for latest commit');
  }
}());
