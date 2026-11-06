# KiranaIQ Change History

This document records the implementation work completed across the current
KiranaIQ development sessions. It supplements the existing feature and
architecture documents under this directory.

## 2026-11-06 - Cross-page Alignment and Responsiveness

- Added shared cross-page alignment rules for page headers, cards, definition
  lists, grid-based dashboard cards, list rows, badges, and bottom navigation.
- Added equal-height stat cards and a consistent quick-action grid.
- Updated the product toolbar to use dedicated responsive search, category,
  status, and sort controls.
- Reworked Sales History filters into three aligned desktop columns and a
  single-column mobile layout.
- Added a dedicated Sales transaction summary layout that keeps product text,
  transaction metadata, amount, and Demo badge aligned on narrow screens.
- Added utility rules for shared gaps, medium text weight, and normalized
  description-list margins.
- Verified these rules remain compatible with the existing desktop table and
  mobile card layouts.

## 2026-11-06 - Sales History Routing and History Screen

### Problem

The Dashboard rendered recent sales and its **View all** link navigated to
`/#/sales`, but the route was not registered in the application's hash router.
Direct access and refresh therefore reached React Router's default developer
error page instead of an application screen.

### Root cause

`src/app/router.tsx` registered record-sale as `sales/new` but had no
`sales` route. No Sales History screen was registered for that URL.

### Implemented

- Added a complete Sales History screen that reads the existing Dexie/IndexedDB
  sales table without creating, overwriting, or deleting transactions.
- Registered `/sales` before the wildcard route in the hash-router layout.
- Kept `/sales/new` for recording new sales.
- Added direct transaction detail expansion so users can inspect every sale
  item, quantity, pack variant, line amount, transaction amount, and ID.
- Added product/transaction-ID search.
- Added transaction-source, from-date, and to-date filters.
- Added Demo badges for seeded sales and a separate **Recorded sales** filter
  for genuine records.
- Added useful empty and filtered-empty states.
- Added working links back to the Dashboard.
- Updated the Sales bottom-navigation destination to open Sales History while
  preserving `/sales/new` as the sale-recording action.
- Added an application-level React render ErrorBoundary in `src/app/App.tsx`.
- Added a React Router route error screen plus a wildcard route so unknown
  routes show an application-owned recovery page rather than React Router's
  developer 404 screen.
- Updated all supported translations for the new history labels.

### Sales files changed

| File | Change |
|---|---|
| `src/features/sales/SalesHistoryScreen.tsx` | New reusable Sales History feature |
| `src/app/router.tsx` | Added `/sales`, route error UI, and wildcard fallback |
| `src/app/App.tsx` | Added application-level ErrorBoundary |
| `src/components/layout/AppLayout.tsx` | Sales navigation now opens Sales History |
| `src/services/interfaces.ts` | Allowed the sales service list operation to accept an optional limit |
| `src/services/local/index.ts` | Updated local sales listing to support both limited and complete history queries |
| `src/i18n/locales/en/translation.json` | Added English Sales History labels |
| `src/i18n/locales/ta/translation.json` | Added Tamil Sales History labels |
| `src/i18n/locales/hi/translation.json` | Added Hindi Sales History labels |

### Verification

- `npm run typecheck` passed.
- `npm run build` passed.
- Directly opening `http://localhost:5180/#/sales` displayed Sales History.
- Refreshing the Sales History route preserved the current route and rendered the screen.
- Dashboard **View all** opened Sales History.
- Browser back and forward navigation worked between Dashboard and Sales History.
- Browser navigation displayed the existing saved and demo transactions correctly.
- The route used existing IndexedDB sales data and did not generate fake sales.

---

## Product Management Redesign

Product routes, screens, and local service behavior were repaired and
redesigned to provide reliable product management.

### Routing and loading fixes

- Replaced and consolidated product route behavior in `src/app/router.tsx`.
- Established route priority:
  1. `/products`
  2. `/products/new`
  3. `/products/:productId/edit`
  4. `/products/:productId`
- Added loading states while product and edit data are fetched.
- Added solution-oriented not-found states for missing product records.
- Added route recovery and application-level navigation back to Home.

### Product screens

- Redesigned the Products list with search, category, stock-status, and sort controls.
- Added responsive card/table presentation.
- Added explicit View and Edit actions.
- Updated product detail navigation and content.
- Repaired product create/edit flows and redirect behavior.
- Added safe rendering for user-provided text.

### Data reliability

- Updated local product lookup and mutation behavior.
- Added retries to accommodate short-lived IndexedDB consistency timing.
- Preserved stock and transaction history through archive/soft-delete behavior.
- Updated the service interfaces and local implementation where product
  operations required additional detail or safety.

### Product files changed

| File | Change |
|---|---|
| `src/features/products/ProductsScreen.tsx` | Redesigned list, filters, sorting, and navigation |
| `src/features/products/ProductFormScreen.tsx` | Repaired create/edit loading, validation, save, and navigation |
| `src/features/products/ProductDetailScreen.tsx` | Improved detail loading and missing-record handling |
| `src/features/products/pages/ProductDetailsPage.tsx` | Added dedicated product details page implementation |
| `src/features/products/components/ProductCard.tsx` | Added reusable responsive product card |
| `src/features/products/hooks/useProduct.ts` | Added shared product detail loading behavior |
| `src/features/products/hooks/useProducts.ts` | Added shared product-list loading behavior |
| `src/components/common/SafeText.tsx` | Added safe text rendering support |
| `src/services/local/index.ts` | Added resilient product detail and CRUD behavior |
| `src/db/database.ts` | Updated database-related support required by product behavior |

The dedicated specification is retained at
`documents/PRODUCT_MANAGEMENT_REDESIGN.md`.

---

## Dashboard and Layout Improvements

- Updated the Dashboard to use clear desktop/mobile quick-action layouts.
- Added four-column desktop and two-column mobile dashboard grids.
- Preserved the existing Dashboard sections and sales data.
- Wired Dashboard stat cards and attention items to their existing routes.
- Added bottom-clearance layout calculations so content remains accessible
  above the mobile navigation.
- Updated the existing Sales navigation item to open the Sales area rather
  than duplicate navigation entries.

### Files changed

- `src/features/dashboard/DashboardScreen.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/feedback/States.tsx`
- `src/styles/global.css`
- `src/styles/tokens.css`

---

## Restock and Translation Updates

- Updated restock presentation and related behavior.
- Added a dedicated restock translation helper module.
- Preserved existing Restock Plan functionality and routes.
- Updated all three language resources where labels and UI behavior changed.

### Files changed

- `src/features/restock/RestockScreen.tsx`
- `src/features/restock/restockTranslations.ts`
- `src/i18n/locales/en/translation.json`
- `src/i18n/locales/ta/translation.json`
- `src/i18n/locales/hi/translation.json`

---

## Shared UI and Application Reliability

- Improved loading, empty, error, and not-found application states.
- Added reusable not-found recovery content.
- Added application and route-level ErrorBoundary behavior.
- Improved responsive forms, lists, cards, and dashboard layout.
- Added search input icon and form-input styling support.
- Updated translation resources used by the shared UI.

### Files changed

- `src/components/feedback/States.tsx`
- `src/components/common/Badges.tsx`
- `src/styles/global.css`
- `src/styles/tokens.css`
- `src/app/App.tsx`
- `src/app/router.tsx`

---

## Service, Database, and Data-Model Changes

- Updated the local product, sales, and supporting service implementations.
- Expanded service contracts for product detail and sales-history behavior.
- Added database support required by the newer product-management paths.
- Kept transaction storage in the existing IndexedDB/Dexie tables.
- Did not add fake sales, reset demo transactions, or overwrite existing data.
- Preserved existing demo data and clearly distinguished it through
  `demo: true` records and the Demo badge.

### Files changed

- `src/services/interfaces.ts`
- `src/services/local/index.ts`
- `src/db/database.ts`
- `src/domain/types/index.ts`

---

## Documentation and Build Output

- Added this change-history document under `documents/`.
- Existing product-management redesign documentation remains in
  `documents/PRODUCT_MANAGEMENT_REDESIGN.md`.
- Production builds regenerate the deployable output under `docs/`.
- Vite/PWA build output includes the Sales History lazy-loaded bundle.

---

## Validation Summary

| Check | Result |
|---|---|
| Sales route direct access | Passed |
| Dashboard **View all** navigation | Passed |
| Sales page refresh | Passed |
| Browser back navigation | Passed |
| Browser forward navigation | Passed |
| Sales data from existing IndexedDB records | Passed |
| Demo transaction distinction | Passed |
| TypeScript compilation | Passed |
| Production build | Passed |

## Known Boundaries

- The Sales page does not create or mutate transaction data.
- The Dashboard was not redesigned or replaced; only existing navigation was
  completed and existing layout improvements were retained.
- No duplicate Sales bottom-navigation item was added.
- Existing sales data is preserved.
