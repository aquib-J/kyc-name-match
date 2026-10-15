# Strict KYC Name Match

Checks whether names from two Indian identity documents are the same, using the fixed rules in [RULES.md](RULES.md). It returns `MATCH | REVIEW | NO_MATCH` and a reason code. There are no scores and no thresholds.

- **Similarity isn't identity.** A one-letter difference can mean a different person, so every spelling difference is NO_MATCH. See [NOTES.md](NOTES.md).
- Zero dependencies, Node 18+, no install step.

## Run

```bash
node main.js                                # standard preset
node main.js --preset strict                # strict | standard | lenient
node main.js --preset standard --reorder=reject --abbreviation=accept
node main.js --compare                      # all 3 presets side by side
node --test                                 # business-rule tests
```

- `main.js` prints mismatches against the expected results (should be 0), the MATCH/REVIEW/NO_MATCH counts, and a breakdown by reason code. It exits with 1 if anything mismatches.
- Toggles: `reorder`, `middle_name_missing`, `abbreviation`. Each one is `accept | review | reject`.

## Use

```js
const { match, PRESETS } = require('./src/matcher');
match('Smt. Sunita Devi Sharma', 'Sunita Sharma', PRESETS.standard);
// { result: 'REVIEW', reason: 'MIDDLE_NAME_MISSING' }
```

## Layout

```
RULES.md              the rules (source of truth)
src/normalize.js      cleaning: case, spaces, punctuation, honorifics, relation clauses, jr/sr
src/matcher.js        exact comparison + toggles + presets
src/dataset.js        CSV reader, expected result per rule
main.js               CLI
test/rules.test.js    tests written as business rules
data/dataset.csv      152 labelled pairs (rule column)
```
