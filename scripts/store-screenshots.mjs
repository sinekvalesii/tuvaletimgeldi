// Mağaza ekran görüntülerini üretir (1080x2160, Google Play uyumlu).
// Önce geliştirme sunucusunu başlatın:  npm run dev
// Sonra:  npm run screenshots
import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';

const URL = process.env.APP_URL || 'http://localhost:5173/';
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
];
const executablePath = BROWSERS.find((p) => existsSync(p));
const HOME = { latitude: 41.0058, longitude: 28.9768 }; // Sultanahmet

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(lang) {
  const out = `store-assets/screenshots-${lang}`;
  mkdirSync(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--lang=' + lang] });
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(new globalThis.URL(URL).origin, ['geolocation']);
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 720, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.setGeolocation(HOME);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

  // 1) Tanıtım ekranı
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('tg_lang', l); localStorage.setItem('tg_theme', 'light'); }, lang);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(800);
  await page.screenshot({ path: `${out}/05-intro.png` });

  // 2) Harita + yakındakiler
  await page.evaluate(() => localStorage.setItem('tg_onboarded_v1', '1'));
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(3500);
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await page.screenshot({ path: `${out}/01-map.png` });

  // 3) Liste genişletilmiş
  await page.evaluate(() => {
    const h = document.querySelector('#nearby-head');
    h.dispatchEvent(new PointerEvent('pointerdown', { clientY: 600, pointerId: 1 }));
    h.dispatchEvent(new PointerEvent('pointerup', { clientY: 600, pointerId: 1 }));
  });
  await sleep(700);
  await page.screenshot({ path: `${out}/02-list.png` });

  // 4) ACİL -> en yakın tuvalet detayı
  await page.evaluate(() => {
    const h = document.querySelector('#nearby-head');
    h.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, pointerId: 1 }));
    h.dispatchEvent(new PointerEvent('pointerup', { clientY: 100, pointerId: 1 }));
  });
  await sleep(400);
  await page.click('#urgent-btn');
  await sleep(2500);
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await page.screenshot({ path: `${out}/03-urgent.png` });

  // 5) Filtre: engelli erişimi
  await page.evaluate(() => document.querySelector('[data-sheet-close]')?.click());
  await sleep(400);
  await page.click('[data-filter="accessible"]');
  await sleep(800);
  await page.screenshot({ path: `${out}/04-filter.png` });

  await browser.close();
  console.log(`${out} hazır`);
}

await shoot('tr');
await shoot('en');
