// OpenStreetMap Overpass API'den gerçek tuvalet verisi.
// Sonuçlar ~5 km'lik hücreler halinde önbelleğe alınır, aynı bölge tekrar
// istenmez. Overpass adil kullanım kuralları için istekler sınırlıdır.

import { MAP } from '../config.js';

const CELL = 0.05; // derece (~5 km)
const TTL = 1000 * 60 * 60 * 24; // 24 saat
const LS_KEY = 'tg_osm_cache_v1';
const MAX_CELLS_STORED = 40;
const MAX_CELLS_PER_REQUEST = 16;

const memory = new Map(); // cellKey -> { t, items }
const pending = new Map();

// Türkiye verisi uygulamanın içinde gömülü gelir (public/data/toilets-tr.json)
// Böylece Overpass sunucusu yoğun/kapalı olsa bile Türkiye'de harita anında dolar.
const TR_BOX = { s: 35.8, w: 25.6, n: 42.2, e: 44.9 };
let bundledPromise = null;

function loadBundled() {
  if (!bundledPromise) {
    bundledPromise = fetch('data/toilets-tr.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.rows) return null;
        const tri = (v) => (v === 1 ? 'yes' : v === 0 ? 'no' : null);
        return j.rows.map((r) => ({
          id: 'osm-' + r[0],
          source: 'osm',
          osmType: { n: 'node', w: 'way', r: 'relation' }[r[0][0]],
          osmId: +r[0].slice(1),
          lat: r[1],
          lng: r[2],
          name: r[3],
          type: j.types[r[4]] || 'other',
          fee: tri(r[5]),
          wheelchair: tri(r[6]),
          baby: r[7] === 1,
          customersOnly: r[8] === 1,
          openingHours: r[9] || '',
          description: '',
        }));
      })
      .catch(() => null);
  }
  return bundledPromise;
}

function inTurkey(lat, lng) {
  return lat > TR_BOX.s && lat < TR_BOX.n && lng > TR_BOX.w && lng < TR_BOX.e;
}

function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    const now = Date.now();
    for (const [k, v] of Object.entries(raw)) {
      if (now - v.t < TTL) memory.set(k, v);
    }
  } catch {}
}

function saveCache() {
  try {
    const entries = [...memory.entries()]
      .sort((a, b) => b[1].t - a[1].t)
      .slice(0, MAX_CELLS_STORED);
    localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Depolama doluysa önbelleği temizle
    try { localStorage.removeItem(LS_KEY); } catch {}
  }
}

loadCache();

const cellKey = (i, j) => `${i}:${j}`;

function cellsForBounds(s, w, n, e) {
  const cells = [];
  for (let i = Math.floor(s / CELL); i <= Math.floor(n / CELL); i++) {
    for (let j = Math.floor(w / CELL); j <= Math.floor(e / CELL); j++) {
      cells.push([i, j]);
    }
  }
  return cells;
}

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

function yesNo(v) {
  if (v === 'yes' || v === 'designated' || v === 'limited') return 'yes';
  if (v === 'no') return 'no';
  return null;
}

function toToilet(el) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  // Sadece müşterilere açık yerleri gösterme (toilets:access=customers) — yine de bilgi olarak ekle
  return {
    id: `osm-${el.type[0]}${el.id}`,
    source: 'osm',
    osmType: el.type,
    osmId: el.id,
    name: tags.name || tags['name:tr'] || tags.operator || '',
    type: classify(tags),
    lat,
    lng,
    fee: yesNo(tags.fee ?? tags['toilets:fee']),
    wheelchair: yesNo(tags.wheelchair ?? tags['toilets:wheelchair']),
    baby: tags.changing_table === 'yes' || tags.diaper === 'yes' || tags['toilets:changing_table'] === 'yes',
    customersOnly: (tags.access || tags['toilets:access']) === 'customers',
    openingHours: tags.opening_hours || '',
    description: tags.description || '',
  };
}

async function overpass(query) {
  let lastErr;
  for (const url of MAP.overpassUrls) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function fetchCells(cells) {
  const is = cells.map((c) => c[0]);
  const js = cells.map((c) => c[1]);
  const s = Math.min(...is) * CELL, n = (Math.max(...is) + 1) * CELL;
  const w = Math.min(...js) * CELL, e = (Math.max(...js) + 1) * CELL;
  const bbox = `${s},${w},${n},${e}`;
  const q = `[out:json][timeout:25];
(
  nwr["amenity"="toilets"](${bbox});
  nwr["toilets"="yes"]["access"!="private"](${bbox});
);
out center tags 1500;`;
  const data = await overpass(q);
  const items = (data.elements || []).map(toToilet).filter(Boolean);
  const now = Date.now();
  for (const [i, j] of cells) memory.set(cellKey(i, j), { t: now, items: [] });
  for (const it of items) {
    const k = cellKey(Math.floor(it.lat / CELL), Math.floor(it.lng / CELL));
    const entry = memory.get(k);
    if (entry) entry.items.push(it);
  }
  saveCache();
}

/**
 * Sınırlar içindeki tuvaletleri döndürür.
 * @returns {Promise<{items: Array, tooLarge: boolean}>}
 */
export async function getOsmToilets(s, w, n, e) {
  if (inTurkey((s + n) / 2, (w + e) / 2)) {
    const all = await loadBundled();
    if (all) {
      return {
        items: all.filter((x) => x.lat >= s && x.lat <= n && x.lng >= w && x.lng <= e),
        tooLarge: false,
      };
    }
  }
  const cells = cellsForBounds(s, w, n, e);
  if (cells.length > MAX_CELLS_PER_REQUEST * 2) {
    return { items: collect(cells), tooLarge: true };
  }
  const now = Date.now();
  const missing = cells.filter(([i, j]) => {
    const c = memory.get(cellKey(i, j));
    return !c || now - c.t > TTL;
  });
  if (missing.length) {
    // Büyük istekleri parçalara böl
    const chunks = [];
    for (let k = 0; k < missing.length; k += MAX_CELLS_PER_REQUEST) {
      chunks.push(missing.slice(k, k + MAX_CELLS_PER_REQUEST));
    }
    for (const chunk of chunks) {
      const key = chunk.map((c) => c.join(':')).join('|');
      if (!pending.has(key)) {
        pending.set(key, fetchCells(chunk).finally(() => pending.delete(key)));
      }
      await pending.get(key);
    }
  }
  return { items: collect(cells), tooLarge: false };
}

function collect(cells) {
  const out = [];
  for (const [i, j] of cells) {
    const c = memory.get(cellKey(i, j));
    if (c) out.push(...c.items);
  }
  return out;
}

export function osmEditUrl(toilet) {
  return `https://www.openstreetmap.org/${toilet.osmType}/${toilet.osmId}`;
}

// Yer arama (Nominatim) — sadece kullanıcı "ara" dediğinde çağrılır
export async function searchPlaces(query, lang) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=${lang}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((d) => ({
    name: d.display_name,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
  }));
}
