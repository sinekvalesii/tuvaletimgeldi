// Mesafe ve geohash yardımcıları

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function geohashEncode(lat, lng, precision = 7) {
  let idx = 0, bit = 0, evenBit = true, hash = '';
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { idx = idx * 2 + 1; lngMin = mid; } else { idx *= 2; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { idx = idx * 2 + 1; latMin = mid; } else { idx *= 2; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) { hash += BASE32[idx]; bit = 0; idx = 0; }
  }
  return hash;
}

// Verilen sınırları kapsayan geohash hücreleri (precision 4 ≈ 39x20 km)
export function geohashesForBounds(south, west, north, east, precision = 4) {
  const set = new Set();
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const lat = south + ((north - south) * i) / steps;
      const lng = west + ((east - west) * j) / steps;
      set.add(geohashEncode(lat, lng, precision));
    }
  }
  return [...set];
}

export function formatDistance(m, t) {
  if (m < 1000) return `${Math.round(m / 10) * 10} ${t('m')}`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} ${t('km')}`;
}

export function walkMinutes(m) {
  return Math.max(1, Math.round(m / 80)); // ~4.8 km/sa
}
