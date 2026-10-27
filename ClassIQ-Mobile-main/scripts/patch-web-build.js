/**
 * Patches dist/index.html after expo export — PWA + Safari/iOS support.
 * Run: npm run build:web
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const distHtml = path.join(distDir, 'index.html');
const publicDir = path.join(__dirname, '..', 'public');
const assetsDir = path.join(__dirname, '..', 'assets');
const iconSrc = path.join(assetsDir, 'user-verification.png');

if (!fs.existsSync(distHtml)) {
  console.error('dist/index.html not found. Run: npx expo export --platform web');
  process.exit(1);
}

if (!fs.existsSync(iconSrc)) {
  console.error('assets/user-verification.png not found.');
  process.exit(1);
}

let html = fs.readFileSync(distHtml, 'utf8');

function stripPwaTags(source) {
  return source
    .replace(/<link rel="manifest"[^>]*>\s*/gi, '')
    .replace(/<link rel="apple-touch-icon[^>]*>\s*/gi, '')
    .replace(/<link rel="icon"[^>]*>\s*/gi, '')
    .replace(/<meta name="apple-mobile-web-app[^"]*"[^>]*>\s*/gi, '')
    .replace(/<meta name="theme-color"[^>]*>\s*/gi, '');
}

// iOS looks for /apple-touch-icon.png at the site root when adding to Home Screen
const pwaHead = `
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#1A73E8">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="ClassIQ">
  <link rel="icon" type="image/png" sizes="192x192" href="/apple-touch-icon.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="apple-touch-icon" sizes="192x192" href="/apple-touch-icon.png">
  <link rel="apple-touch-icon" sizes="512x512" href="/apple-touch-icon.png">
`;

html = stripPwaTags(html);
if (!html.includes('</head>')) {
  console.error('dist/index.html has no </head> tag.');
  process.exit(1);
}
const SW_CACHE_VERSION = '9';

const swCacheBustScript = `
  <script>
    (function () {
      var key = 'classiq_sw_v';
      var v = '${SW_CACHE_VERSION}';
      if (localStorage.getItem(key) === v) return;
      localStorage.setItem(key, v);
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      }).then(function () {
        if ('caches' in window) {
          return caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) { return caches.delete(k); }));
          });
        }
      }).finally(function () {
        if (!sessionStorage.getItem('classiq_sw_reloaded')) {
          sessionStorage.setItem('classiq_sw_reloaded', '1');
          window.location.reload();
        }
      });
    })();
  </script>
`;

html = html.replace('</head>', `${pwaHead}${swCacheBustScript}</head>`);

const swScript = `
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/', updateViaCache: 'none' }).catch(function (e) {
        console.warn('SW register failed', e);
      });
    }
  </script>
`;

if (!html.includes('service-worker.js')) {
  html = html.replace('</body>', `${swScript}</body>`);
}

fs.writeFileSync(distHtml, html);

// Copy PWA assets required for push + icons
const copyFiles = ['service-worker.js', 'manifest.json', '_redirects', 'netlify.toml', 'privacy.html'];
for (const file of copyFiles) {
  const src = path.join(publicDir, file);
  const dst = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`Copied ${file} → dist/`);
  }
}

const distAssetsDir = path.join(distDir, 'assets');
fs.mkdirSync(distAssetsDir, { recursive: true });

const iconCopies = [
  [iconSrc, path.join(distDir, 'apple-touch-icon.png')],
  [iconSrc, path.join(distDir, 'apple-touch-icon-precomposed.png')],
  [iconSrc, path.join(distAssetsDir, 'user-verification.png')],
  [iconSrc, path.join(distAssetsDir, 'apple-touch-icon.png')],
  [iconSrc, path.join(publicDir, 'apple-touch-icon.png')],
];

for (const [src, dst] of iconCopies) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`Copied icon → ${path.relative(path.join(__dirname, '..'), dst)}`);
}

console.log('Patched dist/ for PWA icons + push (Safari + Netlify).');
