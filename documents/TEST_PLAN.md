# Test Plan

## Test Strategy

| Level | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | Pure domain functions, validation, money/dates |
| Integration | Vitest + fake-indexeddb | Service layer (Dexie operations) |
| UI | Vitest + RTL | Component rendering, interactions, i18n, a11y |
| E2E | (Future) Playwright | Full user flows, PWA install, offline |
| Static | ESLint + TypeScript | Code quality, type safety |
| Parity | Node script | Translation key completeness |

---

## Test Matrix

### Domain Logic (`src/domain/**/*.test.ts`)

| Module | Functions | Key Assertions |
|--------|-----------|----------------|
| `money.test.ts` | `rupeesToPaise`, `paiseToRupees`, `formatMoney`, `sumPaise` | Rounding, negative handling, INR formatting per locale |
| `dates.test.ts` | `todayISODate`, `daysBetween`, `daysUntilExpiry`, `formatDate`, `formatDateTime` | Cross-month/year, leap year, locale formatting |
| `inventory.test.ts` | `computeStockFromMovements`, `computeUsableStock`, `stockStatus`, `reorderQuantity`, `roundUpToPack`, `buildLowStockAlerts`, `classifyExpiryRisk`, `buildExpiryAlerts`, `buildSlowMovingProducts` | Ledger sum, expired exclusion, status thresholds, reorder math, sort orders |
| `restock.test.ts` | `buildRestockPlan` | Budget never exceeded, pack rounding, no-cost exclusion, insufficient-history label, expired excluded, deterministic output |
| `validation.test.ts` | All Zod schemas | Required fields, ranges, types, custom messages |

### Service Layer (`src/services/local/*.test.ts`)

| Service | Scenarios |
|---------|-----------|
| `LocalProductService` | CRUD, list with filters, detail with stock, variant management |
| `LocalSalesService` | Record sale (stock decrement, movements), insufficient stock error, duplicate guard |
| `LocalPurchaseService` | Receive stock (batch + movements), expiry validation, cost sync |
| `LocalStockMovementService` | List with filters, correction (delta movement, history preserved) |
| `LocalAlertService` | Low stock, expiry, slow-moving aggregation |
| `LocalRestockService` | Preview with budget, save/load plans |
| `LocalSettingsService` | Get/update, defaults, onboarding flag |
| `LocalBackupService` | Export (full data), import (validation + transactional replace) |
| `LocalPinService` | Setup, verify, change, disable, reset, attempt backoff |

### UI Components (`src/components/**/*.test.tsx`)

| Component | Tests |
|-----------|-------|
| `ConfirmDialog` | Open/close, focus trap, Escape cancels, busy disables, danger variant |
| `QuantityStepper` | Increment/decrement, min/max, disabled, keyboard, aria-labels |
| `PinPad` | Digit entry, backspace, show/hide, keyboard input, wait countdown |
| `StockBadge` / `ExpiryBadge` | All status variants render correct class + label |
| `EmptyState` / `ErrorState` / `LoadingState` | Render with props, retry action |
| `ConnectionChip` / `OfflineBanner` | Online/offline states, correct icons |

### Feature Screens (`src/features/**/*.test.tsx`)

| Screen | Critical Paths |
|--------|----------------|
| `OnboardingScreen` | Language/theme selection, start button saves settings, navigates to `/` |
| `DashboardScreen` | Stats load, quick actions navigate, attention list links, offline banner |
| `ProductsScreen` | Search/filter/sort, add/edit navigation, card/table switch (CSS) |
| `ProductFormScreen` | Validation (required, ranges), edit prefill, create/edit save, values preserved on error |
| `RecordSaleScreen` | Cart add/remove, quantity stepper, review step, confirm (stock validation), receipt, duplicate guard |
| `ReceivePurchaseScreen` | Form validation, batch/expiry optional, review, confirm, stock increment |
| `MovementsScreen` | Filters, correction dialog (delta vs ledger total) |
| `ExpiryScreen` | Three groups, window selector persists, risk badges |
| `SlowMovingScreen` | Flagged vs new products, window selector |
| `RestockScreen` | Budget input, generate, override qty, recalc, draft/confirm, excluded reasons |
| `SettingsScreen` | Language/theme change, defaults update, export/import/reset modals |
| `InstallScreen` | Install button (mock `beforeinstallprompt`), manual steps, update banner |

### PIN Feature (`src/features/pin/*.test.tsx`)

| Screen | Tests |
|--------|-------|
| `PinSetupScreen` | Intro → enter → confirm → match → persist → unlock; mismatch resets; skip sets flag |
| `PinUnlockScreen` | Correct PIN unlocks; wrong PIN shows error; failed attempts → increasing delay; forgot → reset confirmation → data preserved |
| `PinChangeScreen` (in Settings) | Current PIN required, new PIN confirmed, change persists |

### i18n & Accessibility

| Test | Assertion |
|------|-----------|
| `translationParity.test.ts` | `en/ta/hi` have identical key sets (477 keys); no empty values |
| `languageSwitch.test.tsx` | Change language → all visible labels update |
| `themeSwitch.test.tsx` | Change theme → `document.documentElement.dataset.theme` updates |
| `a11y.test.tsx` | Focus visible, aria-labels on icon buttons, form labels associated, role=dialog on modals |

### PWA & Build

| Script | Validates |
|--------|-----------|
| `check-translations.mjs` | Key parity + no empty translations |
| `check-pwa.mjs` | `dist/manifest.webmanifest` fields, `sw.js` workbox, icons in dist |

---

## Running Tests

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# With coverage
npm run test -- --coverage

# Single file
npm run test -- src/domain/inventory.test.ts
```

## Test Data Management

- **Isolation:** Each test file creates its own Dexie DB name via `KiranaDB('test-' + random())`
- **Seeding:** `seedDemoData()` called in `beforeEach` where needed
- **Cleanup:** `afterEach` closes DB, `Dexie.delete(name)`
- **Determinism:** Seed uses fixed dates relative to `now`; no `Math.random()` in domain logic

## CI Pipeline (Local Verification)

```bash
npm run verify
# Runs: typecheck → lint → test → build → check:translations → check:pwa
```

All must pass before merge.

## Future E2E (Playwright)

- [ ] Install flow (Chrome headless + `beforeinstallprompt` mock)
- [ ] Offline: load → disconnect → complete sale → reconnect → verify
- [ ] PIN: enable → lock → unlock → change → disable
- [ ] Backup: export → clear DB → import → verify counts
- [ ] Language: en → ta → hi → en (all screens)
- [ ] Theme: light → dark → system (OS toggle)