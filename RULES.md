# strict kyc name match — rules

always ignored (never change the result):
- case, extra spaces, punctuation
- honorifics: shri, sri, smt, kumari, mr, mrs, ms, dr, late
- relation clauses: s/o w/o d/o c/o, son of / wife of / daughter of / care of — drop everything after
- initial formatting when BOTH sides are initials (V.S. = V. S.)

toggles (each one: accept | review | reject):
- reorder: same words, different order (passport surname-first)
- middle_name_missing: first + last match, one side has an extra middle word
- abbreviation: approved list only, md / mohd -> mohammed

presets:
- strict   = all reject
- standard = reorder accept, middle_name_missing review, abbreviation review
- lenient  = all accept

always NO_MATCH, no toggle:
- any spelling difference (typo, ocr, transliteration e.g. mohammed/muhammad)
- initial vs full name (N. Sivaraman vs Natarajan Sivaraman)
- different surname (anglicised e.g. ganguly/gangopadhyay, marriage)
- jr/sr on one side only
- single word name vs multi word

output: MATCH | REVIEW | NO_MATCH + reason code

dataset columns: id, name_doc_1, name_doc_2, rule, category, notes
rule ∈ noise | reorder | middle_name_missing | abbreviation | hard_fail