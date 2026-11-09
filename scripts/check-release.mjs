// Yayın öncesi kontrol:  npm run check:release
// Doldurulmamış ayarları, test reklam kimliklerini ve eksik dosyaları listeler.
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const config = read('src/config.js');
const site = read('public/site-config.js');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const gradle = read('android/app/build.gradle');

const checks = [
  ['Firebase apiKey dolduruldu', !/apiKey:\s*''/.test(config)],
  ['Firebase projectId dolduruldu', !/projectId:\s*''/.test(config)],
  ['İletişim adresi girildi (src/config.js)', /contactEmail:\s*'[^']+'|contactUrl:\s*'http/.test(config)],
  ['İletişim adresi girildi (public/site-config.js)', /contactEmail:\s*'[^']+'|contactUrl:\s*'http/.test(site)],
  ['Veri sorumlusu adı girildi (public/site-config.js)', !/owner:\s*'TuvaletimGeldi'/.test(site)],
  ['AdMob test modu kapatıldı (testing: false)', /testing:\s*false/.test(config)],
  ['Gerçek AdMob banner kimliği girildi', !config.includes('ca-app-pub-3940256099942544/6300978111')],
  ['Gerçek AdMob uygulama kimliği girildi (AndroidManifest.xml)', !manifest.includes('ca-app-pub-3940256099942544~')],
  ['Gömülü Türkiye tuvalet verisi var', existsSync('public/data/toilets-tr.json')],
  ['Android imzalama anahtarı var', existsSync('android/upload-keystore.jks') && existsSync('android/keystore.properties')],
];

let ok = 0;
console.log('\nTuvaletimGeldi — yayın kontrolü\n');
for (const [label, pass] of checks) {
  console.log(`${pass ? '✅' : '❌'} ${label}`);
  if (pass) ok++;
}
const vc = gradle.match(/versionCode (\d+)/)?.[1];
const vn = gradle.match(/versionName "([^"]+)"/)?.[1];
console.log(`\nAndroid sürümü: ${vn} (versionCode ${vc}) — her yüklemede versionCode'u 1 artırın.`);
if (existsSync('public/data/toilets-tr.json')) {
  const d = JSON.parse(read('public/data/toilets-tr.json'));
  const age = Math.round((Date.now() - Date.parse(d.generated)) / 86400000);
  console.log(`Tuvalet verisi: ${d.rows.length} kayıt, ${age} gün önce güncellendi${age > 60 ? ' — npm run data:update önerilir' : ''}.`);
}
console.log(`\n${ok}/${checks.length} kontrol geçti.${ok === checks.length ? ' Yayına hazır! 🎉' : ' Ayrıntılar: docs/YAYIN-REHBERI.md'}\n`);
process.exitCode = ok === checks.length ? 0 : 1;
