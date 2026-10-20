#!/usr/bin/env node
/**
 * Translation parity checker.
 *
 * Verifies that en/ta/hi translation.json files contain exactly the same
 * key paths. Exits non-zero on any mismatch so CI / `npm run
 * check:translations` fails loudly.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const locales = ['en', 'ta', 'hi','kn'];

function flatten(obj, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, full, out);
    } else {
      out.add(full);
    }
  }
  return out;
}

const keysets = new Map();
for (const locale of locales) {
  const file = path.join(root, 'src', 'i18n', 'locales', locale, 'translation.json');
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`✗ Cannot read ${file}: ${err.message}`);
    process.exit(1);
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error(`✗ ${locale}/translation.json is not valid JSON: ${err.message}`);
    process.exit(1);
  }
  keysets.set(locale, flatten(json));
}

const reference = keysets.get('en');
let failed = false;

for (const locale of locales) {
  const keys = keysets.get(locale);
  const missing = [...reference].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !reference.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`✗ ${locale}: ${missing.length} missing, ${extra.length} extra key(s)`);
    for (const k of missing) console.error(`    missing: ${k}`);
    for (const k of extra) console.error(`    extra:   ${k}`);
  }
}

// Detect empty translations (translated value equal to nothing).
for (const locale of locales) {
  const raw = JSON.parse(
    readFileSync(path.join(root, 'src', 'i18n', 'locales', locale, 'translation.json'), 'utf8'),
  );
  const check = (obj, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const full = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object') check(value, full);
      else if (typeof value === 'string' && value.trim() === '') {
        failed = true;
        console.error(`✗ ${locale}: empty translation for ${full}`);
      }
    }
  };
  check(raw);
}

if (failed) {
  console.error('\nTranslation check FAILED.');
  process.exit(1);
}
console.log(`✓ Translations OK: ${reference.size} keys × ${locales.length} languages.`);
