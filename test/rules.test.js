'use strict';

// Business rules from RULES.md, one test per rule.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { match, PRESETS, TOGGLES } = require('../src/matcher');
const { clean, HONORIFICS } = require('../src/normalize');
const { readDataset, expectedResult } = require('../src/dataset');

const PRESET_LIST = Object.entries(PRESETS);
const ALL_ACCEPT = PRESETS.lenient;

// Pairs covering every kind of outcome, used to check that noise never moves it.
const BASE_PAIRS = [
  ['Rajesh Kumar Tiwari', 'Rajesh Kumar Tiwari'],     // exact
  ['Tiwari Rajesh Kumar', 'Rajesh Kumar Tiwari'],     // reorder
  ['Rajesh Kumar Tiwari', 'Rajesh Tiwari'],           // middle name missing
  ['Md Salim Ansari', 'Mohammed Salim Ansari'],       // abbreviation
  ['Rajesh Kumar Tiwari', 'Rakesh Kumar Tiwari'],     // spelling
  ['R. Kumar Tiwari', 'Rajesh Kumar Tiwari'],         // initial vs full
];

function forEveryPreset(fn) {
  for (const [name, toggles] of PRESET_LIST) fn(toggles, name);
}

function assertSame(a, b, msg) {
  assert.deepStrictEqual(a, b, msg);
}

test('result has only result and reason: no score, no threshold', () => {
  const r = match('Suresh Kumar', 'Suresh Kumar');
  assert.deepStrictEqual(Object.keys(r).sort(), ['reason', 'result']);
  assert.deepStrictEqual(r, { result: 'MATCH', reason: 'EXACT' });
});

test('adding an honorific never changes the result', () => {
  forEveryPreset((toggles, preset) => {
    for (const [a, b] of BASE_PAIRS) {
      const base = match(a, b, toggles);
      for (const h of HONORIFICS) {
        for (const form of [h, `${h}.`, h.toUpperCase()]) {
          assertSame(match(`${form} ${a}`, b, toggles), base, `${preset}: "${form} ${a}" vs "${b}"`);
          assertSame(match(a, `${form} ${b}`, toggles), base, `${preset}: "${a}" vs "${form} ${b}"`);
        }
      }
      assertSame(match(`Late Shri ${a}`, `Smt. ${b}`, toggles), base, `${preset}: stacked honorifics`);
    }
  });
});

test('only the honorifics in RULES.md are ignored', () => {
  assert.deepStrictEqual([...HONORIFICS].sort(),
    ['dr', 'kumari', 'late', 'mr', 'mrs', 'ms', 'shri', 'smt', 'sri']);
  // "Prof" is not on the list, so it is a word like any other.
  assert.strictEqual(match('Prof Anil Gupta', 'Anil Gupta', ALL_ACCEPT).result, 'NO_MATCH');
});

test('adding a relation clause never changes the result', () => {
  const clauses = ['S/O Mahesh Yadav', 'w/o Amit Singh', 'D / O Ramesh Nair', 'C/O Salim Khan',
    'son of Ramesh', 'wife of Amit', 'daughter of Suresh', 'care of Nadeem', 'Son  Of Ravi'];
  forEveryPreset((toggles, preset) => {
    for (const [a, b] of BASE_PAIRS) {
      const base = match(a, b, toggles);
      for (const c of clauses) {
        assertSame(match(`${a} ${c}`, b, toggles), base, `${preset}: "${a} ${c}"`);
        assertSame(match(a, `${b} ${c}`, toggles), base, `${preset}: "${b} ${c}"`);
      }
    }
  });
});

test('case, extra spaces and punctuation never change the result', () => {
  const variants = (s) => [s.toUpperCase(), s.toLowerCase(), `  ${s.replace(/ /g, '   ')}  `, `${s}.`, s.replace(/ /g, ', ')];
  forEveryPreset((toggles, preset) => {
    for (const [a, b] of BASE_PAIRS) {
      const base = match(a, b, toggles);
      for (const v of variants(a)) assertSame(match(v, b, toggles), base, `${preset}: "${v}" vs "${b}"`);
    }
  });
  assert.strictEqual(match("D'Souza Maria", 'DSouza Maria', PRESETS.strict).result, 'MATCH');
});

test('initial formatting is ignored when both sides are initials', () => {
  for (const a of ['V.S. Raghavan', 'V. S. Raghavan', 'V S Raghavan', 'v.s.raghavan']) {
    forEveryPreset((toggles) => {
      assertSame(match(a, 'V. S. Raghavan', toggles), { result: 'MATCH', reason: 'EXACT' }, a);
    });
  }
});

test('any one-character spelling difference is NO_MATCH, even with every toggle on accept', () => {
  const name = 'Rajesh Kumar Tiwari';
  const mutants = new Set();
  for (let i = 0; i < name.length; i++) {
    if (name[i] === ' ') continue;
    mutants.add(name.slice(0, i) + name.slice(i + 1));                       // deletion
    for (const c of ['a', 'e', 'i', 'x', '1', 'é']) {
      if (c !== name[i].toLowerCase()) mutants.add(name.slice(0, i) + c + name.slice(i + 1)); // substitution / OCR
      mutants.add(name.slice(0, i) + c + name.slice(i));                     // insertion
    }
  }
  for (const m of mutants) {
    assert.strictEqual(match(name, m, ALL_ACCEPT).result, 'NO_MATCH', `"${m}"`);
    assert.strictEqual(match('Tiwari Rajesh Kumar', m, ALL_ACCEPT).result, 'NO_MATCH', `reordered vs "${m}"`);
  }
});

test('transliteration variants are spelling differences', () => {
  for (const [a, b] of [['Mohammed Rafiq', 'Muhammad Rafiq'], ['Lakshmi Iyer', 'Laxmi Iyer'],
    ['Mohd Rafiq', 'Muhammad Rafiq'], ['Md Rafiq', 'Mohammad Rafiq']]) {
    assert.strictEqual(match(a, b, ALL_ACCEPT).result, 'NO_MATCH', `${a} vs ${b}`);
  }
});

test('an initial never matches a full name', () => {
  for (const [a, b] of [['N. Sivaraman', 'Natarajan Sivaraman'], ['Rahul K. Reddy', 'Rahul Kumar Reddy'],
    ['M. K. Senthil', 'Muthuvel Karthikeyan Senthil'], ['S. Kumar Pandey', 'Ramesh Kumar Pandey']]) {
    forEveryPreset((toggles, preset) => {
      assertSame(match(a, b, toggles), { result: 'NO_MATCH', reason: 'INITIAL_VS_FULL' }, `${preset}: ${a} vs ${b}`);
    });
  }
});

test('different initials on both sides are NO_MATCH', () => {
  assert.strictEqual(match('R. K. Gupta', 'R. S. Gupta', ALL_ACCEPT).result, 'NO_MATCH');
});

test('a different surname is NO_MATCH', () => {
  for (const [a, b] of [['Neha Priya Gupta', 'Neha Priya Agarwal'], ['Sourav Ganguly', 'Sourav Gangopadhyay']]) {
    assert.strictEqual(match(a, b, ALL_ACCEPT).result, 'NO_MATCH', `${a} vs ${b}`);
  }
});

test('jr or sr on one side only is NO_MATCH', () => {
  forEveryPreset((toggles, preset) => {
    for (const s of ['Jr', 'jr.', 'SR']) {
      assertSame(match('Ramesh Babu Naidu', `Ramesh Babu Naidu ${s}`, toggles),
        { result: 'NO_MATCH', reason: 'SUFFIX_MISMATCH' }, `${preset}: ${s}`);
    }
    assert.strictEqual(match('Ramesh Babu Jr', 'Ramesh Babu Sr', toggles).result, 'NO_MATCH');
    assert.strictEqual(match('Ramesh Babu Jr', 'RAMESH BABU JR.', toggles).result, 'MATCH');
  });
});

test('a single word name never matches a multi word name', () => {
  forEveryPreset((toggles) => {
    for (const [a, b] of [['Kumar', 'Suresh Kumar'], ['Ram', 'Ram Kishore Yadav'], ['Ravishankar', 'Ravi Shankar']]) {
      assertSame(match(a, b, toggles), { result: 'NO_MATCH', reason: 'SINGLE_VS_MULTI_WORD' }, `${a} vs ${b}`);
    }
  });
});

test('a name that is only an honorific or relation clause matches nothing', () => {
  assertSame(match('Shri', 'Shri'), { result: 'NO_MATCH', reason: 'EMPTY_NAME' });
  assertSame(match('S/O Ramesh', 'Ramesh'), { result: 'NO_MATCH', reason: 'EMPTY_NAME' });
});

// One example per toggle; the toggle alone decides the outcome.
const TOGGLE_CASES = {
  reorder: ['Sharma Anil Kumar', 'Anil Kumar Sharma'],
  middle_name_missing: ['Rahul Kumar Reddy', 'Rahul Reddy'],
  abbreviation: ['Mohd. Aslam Qureshi', 'Mohammed Aslam Qureshi'],
};

test('each toggle actually changes the outcome', () => {
  const expected = { accept: 'MATCH', review: 'REVIEW', reject: 'NO_MATCH' };
  for (const toggle of TOGGLES) {
    const [a, b] = TOGGLE_CASES[toggle];
    for (const [policy, result] of Object.entries(expected)) {
      for (const others of ['accept', 'reject']) {
        const toggles = Object.fromEntries(TOGGLES.map((t) => [t, t === toggle ? policy : others]));
        assertSame(match(a, b, toggles), { result, reason: toggle.toUpperCase() },
          `${toggle}=${policy}, others=${others}`);
      }
    }
  }
});

test('presets are exactly as written in RULES.md', () => {
  assert.deepStrictEqual(PRESETS.strict, { reorder: 'reject', middle_name_missing: 'reject', abbreviation: 'reject' });
  assert.deepStrictEqual(PRESETS.standard, { reorder: 'accept', middle_name_missing: 'review', abbreviation: 'review' });
  assert.deepStrictEqual(PRESETS.lenient, { reorder: 'accept', middle_name_missing: 'accept', abbreviation: 'accept' });
});

test('when two toggles are needed, the stricter policy wins', () => {
  assertSame(match('Ansari Md Salim', 'Mohammed Salim Ansari', PRESETS.standard),
    { result: 'REVIEW', reason: 'REORDER+ABBREVIATION' });
  assertSame(match('Ansari Md Salim', 'Mohammed Salim Ansari', { ...PRESETS.lenient, reorder: 'reject' }),
    { result: 'NO_MATCH', reason: 'REORDER+ABBREVIATION' });
});

test('only one missing middle word is a missing middle name', () => {
  // Dropping the surname or first name is not a missing middle name.
  assert.strictEqual(match('Suresh Kumar Reddy', 'Suresh Kumar', ALL_ACCEPT).result, 'NO_MATCH');
  assert.strictEqual(match('Suresh Kumar Reddy', 'Kumar Reddy', ALL_ACCEPT).result, 'NO_MATCH');
  // Two missing middle words is too much.
  assertSame(match('Anil Kumar Raj Sharma', 'Anil Sharma', ALL_ACCEPT), { result: 'NO_MATCH', reason: 'EXTRA_WORDS' });
  // Four words vs three is fine when the extra one is in the middle.
  assert.strictEqual(match('Venkata Sai Krishna Reddy', 'Venkata Krishna Reddy', ALL_ACCEPT).result, 'MATCH');
});

test('the abbreviation list is closed: only md and mohd, only to mohammed', () => {
  assert.strictEqual(match('Md Aslam', 'Mohd Aslam', ALL_ACCEPT).result, 'MATCH');
  assert.strictEqual(match('Mohd Aslam', 'Mohammed Aslam', PRESETS.strict).result, 'NO_MATCH');
  assert.strictEqual(match('Mohmd Aslam', 'Mohammed Aslam', ALL_ACCEPT).result, 'NO_MATCH');
  assert.strictEqual(match('Syd Aslam', 'Syed Aslam', ALL_ACCEPT).result, 'NO_MATCH');
});

test('the result does not depend on which document is first', () => {
  const rows = readDataset(path.join(__dirname, '..', 'data', 'dataset.csv'));
  forEveryPreset((toggles, preset) => {
    for (const r of rows) {
      assertSame(match(r.name_doc_2, r.name_doc_1, toggles), match(r.name_doc_1, r.name_doc_2, toggles), `${preset} #${r.id}`);
    }
  });
});

test('every dataset row gets the outcome its rule and the preset imply', () => {
  const rows = readDataset(path.join(__dirname, '..', 'data', 'dataset.csv'));
  assert.ok(rows.length > 0);
  forEveryPreset((toggles, preset) => {
    for (const r of rows) {
      assert.strictEqual(match(r.name_doc_1, r.name_doc_2, toggles).result, expectedResult(r.rule, toggles),
        `${preset} #${r.id} "${r.name_doc_1}" vs "${r.name_doc_2}" (${r.rule})`);
    }
  });
});

test('invalid toggle values are rejected', () => {
  assert.throws(() => match('A B', 'A B', { ...PRESETS.standard, reorder: 'maybe' }), /reorder/);
});

test('cleaning keeps digits and diacritics so they are compared, not fixed', () => {
  assert.deepStrictEqual(clean('Gov1nd Rao').tokens, ['gov1nd', 'rao']);
  assert.deepStrictEqual(clean('José Mathew').tokens, ['josé', 'mathew']);
  assert.deepStrictEqual(clean('Late Smt. Parvathi Amma Kurup W/O Raman').tokens, ['parvathi', 'amma', 'kurup']);
});
