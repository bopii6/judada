# Manual Jijiao Sentence Import

This workflow lets you bypass OCR and JSON hand-editing by importing a curated CSV (or TSV) file and generating the exact payload expected by the system.

## 1. Prepare the CSV file

* Use UTF-8 encoding. Excel users can "Save As" CSV UTF-8.
* Required columns: unit_sequence, group_number, sentence_en.
* Optional columns (recommended):
  * unit_title – full unit display title (e.g. Unit 1 - Going to Beijing).
  * group_title – the label that appears next to each round/group.
  * sentence_number – keeps manual ordering if you need to insert sentences later.
  * sentence_title – overrides the default Sentence N label.
  * page_number – accepts raw numbers or tokens such as P6/Page 6.
  * sentence_cn, summary – translated text or a short description; each defaults to blank and the English sentence respectively.

Start from the template at docs/templates/jijiao_grade5_manual_import_template.csv. It contains the exact header plus a few example sentences so you can see the expected shape.

## 2. Run the importer

`ash
python apps/server/scripts/import_jijiao_manual.py \
  --input docs/templates/jijiao_grade5_manual_import_template.csv \
  --output docs/generated/jijiao_grade5_unit_sentences.json
`

Flags:

* --input/-i – your curated CSV/TSV file.
* --output/-o – destination JSON (defaults to docs/generated/jijiao_grade5_unit_sentences.json).
* --package-summary – optional human-friendly summary that shows up in the UI.

The script validates every row, normalizes ordering, fills missing labels, and prints how many units/rounds it produced.

## 3. Verify in the app

Open docs/generated/jijiao_grade5_unit_sentences.json (or whichever output path you used) to confirm the data is correct, then trigger your normal syncing/deployment flow. Because the structure matches the previous OCR-based output, no additional backend/front-end changes are necessary.
