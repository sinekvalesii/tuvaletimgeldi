// Logo ve tüm ikon/mağaza görsellerini üretir:  npm run icons
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });
mkdirSync('resources', { recursive: true });
mkdirSync('store-assets', { recursive: true });

// İğne + tuvalet simgesi (1024 birimlik kare içinde)
const glyph = (pinFill = '#fff', toiletFill = '#059669') => `
  <path d="M512 150C352 150 236 270 236 424c0 190 276 450 276 450s276-260 276-450C788 270 672 150 512 150z" fill="${pinFill}"/>
  <g fill="${toiletFill}">
    <rect x="404" y="290" width="70" height="134" rx="14"/>
    <rect x="404" y="420" width="222" height="40" rx="14"/>
    <path d="M428 460h176c0 70-40 104-86 110l12 52h-92l12-56c-14-20-22-56-22-106z"/>
  </g>`;

const bg = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#10b981"/><stop offset="1" stop-color="#047857"/></linearGradient></defs>`;

const iconSvg = (rounded = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bg}
  <rect width="1024" height="1024" ${rounded ? 'rx="224"' : ''} fill="url(#g)"/>${glyph()}</svg>`;

// Maskelenebilir ikon: simge güvenli alanda (%70) kalsın
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bg}
  <rect width="1024" height="1024" fill="url(#g)"/><g transform="translate(153.6 153.6) scale(0.7)">${glyph()}</g></svg>`;

const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <g transform="translate(184 184) scale(0.64)">${glyph()}</g></svg>`;
const backgroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bg}<rect width="1024" height="1024" fill="url(#g)"/></svg>`;

const splashSvg = (dark) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
  ${bg}<rect width="2732" height="2732" fill="${dark ? '#0b1210' : 'url(#g)'}"/>
  <g transform="translate(1066 1066) scale(0.586)">${dark ? `<rect width="1024" height="1024" rx="224" fill="url(#g)"/>` : ''}${glyph()}</g></svg>`;

const featureSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500">${bg}
  <rect width="1024" height="500" fill="url(#g)"/>
  <circle cx="880" cy="80" r="160" fill="#fff" opacity=".07"/><circle cx="960" cy="460" r="120" fill="#fff" opacity=".06"/>
  <g transform="translate(70 90) scale(0.31)">${glyph()}</g>
  <text x="400" y="225" font-family="Segoe UI, Arial, sans-serif" font-size="64" font-weight="800" fill="#fff">TuvaletimGeldi</text>
  <text x="402" y="285" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="#ecfdf5">En yakın tuvaleti saniyeler içinde bul</text>
  <g font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="600" fill="#047857">
    <rect x="402" y="320" width="150" height="44" rx="22" fill="#fff"/><text x="477" y="349" text-anchor="middle">Ücretsiz</text>
    <rect x="566" y="320" width="190" height="44" rx="22" fill="#fff"/><text x="661" y="349" text-anchor="middle">Engelli erişimi</text>
    <rect x="770" y="320" width="170" height="44" rx="22" fill="#fff"/><text x="855" y="349" text-anchor="middle">Bebek bakım</text>
  </g></svg>`;

const ogSvg = featureSvg.replace('viewBox="0 0 1024 500"', 'viewBox="0 -65 1024 630" preserveAspectRatio="xMidYMid slice"');

const png = (svg, size, out, h = size) => sharp(Buffer.from(svg)).resize(size, h).png().toFile(out);

writeFileSync('public/favicon.svg', iconSvg());
await Promise.all([
  png(iconSvg(), 192, 'public/icons/icon-192.png'),
  png(iconSvg(), 512, 'public/icons/icon-512.png'),
  png(maskableSvg, 512, 'public/icons/maskable-512.png'),
  png(iconSvg(false), 180, 'public/icons/apple-touch-icon.png'),
  png(ogSvg, 1200, 'public/icons/og-image.png', 630),
  png(iconSvg(false), 1024, 'resources/icon-only.png'),
  png(foregroundSvg, 1024, 'resources/icon-foreground.png'),
  png(backgroundSvg, 1024, 'resources/icon-background.png'),
  png(splashSvg(false), 2732, 'resources/splash.png'),
  png(splashSvg(true), 2732, 'resources/splash-dark.png'),
  png(iconSvg(false), 512, 'store-assets/play-icon-512.png'),
  png(featureSvg, 1024, 'store-assets/feature-graphic-1024x500.png', 500),
  png(iconSvg(false), 1024, 'store-assets/app-store-icon-1024.png'),
]);
console.log('İkonlar üretildi.');
