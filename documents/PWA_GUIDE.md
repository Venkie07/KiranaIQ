# PWA Guide

## Overview

KiranaIQ is a **Progressive Web App** built with Vite + `vite-plugin-pwa` (Workbox). It meets all Chrome/Android installability criteria and works fully offline after first load.

## Manifest Configuration

```typescript
// vite.config.ts → VitePWA({ manifest: { ... } })
{
  name: 'KiranaIQ — Inventory & Restocking Assistant',
  short_name: 'KiranaIQ',
  description: 'Offline-first multilingual inventory...',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: '#6D28D9',
  background_color: '#FFFFFF',
  lang: 'en',
  categories: ['business', 'productivity'],
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}
```

## Service Worker (Workbox generateSW)

| Feature | Config |
|---------|--------|
| **Strategy** | `generateSW` (precache manifest) |
| **Register Type** | `prompt` (manual registration via `virtual:pwa-register`) |
| **Precache** | All build output (`**/*.{js,css,html,svg,png,woff2}`) + `offline.html` |
| **Navigate Fallback** | `/index.html` (SPA shell) |
| **Fallback Denylist** | `/offline.html` (served directly) |
| **Cleanup** | `cleanupOutdatedCaches: true` |
| **Clients Claim** | `true` (immediate control) |

## Offline Behavior

| Asset | Cached By | Available Offline |
|-------|-----------|-------------------|
| App shell (HTML/JS/CSS) | SW precache | ✅ Yes |
| Icons / favicon | SW precache | ✅ Yes |
| `offline.html` | SW precache | ✅ Yes |
| Translation JSON | Bundled in JS | ✅ Yes |
| IndexedDB data | Browser storage | ✅ Yes |
| External APIs | N/A (none) | N/A |

**What Works Offline:**
- Dashboard, Products, Sales, Purchases, Movements, Expiry, Slow-Moving, Restock, Settings
- Language/Theme changes (saved to IndexedDB)
- Backup export/import
- PIN lock/unlock

**What Requires Online:**
- First load (SW registration + precache)
- PWA install prompt (`beforeinstallprompt`)
- App updates (SW detects new version)

## Installation Flow

### Desktop / Android (Chrome, Edge, Firefox)
1. User visits app over HTTPS (or localhost)
2. Browser fires `beforeinstallprompt` → captured by `useInstallPrompt` hook
3. UI shows **"Install App"** button (only after user interaction)
4. User clicks → `prompt()` called → native install dialog
5. On accept → `appinstalled` event → UI updates to "Already installed"

### iOS (Safari)
- No `beforeinstallprompt` → `state = 'unsupported'`
- UI shows **manual steps**: Share → Add to Home Screen → Add
- Runs in standalone when launched from home screen

### Install Button Logic (`useInstallPrompt`)
```typescript
// Captures event, prevents default
// Shows button only when: event exists AND not dismissed AND not standalone
// On click: await deferred.prompt(); await userChoice;
// On dismiss: localStorage.setItem('kiranaiq.installDismissed', '1')
```

**No Nagging:** Dismissed prompt remembered in `localStorage`; manual instructions shown instead.

## Update Flow

```typescript
// vite-plugin-pwa registerType: 'prompt'
// virtual:pwa-register → registerSW({ immediate: true, onNeedRefresh })
```

1. New deployment → SW detects new `manifest.webmanifest`
2. `onNeedRefresh` fires → `updateReady = true`
3. Banner appears: *"A new version is ready — Reload to update"*
4. User clicks **"Update now"** → `updateSW(true)` → hard reload
5. **Never** auto-reloads mid-transaction (user controls timing)

## Icon Generation

**Script:** `scripts/generate-icons.mjs` (pure Node, zero deps)

```bash
npm run icons
```

Generates:
| File | Size | Purpose |
|------|------|---------|
| `public/icons/icon-192.png` | 192×192 | Any |
| `public/icons/icon-512.png` | 512×512 | Any |
| `public/icons/maskable-192.png` | 192×192 | Maskable |
| `public/icons/maskable-512.png` | 512×512 | Maskable |
| `public/apple-touch-icon.png` | 180×180 | iOS home screen |
| `public/favicon.svg` | 32×32 | Browser tab |

**Design:** Purple rounded square (#6D28D9) with white shopping-bag glyph. Maskable versions use 80% safe zone.

## Verification Checklist (`npm run check:pwa`)

```bash
# After npm run build
node scripts/check-pwa.mjs
```

Validates:
- ✅ `dist/manifest.webmanifest` exists with required fields
- ✅ `dist/sw.js` contains Workbox
- ✅ Icons present in `dist/icons/`
- ✅ Maskable icon declared in manifest
- ✅ `offline.html` precached

## HTTPS Requirement

| Environment | Installable? |
|-------------|--------------|
| `localhost` | ✅ Yes (treated as secure) |
| `127.0.0.1` | ✅ Yes |
| `https://yourdomain.com` | ✅ Yes |
| `http://yourdomain.com` | ❌ No (Service Worker requires secure context) |
| Private/Incognito | ⚠️ Limited (storage blocked) |

## Capacitor / Android Migration Path

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init kirana-iq com.kirana.iq
npx cap add android
npm run build
npx cap sync android
```

### Key Changes Needed

| Area | Web (PWA) | Android (Capacitor) |
|------|-----------|---------------------|
| Storage | IndexedDB (Dexie) | SQLite (`@capacitor-community/sqlite`) |
| Icons | `public/icons/` | `android/app/src/main/res/` |
| Manifest | `manifest.webmanifest` | `AndroidManifest.xml` |
| Updates | SW + banner | Play Store / in-app update API |
| Permissions | None | `INTERNET`, `STORAGE` (for backup) |

### Data Migration Strategy

1. On first Capacitor run, check for existing IndexedDB data
2. If found → run migration script: read Dexie → write SQLite
3. Delete IndexedDB after successful migration
4. PIN credentials: user re-enters (or separate migration)

Documented in `docs/ARCHITECTURE.md` → "Future Capacitor / Android Migration"

## Testing PWA Locally

```bash
npm run build
npm run preview  # Serves dist/ on http://localhost:4173
```

Test in Chrome DevTools:
- **Application → Manifest** — verify fields
- **Application → Service Workers** — "Offline" checkbox, "Update on reload"
- **Network → Offline** — reload, verify app works
- **Lighthouse → PWA** — score > 90

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Install button never appears | HTTP (not HTTPS), private mode, already installed | Use HTTPS/localhost; disable private mode |
| SW not registering | `registerType: 'prompt'` + manual registration | Ensure `registerSW` called in `main.tsx` |
| Offline page not shown | `navigateFallbackDenylist` misconfigured | Check `vite.config.ts` Workbox config |
| Icons missing in dist | `generate-icons` not run | Run `npm run icons` before build |
| Update banner never shows | `registerType: 'autoUpdate'` instead of `'prompt'` | Use `'prompt'` + `onNeedRefresh` |

## Resources

- [Web App Manifest Spec](https://w3c.github.io/manifest/)
- [Workbox generateSW](https://developer.chrome.com/docs/workbox/modules/workbox-build/)
- [vite-plugin-pwa Docs](https://vite-pwa-org.netlify.app/)
- [PWA Install Criteria](https://web.dev/install-criteria/)
- [Maskable Icons](https://web.dev/maskable-icon/)