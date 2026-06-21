# Tasks - Bank Parser & Payment Fixes

## A-Bank Parser Fix
- [x] Modify `backend/ai_parser/universal_parser.py` to route A-Bank to midpoint-based parser
- [x] Implement `pdfplumber` midpoint parser with geometric filtering in `universal_parser.py`
- [x] Verify parsing accuracy of A-Bank statement locally using test script
- [x] Run parser tests to check for regressions on other banks
- [x] Deploy backend updates to Fly.io
- [x] Update walkthrough documentation

## Monobank PDF Parser Fix
- [x] Modify `backend/ai_parser/universal_parser.py` to route Monobank to midpoint-based parser
- [x] Implement `_parse_monobank_pdf` with geometric filtering and normalization in `universal_parser.py`
- [x] Verify parsing accuracy of Monobank statement locally using test script
- [x] Deploy backend updates to Fly.io
- [x] Update walkthrough documentation

## Admin Payment Button Fix
- [x] Remove unnecessary Mono Pay button from the admin billing details card view
- [x] Verify frontend compile safety locally
- [x] Deploy frontend updates to Fly.io
