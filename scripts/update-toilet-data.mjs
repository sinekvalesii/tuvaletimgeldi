// Türkiye'deki tüm tuvaletleri OpenStreetMap'ten indirip uygulamaya gömer.
// Kullanım:  npm run data:update   (her sürüm öncesi çalıştırmanız önerilir)
// Çıktı: public/data/toilets-tr.json
import { writeFileSync, mkdirSync } from 'node:fs';

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const QUERY = `[out:json][timeout:300];
area["ISO3166-1"="TR"][admin_level=2]->.tr;
(
  nwr["amenity"="toilets"](area.tr);
  nwr["toilets"="yes"]["access"!="private"](area.tr);
);
out center tags;`;

const TYPES = ['public', 'cafe', 'mall', 'station', 'mosque', 'fuel', 'park', 'other'];

function classify(tags) {
  const a = tags.amenity;
  if (a === 'toilets') return 'public';
  if (a === 'place_of_worship') return tags.religion === 'muslim' ? 'mosque' : 'other';
  if (['cafe', 'restaurant', 'fast_food', 'bar', 'pub', 'food_court'].includes(a)) return 'cafe';
  if (a === 'fuel') return 'fuel';
  if (tags.shop === 'mall' || tags.shop === 'department_store') return 'mall';
  if (tags.railway === 'station' || tags.public_transport === 'station' || a === 'bus_station' || a === 'ferry_terminal') return 'station';
  if (tags.leisure === 'park') return 'park';
  return 'other';
}
const yn = (v) => (v === 'yes' || v === 'designated' || v === 'limited' ? 1 : v === 'no' ? 0 : -1);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchData() {
  let wait = 15000;
  for (let attempt = 1; attempt <= 12; attempt++) {
    for (const url of MIRRORS) {
      try {
        console.log(`Deneme ${attempt}: ${url}`);
        const res = await fetch(url, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(QUERY),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'TuvaletimGeldi-data-updater/1.0',
          },
          signal: AbortSignal.timeout(320000),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (!json.elements?.length) throw new Error('boş yanıt');
        return json;
      } catch (e) {
        console.log('  başarısız:', e.message);
      }
    }
    console.log(`  ${wait / 1000} sn bekleniyor…`);
    await sleep(wait);
    wait = Math.min(wait * 2, 120000);
  }
  throw new Error('Tüm denemeler başarısız');
}

const data = await fetchData();
// Kompakt biçim: [id, lat, lng, ad, türIndex, ücret, engelli, bebek, sadeceMüşteri, saatler]
const rows = [];
for (const el of data.elements) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null) continue;
  rows.push([
    el.type[0] + el.id,
    +lat.toFixed(6),
    +lng.toFixed(6),
    t.name || t['name:tr'] || t.operator || '',
    TYPES.indexOf(classify(t)),
    yn(t.fee ?? t['toilets:fee']),
    yn(t.wheelchair ?? t['toilets:wheelchair']),
    t.changing_table === 'yes' || t.diaper === 'yes' || t['toilets:changing_table'] === 'yes' ? 1 : 0,
    (t.access || t['toilets:access']) === 'customers' ? 1 : 0,
    t.opening_hours || '',
  ]);
}
mkdirSync('public/data', { recursive: true });
writeFileSync(
  'public/data/toilets-tr.json',
  JSON.stringify({ generated: new Date().toISOString(), source: 'OpenStreetMap contributors (ODbL)', types: TYPES, rows }),
);
console.log(`Tamam: ${rows.length} tuvalet kaydedildi -> public/data/toilets-tr.json`);
