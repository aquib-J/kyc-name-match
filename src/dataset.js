'use strict';

const fs = require('fs');
const { TOGGLES, POLICIES } = require('./matcher');

const RULES = ['noise', ...TOGGLES, 'hard_fail'];

/** Minimal CSV reader: header row, optional double-quoted fields. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim()));
}

function readDataset(file) {
  const [head, ...lines] = parseCsv(fs.readFileSync(file, 'utf8'));
  return lines.map((cells, n) => {
    const row = Object.fromEntries(head.map((h, i) => [h.trim(), (cells[i] ?? '').trim()]));
    if (!RULES.includes(row.rule)) {
      throw new Error(`${file} row ${n + 2}: unknown rule ${JSON.stringify(row.rule)}`);
    }
    return row;
  });
}

/** Expected outcome of a row under the active toggles. */
function expectedResult(rule, toggles) {
  if (rule === 'noise') return 'MATCH';
  if (rule === 'hard_fail') return 'NO_MATCH';
  return POLICIES[toggles[rule]];
}

module.exports = { readDataset, expectedResult, parseCsv, RULES };
