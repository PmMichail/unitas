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
- [ ] Refactor `globals.css` to clean up forced modal borders and text-white overrides
- [ ] Implement premium, responsive, clean modal components in `frontend/app/dashboard/page.tsx`
- [ ] Verify local Next.js build passes cleanly without compilation errors
- [ ] Deploy updated frontend to Fly.io production
- [ ] Verify the live site modal visual styling and theme switching


