// AdMob banner reklamları — sadece Android/iOS uygulamasında.
// Avrupa/Türkiye kullanıcıları için Google UMP izin formu otomatik gösterilir.
import { ADMOB } from '../config.js';
import { isNative, platform } from './native.js';

let AdMob, enums;
let privacyRequired = false;

function setAdHeight(px) {
  document.documentElement.style.setProperty('--ad-h', `${px}px`);
}

export async function initAds() {
  if (!isNative || !ADMOB.enabled) return;
  try {
    const mod = await import('@capacitor-community/admob');
    AdMob = mod.AdMob;
    enums = mod;
    await AdMob.initialize({ initializeForTesting: ADMOB.testing });

    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === enums.AdmobConsentStatus.REQUIRED) {
      info = await AdMob.showConsentForm();
    }
    privacyRequired = info.privacyOptionsRequirementStatus === enums.PrivacyOptionsRequirementStatus.REQUIRED;
    if (!info.canRequestAds) return;

    if (platform === 'ios') {
      await AdMob.requestTrackingAuthorization().catch(() => {});
    }

    AdMob.addListener(enums.BannerAdPluginEvents.SizeChanged, (size) => setAdHeight(size.height || 0));
    AdMob.addListener(enums.BannerAdPluginEvents.FailedToLoad, () => setAdHeight(0));

    await AdMob.showBanner({
      adId: platform === 'ios' ? ADMOB.iosBannerId : ADMOB.androidBannerId,
      adSize: enums.BannerAdSize.ADAPTIVE_BANNER,
      position: enums.BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: ADMOB.testing,
    });
  } catch (e) {
    console.warn('Ads disabled:', e);
    setAdHeight(0);
  }
}

export const adPrivacyAvailable = () => isNative && privacyRequired;

export async function showAdPrivacyOptions() {
  if (AdMob) await AdMob.showPrivacyOptionsForm().catch(() => {});
}

// Tam ekran sayfalar açıkken reklamı gizle (ör. giriş formu)
export async function setAdsVisible(visible) {
  if (!AdMob) return;
  if (visible) AdMob.resumeBanner().catch(() => {});
  else AdMob.hideBanner().catch(() => {});
}
