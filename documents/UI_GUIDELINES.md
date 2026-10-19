# UI Guidelines

## Design Philosophy

KiranaIQ targets **small shop owners in rural/semi-rural India** with:
- Limited digital literacy
- Low-end Android phones (2GB RAM, small screens)
- Unreliable internet
- Preference for Tamil, English, or Hindi

**Core tenets:**
1. **Simple over clever** — no hidden gestures, no complex menus
2. **Fast over pretty** — minimal JS, lazy-loaded charts, no animations that block interaction
3. **Accessible by default** — 48px touch targets, visible focus, screen-reader labels
4. **Offline-first** — every action works without network
5. **Trustworthy** — clear confirmations, no silent failures, audit trail visible

---

## Color System (CSS Custom Properties)

### Light Theme (Default)
```css
--color-primary: #6D28D9;        /* Purple */
--color-primary-hover: #5B21B6;
--color-background: #FFFFFF;
--color-surface: #F8F7FC;
--color-surface-raised: #FFFFFF;
--color-text: #1F1635;
--color-text-muted: #6B647A;
--color-border: #E7E1F0;
--color-success: #15803D;        /* Green */
--color-warning: #B45309;        /* Amber */
--color-danger: #B91C1C;         /* Red */
```

### Dark Theme
```css
--color-primary: #A78BFA;
--color-primary-hover: #C4B5FD;
--color-background: #0B1020;     /* Deep navy */
--color-surface: #111A30;
--color-surface-raised: #18233D;
--color-text: #F4F3FF;
--color-text-muted: #B6BED3;
--color-border: #293653;
--color-success: #4ADE80;
--color-warning: #FBBF24;
--color-danger: #F87171;
```

**Usage Rule:** Components **must** use `var(--color-*)` — never hardcode hex values.

---

## Typography

### Font Stack (System Only — No Web Fonts)
```css
--font-sans:
  system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
  'Noto Sans', 'Noto Sans Tamil', 'Noto Sans Devanagari',
  'Latha', 'Nirmala UI', 'Mangal', 'Kokila', sans-serif;
```

### Scale
| Token | Size | Use Case |
|-------|------|----------|
| `--text-xs` | 0.75rem | Labels, hints, timestamps |
| `--text-sm` | 0.875rem | Body text, form labels |
| `--text-base` | 1rem | Primary content, inputs |
| `--text-lg` | 1.125rem | Section titles |
| `--text-xl` | 1.375rem | Page headers |
| `--text-2xl` | 1.75rem | Dashboard stats |
| `--text-3xl` | 2.125rem | Onboarding logo text |

### Tamil/Devanagari Rendering
- Test on Android Chrome with `Noto Sans Tamil` / `Nirmala UI`
- Fallback chain ensures glyphs never show as tofu (□)
- Line height 1.5 accommodates diacritics

---

## Spacing & Layout

### Spacing Scale
```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;
--space-4: 16px;  --space-5: 24px;  --space-6: 32px;
--space-7: 48px;
```

### Border Radius
```css
--radius-sm: 8px;    --radius-md: 12px;
--radius-lg: 16px;   --radius-full: 999px;
```

### Touch Targets
- **Minimum 48×48 CSS pixels** for all interactive elements
- Buttons, steppers, keypad keys, tabs all meet this
- `min-height: var(--touch-target)` on all buttons

### Safe Areas
```css
padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + var(--space-5));
```
Respects notches, home indicators, navigation bars.

---

## Component Patterns

### Buttons
| Variant | Class | Use Case |
|---------|-------|----------|
| Primary | `.btn--primary` | Main CTA (Save, Confirm, Add) |
| Secondary | `.btn--secondary` | Alternative (Cancel, Back) |
| Ghost | `.btn--ghost` | Subtle (Clear, View All) |
| Danger | `.btn--danger` | Destructive (Delete, Reset) |
| Block | `.btn--block` | Full-width mobile CTAs |

**States:** `:hover`, `:focus-visible`, `:disabled` (opacity 0.55, not-allowed cursor)

### Form Fields
```html
<label class="field">
  <span class="field__label">Label <span class="muted">(optional)</span></span>
  <input class="input" ... />
  <span class="field__hint">Helper text</span>
  <span class="field__error" id="err-name">Error message</span>
</label>
```
- `aria-invalid="true"` + `aria-describedby="err-name"` on error
- Required fields: `(required)` in label (translated)
- Values preserved on validation failure

### Cards
```html
<div class="card">
  <h2 class="card__title">Title <span class="badge">Count</span></h2>
  <div class="stack">...</div>
</div>
```
- White/raised surface, subtle border, 12px radius
- `card-list-only` (mobile) / `table-wrap` (desktop ≥768px) via CSS

### Badges (Status — Never Color Alone)
| Status | Class | Icon + Text |
|--------|-------|-------------|
| OK / In Stock | `.badge--ok` | ✓ In stock |
| Low / Warning | `.badge--low` / `.badge--warning` | ⚠ Low stock |
| Out / Danger | `.badge--out` / `.badge--danger` | ✗ Out of stock |
| Demo | `.badge--demo` | ℹ Demo |
| Neutral | `.badge--neutral` | Info |

### Empty / Error / Loading States
```tsx
<EmptyState title={t('states.emptyTitle')} body={t('states.noResults')} action={<Button />} />
<ErrorState errorKey="errors.dbInit" onRetry={load} />
<LoadingState label={t('states.loading')} />
```
- Consistent spacing, centered, retry button where recoverable

### Dialogs (ConfirmDialog)
- `role="dialog" aria-modal="true" aria-labelledby="title"`
- Focus trapped, Escape closes, first button focused
- `busy` prop disables buttons, shows loading text

---

## Navigation

### Mobile (≤899px)
- **Bottom Nav** (fixed): Home, Products, Sell, Restock, Settings
- Center accent button for "Record Sale"
- Top bar: Brand + Offline indicator

### Desktop (≥900px)
- **Sidebar** (collapsible) with all sections
- Top bar for brand/theme/language
- Sub-nav row for secondary screens (Movements, Expiry, Slow-Moving, Install)

### Onboarding Gate
- `/onboarding` shown until `settings.onboardingComplete = true`
- Redirects to `/` after completion

### PIN Lock Gate
- If enabled & locked → full-screen PIN entry
- Activity resets inactivity timer
- Never blocks active usage

---

## Internationalization

### Key Rules
1. **Never hardcode user text** — always `t('key')`
2. **Namespace keys** — `common.save`, `products.addProduct`, `validation.nameMin`
3. **Pluralization** — use ICU-style in JSON (`key_one` / `key_other`) where needed; otherwise neutral phrasing (`{{count}} items`)
4. **Date/Number** — `Intl.DateTimeFormat` / `Intl.NumberFormat` with locale map:
   - `en` → `en-IN`
   - `ta` → `ta-IN`
   - `hi` → `hi-IN`
5. **Currency** — always INR (₹), formatted per locale

### Translation Files
```
src/i18n/locales/
  en/translation.json   (canonical)
  ta/translation.json
  hi/translation.json
```
- Parity enforced by `scripts/check-translations.mjs` (CI)
- Dev warning on missing keys via `parseMissingKeyHandler`

---

## Accessibility Checklist

| Requirement | Implementation |
|-------------|----------------|
| **Keyboard navigation** | All interactive elements reachable, visible `:focus-visible` |
| **Screen readers** | `role`, `aria-label`, `aria-live="polite"` (toasts), `aria-describedby` (errors) |
| **Touch targets** | ≥48px, verified in CSS |
| **Color contrast** | WCAG AA verified for all token pairs |
| **Reduced motion** | `@media (prefers-reduced-motion)` disables transitions/skeleton shimmer |
| **Language** | `lang` attr on `<html>`, `dir` auto for RTL not needed |
| **Form labels** | Every input has `<label>` or `aria-label` |

---

## Responsive Breakpoints

| Breakpoint | Target | Layout Changes |
|------------|--------|----------------|
| `< 480px` | Small phones | Single-column cards, full-width buttons |
| `480–767px` | Large phones | Card grid 2-col, bottom nav |
| `768–899px` | Tablets | Table view enabled, sidebar optional |
| `≥ 900px` | Desktop | Full sidebar, multi-col grids |

---

## Performance Budgets

| Metric | Target |
|--------|--------|
| Initial JS (gzipped) | < 150 KB |
| Largest Contentful Paint | < 2.5s (3G) |
| Time to Interactive | < 3.5s (3G) |
| Chart chunk (Recharts) | Lazy, < 80 KB |
| Service Worker cache | < 5 MB total |

---

## Anti-Patterns to Avoid

| ❌ Don't | ✅ Do |
|----------|-------|
| Hardcode colors | Use `var(--color-*)` |
| Hardcode text | Use `t('key')` |
| Icon-only buttons | Icon + text, or `aria-label` |
| Dense tables on mobile | Card list with CSS switch |
| Auto-play audio | User-initiated only |
| Silent failures | Toast + inline error + retry |
| Reset form on error | Preserve values, show inline error |
| Blocking animations | CSS-only, respect `prefers-reduced-motion` |
| LocalStorage for business data | IndexedDB (Dexie) |