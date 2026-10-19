# KiranaIQ — Offline-First Inventory & Restocking Assistant

> **Smart Stock. Less Waste. Better Business.**

KiranaIQ is a Progressive Web App (PWA) designed for small kirana shops in India. It works completely offline, supports Tamil, English, and Hindi, and helps shopkeepers manage stock, record sales, receive purchases, track expiries, spot slow-moving items, and plan restocking within a budget.

---

## Problem Statement

Small kirana shops in rural and semi-rural India face:
- Paper-based or mental inventory tracking → errors, over/under-stocking
- No expiry tracking → waste from spoiled goods
- No sales analytics → slow movers tie up capital
- No budget-aware restocking → overspending or stockouts
- Unreliable internet → cloud apps fail
- Low digital literacy → complex UIs are unusable

KiranaIQ solves this with an **offline-first**, **multilingual**, **mobile-first** app that stores all data locally on the device.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Products & Inventory** | Add products with variants (pack sizes), selling price, cost, barcode, supplier, expiry tracking |
| **Record Sales** | Fast cart flow with search, quantity steppers, stock validation, receipt |
| **Receive Purchases** | Log incoming stock with batch codes & expiry dates |
| **Stock History** | Full ledger: opening, purchases, sales, returns, damage, expiry, corrections |
| **Expiry Alerts** | Expired / critical (≤⅓ window) / warning (≤ window) / upcoming batches |
| **Slow-Moving Detection** | Flags products with no recent sales; distinguishes new products from truly slow |
| **Restock Planner** | Budget-constrained greedy algorithm with pack-size rounding, priority scoring, transparent assumptions |
| **PIN Lock** | Optional 4–6 digit PIN with PBKDF2-SHA256 (210k iterations), inactivity lock, recovery |
| **Multilingual** | English, Tamil (தமிழ்), Hindi (हिन्दी) — full UI translation |
| **Themes** | Light / Dark / System — persisted, no flash |
| **PWA** | Installable, offline-capable, service worker, update prompt |
| **Backup/Restore** | Export/import full JSON backup (schema versioned, validated) |
| **Demo Mode** | Seeded synthetic data, clearly marked, one-click reset |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript (strict) |
| Build | Vite 6 |
| Routing | React Router 6 (createBrowserRouter + lazy routes) |
| State | React Context + hooks (no Redux) |
| Persistence | Dexie.js (IndexedDB) — replaceable adapter pattern |
| i18n | i18next + react-i18next (3 languages, bundled) |
| Validation | Zod (forms + service layer + backup) |
| Icons | Lucide React |
| Charts | Recharts (lazy-loaded, dashboard only) |
| Testing | Vitest + React Testing Library + fake-indexeddb |
| Lint/Format | ESLint 9 (flat) + Prettier |
| PWA | vite-plugin-pwa (Workbox generateSW) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / PWA                         │
├─────────────────────────────────────────────────────────────┤
│  Service Worker (Workbox) ──► Precached App Shell (static)  │
├─────────────────────────────────────────────────────────────┤
│  React App                                                    │
│  ├─ Providers (Settings, Theme, i18n, Toast, Lock, Services)│
│  ├─ Router (lazy routes)                                     │
│  ├─ Components (Layout, Common, Feedback, Forms)            │
│  └─ Features (Screens: Dashboard, Products, Sales, ...)     │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (Interfaces + Local Implementations)          │
│  ├─ ProductService, SalesService, PurchaseService, ...      │
│  ├─ Domain Logic (stock, alerts, restock — pure functions)  │
│  └─ Dexie Database (products, variants, sales, movements, ...)│
├─────────────────────────────────────────────────────────────┤
│  IndexedDB (business data)  ◄─── separate from SW cache     │
└─────────────────────────────────────────────────────────────┘
```

**Key Principles:**
- UI components depend only on service **interfaces** (in `src/services/interfaces.ts`)
- Business logic lives in pure domain functions (`src/domain/*`) — tested in isolation
- `Local*Service` implementations use Dexie; future `Sqlite*Service` can swap in
- API endpoints documented in `src/services/api/endpoints.ts` — **not called** by current app
- All user-visible text goes through i18n (`t('key')`) — never hardcoded

---

## Folder Structure

```
kirana-iq/
├── public/
│   ├── icons/               # PWA icons (192, 512, maskable)
│   ├── favicon.svg
│   └── offline.html
├── scripts/
│   ├── generate-icons.mjs   # Pure JS PNG writer
│   ├── check-translations.mjs
│   └── check-pwa.mjs
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API_CONTRACT.md
│   ├── DATA_MODEL.md
│   ├── UI_GUIDELINES.md
│   ├── PWA_GUIDE.md
│   ├── TEST_PLAN.md
│   └── SECURITY_PRIVACY.md
├── src/
│   ├── app/                 # App, Router, Providers
│   ├── components/
│   │   ├── common/          # Button, Card, Input, ConfirmDialog, ...
│   │   ├── layout/          # AppLayout, TopBar, BottomNav
│   │   ├── feedback/        # Toast, States, ConnectionStatus
│   │   └── forms/           # QuantityStepper
│   ├── features/
│   │   ├── onboarding/
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── sales/
│   │   ├── purchases/
│   │   ├── inventory/       # Movements
│   │   ├── expiry/
│   │   ├── slowMoving/
│   │   ├── restock/
│   │   ├── settings/
│   │   ├── install/
│   │   └── pin/
│   ├── hooks/               # useSettings, useToast, useLock, useOnlineStatus, ...
│   ├── i18n/                # index.ts + locales/en|ta|hi/translation.json
│   ├── services/
│   │   ├── interfaces.ts    # All service interfaces
│   │   ├── local/           # Dexie implementations
│   │   ├── pin/             # PBKDF2 PIN service
│   │   ├── api/endpoints.ts # Future API contracts
│   │   └── serviceFactory.ts
│   ├── db/                  # Dexie schema + seed
│   ├── domain/
│   │   ├── types/           # All TypeScript types
│   │   ├── money.ts         # Paise arithmetic + formatting
│   │   ├── dates.ts         # Date helpers + formatting
│   │   ├── inventory.ts     # Stock calc, alerts
│   │   ├── restock.ts       # Budget planner
│   │   └── validation.ts    # Zod schemas
│   ├── styles/
│   │   ├── tokens.css       # Design tokens (CSS variables)
│   │   ├── themes.css       # Light/dark theme overrides
│   │   └── global.css       # Reset + component classes
│   ├── test/                # Vitest setup + helpers
│   ├── main.tsx
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── eslint.config.js
├── .prettierrc.json
├── .gitignore
├── README.md
├── CHANGELOG.md
└── TODO.md
```

---

## Prerequisites

- **Node.js ≥ 20** (tested on v24)
- **npm ≥ 10** (or pnpm/yarn)
- Modern browser with IndexedDB & Service Worker support (Chrome, Edge, Firefox, Safari 15+)

---

## Installation

```bash
git clone <repo-url>
cd kirana-iq
npm install
```

---

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run Vitest suite (jsdom) |
| `npm run test:watch` | Watch mode |
| `npm run lint` | ESLint (flat config) |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check |
| `npm run typecheck` | `tsc -b` (no emit) |
| `npm run icons` | Generate PWA icons (public/icons) |
| `npm run check:translations` | Verify en/ta/hi key parity |
| `npm run check:pwa` | Validate dist/manifest + SW + icons |
| `npm run verify` | Full CI pipeline (typecheck+lint+test+build+checks) |

---

## PWA Installation

### Desktop / Android (Chrome, Edge)
1. Open the app in Chrome/Edge
2. Click `⋮` menu → **Install app** / **Add to Home screen**
3. Confirm — icon appears on home screen / app launcher

### iOS (Safari)
1. Open in Safari
2. Tap **Share** → **Add to Home Screen** → **Add**

### Offline Behavior
- After first load, the **entire app shell** is cached
- All features work offline: dashboard, products, sales, purchases, alerts, restock, settings
- Data is read/written to **IndexedDB** — no network required
- The offline indicator (top bar) shows device connectivity only; it does **not** mean the app is broken

### Updates
- When a new version is deployed, a banner appears: *"A new version is ready — Reload to update"*
- Clicking reloads the page; your local data is **never** affected

---

## Supported Languages

| Code | Language | Native Name |
|------|----------|-------------|
| `en` | English | English |
| `ta` | Tamil | தமிழ் |
| `hi` | Hindi | हिन्दी |

Change language in **Settings → Language** (immediate, no reload).

---

## Theme Configuration

| Option | Description |
|--------|-------------|
| **Light** | White background, purple accents |
| **Dark** | Deep navy background, purple accents |
| **System** | Follows OS `prefers-color-scheme` |

Change in **Settings → Appearance**. Preference is saved locally and applied before first paint (no flash).

---

## Mock Data & Reset

On first launch, the app seeds **synthetic demo data** for a typical kirana shop:
- 13 products across 8 categories (rice, snacks, biscuits, oil, dairy, beverages, personal care, household)
- ~18 variants with pack sizes, prices, costs
- Opening stock, purchases with batches (some expiring/expired), sales over 30 days
- All records tagged `demo: true` and show a **Demo** badge

**Reset Demo Data:** Settings → Data → Reset demo data (requires confirmation). This restores the original seeded dataset without affecting your PIN or preferences.

---

## Local Persistence

- **IndexedDB (Dexie)** stores all business data: products, variants, sales, movements, batches, plans, settings
- **Service Worker** caches only static assets (JS, CSS, HTML, icons, offline.html) — **not** business data
- PIN credentials stored separately in `pinCredentials` table (salted PBKDF2 verifier only)
- Data survives browser restart, offline launch, app updates

---

## Future Backend Integration Points

The service layer is interface-based. To connect a backend:

1. Implement `ProductService`, `SalesService`, … in `src/services/api/`
2. Configure `src/services/serviceFactory.ts` to use the new implementation
3. Endpoints are defined in `src/services/api/endpoints.ts`:

```
GET/POST   /products
GET/PATCH  /products/:id
GET        /inventory
POST       /stock-movements
POST       /sales
GET        /sales
POST       /purchases
GET        /alerts
GET        /expiry-batches
GET        /slow-moving-products
POST       /purchase-plans/preview
GET/PUT    /settings
GET        /health
```

**Current app does NOT call these endpoints.** They are documented contracts for future use.

---

## Future Capacitor / Android APK

KiranaIQ is designed for Capacitor packaging:

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init kirana-iq com.kirana.iq
npx cap add android
npm run build
npx cap sync android
```

**Migration notes:**
- IndexedDB → SQLite requires deliberate migration (data does **not** transfer automatically)
- A `Sqlite*Service` adapter implementing the same interfaces is needed
- PIN credentials must be re-entered or migrated separately
- Documented in `docs/ARCHITECTURE.md`

---

## Known Limitations

| Limitation | Notes |
|------------|-------|
| PIN security | Client-side only; protects against casual access, not a determined attacker with device access |
| Expiry dates | Uses device local date (`YYYY-MM-DD`); timezone differences across devices not handled |
| No multi-device sync | Data lives on one device; backup/restore is manual |
| No barcode scanner | Camera-based scanning not implemented (optional future) |
| Single-user | No role-based access or multi-user support |
| No cloud backup | Export/import is manual file-based |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| App won't load / white screen | Close private/incognito mode (blocks IndexedDB) |
| "Could not open local database" | Allow storage permission; disable private mode |
| Install button doesn't appear | Requires HTTPS (or localhost); try Chrome; disable private mode |
| Data lost after update | Never happens — IndexedDB is separate from SW cache; if it did, use Settings → Import backup |
| Tamil/Hindi not rendering | Ensure device has Noto Sans Tamil / Nirmala UI fonts (most Androids do) |

---

## Version & Status

**Current:** `0.1.0` — Feature-complete frontend prototype (all 13 screens + PIN + PWA)

**Links:**
- [CHANGELOG.md](CHANGELOG.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API Contract](docs/API_CONTRACT.md)
- [Data Model](docs/DATA_MODEL.md)
- [UI Guidelines](docs/UI_GUIDELINES.md)
- [PWA Guide](docs/PWA_GUIDE.md)
- [Test Plan](docs/TEST_PLAN.md)
- [Security & Privacy](docs/SECURITY_PRIVACY.md)