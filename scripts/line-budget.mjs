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
const CEILINGS = new Map([
  // The canvas host is where pan, wheel zoom, the stamp ghost and the selection marquee all
  // land, and the toolbar grows a control per tool; 1200 left no room for the next one. The
  // draggable panel then added a separator the shell has to carry: its own track in the grid,
  // pointer and keyboard handling, and a re-clamp when the window changes size.
  // The side panel then grew sections that fold, so the sprite tree can own the panel's height
  // and be the only thing in it that scrolls. Importing a PNG then split into two buttons —
  // replace the document, or add it as a layer over the canvas as it stands. The rail then lost
  // its words: every control in it is an icon now, and the drawings are path data kept here
  // rather than an icon package pulled in for them. The scatter mix then became a weighted set,
  // so the shell carries the weights and the handler that moves them as well as the colours.
  // Brush size and stamp scale then became typed numbers, through one field that keeps the text
  // apart from the committed value and a tested parser behind it. The brush then got a shape
  // toggle under the size, with an icon per shape.
  [
    'ui',
    {
      ceiling: 1920,
      reason: 'canvas host, a resizable panel, folding sections, two imports, a hand-drawn icon set, a number field',
    },
  ],
  // The outline brush turned its one edge colour into up to four rings painted outwards, each
  // refusing the colours inside it; the ring geometry and what it promises across a dragged
  // stroke is most of what the extra lines are, and it is all tested.
  // The stamp then grew a ring of its own: a flood outwards from every painted pixel onto a
  // buffer grown to hold it, which is a different shape from the brush's nib-per-step rings.
  // The nib then became a size plus a shape, square or circle, and the tests that pin the circle.
  [
    'document',
    { ceiling: 1420, reason: 'the outline brush rings, the stamp ring, and the tests that pin them' },
  ],
]);

// Applies to every top-level directory under src/ without its own entry above, and to `(root)`
// (the files directly under src/, in no feature directory).
const DEFAULT_CEILING = 1200;

// Checked separately from the per-directory ceilings so a reader sees the whole promise, not
// only the parts: src/ as a whole stays small enough to read in one context window. Raised for
// the stamp's eight orientations, whose exhaustive tests are most of what it bought, and again
// for the scatter brush: a palette slot that holds a set rather than one colour, plus the tests
// that pin its stroke down as reproducible. Raised once more for layers that can be renamed in
// place and dragged into order, whose reordering rule is a tested pure function rather than the
// swap the buttons used to do inline. Raised once more for the toolbar's icon set, which is
// drawing data rather than logic — the alternative was a dependency. Raised once more for the
// scatter mix's per-colour ratio: a weight beside every picked colour, the slider that sets it,
// and the draw the weights expand into. Raised once more for a ring around a stamped sprite,
// which is the same edge colours the outline brush uses grown around the sprite's own shape.
// Raised once more for typed brush size and stamp scale and a round brush beside the square one.
const TOTAL_CEILING = 4760;

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
