# Architecture Documentation

## System Overview

KiranaIQ is an offline-first Progressive Web App built with React 18, TypeScript, and Vite. The architecture follows a **clean separation of concerns** with distinct layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Browser / PWA Runtime                       │
├─────────────────────────────────────────────────────────────────┤
│  Service Worker (Workbox) ──► Static Asset Cache (JS/CSS/HTML)  │
├─────────────────────────────────────────────────────────────────┤
│  React Application                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │  Providers  │ │   Router    │ │ Components  │ │ Features  │ │
│  │ (Context)   │ │ (Lazy)      │ │ (Common)    │ │ (Screens) │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer (Interfaces + Local Implementations)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Product  │ │  Sales   │ │ Purchase │ │ Movement │ ...      │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  Domain Logic (Pure Functions)                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Money   │ │  Dates   │ │Inventory │ │ Restock  │          │
│  │ (paise)  │ │ (format) │ │ (stock)  │ │ (plan)   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  Persistence (Dexie / IndexedDB)                                │
│  products | variants | sales | movements | batches | plans ... │
├─────────────────────────────────────────────────────────────────┤
│  IndexedDB (Business Data)  ◄─── Separate from SW Cache        │
└─────────────────────────────────────────────────────────────────┘
```

## Component Boundaries

### UI Layer (`src/components/`, `src/features/`)
- **Presentational only** — no business logic
- Receive data via props or hooks
- Call service methods through `useServices()` hook
- All user-visible text via `useTranslation()` → `t('key')`

### Service Layer (`src/services/`)
- **Interfaces** in `src/services/interfaces.ts` — contracts only
- **Local implementations** in `src/services/local/index.ts` — Dexie + domain logic
- **Factory** in `src/services/serviceFactory.ts` — singleton access + test override
- **Future API** contracts in `src/services/api/endpoints.ts` (not called)

### Domain Layer (`src/domain/`)
- **Pure TypeScript functions** — no React, no side effects
- Fully testable in isolation (Vitest)
- `money.ts`, `dates.ts`, `inventory.ts`, `restock.ts`, `validation.ts`

### Persistence (`src/db/`)
- `database.ts` — Dexie schema (versioned)
- `seed.ts` — deterministic synthetic data

### Localization (`src/i18n/`)
- `index.ts` — i18next init + language switching
- `locales/{en,ta,hi}/translation.json` — 477 keys each, parity enforced

## Data Flow

```
User Action (click, input)
       │
       ▼
Event Handler (in Feature Component)
       │
       ▼
Service Method (via useServices hook)
       │
       ├──► Domain Logic (pure calculation)
       │
       ▼
Dexie Transaction (atomic write)
       │
       ▼
React Query / Live Query (dexie-react-hooks) → Re-render
```

## PWA Lifecycle

1. **First Visit** → Service worker registers, precaches app shell
2. **Install Prompt** → `beforeinstallprompt` captured → user clicks "Install"
3. **Offline** → SW serves cached shell; IndexedDB serves business data
4. **Update** → SW detects new version → `onNeedRefresh` → banner → user reloads
5. **Revisit** → Instant load from cache; background sync for updates

## Security & Data Integrity

| Concern | Mitigation |
|---------|------------|
| PIN storage | PBKDF2-SHA256 (210k iters), salted, verifier only |
| Data validation | Zod schemas at form + service + backup layers |
| Import safety | Full schema validation before transactional replace |
| XSS | React auto-escapes; no `dangerouslySetInnerHTML` |
| Storage limits | IndexedDB quota (typically 50MB+); user prompted if full |
| Private mode | Detected at startup; user guided to disable |

## Future Capacitor / Android Migration

```
Current (Browser)                    Future (Capacitor Android)
─────────────────────                ─────────────────────────
Dexie (IndexedDB)          ──►       SQLite (capacitor-sqlite)
Service Worker             ──►       Native WebView + native plugins
PWA Manifest               ──►       AndroidManifest.xml + icons
IndexedDB data             ──►       Migration script (one-time)
```

**Migration Strategy:**
1. Add `Sqlite*Service` implementing same interfaces
2. Write migration tool: read Dexie → write SQLite (schema mapping)
3. On first Capacitor run, detect Dexie data → migrate → delete Dexie
4. PIN credentials re-entered or migrated separately
5. Documented in `docs/PWA_GUIDE.md`