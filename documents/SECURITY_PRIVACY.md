# Security & Privacy Documentation

## Threat Model

KiranaIQ is an **offline-first** app for small shop owners. The primary threats are:

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Casual access by staff/family | High | Medium | Optional PIN lock |
| Device theft/loss | Medium | High | PIN + no cloud sync |
| Malicious app on same device | Low | Medium | No sensitive permissions |
| Backup file leakage | Low | High | User-controlled export/import |
| Supply chain (npm) | Low | High | Locked deps, minimal deps |

**Out of scope:** Nation-state actors, rooted devices, hardware attacks.

---

## PIN Lock Implementation

### Cryptographic Design

| Property | Value |
|----------|-------|
| Algorithm | PBKDF2-HMAC-SHA256 |
| Iterations | 210,000 |
| Salt | 16 bytes (cryptographically random) |
| Derived key | 32 bytes (256 bits) |
| Storage | `pinCredentials` table (IndexedDB) |
| Format | `{ salt, verifier, iterations, createdAt }` — **no plaintext PIN** |

### Verification Flow

```
User enters PIN
       │
       ▼
PBKDF2(pin, stored_salt, 210000) → derived_key
       │
       ▼
timingSafeEqual(derived_key, stored_verifier)
       │
       ├── YES → unlock, reset attempt counter
       └── NO  → increment counter, set lockout delay
```

### Attempt Lockout

| Failed Attempts | Delay |
|-----------------|-------|
| 1–2 | None |
| 3 | 1 second |
| 4 | 2 seconds |
| 5 | 4 seconds |
| 6 | 8 seconds |
| 7+ | 16 seconds (capped at 30s) |

**Note:** Counter is in-memory only (not tamper-proof). Page reload resets delay — documented in UI.

### PIN Setup / Change / Reset

| Action | Requirements |
|--------|--------------|
| **Enable** | 4–6 digits, confirmed twice, explains scope |
| **Change** | Current PIN verified, new PIN 4–6 digits, confirmed |
| **Disable** | Current PIN verified, explains data stays |
| **Forgot PIN** | Explicit confirmation: "PIN removed, data kept" |

### What PIN Protects

- Opens the app to business data (products, sales, purchases, reports)
- Prevents casual viewing when phone handed to others

### What PIN Does NOT Protect

- Device-level access (use phone lock screen)
- Data extraction via USB/ADB on unlocked device
- Backup files exported by user (plaintext JSON)
- Malware with root/ADB access

---

## Data Storage

| Data | Location | Encryption |
|------|----------|------------|
| Business data (products, sales, etc.) | IndexedDB (Dexie) | None (browser-managed) |
| PIN credential | IndexedDB (separate table) | PBKDF2 verifier only |
| Settings | IndexedDB | None |
| Backup export | User filesystem (JSON) | None (user responsibility) |
| Service Worker cache | Browser Cache API | None (static assets only) |

**Key Principle:** Business data and PIN credentials are in **separate IndexedDB object stores**. Resetting PIN never touches business tables.

---

## Network & Permissions

| Capability | Used? | Details |
|------------|-------|---------|
| Network fetch | ❌ No | No API calls; all local |
| Geolocation | ❌ No | Not requested |
| Camera | ❌ No | Not requested (future: barcode scanner) |
| Microphone | ❌ No | Not requested (future: voice input) |
| Clipboard | ❌ No | Not used |
| Notifications | ❌ No | Not used |
| Bluetooth | ❌ No | Not used |
| USB/Serial | ❌ No | Not used |

**Content Security Policy:** Not needed (no inline scripts, no external resources). Vite builds with nonce-based CSP optional.

---

## Backup & Restore Security

### Export
- Generates JSON with **all business data + settings**
- Includes `demoDataIncluded` flag and record count
- File saved to user's Downloads folder
- **No encryption** — user must protect the file

### Import
- Full schema validation via Zod (`backupFileSchema`)
- **Rejects** invalid/malformed files before any write
- **Transactional replace:** all business tables cleared + bulk insert in single Dexie transaction
- Partial failure → rollback (no partial state)
- Settings merged (PIN credential untouched)

### Best Practices for Users
1. Store backup files on encrypted storage (phone encryption + cloud encryption)
2. Don't share backup files via unencrypted channels
3. Verify import success (toast shows record counts)

---

## PWA Security

| Aspect | Implementation |
|--------|----------------|
| Service Worker | `generateSW` with `clientsClaim: true`, `cleanupOutdatedCaches: true` |
| Register Type | `prompt` (manual via `virtual:pwa-register`) |
| Update | User-initiated reload only (`onNeedRefresh`) |
| Offline Fallback | `offline.html` (static, no dynamic content) |
| HTTPS | Required for install; localhost exempt |
| Scope | `/` (entire origin) |

---

## Privacy by Design

| Principle | Implementation |
|-----------|----------------|
| **Data Minimization** | Only shop inventory data collected; no user accounts, no analytics, no tracking |
| **Local-First** | All data stays on device; no cloud sync |
| **User Control** | Export/import/reset fully user-initiated |
| **Transparency** | All user-visible text translatable; no hidden telemetry |
| **No Third Parties** | Zero external requests (fonts, CDNs, analytics) |
| **Offline by Default** | Works without any network connection |

---

## Known Limitations & Residual Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PIN brute-force (offline) | Medium | 210k PBKDF2 iterations; 4–6 digit PIN = 10⁴–10⁶ space; ~minutes to hours on GPU |
| Backup file theft | Low | User education; phone encryption |
| IndexedDB corruption | Low | Dexie transactions; backup/restore |
| Private mode blocks storage | Medium | Detected at startup; user guided to disable |
| iOS PWA limitations | Medium | Manual install instructions provided |
| No remote wipe | N/A | By design (offline-first) |

---

## Compliance Notes

| Regulation | Applicability | Status |
|------------|---------------|--------|
| GDPR | If EU users | No personal data collected; only business inventory |
| India DPDP Act | If Indian users | No personal data; shop name optional |
| PCI DSS | If payments added | Not applicable (no payment processing) |
| HIPAA | Not applicable | No health data |

---

## Incident Response (For Developers)

If a vulnerability is discovered:

1. **Patch** the affected module (domain/service/UI)
2. **Bump version** in `package.json`
3. **Document** in `CHANGELOG.md` under `[Unreleased]`
4. **Release** new build; PWA update prompt notifies users
5. **No user data migration** needed (local-only)

---

## Security Checklist for Contributors

- [ ] No `eval`, `Function`, `dangerouslySetInnerHTML`
- [ ] All user input validated via Zod (forms + services + backup)
- [ ] No secrets in code (API keys, passwords)
- [ ] PIN logic only in `src/services/pin/pinService.ts`
- [ ] Crypto uses `crypto.subtle` (Web Crypto API)
- [ ] Timing-safe comparison for PIN verification
- [ ] New dependencies audited (`npm audit`)
- [ ] Tests cover new validation/error paths