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

## Subscription & Pricing Model Update
- [x] Update database models in backend/api/main.py (SubscriptionPlan and Subscription)
- [x] Add SQL migrations on startup in backend/api/main.py
- [x] Seed/sync default Business plan (id=1) on startup with the new pricing structure
- [x] Update GET /api/subscription/plans response format
- [x] Update POST /api/subscription/create schema and dynamic calculator logic
- [x] Update POST /api/billing/webhook/mono to parse safe period keys and update new columns
- [x] Update POST /api/profiles/{profile_id}/purchase-resident-cabinet to work as a free configuration endpoint
- [x] Update GET /api/profiles/{profile_id}/resident-cabinet-status to remove 500 UAH legacy references
- [x] Update frontend/lib/api.ts typing for createSubscription
- [x] Update frontend/app/settings/subscription/page.tsx with the checkbox and dynamic details calculator
- [x] Update frontend/app/billing/page.tsx to hide config when inactive, show edit config when active, and bypass payment step
- [x] Run typescript build verification on frontend and syntax/test check on backend
