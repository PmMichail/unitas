# Implementation Plan: Recurring OSBB Resident Cabinet Subscription

Transition the OSBB Resident Cabinet module from a one-time payment of 1500 UAH to a recurring subscription add-on (500 UAH/mo) integrated into the pricing plans selection flow.

## User Review Required

> [!IMPORTANT]
> **Plan and Price Mapping:**
> We are adding a new `subscription_plans` table containing:
> - **Basic Plan (Базовий):** 499 UAH/mo, no member cabinet option (`has_member_module = False`).
> - **Premium Plan (Преміум):** 999 UAH/mo, with optional member cabinet (+500 UAH/mo, total 1499 UAH/mo) (`has_member_module = True`, `member_module_price = 500`).
>
> **Access Restriction:**
> Resident endpoints will check the active subscription and verify that `is_member_module_active` is `True` on the subscription.

## Open Questions

- **trans_slug / slug generation:** If the OSBB name is in Cyrillic, we will automatically transliterate it to a unique URL-friendly Latin slug (e.g. `ОСББ Зелений Курган` -> `zelenyi-kurhan`). Let us know if you want a custom edit field for the slug during checkout instead.

---

## Proposed Changes

### Database Schema

#### [MODIFY] [main.py](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/backend/api/main.py)
- Define `SubscriptionPlan` model:
  ```python
  class SubscriptionPlan(Base):
      __tablename__ = "subscription_plans"
      id = Column(Integer, primary_key=True, index=True)
      name = Column(String, nullable=False)
      price = Column(Numeric(10, 2), nullable=False)
      has_member_module = Column(Boolean, default=False)
      member_module_price = Column(Numeric(10, 2), default=0.0)
  ```
- Add `is_member_module_active` column to `Subscription` model:
  ```python
  is_member_module_active = Column(Boolean, default=False)
  ```
- Update `migrate_database()` function to:
  - Add `is_member_module_active` column to `subscriptions` table.
  - Create `subscription_plans` table if it doesn't exist.
  - Populate default plans: "Базовий" (499 UAH) and "Преміум" (999 UAH, `has_member_module=True`, `member_module_price=500`).

---

### Backend Endpoints

#### [MODIFY] [main.py](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/backend/api/main.py)
- **GET `/api/subscription/plans`**: Return list of plans.
- **POST `/api/subscription/create`**:
  - Accept `plan_id`, `enable_member_module`, `profile_id`.
  - Calculate price (plan price + member module price if enabled).
  - Automatically transliterate name to a unique slug if not present.
  - Create/update child profile `osbb_enterprise` for resident cabinet payments.
  - Create pending `Subscription` and `Payment` history.
  - Generate Monobank invoice with reference: `sub_{profile_id}_{plan_code}_monthly_{payment.id}_{timestamp}_member_{1/0}`.
- **Webhook `/api/billing/webhook/mono`**:
  - Extract and parse reference to determine if member module was enabled (`parts[7] == '1'`).
  - Set `subscription.is_member_module_active = True/False` on successful payment.
  - Activate/block the child profile based on whether the module is enabled.
- **Resident Access Guard (`verify_member_token`)**:
  - Check that the parent OSBB profile has an active subscription AND `is_member_module_active` is `True`. Return 403 otherwise.
- **Daily Expired Check (`deactivate_expired_modules`)**:
  - Scan for expired subscriptions or subscriptions with inactive status.
  - If they had `is_member_module_active = True`, set it to `False`, block the child cabinet profile (`is_blocked = True`), and send Telegram/Email notification to the OSBB head.

---

### Frontend Components

#### [MODIFY] [api.ts](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/frontend/lib/api.ts)
- Add API methods:
  - `getSubscriptionPlans()`
  - `createSubscription(data)`

#### [MODIFY] [page.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/frontend/app/settings/subscription/page.tsx)
- Check if selected profile is OSBB/ST.
- Render dynamic OSBB plan selector: "Базовий" and "Преміум" plans.
- Render a checkbox "📱 Кабінет мешканців [+500 грн/міс]" under the Premium option.
- Update total checkout cost and redirect to Monobank payment page.

#### [MODIFY] [page.tsx](file:///Users/mac/.gemini/antigravity-ide/scratch/unitas/frontend/app/billing/page.tsx)
- Replace old resident cabinet tab status card with details:
  - Subscription tier, module active status (+500 UAH/mo if active).
  - Next payment date, total monthly price.
  - Resident stats: total registered, pending approval, active.
  - Redirect buttons to subscription page: "[📋 Скасувати модуль]" and "[🔄 Змінити тариф]".

---

## Verification Plan

### Automated/Unit Tests
- Restart backend to run migrations, verify table schemas.
- Test endpoints `/api/subscription/plans` and `/api/subscription/create` with Mock Monobank client.

### Manual Verification
1. Log in as OSBB head.
2. Navigate to "Тарифи та оплата" -> select Premium plan -> check "Кабінет мешканців".
3. Verify total price updates to 1499 UAH. Click checkout and pay.
4. Verify Resident Cabinet slug and URL generated, and module status in Billing Panel is Active.
5. Log in as a resident -> verify access works.
6. Trigger daily cron logic -> verify expired subscription blocks resident cabinet.
