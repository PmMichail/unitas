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


## 5. UniTax Resident Search, Geolocation, and Member Enhancements

### 1. Resident Login & Unique Phone Constraint
- Modified the login flow under `/osbb/[slug]/login` to authenticate using **phone number** instead of account number, matching the backend refactoring.
- Added strict uniqueness constraint: a phone number can only be registered to a single member property across the platform, preventing duplicate resident registrations.

### 2. Tenant Voting Restrictions & Quorum Calculation
- Restricted members with the role of `'tenant'` ("Мешканець") from participating in surveys.
- Disabled voting buttons on the resident dashboard (`/osbb/[slug]/dashboard`) and added tooltip warnings for tenant accounts.
- Updated the quorum calculation algorithm to exclude tenant-occupied properties from the eligible area, ensuring quorum is calculated based solely on owner areas.

### 3. Survey Management and Geolocation Pinning
- Implemented surveys/polls management cabinet for accountants to list, create, close, and delete polls.
- Added Geolocation card in the accountant's cabinet to capture and lock the OSBB coordinates via `navigator.geolocation`.
- Fixed a backend `NameError: name 'starting_debt_pdfo' is not defined` inside `update_profile_endpoint`.

### 4. Geolocation Search on Resident Search Page
- Added "Пошук" (Search) button next to the search input on `/osbb/search`.
- Integrated "Найближчі ОСББ" (Nearby OSBBs) button querying `/api/osbb/nearby` to list associations within close range of the resident's current coordinates.

---

## E2E Validation Results
- Created an automated integration test script `scratch/test_member_enhancements.py` testing registration, duplicate phone checks, survey creation, voting rules, quorum calculations, profile updates, and nearby geolocation search.
- **Result**: All checks executed and passed successfully.
- Verified Next.js build compilation with 100% success (`npm run build` completed successfully).

---

## 6. Settings Page Localization & Production Deployments

### 1. Natural Ukrainian Localization of Settings Page
- Reviewed and polished the entire [settings/page.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/frontend/app/settings/page.tsx) to use natural and correct Ukrainian language phrasing (e.g. replacing Russianisms and technical jargon like `відправте` with `надішліть`, `конфігів` with `налаштувань`, and fixing correct prepositions like `ВЗ із`, `ПДФО із`).

### 2. Backend & Frontend Production Deployments to Fly.io
- **Backend Service (`unitas-backend`)**: Deployed successfully via `flyctl deploy --config fly.backend.toml`. Tested health and routing endpoints.
- **Frontend Service (`unitas-frontend`)**: Built the production-ready Next.js bundle and deployed it successfully to Fly.io via `flyctl deploy` inside `frontend/`. 

### 3. Production Verification
- **DNS & SSL**: Verified both domains are active and have valid SSL certificates:
  - Frontend: [unitas-frontend.fly.dev](https://unitas-frontend.fly.dev/) / [www.unitax.pro](https://www.unitax.pro/) (responds with HTTP 200 OK)
  - Backend API: [unitas-backend.fly.dev](https://unitas-backend.fly.dev/) / [api.unitax.pro](https://api.unitax.pro/)
- **Content Check**: Verified that the newly localized strings (e.g. `"Налаштування"`) are present in the server response payload of `/settings`.

---

## 7. Monthly Meter Readings Pivot View, Apple Review Login Credentials, and OSBB Number Input

### 1. Monthly Meter Readings Pivot View
- **Backend Query & Route**: Added `/api/profiles/{profile_id}/meters-readings-pivot` in `backend/api/main.py` which aggregates all meters for a profile along with their history of readings.
- **Frontend API Binding**: Added `getMetersReadingsPivot` to `frontend/lib/api.ts`.
- **UI Tab Integration**: Integrated a new "Зведений звіт по місяцях" (Monthly Pivot Report) view inside the billing dashboard (`frontend/app/billing/page.tsx`) with a clean tab toggle switch next to "Список лічильників".
- **Dynamic Pivot Table**: Renders a beautiful table that gathers all unique reading months chronologically (newest first), formats them to natural Ukrainian text (e.g., "Червень 2026"), and displays the reading value and charge amount (in UAH) in each corresponding cell.

### 2. Apple Review Login Credentials & OSBB Number Input
- **Apple Reviewer Backdoor**: Enhanced backend auth in `backend/api/main.py` to allow Apple Review credentials (`apple_review@unitas.com`) to bypass the live phone/SMS OTP check and log in using cooperative member identifier `9999` directly.
- **Login Form Enhancements**: Updated `/osbb/[slug]/login` with an additional field for "Номер абонента" (cooperative/flat number identifier) and integrated automated support to submit review credentials with a single click.

### 3. Verification & Deployment
- **Integration Test**: Created `scratch/test_pivot_endpoint.py` and verified the correct SQL join structure and serialized output format.
- **Type Checking**: Validated type safety using `npx tsc --noEmit` on the frontend with 0 compilation errors.
- **Production Deploy**: Successfully pushed all updates to GitHub and redeployed both `unitas-backend` and `unitas-frontend` services to Fly.io.

### 4. LiqPay Checkout & Resident Dashboard Layout Fixes
- **LiqPay Signature Format**: Corrected signature calculation in `backend/api/main.py` and `backend/services/liqpay_service.py`. Standardized digest calculation to generate a Base64-encoded binary SHA-1 digest (`base64.b64encode(hashlib.sha1(...).digest()).decode('utf-8')`) rather than a hex digest string, which resolved the `"Помилка формування запиту"` validation rejection from the LiqPay checkout gateway.
- **Dashboard Layout Alignment**: Restructured the payment input, Mono Pay/LiqPay buttons, and PDF receipt download button in `frontend/app/osbb/[slug]/dashboard/page.tsx` into clearly separated, vertically stacked groups with dedicated category labels ("Швидка онлайн-оплата" and "Рахунок на оплату"). This layout modification utilizes modern Tailwind CSS wraps (`flex-wrap`) to prevent horizontal clipping or off-screen button overflow on mobile and tablet viewport widths.
- **Verification & Deployment**: Executed a full Next.js production build check (`npm run build`) locally to confirm zero TypeScript compile issues and successfully deployed the backend and frontend updates to Fly.io.

### 5. Mobile App Layout & LiqPay Redirect Signature Fixes
- **Mobile Payment Layout Restructuring**: Updated [ResidentDashboard.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/components/resident/ResidentDashboard.tsx) to align with the stacked design pattern. Replaced the single horizontal row containing the payment input, Mono Pay, and LiqPay buttons with a vertically stacked structure. Online payment and receipt actions are now separated under "Швидка онлайн-оплата" and "Рахунок на оплату" headings, which prevents horizontal clipping and ensures buttons do not stretch off-screen.
- **GET Redirect Signature Fix**: Discovered that `/api/member/billing/liqpay/pay-redirect` GET endpoint (used by the mobile app for LiqPay redirects) was still using the legacy `.hexdigest()` signature format. Corrected it to use the proper base64-encoded binary SHA-1 digest format.
- **Meter Submit Button Alignment**: Removed the fixed `width: 50` style constraint from the manual meter reading submit button (`submitButton` in [ResidentDashboard.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/components/resident/ResidentDashboard.tsx)) and replaced it with a dynamic `paddingHorizontal: 16` container. This allows the "Зберегти" button text to render cleanly on one line without squeezing, clipping, or wrapping, resolving the UX layout issues.
- **Redeployment**: Deployed the latest backend fixes to Fly.io (`fly deploy --config fly.backend.toml`) to ensure the mobile app's checkout redirect works perfectly on production.

### 6. Payment Purpose Customization (Contributions vs Electricity)
- **Web Dropdown Selector**: Introduced a select dropdown in `frontend/app/osbb/[slug]/dashboard/page.tsx` for residents to choose their payment purpose: "Внески ОСББ" (standard contributions) or "Електроенергія" (electricity). Selecting a purpose dynamically adjusts the payment description (e.g. `Оплата за електроенергію, о/р №...`) and passes `charge_type="utility"` or `charge_type="regular"` to the backend.
- **Mobile Segment Selector**: Added an interactive segmented picker in `mobile/components/resident/ResidentDashboard.tsx` with native Pressable tabs ("Внески ОСББ" / "Електроенергія"). Choosing a tab dynamically updates the payload and passes the correct charge type and URI-encoded description to `/api/member/billing/liqpay/pay-redirect`.
- **Backend Tracking**: The backend receives the custom `charge_type` and `description` to ensure the generated invoices on Mono Pay/LiqPay display compliant, explicit titles (crucial for OSBB accounting audits) and log payments under the correct ledger category.

---

## 8. Collapsible Meter Nodes & Admin Transparency Toggle

### 1. Collapsible Meter Nodes (Dropdown Lists)
- **State Integration**: Introduced `expandedNodes` state in [ResidentTransparency.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/components/resident/ResidentTransparency.tsx) to manage collapse/expand status of each meter node by its ID.
- **Togglable Pressable Rows**: Wrapped the meter rows in a `<Pressable>` which is enabled only if the meter node has child meters. Tapping a parent meter toggles its collapsed state.
- **Visual Indicators**:
  - Added a rotating Chevron icon next to the value to visually guide the resident that the row is expandable.
  - Added a count badge (e.g. `+3`) when a node with children is collapsed, showing how many sub-meters are nested inside.
  - Nested children are only rendered when the node is expanded, keeping the initial screen uncluttered.

### 2. Admin Transparency Settings Toggle ("Галочка")
- **Database Column**: Added `show_apartment_meters_in_transparency` boolean column to the `Profile` model schema in `backend/api/main.py` (default `True`).
- **Database Migration**: Added an alter statement in `migrate_database()` to dynamically provision the column in existing databases. Migrated the remote Fly.io PostgreSQL database schema successfully.
- **Settings Endpoints & Sync**:
  - Updated `purchase_resident_cabinet_module` and `get_resident_cabinet_status` to accept, update, and return the `show_apartment_meters_in_transparency` configuration setting.
  - Updated `sync_child_profile` to automatically copy the setting from the parent profile to the resident cabinet child profile.
  - Updated `get_member_transparency` and `serialize_meter_node` on the backend to filter out any child meters that have a non-null `member_id` (apartment/resident meters) if `show_apartment_meters_in_transparency` is set to `False`.
- **Admin Settings Checkbox UI**:
  - Added state variable `rcShowApartmentMeters` in [page.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/frontend/app/billing/page.tsx).
  - Placed settings checkboxes in two locations: the initial cabinet setup configuration modal and the general settings tab under billing panel.
  - Checked the state on submit and sent the boolean flag to the API.

### 3. Client-Side Filtering Fallback
- Added extra security in [ResidentTransparency.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/components/resident/ResidentTransparency.tsx) to filter out resident meters on the client side if the profile setting is disabled, ensuring full privacy alignment.

### 4. Compilation Verification
- Ran Next.js typechecks (`npx tsc --noEmit` inside `frontend`) and React Native typechecks (`npx tsc --noEmit` inside `mobile`) to verify zero errors.

---

## 9. PrivatBank API CP1251 Encoding Fix

### The Problem
When FOP/OSBB accounts synced transactions via the PrivatBank API integration (Autoclient/ACP API), Cyrillic descriptions (e.g. `Ресторани, кафе, бари: Pausecaffe 3`) were parsed with stripped or garbled characters (e.g. `, , : Pausecaffe 3`). This was caused by the bank API returning cp1251-encoded (Windows-1251) responses. When the backend parsed it, `response.json()` failed due to invalid UTF-8 sequences. The backend fallback then decoded the raw bytes as UTF-8 with `errors='ignore'`, which stripped out all Cyrillic characters, leaving only ASCII characters and punctuation.

### Changes Made
- **Encoding Auto-detection**: Modified `backend/services/bank_oauth.py`'s response parsing block.
- **CP1251 Decoding Fallback**: The parser now attempts strict `utf-8` decoding first. If a `UnicodeDecodeError` is raised, it attempts to decode the raw bytes using `cp1251` (Windows-1251), preserving Cyrillic strings before falling back to `errors='ignore'` as a final resort.
- **Production Deployment**: Successfully redeployed both backend and frontend to Fly.io.

---

## 10. Announcements & Readings Posting Period (Monthly Postings / Grid / Mobile Integration)

### 1. Disabled Immediate Balance Deduction
- **Draft Status (`is_locked = False`)**: Submitting readings as a member in the cabinet no longer immediately deducts their balance or creates billing charges. Readings are saved in the database in a draft state.

### 2. Announcements & Board API Controls
- **API Endpoints**: Created GET, POST, and DELETE endpoints for announcements at `/api/profiles/{profile_id}/announcements`.
- **Board Authorization**: Unified the board cabinet authorization (`verify_board_access`) so both physical board members and profile admins (acting as Virtual Chairmen) can view and modify board data.

### 3. Web & Mobile Layout Integration
- **Announcements Display**: Built an announcements list panel displaying the latest board messages at the top of the resident cabinet dashboard on both the Next.js Web frontend and the React Native Mobile app.
- **Month/Year Posting Selector**: Replaced the lock button on the admin billing page with active month/year selectors and two core buttons: "Провести покази" (locks readings, calculates monthly consumption, deducts balances, creates `BillingCharge`) and "Скасувати проводку" (reverts the charges, unlocks readings, restores balances).
- **Inline Billing Readings Grid**: Provided a spreadsheet-like input grid in the admin billing panel listing all resident meters. Admins can enter or modify resident readings directly via numeric inputs that auto-save on-blur.

### 4. Verification & Production Deployments
- **Compile Verification**: Successfully verified type-safety and resolved all property type checks on both Next.js Web (`npm run build`) and React Native Mobile (`npx tsc --noEmit`).
- **Fly.io Deploy**: Initiated and successfully deployed updated versions of both frontend and backend to production.

---

## 11. FastAPI Path Parameter / Query Clash Fix

### The Problem
During backend startup, FastAPI raised a startup crash `AssertionError: Cannot use Query for path param 'profile_id'` mapping to the new announcements POST endpoint `/api/profiles/{profile_id}/announcements`. This endpoint uses the `verify_board_access` dependency, which explicitly declared `profile_id: Optional[int] = Query(None)`. Under FastAPI's parameters resolution, a route's path parameter name cannot conflict with query parameters declared inside its nested dependencies.

### Changes Made
- **Parameter Binding Relaxation**: Replaced `profile_id: Optional[int] = Query(None)` with `profile_id: Optional[int] = None` in the `verify_board_access` dependency signature. Without explicit `Query` metadata, FastAPI correctly routes the path parameter value if available, or falls back to query binding if absent.
- **Verification**: Verified that the FastAPI backend starts up successfully under local Python 3.12 environment (0 crash exceptions).
- **Redeployment**: Redeployed the backend service to Fly.io production.

---

## 12. Disabling Board Module for Residents

### Changes Made
- **Next.js Resident Cabinet**: Hidden the "Правління" tab button from the tabs bar and disabled the rendering of active tab content for `"board"` in [frontend/app/osbb/[slug]/dashboard/page.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/frontend/app/osbb/%5Bslug%5D/dashboard/page.tsx).
- **React Native Mobile App**: Hidden the "Правління" card from the grid menu row in [mobile/components/resident/ResidentDashboard.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/components/resident/ResidentDashboard.tsx).
- **Type Safety Verification**: Ran compile checks successfully on both platforms (`npm run build` and `npx tsc --noEmit`).
- **Production Deployment**: Initiated redeployment of the web frontend to Fly.io.

---

## 13. Restructuring Add Object Form & Clarifying Initial Balance

### Changes Made
- **Tabbed Modal Interface**: Modified the Add/Edit Object modal in [frontend/app/billing/page.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/frontend/app/billing/page.tsx) to divide the input fields into two clear, distinct tabs:
  1. **Характеристики об'єкта**: Type, identifier, street, number, area, tariff, fixed fee, and main parent bindings.
  2. **Дані мешканця**: Full name, phone, email, role, ownership share, initial dues balance, and board checkboxes.
- **State Integration**: Introduced `modalTab` state variable to track the active tab, defaulting to `"property"` and resetting when the modal is opened.
- **Starting Balance Clarification**: Renamed the starting balance field label to **"Початковий баланс членських внесків (грн)"** and added descriptive helper text: *"Вкажіть суму зі знаком мінус "-", якщо є стартовий борг по членських внесках."*, explicitly noting that starting debt is entered with a minus `-` sign.
- **Verification**: Verified zero TypeScript compile errors via production Next.js compilation (`npm run build`).
- **Production Deployment**: Successfully built and deployed the updated web application to Fly.io (`unitas-frontend`).

---

## 14. Batch Object Generator (Генератор об'єктів)

### 1. Backend Endpoint Implementation
- **FastAPI Batch Endpoint**: Created `@app.post("/api/profiles/{profile_id}/members/batch-generate")` in [backend/api/main.py](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/backend/api/main.py) which handles generating a sequence of property objects (apartments, plots, or parking spaces) in bulk.
- **Skipping Duplicate Records**: Automatically checks for preexisting records to prevent duplicates, and returns a JSON payload detailing the count of created vs. skipped objects.
- **Auto-formatting Addresses**: Automatically handles the standard address format conventions (e.g. mapping plots under property type `"дл."` with prefixed identifiers like `"дл. 29"`, and mapping apartments under property type `"кв."` with the corresponding house number and flat identifiers).

### 2. Frontend Integration
- **API Client Wrapper**: Added `batchGenerateMembers` to [frontend/lib/api.ts](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/frontend/lib/api.ts).
- **Interactive Action Button**: Positioned a new **«Генератор об'єктів»** button inside the billing members list control bar next to *"Імпорт списком"* in [frontend/app/billing/page.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/frontend/app/billing/page.tsx).
- **Batch Generator Wizard Modal**: Added `BatchGeneratorModal` prompting the administrator for street name, house number, property type, number ranges ("Від №... До №..."), and default parameters (default area in sqm, default monthly rate, or fixed dues fee).
- **Response Alerts & Auto-Reload**: Integrates success alerts (noting the count of generated properties and duplicates skipped) and automatically reloads the member grid upon completion.

### 3. Verification & Deployment
- **Integration Test Suite**: Created a file-based integration test script verifying batch inserts, duplicate skips, and dynamic registration street/number lists mapping. All tests executed with 100% success.
- **Production Deploy**: Pushed backend changes to `unitas-backend` and frontend changes to `unitas-frontend` services on Fly.io successfully.

---

## 15. Board Workspace Relocation & Mobile Board Visibility

### 1. Board Workspace Relocation (Web UI)
- **Dashboard Clean-up**: Removed the **«Правління»** (Board) and **«Оголошення»** (Announcements) button tabs from the main dashboard top header navigation (`frontend/app/dashboard/page.tsx`) to avoid cluttering general business/tax profiles with OSBB-specific billing modules.
- **Billing Tab Integration**: Added **«Правління»** as a main tab in the accountant/manager's billing panel (`frontend/app/billing/page.tsx`) alongside *«Список об'єктів»*, *«Контрагенти»*, *«Розрахунки»*, etc.
- **Embedded Board Workspace**: Integrated the full interactive Board Workspace (issue agenda creation, status flow management, voting, AI minutes/protocol generation, and KEP digital signatures) directly under the new `/billing` tab, styled consistently with the rest of the billing console.

### 2. Conditional Mobile Board Card Visibility
- **Role-Based Check**: Modified the React Native Mobile dashboard (`mobile/components/resident/ResidentDashboard.tsx`) to conditionally display the **«Правління»** grid card.
- **Implementation**: The card is now rendered only if the logged-in resident's profile data specifies they are a board member or chairman:
  ```typescript
  {Boolean(data?.member?.is_board_member || data?.member?.is_board_chairman) && ( ... )}
  ```
  Regular residents will no longer see the card.
- **Announcements**: Confirmed that the **«Оголошення»** (Announcements) block remains fully functional and appears on the mobile dashboard when announcements exist (`announcements.length > 0`).

### 3. Verification & Deployment
- **TypeScript Verification**: Validated compiler safety for both the frontend (Next.js build checks) and mobile codebases.
- **Production Deploy**: Rebuilt and deployed the updated frontend application successfully to Fly.io (`unitas-frontend.fly.dev`).

---

## 16. Mobile & Web General Meetings Layout Enhancements

### 1. Web Resident Panel Home Screen Banners & Board Tab
- **Tabbar Restoration**: Restored the **«Правління»** (Board) tab button inside the resident web portal ([page.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/frontend/app/osbb/[slug]/dashboard/page.tsx)) for board members/chairmen, enabling the tab view state.
- **Home Tab Active Banners**: Implemented premium-styled alert banners at the top of the **home tab** (`activeTab === "dashboard"`) that automatically render whenever there are active general meetings (for all residents) or active board issues (for board members). These cards show description summaries, term dates, and direct links to navigate to the respective tabs.

### 2. Mobile Resident App Home Screen Grid & Modal Overlay
- **Dashboard Grid Button**: Added a dedicated **«Загальні збори»** grid button in [ResidentDashboard.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/components/resident/ResidentDashboard.tsx) rendered for all co-owners. For board members, it aligns side-by-side with «Правління».
- **Modal Voting Overlay**: Built a fully interactive Modal overlay showing active/completed general meetings, allowing residents to cast digital votes secured via mock Diia.Signature, PrivatBank SMS verification, or personal KEP passcodes, perfectly synced with the backend API.

### 3. Verification & Build Safety
- **Mobile**: Checked type safety via `npx tsc --noEmit` yielding zero compilation errors.
- **Web**: Generated the production Next.js optimized bundle using `npm run build` inside the `frontend` folder with 100% success.

---

## 17. Subscription Checkout & Email Invoice Fixes

### 1. Payment Checkout Fix (Backend API)
- **Constraint Removal**: Removed the restriction `if profile.type != "fop":` from the subscription creation logic inside `create_payment_combined` in [main.py](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/backend/api/main.py). Non-FOP entities (such as OSBBs, cooperatives, and TOVs) can now directly purchase and upgrade their subscriptions online using Monobank.
- **Import Resolution**: Fixed a `NameError: name 'monobank_service' is not defined` inside the subscription payment flow by uncommenting `from services.monobank_service import monobank_service` in [main.py](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/backend/api/main.py). This resolved the "Помилка при спробі створити платіж" checkout failure.

### 2. Restored Send Invoice to Email Button & Email Auto-Prefill (Frontend UI)
- **Action Trigger**: Added a dedicated **«Надіслати рахунок на e-mail»** button inside the selected tariff details display in [page.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/frontend/app/settings/subscription/page.tsx). It triggers the `handleOpenInvoiceModal` action, opening the modal wizard.
- **Email Auto-Prefill**: Prefills the email address input field inside the invoice request modal using the user's registration credentials (read from `telegramId` in the App Context if it contains `@`) so they don't have to retype it.

### 3. Direct PDF Invoice Downloads (Backend API & Frontend UI)
- **Direct Download Endpoints**: Implemented new `/api/subscriptions/download-invoice-pdf` and `/api/payments/{payment_id}/pdf` endpoints in [main.py](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/backend/api/main.py) to generate and return the subscription invoice PDF directly as a stream.
- **UI Download Actions**: Integrated a **«Завантажити PDF»** button directly inside the email invoice modal popup, and added a **«Рахунок (PDF)»** link next to each subscription invoice entry in the payments history table, giving users immediate access to their PDF invoices offline without relying on SMTP email delivery.
- **Dynamic Invoice Pricing**: Resolved the issue where all invoices were generated with a hardcoded price of 299 UAH regardless of the active profile's group/system (such as FOP 3rd group which pays 450 UAH). Now, the frontend dynamically calculates the pricing based on the selected profile's group and options, passing the correct `amount` and `tariff_code` parameters to both `downloadSubscriptionInvoicePDF` and `sendSubscriptionInvoice` API endpoints. The backend uses these parameters to generate the PDF and populate the billing records with the correct price and Ukrainian tariff name.
- **Build Success**: Deployed both updated backend and frontend instances successfully to Fly.io.

## 18. App Store Rejection Resolution (Guidelines 3.1.1 & 4.8)

### 1. Guideline 4.8 Compliance (Telegram ID Login Bypass)
- **iOS Hide**: Wrapped the Telegram ID segmented tab selection and the temporary password request link with `Platform.OS !== 'ios'` checks inside [login.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/app/(auth)/login.tsx).
- **Default State Constraint**: Implemented a `useEffect` hook to automatically enforce `loginMode = 'email'` if the user is running on iOS. This leaves standard Email/Password authentication as the only active credential method on Apple devices, completely removing the requirement for "Sign In with Apple".

### 2. Guideline 3.1.1 Compliance (Hiding Billing & Payments on iOS)
- **Business Registration Restored**: Kept the business registration form fully operational inside the app on iOS, allowing FOPs and companies to register directly.
- **Hiding Billing Tab**: Conditionally hid the «Білінг» (Billing) tab in [_layout.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/app/(tabs)/_layout.tsx) for business users on iOS by setting its `href` to `null` if `Platform.OS === 'ios' && !isResident`. This completely hides the billing overview screen from Apple's reviewers.
- **Hiding Inline Payments**: Hidden the Mono Pay and LiqPay online payment buttons for residents on iOS inside [ResidentDashboard.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/components/resident/ResidentDashboard.tsx) and [index.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/app/(tabs)/index.tsx), leaving only manual bank details (IBAN) visible.
- **Hiding Invoice Mono Pay**: Hidden the «Оплатити через Mono Pay» button inside the member details modal in [billing.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/app/(tabs)/billing.tsx) on iOS.

### 3. Payment Wording Cleanup
- **Mono Pay mention**: Removed the phrase `"через Mono Pay"` from the help and support info card text, changing it to: *«...Мешканці можуть передавати показання та сплачувати рахунки онлайн безпосередньо голові правління.»*

### 4. Build Information
- **Version Setting**: Bounded build numbers in [app.json](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/app.json) to `version = "1.0.0"`, `ios.buildNumber = "8"`, and `android.versionCode = 8`.
- **EAS Production Build**: Triggered and successfully completed a production build for iOS.
  * **IPA Artifact URL**: https://expo.dev/artifacts/eas/3NdWkh8fz0a2RZTDrgPWJtNa7UJPDujlbFyuYk5bkXs.ipa
  * **EAS Build Logs**: https://expo.dev/accounts/maiklmax/projects/unitax-mobile/builds/9200dba6-8ee1-4fa5-b925-445aa51220d0
- **Validation**: Confirmed zero compilation errors via `npx tsc --noEmit` on the mobile project.

---

## 19. Mobile App Store Compliance Fixes (Guideline 3.1.1 & 4.8) - Version 1.0.0 (9)

### 1. Account / Profile Registration Removal (Mobile App)
- **Modal Swapper Button**: Removed the "Додати новий профіль" (Add new profile) action button from the profile selection switcher modal in [index.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/app/(tabs)/index.tsx).
- **Profiles Management Screen**: Removed both the top header "Додати профіль" (Add profile) button and the empty state add action button in [profiles.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/app/(tabs)/profiles.tsx).

### 2. Website Redirect Cards Removal
- **Dashboard Section**: Replaced the "Web Version Redirect Card" in [index.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/app/(tabs)/index.tsx) with a beautiful static "Популярні новини" (Popular News) card placeholder layout that lists relevant tax updates and calendar warnings without external hyperlinks.
- **Settings Screen**: Deleted the "Transition to website Card" completely from [settings.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/app/(tabs)/settings.tsx).

### 3. Non-Profit Billing Screen Restored
- **Layout Tab Bar**: Restored the visibility of the "Білінг" (Billing) tab on iOS by removing the `Platform.OS === 'ios'` constraint on the `href` field in [_layout.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/app/(tabs)/_layout.tsx). This allows non-profit/OSBB organization owners to manage their co-owners, utilities, and contributions ledger on Apple devices.

### 4. Locked Taxation Structures (Edit Mode)
- **Profiles screen**: Disabled inputs and segmented toggles for Profile Type (FOP vs Company), Tax System, Non-Profit Subtypes, and Tax Groups/Rates inside the profile editor popup of [profiles.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/mobile/app/(tabs)/profiles.tsx) whenever `editingProfile` is not null. This enforces the rule that users cannot switch tax groups/categories on existing profiles inside the app.

### 5. Telegram Bot Registry Cleanup
- **Bot Actions**: Removed the "+ Додати підприємство" (Add company) keyboard layout, message filter registration, and click event callbacks inside [bot.py](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/telegram_bot/bot.py) to prevent organization registration actions from the Telegram interface. Added a click interceptor in `handle_menu_click` to automatically capture any cached "➕ Додати підприємство" button clicks on the client-side and force-update the user's keyboard with the new layout (completely removing the obsolete button).

### 6. Build Information
- **EAS Production Build 1.0.0 (10)**: Completed production builds successfully:
  * **Android App (.aab)**: https://expo.dev/artifacts/eas/ZjhxdcOIEyrpB0O7Csh9_7a6-VX-2FCoZ0jtPIKytA0.aab
  * **iOS App (.ipa)**: https://expo.dev/artifacts/eas/5skJRVEohWqr_RtqNjHaQ80ipKuN2ug2PBn2Qf_DiGE.ipa
  * **Android EAS Logs**: https://expo.dev/accounts/maiklmax/projects/unitax-mobile/builds/3fc95c4c-85cd-4335-9357-2b002189d21c
  * **iOS EAS Logs**: https://expo.dev/accounts/maiklmax/projects/unitax-mobile/builds/f264ee30-82b2-41a0-a7f4-cb558655ebc2
- **Verification**: Validated compilation with `npx tsc --noEmit` producing zero type errors.
