# Changelog

All notable changes to KiranaIQ are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.0] - 2026-10-19

### Added
- **Foundation**: Vite 6 + React 18 + TypeScript strict, React Router 6, i18next (en/ta/hi), Dexie 4, Zod, Lucide React, Recharts
- **PWA**: vite-plugin-pwa with Workbox generateSW, manifest, service worker, offline fallback, install prompt, update prompt
- **Design System**: CSS custom properties (tokens + themes), mobile-first responsive, 48px touch targets, system font stack with Tamil/Devanagari fallbacks
- **PIN Lock**: Optional 4–6 digit PIN, PBKDF2-SHA256 (210k iterations), salted verifier only, inactivity lock (immediate/1/5/15 min), recovery flow, no business data deletion on reset
- **Multilingual UI**: 477 keys × 3 languages (English, Tamil, Hindi) with parity check script
- **Inventory**: Products with variants, categories, units, expiry tracking, reorder threshold, stock ledger (movements), batches
- **Sales**: Cart flow, search, quantity stepper, stock validation (usable stock), receipt, duplicate-submission guard
- **Purchases**: Receive stock with batch code/expiry, supplier, cost, review-confirm
- **Stock History**: Ledger with type/date filters, corrections (append-only, original preserved)
- **Expiry Alerts**: Expired / critical / warning / upcoming; configurable warning window (7/14/30/60/90 days)
- **Slow-Moving**: Flags products with no recent sales; distinguishes new products (insufficient history)
- **Restock Planner**: Budget-constrained greedy, pack-size rounding, priority scoring, reason codes, never exceeds budget, assumptions documented
- **Settings**: Language, theme, shop name, expiry window, reorder threshold, slow-moving window, restock lookback, backup export/import, demo reset
- **Backup/Restore**: Schema-versioned JSON, full validation before import, transactional replace
- **Install/Offline Help**: Browser-specific instructions (Chrome, iOS, desktop), offline explanation, troubleshooting
- **Tests**: Domain (stock, restock, alerts, validation), i18n parity, services (Dexie + fake-indexeddb), UI (navigation, language, theme, forms, PIN)
- **Documentation**: README, ARCHITECTURE, API_CONTRACT, DATA_MODEL, UI_GUIDELINES, PWA_GUIDE, TEST_PLAN, SECURITY_PRIVACY

### Changed
- N/A (initial release)

### Fixed
- N/A (initial release)

### Removed
- N/A (initial release)

---

## [Unreleased]

### Planned
- Barcode scanner (camera)
- Voice input (Web Speech API)
- On-device demand forecasting (simple ML)
- Capacitor Android build with SQLite adapter
- Multi-device sync via local Wi-Fi / QR code
- Customer credit ledger
- GST invoice generation