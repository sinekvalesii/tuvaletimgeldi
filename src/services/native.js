// Web ve Android/iOS arasında ortak cihaz özellikleri
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'web' | 'android' | 'ios'

let Geo, ShareP, HapticsP, AppP;

async function plugins() {
  if (!isNative) return;
  if (!Geo) {
    [{ Geolocation: Geo }, { Share: ShareP }, { Haptics: HapticsP }, { App: AppP }] = await Promise.all([
      import('@capacitor/geolocation'),
      import('@capacitor/share'),
      import('@capacitor/haptics'),
      import('@capacitor/app'),
    ]);
  }
}

export async function initNative({ onBack }) {
  if (!isNative) return;
  await plugins();
  const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ]);
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  SplashScreen.hide().catch(() => {});
  AppP.addListener('backButton', () => onBack(() => AppP.exitApp()));
}

// ---- Konum ----
export async function getPosition() {
  if (isNative) {
    await plugins();
    const perm = await Geo.checkPermissions().catch(() => ({ location: 'prompt' }));
    if (perm.location !== 'granted') {
      const req = await Geo.requestPermissions({ permissions: ['location', 'coarseLocation'] }).catch(() => null);
      if (!req || (req.location !== 'granted' && req.coarseLocation !== 'granted')) {
        const e = new Error('denied');
        e.code = 1;
        throw e;
      }
    }
    const p = await Geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(Object.assign(new Error('unsupported'), { code: 2 }));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

export async function watchPosition(cb) {
  if (isNative) {
    await plugins();
    const id = await Geo.watchPosition({ enableHighAccuracy: true, timeout: 20000 }, (p) => {
      if (p) cb({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
    });
    return () => Geo.clearWatch({ id });
  }
  if (!navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    (p) => cb({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 10000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

// ---- Paylaşım ----
export async function share({ title, text, url }) {
  if (isNative) {
    await plugins();
    return ShareP.share({ title, text, url, dialogTitle: title });
  }
  if (navigator.share) return navigator.share({ title, text, url });
  await navigator.clipboard?.writeText(url);
  return 'copied';
}

// ---- Titreşim ----
export async function haptic(kind = 'light') {
  if (!isNative) {
    if (kind === 'heavy') navigator.vibrate?.(30);
    return;
  }
  await plugins();
  const { ImpactStyle } = await import('@capacitor/haptics');
  HapticsP.impact({ style: kind === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Light }).catch(() => {});
}

// ---- Harici bağlantılar / navigasyon ----
export async function openExternal(url) {
  if (isNative) {
    // Sistem uygulamasıyla aç (Google Maps, tarayıcı, e-posta…)
    const { AppLauncher } = await import('@capacitor/app-launcher');
    try {
      await AppLauncher.openUrl({ url });
      return;
    } catch {}
  }
  window.open(url, '_blank', 'noopener');
}

// Uygulamada target=_blank ve mailto bağlantılarını sisteme yönlendir
if (isNative) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (a.target === '_blank' || /^(mailto|tel):/.test(href)) {
      e.preventDefault();
      openExternal(a.href);
    }
  });
}

export function navigateTo(lat, lng, label) {
  const dest = `${lat},${lng}`;
  if (platform === 'ios') {
    openExternal(`https://maps.apple.com/?daddr=${dest}&dirflg=w&q=${encodeURIComponent(label || '')}`);
  } else {
    openExternal(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`);
  }
}
