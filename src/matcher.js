'use strict';

const { clean, isInitial } = require('./normalize');

/**
 * Strict rule-based matcher (RULES.md). Clean both names into canonical
 * words, then compare exactly. The only allowed differences are the three
 * toggles; each one, when it is what makes the names equal, decides the
 * result via its policy (accept | review | reject). No scores, no thresholds.
 */

const TOGGLES = ['reorder', 'middle_name_missing', 'abbreviation'];
const POLICIES = { accept: 'MATCH', review: 'REVIEW', reject: 'NO_MATCH' };
const SEVERITY = { MATCH: 0, REVIEW: 1, NO_MATCH: 2 };

const PRESETS = {
  strict:   { reorder: 'reject', middle_name_missing: 'reject', abbreviation: 'reject' },
  standard: { reorder: 'accept', middle_name_missing: 'review', abbreviation: 'review' },
  lenient:  { reorder: 'accept', middle_name_missing: 'accept', abbreviation: 'accept' },
};

// Approved list only.
const ABBREVIATIONS = new Map([['md', 'mohammed'], ['mohd', 'mohammed']]);

// Every combination of toggles, fewest first: an explanation must use as few
// relaxations as possible.
const COMBOS = [[]];
for (const t of TOGGLES) COMBOS.push(...COMBOS.map((c) => [...c, t]));
COMBOS.sort((a, b) => a.length - b.length);

const sameSequence = (a, b) => a.length === b.length && a.every((t, i) => t === b[i]);
const sameWords = (a, b) => sameSequence([...a].sort(), [...b].sort());

/** Do the two word lists become equal when only the toggles in `used` are allowed? */
function equalUnder(a, b, used) {
  if (used.includes('abbreviation')) {
    a = a.map((t) => ABBREVIATIONS.get(t) ?? t);
    b = b.map((t) => ABBREVIATIONS.get(t) ?? t);
  }
  const same = used.includes('reorder') ? sameWords : sameSequence;
  if (!used.includes('middle_name_missing')) return same(a, b);

  // First and last word stay put; exactly one extra word in between.
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  if (short.length < 2 || long.length !== short.length + 1) return false;
  for (let i = 1; i < long.length - 1; i++) {
    if (same(long.filter((_, j) => j !== i), short)) return true;
  }
  return false;
}

/** Why two names that no toggle can reconcile are different. */
function failReason(a, b) {
  const initialVsFull = (x, y) =>
    x.some((t) => isInitial(t) && !y.includes(t)) && y.some((t) => !isInitial(t) && !x.includes(t));
  if (initialVsFull(a, b) || initialVsFull(b, a)) return 'INITIAL_VS_FULL';
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  if (long.length > short.length && short.every((t) => long.includes(t))) return 'EXTRA_WORDS';
  return 'WORD_MISMATCH';
}

function checkToggles(toggles) {
  for (const t of TOGGLES) {
    if (!(toggles[t] in POLICIES)) {
      throw new Error(`toggle ${t} must be accept|review|reject, got ${JSON.stringify(toggles[t])}`);
    }
  }
}

/**
 * @param {string} name1
 * @param {string} name2
 * @param {{reorder: string, middle_name_missing: string, abbreviation: string}} toggles
 * @returns {{result: 'MATCH'|'REVIEW'|'NO_MATCH', reason: string}}
 */
function match(name1, name2, toggles = PRESETS.standard) {
  checkToggles(toggles);
  const p1 = clean(name1), p2 = clean(name2);
  const a = p1.tokens, b = p2.tokens;
  const noMatch = (reason) => ({ result: 'NO_MATCH', reason });

  if (!a.length || !b.length) return noMatch('EMPTY_NAME');
  if (!sameSequence(p1.suffixes, p2.suffixes)) return noMatch('SUFFIX_MISMATCH');
  if ((a.length === 1) !== (b.length === 1)) return noMatch('SINGLE_VS_MULTI_WORD');

  let best = null;
  for (const used of COMBOS) {
    if (best && used.length > best.used.length) break;
    if (!equalUnder(a, b, used)) continue;
    const result = used.map((t) => POLICIES[toggles[t]])
      .reduce((w, r) => (SEVERITY[r] > SEVERITY[w] ? r : w), 'MATCH');
    if (!best || SEVERITY[result] < SEVERITY[best.result]) best = { used, result };
  }
  if (!best) return noMatch(failReason(a, b));

  const reason = best.used.length ? best.used.map((t) => t.toUpperCase()).join('+') : 'EXACT';
  return { result: best.result, reason };
}

module.exports = { match, PRESETS, TOGGLES, POLICIES, ABBREVIATIONS, checkToggles };
