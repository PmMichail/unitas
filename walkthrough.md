# Walkthrough - Bank PDF Statement Parser & Payment Fixes

This document walks through the modifications applied to resolve transaction amount and counterparty parsing issues when importing A-Bank and Monobank PDF statements, and clean up unnecessary payment buttons for accountants/admins.

---

## 1. A-Bank PDF Statement Parser Fix

### The Problem
When extracting text from A-Bank PDF statements using `pypdf`, columns would frequently squash together vertically or overlap. This caused adjacent numeric values, dates, or payment references to concatenate with the transaction amounts (e.g. parsing `2764.94` as `933 213 556 282 765 грн`).

### Changes Made
- **Dynamic Layout Parser Routing**: Inspects the raw PDF text for A-Bank keywords (`"а-банк"`, `"a-bank"`, `"акцент-банк"`) and routes processing to a new dedicated `_parse_abank_pdf` method.
- **Geometry-Based PDF Parsing**: Implemented `_parse_abank_pdf` using `pdfplumber` to extract words alongside their bounding boxes (`x0`, `top`), grouping words vertically into lines using a strict tolerance of `3.0` points.
- **Column Classification**: Classified words into 5 columns based on horizontal positions:
  - `date`: `x0 < 90`
  - `number`: `90 <= x0 < 180`
  - `details`: `180 <= x0 < 340`
  - `purpose`: `340 <= x0 < 505`
  - `amount`: `505 <= x0`
- **Card Layout Support**: Enabled dynamic support for simple card statement layouts (e.g., `samples/abank.pdf`) by auto-detecting card keywords and adjusting column bounds to ignore the balance column.
- **Midpoint-Based Grouping**: Grouped multi-line rows into individual transaction objects using vertical midpoints between consecutive transaction dates.
- **Geometric Filtering**: Discarded headers and footers dynamically:
  - Ignored lines above `first_tx_top - 15`.
  - Ignored lines below `last_tx_top + 70`.

---

## 2. Monobank PDF Statement Parser Fix

### The Problem
Monobank (FOP) PDF statements failed to parse correctly. The default `pypdf` sequential reader missed all transactions, falling back to the heuristic parser which misread the license text in the header (`Ліцензія НБУ... №92 від 20.01.1994`) as a transaction of `92 UAH` on `1994-01-20`.

### Changes Made
- **Routing**: Added routing in `_parse_pdf` to check if text contains Monobank keywords (`"універсал"`, `"universal"`, `"монобанк"`, `"monobank"`) and call `_parse_monobank_pdf(file_path)`.
- **Character Normalization**: Normalized Latin `i`/`I` in Cyrillic contexts to ensure proper regex matching of counterparty names (e.g. converting `"Дн-кiй"` to `"Дн-кій"`).
- **Column Classification**: Mapped words horizontally into 5 columns:
  - `date`: `x0 < 70` (covers Date and Time)
  - `details`: `70 <= x0 < 195` (covers payment purpose details)
  - `contragent`: `195 <= x0 < 315` (covers counterparty name, IBAN, EDRPOU)
  - `amount`: `315 <= x0 < 365` (covers transaction amount)
  - `balance`: `365 <= x0` (ignored)
- **Midpoint Grouping & Geometric Filtering**: Grouped lines into transactions using midpoints and geometric limits (`first_tx_top - 15` and `last_tx_top + 70`), completely filtering out the top license text and bottom signatures.
- **Counterparty Details Parsing**: Filtered out `IBAN:`, `UA...` values, and `ЄДРПОУ:` from the `contragent` column to isolate the exact counterparty name while storing the EDRPOU and IBAN codes in separate transaction fields.

---

## 3. Admin Payment Button Fix

### The Problem
When the OSBB manager/accountant viewed a member's card in the admin billing dashboard (`frontend/app/billing/page.tsx`), a button titled "Оплатити через Mono Pay" was rendered below their balance. This button is unnecessary and confusing for administrators since they should not pay resident balances from their own bank accounts.

### Changes Made
- **UI Clean-up**: Removed the "Оплатити через Mono Pay" button from the administrator details card in `frontend/app/billing/page.tsx`.
- **Validation**: Verified type safety using `npx tsc --noEmit` (0 compile errors).
- **Deployment**: Successfully deployed frontend changes to Fly.io.

---

## Validation Results

### 1. Verification of A-Bank Statements
- Real PDF `277de235-a3d5-49fb-acb7-fe21e96cbda7.pdf` -> parsed all **18 transactions** with 100% accuracy.
- Mock PDF `samples/abank.pdf` -> parsed all **3 transactions** with correct amounts (`15000.00`, `150.00`, `8500.00`).

### 2. Verification of Monobank Statements
- Real PDF `report_21-06-2026_08-09-10.pdf` -> parsed all **2 transactions** with 100% accuracy:
  - Tx 1: `2026-06-20`, `-250.00 UAH` (Vійськовий збір), Contr: `ГУК У ДН-КІЙ ОБЛ/ДН-КА ОБ/11011000`, EDRPOU: `37988155`, IBAN: `UA778999980313070063000004001`
  - Tx 2: `2026-06-18`, `985.02 UAH` (Acquiring Settlement), Contr: `АТ "УНІВЕРСАЛ БАНК"`, EDRPOU: `21133352`, IBAN: `UA773220012924799880000006136`
- Top license information was successfully discarded.
 
---

## 4. Subscription Period Checkout and Webhook Activation Fixes

### The Problem
FOP and OSBB profile subscription checkouts failed when choosing half-yearly or yearly periods. Specifically:
- Mismatched period names between frontend and backend endpoints caused database lookups to fail.
- The Monobank payment reference format used underscores (e.g. `half_yearly`) which broke the webhook `parts = reference.split("_")` parsing index, causing a `ValueError` when converting the text `"yearly"` to an integer payment ID.
- Startup table synchronization hung or threw duplicate table exceptions on utility imports.

### Changes Made
- **Period Mapping**: Standardized period formats on the frontend subscription settings page (`frontend/app/settings/subscription/page.tsx`).
- **Reference Index Safety**: Standardized `"half_yearly"` to `"halfyearly"` inside Monobank order references, preventing webhook splits from breaking.
- **Robust Webhook Processing**: Updated backend webhook callback to process all period aliases ("month", "halfyearly", "yearly", "year", etc.) and dynamically calculate expiration dates (30, 180, and 365 days).
- **Startup Protection**: Wrapped database initializations and table creation steps in `try-except` blocks to prevent connection pool locks and startup crashes.

---

## Validation Results

### 1. Verification of A-Bank Statements
- Real PDF `277de235-a3d5-49fb-acb7-fe21e96cbda7.pdf` -> parsed all **18 transactions** with 100% accuracy.
- Mock PDF `samples/abank.pdf` -> parsed all **3 transactions** with correct amounts (`15000.00`, `150.00`, `8500.00`).

### 2. Verification of Monobank Statements
- Real PDF `report_21-06-2026_08-09-10.pdf` -> parsed all **2 transactions** with 100% accuracy:
  - Tx 1: `2026-06-20`, `-250.00 UAH` (Vійськовий збір), Contr: `ГУК У ДН-КІЙ ОБЛ/ДН-КА ОБ/11011000`, EDRPOU: `37988155`, IBAN: `UA778999980313070063000004001`
  - Tx 2: `2026-06-18`, `985.02 UAH` (Acquiring Settlement), Contr: `АТ "УНІВЕРСАЛ БАНК"`, EDRPOU: `21133352`, IBAN: `UA773220012924799880000006136`
- Top license information was successfully discarded.

### 3. Subscription Checkout Integration
- Ran end-to-end integration checkout tests for all periods:
  - **Monthly**: Monobank invoice created successfully (549 UAH total).
  - **Half-yearly**: Monobank invoice created successfully (2999 UAH total).
  - **Yearly**: Monobank invoice created successfully (5999 UAH total).

### 4. Webhook and Subscription Activation Verification
Simulated paid Monobank webhook responses using FastAPI `TestClient`, verifying correct subscription states:
- **Monthly**: Payment set to `paid`, subscription activated for `monthly`, expires in **30 days**.
- **Half-yearly**: Payment set to `paid`, subscription activated for `half_yearly`, expires in **180 days**.
- **Yearly**: Payment set to `paid`, subscription activated for `yearly`, expires in **365 days**.
- Resident cabinet and member modules were correctly enabled on the profile.

