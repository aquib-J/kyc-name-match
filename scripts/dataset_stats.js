'use strict';

// Prints summary stats for data/dataset.csv. Usage: node scripts/dataset_stats.js

const fs = require('fs');
const path = require('path');

const HONORIFICS = new Set(['shri', 'sri', 'smt', 'kumari', 'mr', 'mrs', 'ms', 'dr', 'late']);
const RELATION = /\s+(?:s\/o|w\/o|d\/o|c\/o|son of|wife of|daughter of|care of)\s.*$/i;

// The dataset has no quoted fields or embedded commas.
const lines = fs.readFileSync(path.join(__dirname, '..', 'data', 'dataset.csv'), 'utf8')
  .trim().split(/\r?\n/);
const head = lines[0].split(',');
const rows = lines.slice(1).map((line) => {
  const cells = line.split(',');
  return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
});

function words(name) {
  return name.toLowerCase()
    .replace(RELATION, '')
    .replace(/'/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !HONORIFICS.has(w));
}

const pct = (n, total) => ((n / total) * 100).toFixed(1) + '%';

function countBy(items) {
  const counts = {};
  for (const x of items) counts[x] = (counts[x] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// 1. rows by rule
console.log(`1. Rows by rule (${rows.length} rows)`);
for (const [rule, n] of countBy(rows.map((r) => r.rule))) {
  console.log(`   ${rule.padEnd(20)} ${String(n).padStart(4)}  ${pct(n, rows.length)}`);
}
const hard = rows.filter((r) => r.rule === 'hard_fail').length;
const matchable = rows.length - hard;
console.log(`   match-able vs hard_fail: ${matchable} : ${hard}` +
  `  (${pct(matchable, rows.length)} / ${pct(hard, rows.length)})`);

// 2. names by word count after cleaning
const names = rows.flatMap((r) => [r.name_doc_1, r.name_doc_2]);
const buckets = { '1': 0, '2': 0, '3': 0, '4+': 0 };
for (const n of names) {
  const k = words(n).length;
  buckets[k >= 4 ? '4+' : String(k)]++;
}
console.log(`\n2. Names by word count after cleaning (${names.length} names)`);
for (const [k, n] of Object.entries(buckets)) {
  console.log(`   ${k.padEnd(3)} words ${String(n).padStart(4)}  ${pct(n, names.length)}`);
}
console.log(`   3+ words: ${pct(buckets['3'] + buckets['4+'], names.length)}`);

// 3. categories
const cats = countBy(rows.map((r) => r.category));
console.log(`\n3. Categories (${cats.length})`);
for (const [cat, n] of cats) console.log(`   ${cat.padEnd(20)} ${String(n).padStart(4)}`);
