'use strict';

/**
 * Cleaning per RULES.md: removes only what RULES.md says never changes the
 * result. Everything else (spelling, digits, diacritics, word boundaries) is
 * kept, so it is compared exactly.
 */

// RULES.md honorifics, and only these. Stripped from the front of the name.
const HONORIFICS = new Set(['shri', 'sri', 'smt', 'kumari', 'mr', 'mrs', 'ms', 'dr', 'late']);

// Generational suffixes are kept aside, not dropped: "Jr" is a different person.
const SUFFIXES = new Set(['jr', 'sr']);

// s/o w/o d/o c/o and the spelled-out forms. Everything from the marker on
// describes another person (father, husband, guardian) and is dropped.
const RELATION_CLAUSE = /(?:^|[^\p{L}\p{N}])(?:[swdc]\s*\/\s*o|son\s+of|wife\s+of|daughter\s+of|care\s+of)(?![\p{L}\p{N}]).*$/su;

/**
 * @param {string} input
 * @returns {{tokens: string[], suffixes: string[]}}
 */
function clean(input) {
  let s = String(input ?? '').normalize('NFC').toLowerCase();
  s = s.replace(RELATION_CLAUSE, '');
  s = s.replace(/['’‘`]/g, '');                 // D'Souza -> dsouza
  s = s.replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ');  // other punctuation separates words: V.S. -> v s

  const tokens = s.split(' ').filter(Boolean);
  while (tokens.length && HONORIFICS.has(tokens[0])) tokens.shift();
  const suffixes = [];
  while (tokens.length && SUFFIXES.has(tokens[tokens.length - 1])) suffixes.unshift(tokens.pop());
  return { tokens, suffixes };
}

const isInitial = (t) => [...t].length === 1;

module.exports = { clean, isInitial, HONORIFICS, SUFFIXES };
