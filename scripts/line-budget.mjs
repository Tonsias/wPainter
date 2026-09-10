#!/usr/bin/env node
// Tripwire, not a style rule: catches src/ growing past what the project has argued for, one
// top-level directory at a time. It does not judge whether any single line is justified — only
// that the aggregate stays inside room for one ordinary feature before the next has to raise
// the ceiling deliberately. Raising a ceiling is a normal edit; doing it silently is the thing
// this check exists to prevent.
//
// No dependency beyond Node's standard library, per CLAUDE.md § Dependencies.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC_ROOT = join(import.meta.dirname, '..', 'src');

// Per-directory overrides. A directory absent from this map gets DEFAULT_CEILING; add an entry
// (with a one-line reason) when a feature genuinely needs more than that.
const CEILINGS = new Map([]);

// Applies to every top-level directory under src/ without its own entry above, and to `(root)`
// (the files directly under src/, in no feature directory).
const DEFAULT_CEILING = 1200;

// Checked separately from the per-directory ceilings so a reader sees the whole promise, not
// only the parts: src/ as a whole stays small enough to read in one context window.
const TOTAL_CEILING = 3600;

function listSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function countLines(text) {
  // A trailing newline must not count as an extra line — every file here ends with one.
  return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
}

function topLevelDir(file) {
  const rel = relative(SRC_ROOT, file);
  const first = rel.split(sep)[0];
  return first === rel ? '(root)' : first;
}

const files = listSourceFiles(SRC_ROOT);
const byDir = new Map();
for (const file of files) {
  const dir = topLevelDir(file);
  const lines = countLines(readFileSync(file, 'utf8'));
  const row = byDir.get(dir) ?? { lines: 0, files: 0 };
  row.lines += lines;
  row.files += 1;
  byDir.set(dir, row);
}

const totalLines = [...byDir.values()].reduce((sum, row) => sum + row.lines, 0);
const totalFiles = [...byDir.values()].reduce((sum, row) => sum + row.files, 0);

const sorted = [...byDir.entries()].sort((a, b) => b[1].lines - a[1].lines);
console.log('lines   files  dir');
for (const [dir, row] of sorted) {
  console.log(`${String(row.lines).padStart(5)}  ${String(row.files).padStart(5)}  ${dir}`);
}
console.log(`\nsrc/ total: ${totalLines} lines, ${totalFiles} files`);

const failures = [];
for (const [dir, row] of sorted) {
  const ceiling = CEILINGS.get(dir)?.ceiling ?? DEFAULT_CEILING;
  if (row.lines > ceiling) {
    failures.push(`  ${dir}: ${row.lines} lines, ceiling ${ceiling}`);
  }
}
if (totalLines > TOTAL_CEILING) {
  failures.push(`  (total): ${totalLines} lines, ceiling ${TOTAL_CEILING}`);
}

if (failures.length === 0) {
  console.log('\nline-budget: every directory and the total are within their ceilings.');
  process.exit(0);
}

console.error(`\nline-budget: ${failures.length} ceiling(s) exceeded:\n`);
for (const failure of failures) console.error(failure);
console.error('\nCut the directory back, or raise its ceiling in this script with a reason.');
process.exit(1);
