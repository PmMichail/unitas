# Tasks - Bank Parser & Payment Fixes

## A-Bank Parser Fix
- [x] Modify `backend/ai_parser/universal_parser.py` to route A-Bank to midpoint-based parser
- [x] Implement `pdfplumber` midpoint parser with geometric filtering in `universal_parser.py`
- [x] Verify parsing accuracy of A-Bank statement locally using test script
- [x] Впровадження модального вікна та розширеної сітки в `benefits/page.tsx`
  - [x] Оновлення списку переваг (12 елементів)
  - [x] Додавання стану `selectedService` та `isModalOpen`
  - [x] Створення рендерингу світлого модального вікна з тонкою помаранчевою рамкою
  - [x] Реалізація HTML-структури з 16 кубиками та 3D-анімацією збирання
  - [x] Додавання перемикача тем (`ThemeToggle`) в хедер сторінки
  - [x] Окантовка 12 карток переваг на головній сторінці помаранчевою рамкою
- [x] Оновлення динамічних SEO сторінок в `benefits/[service]/page.tsx`
  - [x] Додавання `tax-calendar` та `electronic-documents` до `servicesData`
  - [x] Реалізація повної підтримки світлої та темної тем на сторінках послуг
  - [x] Додавання перемикача тем (`ThemeToggle`) в хедер сторінки
- [x] Налаштування окантовки модальних вікон
  - [x] Впровадження надійних CSS-селекторів у `globals.css` для рамки `#d97706` (світла) / `#f59e0b` (темна) навколо всіх модальних вікон у застосунку
- [x] Реструктуризація та виправлення футера (`LiqPayFooter.tsx`)
  - [x] Видалення зайвої виділяємиої літери "U" на початку назви (реалізовано через CSS content для збереження брендингу)
  - [x] Виведення контактних даних (Адреса, Телефон, Email) у відкритий вигляд
  - [x] Приховування чутливих юридичних даних (ФОП, ЗКПО) під згорнуте меню "Право власності"
  - [x] Повне виправлення контрастності та колірної гами футера у світлій темі (світлий фон, контрастні темні тексти та посилання)
- [x] Верифікація та деплой
  - [x] Локальна збірка проекту (`npm run build`)
  - [x] Деплой оновленого фронтенду на Fly.io (`fly deploy`)
- [x] Run parser tests to check for regressions on other banks
- [x] Deploy backend updates to Fly.io
- [x] Update walkthrough documentation

## Monobank PDF Parser Fix
- [x] Modify `backend/ai_parser/universal_parser.py` to route Monobank to midpoint-based parser
- [x] Implement `_parse_monobank_pdf` with geometric filtering and normalization in `universal_parser.py`
- [x] Update walkthrough documentation
- [x] Глобальна заміна кольору `#4f46e5` на `#6366f1`
  - [x] Редагування `globals.css` (зміна змінних та класів)
  - [x] Оновлення бекенду (`backend/api/main.py` - листи та PDF)
  - [x] Оновлення `support.html`

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

## Settings Page Localization & Deployments
- [x] Polish settings page localization to proper, natural Ukrainian
- [x] Deploy backend updates to Fly.io
- [x] Deploy frontend updates to Fly.io
- [x] Verify production DNS, SSL, and localized settings page via curl checks
- [x] Update walkthrough documentation

## Resident Account Collision Detection & Merging
- [x] Implement automatic collision matching in backend `get_members_moderation` (phone, address, similar name matching)
- [x] Create POST backend API endpoint to merge pending registration request with existing plot record (transfer credentials, email, status, votes, tickets, and push tokens)
- [x] Add interactive Warning and "Об'єднати" button in frontend moderation panel
- [x] Create test script to verify merging logic and DB state transitions
- [x] Deploy frontend and backend changes to Fly.io
- [x] Verify production deployment
- [x] Update walkthrough.md and task.md

## Payment Alignment and LiqPay Checkout Fixes
- [x] Correct LiqPay signature calculation from hex string to base64 binary SHA1 digest (both POST and GET redirect endpoints)
- [x] Restructure resident payment dashboard layout (split actions, stack elements, add flex-wrap) to prevent off-screen button overflow on Web and Mobile
- [x] Fix mobile meter reading input squish by replacing fixed width submit button with dynamic padding
- [x] Verify frontend compile safety locally via production build check
- [x] Deploy backend and frontend updates to Fly.io production
- [x] Verify remote signature parameters and layout flow

## Dashboard Modals Redesign
- [x] Refactor `globals.css` to clean up forced modal borders and text-white overrides
- [x] Implement premium, responsive, clean modal components in `frontend/app/dashboard/page.tsx`
- [x] Verify local Next.js build passes cleanly without compilation errors
- [x] Deploy updated frontend to Fly.io production
- [x] Verify the live site modal visual styling and theme switching

## Consulting Partnership Terms, Dynamic Client Pricing, and 50% Discount for Every 10th Client
- [x] Lock consulting company settings dialog on frontend as a read-only Cooperation Terms modal
- [x] Map consulting billing endpoint on backend to calculate dynamic client prices based on resolved tariff profiles
- [x] Implement 10% partner discount with 50% discount on every 10th client in backend billing calculation
- [x] Display detailed client-by-client monthly billing breakdown grid in partner cabinet billing tab
- [x] Verify local Next.js frontend compile safety via `npx tsc --noEmit`
- [x] Verify FastAPI backend syntax checks
- [x] Redeploy backend and frontend services to Fly.io production
- [x] Update walkthrough.md and task.md with details of implementation

## Accountant Assignment controls, Marketplace Toggle fix, and Marketplace Layout redesign
- [x] Replace read-only accountant cell with styled dropdown selector in Client Matrix tab
- [x] Modify fetchDashboardData to pre-load staff data for owner accounts
- [x] Update assign-accountant endpoint on backend to allow unassignment when accountant_id <= 0
- [x] Include is_listed_in_marketplace flag in backend consulting dashboard response to fix the toggle button state
- [x] Redesign Marketplace settings banner into a clean glassmorphic component with pulsing status badge
- [x] Refactor Marketplace service offers list into a responsive grid card layout
- [x] Fix invited accountant signup conflict by allowing passwordless invited users to register
- [x] Verify frontend build passes without compile errors
- [x] Redeploy both services to Fly.io production
- [x] Create detailed design and search plan for the public marketplace

## Consulting Cabinet Improvements & Card Integration
- [x] Add `is_suspended` to `ConsultingClientAssignment` and card columns to `ConsultingCompany`
- [x] Implement database migrations for new columns
- [x] Fix invited accountant signup conflict by allowing passwordless invited users to register
- [x] Fall back to any user with `is_listed_in_marketplace == True` in `get_marketplace_catalog`
- [x] Update `/api/consulting/billing` to return `is_suspended` and omit suspended clients from total price
- [x] Implement `PUT /api/consulting/billing/suspension` endpoint for freezing/unfreezing client slots
- [x] Implement `POST /api/consulting/billing/card` endpoint for linking payment cards
- [x] Implement Card Binding Modal & Card Info display in the billing tab of the frontend
- [x] Add client row freeze/unfreeze action buttons in the Billing tab
- [x] Verify Next.js build compiles without errors
- [x] Update walkthrough.md and task.md with details of implementation
- [x] Fix accountant invitation hijacking bug in backend team member search

## Marketplace Checkout Accountant Selection & Communication Restored
- [x] Add `requested_accountant_id` and `is_at_company_discretion` to `ConsultingMarketplaceOrder` model and migration
- [x] Update `POST /api/marketplace/checkout` to link chosen accountant and create requested order
- [x] Add `GET /api/consulting/marketplace/requests` and `POST /api/consulting/marketplace/requests/{order_id}/approve` endpoints
- [x] Add `GET /api/marketplace/client-status` to let client track active assignments and requested orders
- [x] Update support chat GET/POST endpoints to route messages through separate rooms (UniTax, Client-Company, Client-Accountant)
- [x] Update `getClientMarketplaceStatus` and `getPartnerSupportChats` helpers to frontend api client
- [x] Integrate multi-room support chat tab selection in client-side SupportChatWidget
- [x] Implement incoming requests grid list and accountant approval dropdowns in partner dashboard
- [x] Verify frontend build passes Next.js production packaging checks
- [x] Redeploy backend and frontend services to Fly.io production

## Consulting Cabinet Reconstruction & Compilation Repair
- [x] Reconstruct lost `page.tsx` from logs using python fuzzy match parser
- [x] Fix duplicate Settings Modal blocks in loading checks
- [x] Delete duplicate remove accountant button blocks
- [x] Resolve template literal backtick syntax issues
- [x] Declare settingsDescription state and remove duplicate handlers
- [x] Verify local build compiling safely (`npm run build` succeeds)
- [x] Redeploy frontend updates to Fly.io
- [x] Update walkthrough.md and task.md

