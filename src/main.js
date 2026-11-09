import './styles.css';
import './leaflet-setup.js';
import L from 'leaflet';
import 'leaflet.markercluster';

import { MAP } from './config.js';
import { t, applyI18n, getLang } from './i18n.js';
import { createBackend } from './services/backend.js';
import { getOsmToilets, searchPlaces } from './services/osm.js';
import { distanceMeters, formatDistance, walkMinutes } from './services/geo.js';
import { initNative, getPosition, watchPosition, haptic } from './services/native.js';
import { initAds } from './services/ads.js';
import { $, $$, esc, toast, closeDialog, sheetDepth, popSheet, closeAllSheets } from './ui/ui.js';
import { openDetail, openAddFlow, openAuth, openProfile, typeEmoji, typeLabel, applyTheme } from './ui/views.js';
import { showOnboardingIfNeeded } from './ui/onboarding.js';

// ------------------------------------------------------------------
//  Durum
// ------------------------------------------------------------------
const state = {
  user: null,
  osm: [],
  community: [],
  hidden: new Set(),
  filters: { free: false, accessible: false, baby: false },
  userPos: null,
  selectedId: null,
  loading: false,
  loadError: false,
  tooLarge: false,
};

const app = { state, t };
window.__tg = app; // hata ayıklama için

// ------------------------------------------------------------------
//  Harita
// ------------------------------------------------------------------
const map = L.map('map', {
  zoomControl: false,
  attributionControl: true,
  tap: true,
}).setView(MAP.defaultCenter, MAP.defaultZoom);
map.attributionControl.setPrefix(false);

L.tileLayer(MAP.tileUrl, {
  attribution: MAP.tileAttribution,
  maxZoom: 19,
  subdomains: 'abc',
}).addTo(map);

const cluster = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 45,
  disableClusteringAtZoom: 17,
});
map.addLayer(cluster);

const markers = new Map(); // id -> marker
let meMarker = null;
let meAccuracy = null;

function pinIcon(toilet, selected) {
  const cls = ['pin'];
  if (toilet.source === 'community') cls.push('community');
  if (toilet.fee === 'yes') cls.push('paid');
  if (selected) cls.push('selected');
  return L.divIcon({
    className: cls.join(' '),
    html: '<div class="pin-body"><span>WC</span></div>',
    iconSize: [34, 34],
    iconAnchor: [17, 40],
  });
}

function allToilets() {
  const list = [...state.community, ...state.osm].filter((x) => !state.hidden.has(x.id));
  const f = state.filters;
  return list.filter(
    (x) => (!f.free || x.fee === 'no') && (!f.accessible || x.wheelchair === 'yes') && (!f.baby || x.baby),
  );
}

app.findToilet = (id) => [...state.community, ...state.osm].find((x) => x.id === id);

function refPoint() {
  if (state.userPos) return state.userPos;
  const c = map.getCenter();
  return { lat: c.lat, lng: c.lng };
}

app.distanceTo = (toilet) => {
  const p = refPoint();
  return distanceMeters(p.lat, p.lng, toilet.lat, toilet.lng);
};

function renderMarkers() {
  const list = allToilets();
  const ids = new Set(list.map((x) => x.id));
  for (const [id, m] of markers) {
    if (!ids.has(id)) {
      cluster.removeLayer(m);
      markers.delete(id);
    }
  }
  const toAdd = [];
  for (const x of list) {
    let m = markers.get(x.id);
    if (!m) {
      m = L.marker([x.lat, x.lng], { icon: pinIcon(x, x.id === state.selectedId), keyboard: true, title: x.name || typeLabel(x.type) });
      m.on('click', () => app.select(x.id));
      markers.set(x.id, m);
      toAdd.push(m);
    } else {
      m.setLatLng([x.lat, x.lng]);
    }
  }
  if (toAdd.length) cluster.addLayers(toAdd);
}

function setSelected(id) {
  const prev = state.selectedId;
  state.selectedId = id;
  for (const pid of [prev, id]) {
    if (!pid) continue;
    const m = markers.get(pid);
    const x = app.findToilet(pid);
    if (m && x) m.setIcon(pinIcon(x, pid === id));
  }
}

app.select = (id, { fly = false } = {}) => {
  const x = app.findToilet(id);
  if (!x) return;
  setSelected(id);
  collapseNearby();
  if (fly) {
    map.flyTo([x.lat, x.lng], Math.max(map.getZoom(), 17), { duration: 0.6 });
  } else {
    // Seçili iğneyi alt sayfanın üstünde görünür tut
    const pt = map.latLngToContainerPoint([x.lat, x.lng]);
    const h = map.getSize().y;
    if (pt.y > h * 0.4) map.panBy([0, pt.y - h * 0.3], { animate: true });
  }
  haptic('light');
  openDetail(app, x, () => setSelected(null));
};

app.focusOn = (lat, lng, zoom = 16) => map.flyTo([lat, lng], zoom, { duration: 0.6 });
app.map = map;

// ------------------------------------------------------------------
//  Veri yükleme
// ------------------------------------------------------------------
let loadTimer = null;
let loadSeq = 0;

app.refresh = (immediate = false) => {
  clearTimeout(loadTimer);
  loadTimer = setTimeout(loadData, immediate ? 0 : 500);
};

async function loadData() {
  if (map.getZoom() < 11) {
    state.tooLarge = true;
    renderNearby();
    return;
  }
  const seq = ++loadSeq;
  const b = map.getBounds().pad(0.25);
  const [s, w, n, e] = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
  state.loading = true;
  state.loadError = false;
  renderNearby();

  // Topluluk verisi genelde daha hızlı gelir: OSM'i beklemeden göster
  const com = (app.backend ? app.backend.listToilets(s, w, n, e) : Promise.resolve([]))
    .then((items) => {
      if (seq !== loadSeq) return;
      mergeInto('community', items, true);
      renderMarkers();
      renderNearby();
    })
    .catch((err) => console.warn(err));

  try {
    const res = await getOsmToilets(s, w, n, e);
    if (seq !== loadSeq) return;
    mergeInto('osm', res.items);
    state.tooLarge = res.tooLarge;
  } catch (err) {
    if (seq !== loadSeq) return;
    state.loadError = true;
    console.warn(err);
  }
  await com;
  if (seq !== loadSeq) return;

  state.loading = false;
  renderMarkers();
  renderNearby();
  maybeOpenDeepLink();
}

function mergeInto(key, items, replaceVisible = false) {
  const byId = new Map(state[key].map((x) => [x.id, x]));
  if (replaceVisible) {
    // Topluluk verisi silinmiş/değişmiş olabilir: görünür alanı tazele
    const b = map.getBounds().pad(0.25);
    for (const [id, x] of byId) if (b.contains([x.lat, x.lng])) byId.delete(id);
  }
  for (const it of items) byId.set(it.id, it);
  // Bellekte en fazla 4000 kayıt tut
  let arr = [...byId.values()];
  if (arr.length > 4000) {
    const c = map.getCenter();
    arr = arr
      .sort((a, b2) => distanceMeters(c.lat, c.lng, a.lat, a.lng) - distanceMeters(c.lat, c.lng, b2.lat, b2.lng))
      .slice(0, 4000);
  }
  state[key] = arr;
}

map.on('moveend', () => app.refresh());

// ------------------------------------------------------------------
//  Yakındakiler listesi
// ------------------------------------------------------------------
function nearestList(limit = 40) {
  const p = refPoint();
  return allToilets()
    .map((x) => ({ x, d: distanceMeters(p.lat, p.lng, x.lat, x.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit);
}

export function toiletRowHtml(x, d) {
  const badges = [];
  if (x.fee === 'no') badges.push(`<span class="badge good">${esc(t('free'))}</span>`);
  if (x.fee === 'yes') badges.push(`<span class="badge warn">${esc(t('paid'))}</span>`);
  if (x.wheelchair === 'yes') badges.push('<span class="badge good">♿</span>');
  if (x.baby) badges.push('<span class="badge good">🍼</span>');
  return `<button class="row" role="listitem" data-id="${esc(x.id)}">
    <span class="type-icon" aria-hidden="true">${typeEmoji(x.type)}</span>
    <span style="flex:1;min-width:0">
      <span style="display:block;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.name || typeLabel(x.type))}</span>
      <span class="muted" style="display:block;font-size:13px;margin:2px 0 4px">${esc(typeLabel(x.type))}</span>
      <span style="display:flex;gap:4px;flex-wrap:wrap">${badges.join('')}</span>
    </span>
    <span style="text-align:right;flex-shrink:0">
      <span style="display:block;font-weight:800;color:var(--brand-strong)">${esc(formatDistance(d, t))}</span>
      <span class="muted" style="font-size:12px">${esc(t('minWalk', { n: walkMinutes(d) }))}</span>
    </span>
  </button>`;
}

function renderNearby() {
  const listEl = $('#nearby-list');
  const items = nearestList();
  $('#nearby-count').textContent = state.loading
    ? t('loadingToilets')
    : items.length
      ? t('nearbyCount', { n: allToilets().length })
      : '';

  if (!items.length) {
    let msg = t('noneNearby');
    if (state.loading) msg = t('loadingToilets');
    else if (state.loadError) msg = t('loadFailed');
    else if (state.tooLarge) msg = getLang() === 'tr' ? 'Tuvaletleri görmek için haritayı yakınlaştırın.' : 'Zoom in to see toilets.';
    listEl.innerHTML = `<div class="muted" style="text-align:center;padding:22px 16px;font-size:15px">${
      state.loading ? '<span class="spinner" style="margin-right:8px;vertical-align:-3px"></span>' : ''
    }${esc(msg)}${
      state.loadError && !state.loading ? `<br><button class="btn" data-retry style="margin-top:12px">${esc(t('retry'))}</button>` : ''
    }</div>`;
    return;
  }
  listEl.innerHTML = items.map(({ x, d }) => toiletRowHtml(x, d)).join('');
}
app.renderNearby = renderNearby;

$('#nearby-list').addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) return app.refresh(true);
  const row = e.target.closest('[data-id]');
  if (row) app.select(row.dataset.id, { fly: true });
});

// Alt sayfa aç/kapa (dokunma veya sürükleme)
const sheet = $('#nearby-sheet');
function setExpanded(on) {
  sheet.classList.toggle('expanded', on);
  document.body.classList.toggle('nearby-expanded', on);
  if (on) $('#nearby-list').scrollTop = 0;
}
function collapseNearby() {
  setExpanded(false);
}
function toggleNearby() {
  setExpanded(!sheet.classList.contains('expanded'));
}
(() => {
  const head = $('#nearby-head');
  let startY = null;
  head.addEventListener('pointerdown', (e) => {
    startY = e.clientY;
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointerup', (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY;
    startY = null;
    if (Math.abs(dy) < 8) toggleNearby();
    else if (dy < -30) setExpanded(true);
    else if (dy > 30) collapseNearby();
  });
})();
map.on('dragstart', collapseNearby);

// ------------------------------------------------------------------
//  Konum
// ------------------------------------------------------------------
let stopWatch = null;

function updateMe(pos) {
  state.userPos = pos;
  const ll = [pos.lat, pos.lng];
  if (!meMarker) {
    meMarker = L.marker(ll, {
      icon: L.divIcon({ className: 'pin', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(map);
    meAccuracy = L.circle(ll, { radius: pos.accuracy || 30, color: '#2563eb', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map);
  } else {
    meMarker.setLatLng(ll);
    meAccuracy.setLatLng(ll).setRadius(pos.accuracy || 30);
  }
}

app.locate = async ({ fly = true, quiet = false } = {}) => {
  try {
    if (!quiet) toast(t('locating'));
    const pos = await getPosition();
    updateMe(pos);
    if (fly) map.flyTo([pos.lat, pos.lng], 16, { duration: 0.8 });
    if (!stopWatch) {
      stopWatch = await watchPosition((p) => {
        updateMe(p);
      });
    }
    renderNearby();
    return pos;
  } catch (e) {
    if (!quiet) toast(e?.code === 1 ? t('locationDenied') : t('locationUnavailable'), 'error', 4000);
    return null;
  }
};

$('#locate-btn').addEventListener('click', () => app.locate());

// ------------------------------------------------------------------
//  ACİL: en yakın tuvalet
// ------------------------------------------------------------------
$('#urgent-btn').addEventListener('click', async () => {
  haptic('heavy');
  const btn = $('#urgent-btn');
  btn.disabled = true;
  try {
    const pos = state.userPos || (await app.locate({ fly: false }));
    if (pos) map.setView([pos.lat, pos.lng], 16);
    // Veri henüz yüklenmediyse bekle
    if (!nearestList(1).length || state.loading) {
      clearTimeout(loadTimer);
      await loadData();
    }
    const near = nearestList(10);
    if (!near.length) {
      toast(state.loadError ? t('loadFailed') : t('noneNearby'), 'error', 4000);
      return;
    }
    // Sadece müşterilere açık olmayanı tercih et (çok uzak değilse)
    const best = near.find((n) => !n.x.customersOnly && n.d < near[0].d * 1.6 + 50) || near[0];
    app.select(best.x.id, { fly: true });
  } finally {
    btn.disabled = false;
  }
});

// ------------------------------------------------------------------
//  Filtreler
// ------------------------------------------------------------------
$$('#filter-chips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const k = chip.dataset.filter;
    state.filters[k] = !state.filters[k];
    chip.setAttribute('aria-pressed', String(state.filters[k]));
    haptic('light');
    renderMarkers();
    renderNearby();
  });
});

// ------------------------------------------------------------------
//  Arama
// ------------------------------------------------------------------
const searchInput = $('#search-input');
const searchResults = $('#search-results');
let placeSearchSeq = 0;

function renderSearch(places = null, loadingPlaces = false) {
  const q = searchInput.value.trim().toLocaleLowerCase(getLang());
  $('#search-clear').classList.toggle('hidden', !q);
  if (!q) {
    searchResults.classList.add('hidden');
    return;
  }
  const p = refPoint();
  const matches = allToilets()
    .filter((x) => (x.name || '').toLocaleLowerCase(getLang()).includes(q))
    .map((x) => ({ x, d: distanceMeters(p.lat, p.lng, x.lat, x.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 8);

  let html = matches.map(({ x, d }) => toiletRowHtml(x, d)).join('');
  if (loadingPlaces) {
    html += `<div class="muted" style="padding:14px;text-align:center"><span class="spinner"></span></div>`;
  } else if (places?.length) {
    html += places
      .map(
        (pl) => `<button class="row" data-place="${pl.lat},${pl.lng}">
        <span class="type-icon" aria-hidden="true">📍</span>
        <span style="flex:1;min-width:0;font-size:14px">${esc(pl.name)}</span></button>`,
      )
      .join('');
  } else if (!places) {
    html += `<button class="row" data-search-places><span class="type-icon" aria-hidden="true">🔎</span>
      <span style="font-weight:600">“${esc(searchInput.value.trim())}” ${getLang() === 'tr' ? 'yerini ara' : '— search places'}</span></button>`;
  } else if (!matches.length) {
    html += `<div class="muted" style="padding:16px;text-align:center">${getLang() === 'tr' ? 'Sonuç bulunamadı' : 'No results'}</div>`;
  }
  searchResults.innerHTML = `<div style="padding:6px">${html}</div>`;
  searchResults.classList.remove('hidden');
}

async function runPlaceSearch() {
  const q = searchInput.value.trim();
  if (q.length < 2) return;
  const seq = ++placeSearchSeq;
  renderSearch(null, true);
  try {
    const places = await searchPlaces(q, getLang());
    if (seq === placeSearchSeq) renderSearch(places);
  } catch {
    if (seq === placeSearchSeq) renderSearch([]);
  }
}

function closeSearch() {
  searchResults.classList.add('hidden');
  searchInput.blur();
}

searchInput.addEventListener('input', () => renderSearch());
searchInput.addEventListener('focus', () => searchInput.value && renderSearch());
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    runPlaceSearch();
  } else if (e.key === 'Escape') closeSearch();
});
$('#search-clear').addEventListener('click', () => {
  searchInput.value = '';
  renderSearch();
  searchInput.focus();
});
searchResults.addEventListener('click', (e) => {
  const row = e.target.closest('[data-id]');
  const place = e.target.closest('[data-place]');
  if (e.target.closest('[data-search-places]')) return runPlaceSearch();
  if (row) {
    closeSearch();
    app.select(row.dataset.id, { fly: true });
  } else if (place) {
    const [lat, lng] = place.dataset.place.split(',').map(Number);
    closeSearch();
    map.flyTo([lat, lng], 16);
  }
});
map.on('click', closeSearch);

// ------------------------------------------------------------------
//  Kullanıcı / profil
// ------------------------------------------------------------------
function renderAvatar() {
  const btn = $('#avatar-btn');
  const u = state.user;
  if (u) {
    btn.classList.remove('guest');
    const initials = (u.displayName || u.email || '?')
      .split(/\s+/)
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    btn.textContent = initials;
  } else {
    btn.classList.add('guest');
    btn.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
  }
}
app.renderAvatar = renderAvatar;

$('#avatar-btn').addEventListener('click', () => openProfile(app));

app.requireLogin = (next) => {
  if (state.user) return next();
  toast(t('loginRequired'));
  openAuth(app, next);
};

$('#add-btn').addEventListener('click', () => app.requireLogin(() => openAddFlow(app)));

// ------------------------------------------------------------------
//  Konum seçme modu (tuvalet ekle/düzenle)
// ------------------------------------------------------------------
app.pickLocation = (initial) =>
  new Promise((resolve) => {
    closeAllSheets();
    collapseNearby();
    if (initial) map.setView([initial.lat, initial.lng], Math.max(map.getZoom(), 18));
    else if (map.getZoom() < 17) map.setZoom(18);
    document.body.classList.add('picking');
    $('#pick-overlay').classList.remove('hidden');
    $('.map-actions').classList.add('hidden');
    $('.topbar').classList.add('hidden');
    sheet.classList.add('hidden');
    const done = (val) => {
      $('#pick-overlay').classList.add('hidden');
      $('.map-actions').classList.remove('hidden');
      $('.topbar').classList.remove('hidden');
      sheet.classList.remove('hidden');
      app.cancelPick = null;
      resolve(val);
    };
    app.cancelPick = () => done(null);
    $('#pick-cancel').onclick = () => done(null);
    $('#pick-confirm').onclick = () => {
      // İğnenin ucu ekranın tam ortasında
      const c = map.getCenter();
      done({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) });
    };
  });

// ------------------------------------------------------------------
//  Paylaşılan bağlantı (?place=...&lat=..&lng=..)
// ------------------------------------------------------------------
let deepLink = null;
try {
  const qs = new URLSearchParams(location.search);
  if (qs.get('place') && qs.get('lat') && qs.get('lng')) {
    deepLink = { id: qs.get('place'), lat: +qs.get('lat'), lng: +qs.get('lng') };
    map.setView([deepLink.lat, deepLink.lng], 17);
  }
} catch {}

function maybeOpenDeepLink() {
  if (!deepLink) return;
  const x = app.findToilet(deepLink.id);
  if (x) {
    deepLink = null;
    history.replaceState(null, '', location.pathname);
    app.select(x.id);
  }
}

// ------------------------------------------------------------------
//  Geri tuşu (Android) ve Escape
// ------------------------------------------------------------------
let lastBack = 0;
function handleBack(exit) {
  if (closeDialog(false)) return;
  if (app.cancelPick) return app.cancelPick();
  if (sheetDepth()) return popSheet();
  if (!searchResults.classList.contains('hidden')) return closeSearch();
  if (sheet.classList.contains('expanded')) return collapseNearby();
  const now = Date.now();
  if (now - lastBack < 2000) return exit();
  lastBack = now;
  toast(t('exitHint'), 'info', 2000);
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.activeElement !== searchInput) handleBack(() => {});
});
$('#backdrop').addEventListener('click', () => closeAllSheets());

// ------------------------------------------------------------------
//  Çevrimdışı uyarısı
// ------------------------------------------------------------------
function updateOnline() {
  $('#offline-banner').classList.toggle('hidden', navigator.onLine);
}
window.addEventListener('online', () => {
  updateOnline();
  app.refresh(true);
});
window.addEventListener('offline', updateOnline);

// ------------------------------------------------------------------
//  Başlat
// ------------------------------------------------------------------
async function boot() {
  applyTheme();
  applyI18n();
  updateOnline();
  renderAvatar();
  renderNearby();
  initNative({ onBack: handleBack });

  app.backend = await createBackend();
  app.backend.onAuthChange((u) => {
    state.user = u;
    renderAvatar();
  });
  app.backend.listHidden().then((ids) => {
    state.hidden = new Set(ids);
    renderMarkers();
    renderNearby();
  });

  app.refresh(true);

  const firstRun = await showOnboardingIfNeeded();
  // İlk açılışta izin tanıtım ekranında istendi; sonraki açılışlarda sessizce dene
  if (!deepLink) app.locate({ fly: true, quiet: !firstRun });
  initAds();
}

boot();
