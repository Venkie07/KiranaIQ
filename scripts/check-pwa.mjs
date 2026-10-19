import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'docs');

const required = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
];

let ok = true;
for (const f of required) {
  const p = join(dist, f);
  if (!existsSync(p)) {
    console.error(`✗ Missing ${f}`);
    ok = false;
  } else {
    console.log(`✓ ${f}`);
  }
}

if (existsSync(join(dist, 'manifest.webmanifest'))) {
  const manifest = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
  const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
  for (const f of requiredFields) {
    if (!manifest[f]) {
      console.error(`✗ manifest missing ${f}`);
      ok = false;
    } else {
      console.log(`✓ manifest.${f}`);
    }
  }
  if (manifest.icons) {
    const sizes = manifest.icons.map((i) => i.sizes).join(', ');
    console.log(`✓ icons: ${sizes}`);
    const maskable = manifest.icons.some((i) => i.purpose?.includes('maskable'));
    console.log(maskable ? '✓ maskable icon present' : '✗ maskable icon missing');
    ok = ok && maskable;
  }
}

if (existsSync(join(dist, 'sw.js'))) {
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  if (sw.includes('workbox')) {
    console.log('✓ SW contains workbox');
  } else {
    console.warn('⚠ SW may not use workbox');
  }
}

const icons = ['icon-192.png', 'icon-512.png', 'maskable-512.png'];
for (const ic of icons) {
  if (!existsSync(join(dist, 'icons', ic))) {
    console.error(`✗ Missing icon ${ic} in dist`);
    ok = false;
  } else {
    console.log(`✓ dist/icons/${ic}`);
  }
}

if (!ok) {
  console.error('\nPWA check FAILED');
  process.exit(1);
}
console.log('\nPWA check PASSED');