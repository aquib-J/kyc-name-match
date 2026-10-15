#!/usr/bin/env node
'use strict';

/**
 * node main.js [--preset strict|standard|lenient] [--reorder=accept|review|reject]
 *              [--middle_name_missing=...] [--abbreviation=...] [--data path]
 * node main.js --compare
 */

const path = require('path');
const { match, PRESETS, TOGGLES, checkToggles } = require('./src/matcher');
const { readDataset, expectedResult, RULES } = require('./src/dataset');

const RESULTS = ['MATCH', 'REVIEW', 'NO_MATCH'];
const USAGE = `usage: node main.js [--preset ${Object.keys(PRESETS).join('|')}] ` +
  `[--${TOGGLES.join('=... --')}=...] [--data file.csv]\n       node main.js --compare`;

function parseArgs(argv) {
  const opts = { preset: 'standard', overrides: {}, compare: false, data: 'data/dataset.csv' };
  for (let i = 0; i < argv.length; i++) {
    let [key, value] = argv[i].replace(/^--/, '').split('=');
    key = key.replace(/-/g, '_');
    const next = () => value ?? argv[++i];
    if (key === 'compare') opts.compare = true;
    else if (key === 'preset') opts.preset = next();
    else if (key === 'data') opts.data = next();
    else if (TOGGLES.includes(key)) opts.overrides[key] = next();
    else if (key === 'help' || key === 'h') { console.log(USAGE); process.exit(0); }
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!PRESETS[opts.preset]) throw new Error(`unknown preset ${opts.preset}`);
  if (opts.compare && (argv.some((a) => a.startsWith('--preset')) || Object.keys(opts.overrides).length)) {
    throw new Error('--compare runs all presets; it cannot be combined with --preset or toggle overrides');
  }
  return opts;
}

function evaluate(rows, toggles) {
  const counts = Object.fromEntries(RESULTS.map((r) => [r, 0]));
  const byReason = {};
  const mismatches = [];
  for (const row of rows) {
    const got = match(row.name_doc_1, row.name_doc_2, toggles);
    const expected = expectedResult(row.rule, toggles);
    counts[got.result]++;
    byReason[got.reason] ??= Object.fromEntries(RESULTS.map((r) => [r, 0]));
    byReason[got.reason][got.result]++;
    if (got.result !== expected) mismatches.push({ row, expected, got });
  }
  return { counts, byReason, mismatches };
}

function table(headers, rows) {
  const all = [headers, ...rows].map((r) => r.map(String));
  const widths = headers.map((_, i) => Math.max(...all.map((r) => r[i].length)));
  return all.map((r) => '  ' + r.map((c, i) => (i ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join('  ')).join('\n');
}

const describe = (toggles) => TOGGLES.map((t) => `${t}=${toggles[t]}`).join(', ');

function report(rows, name, toggles) {
  const { counts, byReason, mismatches } = evaluate(rows, toggles);
  console.log(`Policy: ${name} (${describe(toggles)})`);
  console.log(`Rows:   ${rows.length}\n`);

  console.log(`Mismatches vs expected: ${mismatches.length}`);
  for (const { row, expected, got } of mismatches) {
    console.log(`  #${row.id} "${row.name_doc_1}" | "${row.name_doc_2}"  rule=${row.rule}` +
      `  expected=${expected} got=${got.result} (${got.reason})`);
  }

  console.log('\nResults');
  console.log(table(['', 'rows'], RESULTS.map((r) => [r, counts[r]])));

  console.log('\nBy reason');
  const reasons = Object.keys(byReason).sort((x, y) => sum(byReason[y]) - sum(byReason[x]) || x.localeCompare(y));
  console.log(table(['reason', ...RESULTS], reasons.map((r) => [r, ...RESULTS.map((k) => byReason[r][k])])));
  return mismatches.length;
}

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

function compare(rows) {
  const names = Object.keys(PRESETS);
  const runs = names.map((n) => evaluate(rows, PRESETS[n]));

  console.log(`Presets side by side (${rows.length} rows)\n`);
  console.log(table(['', ...names], [
    ...TOGGLES.map((t) => [t, ...names.map((n) => PRESETS[n][t])]),
  ]));
  console.log();
  console.log(table(['', ...names], [
    ...RESULTS.map((r) => [r, ...runs.map((run) => run.counts[r])]),
    ['mismatches', ...runs.map((run) => run.mismatches.length)],
  ]));

  console.log('\nOutcome by rule');
  const perRule = RULES.map((rule) => {
    const n = rows.filter((r) => r.rule === rule).length;
    return [`${rule} (${n})`, ...names.map((p) => expectedResult(rule, PRESETS[p]))];
  });
  console.log(table(['rule (rows)', ...names], perRule));

  for (const [i, run] of runs.entries()) {
    for (const { row, expected, got } of run.mismatches) {
      console.log(`  MISMATCH ${names[i]} #${row.id}: expected=${expected} got=${got.result} (${got.reason})`);
    }
  }
  return runs.reduce((n, run) => n + run.mismatches.length, 0);
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    process.exit(2);
  }
  const rows = readDataset(path.resolve(__dirname, opts.data));

  let mismatches;
  if (opts.compare) {
    mismatches = compare(rows);
  } else {
    const toggles = { ...PRESETS[opts.preset], ...opts.overrides };
    try {
      checkToggles(toggles);
    } catch (err) {
      console.error(`${err.message}\n${USAGE}`);
      process.exit(2);
    }
    const custom = Object.keys(opts.overrides).length ? ' + overrides' : '';
    mismatches = report(rows, opts.preset + custom, toggles);
  }
  process.exitCode = mismatches ? 1 : 0;
}

main();
