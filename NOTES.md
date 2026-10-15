# Notes

## Why strict

- **Similarity isn't identity.** `Nita` / `Nitya` and `Laxmi` / `Lakshmi` are each one edit apart. One pair is two people, the other might be one person. No score can tell them apart, so a fuzzy matcher has to guess.
- The old fuzzy matchers (Levenshtein, Jaro-Winkler, Indic phonetic, and the scored "structural" matcher) produced numbers that needed thresholds. Thresholds tuned on 108 rows don't carry over to production, and "0.93" is not something a compliance reviewer can audit.
- Strict rules give a reason code for every decision. When two names differ, a person resolves it with other evidence (DOB, ID number); we don't guess.
- Accepting that cost is the point. Typos, OCR errors and transliteration variants all go to NO_MATCH, and the business decides what happens after that (re-upload, manual KYC).

## How it works

- `src/normalize.js`: removes only what RULES.md says to ignore:
  - case, extra spaces, punctuation (`.` `,` `-` `/` split words; apostrophes are removed, so `D'Souza` = `DSouza`)
  - the 9 honorifics in RULES.md, at the start of the name only
  - relation clauses (`s/o w/o d/o c/o`, spelled-out forms) and everything after them
  - `jr` / `sr` at the end are kept apart and must be identical on both sides
- Not ignored: digits (`Gov1nd`), diacritics (`José`), joining or splitting words (`Ravishankar` / `Ravi Shankar`). These are spelling differences.
- `src/matcher.js`: compares the cleaned words exactly. If they differ, it looks for the smallest set of toggles that makes them equal:
  - `reorder`: same words, any order
  - `middle_name_missing`: one side has exactly one extra word that is neither first nor last
  - `abbreviation`: `md`, `mohd` → `mohammed`, and nothing else
- The result comes from the toggle policies (accept → MATCH, review → REVIEW, reject → NO_MATCH). When two toggles are needed, the stricter one wins.
- Hard fails happen before any toggle is tried: `EMPTY_NAME`, `SUFFIX_MISMATCH`, `SINGLE_VS_MULTI_WORD`. If nothing explains the difference, the reason is `INITIAL_VS_FULL`, `EXTRA_WORDS` or `WORD_MISMATCH`.

## Dataset

- `data/dataset.csv` has 152 rows. Each row's `rule` (noise | reorder | middle_name_missing | abbreviation | hard_fail) plus the active toggles gives the expected result, so one file covers every preset.
- `data/dataset_v1_is_match.csv` is the old file with binary labels, kept for reference.
- Current results: 0 mismatches under strict, standard and lenient.

## Known gaps (deliberate)

- A surname-first name with a missing middle name (`Sharma Anil Kumar` / `Anil Sharma`) is NO_MATCH. Once the order changes, "middle" has no fixed position, and allowing any missing word would also allow a missing surname.
- `VS Raghavan` (no dots) is treated as the word `vs`, not as two initials.
- A real given name that is also an honorific (`Sri Lakshmi`) is stripped when it comes first.
- Anglicised surnames (`Ganguly` / `Gangopadhyay`) and maiden/married surnames are NO_MATCH by rule.
