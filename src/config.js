// =====================================================================
//  TuvaletimGeldi — UYGULAMA AYARLARI
//  Yayına çıkmadan önce bu dosyadaki işaretli alanları doldurun.
//  Ayrıntılar: docs/YAYIN-REHBERI.md
// =====================================================================

export const APP = {
  name: 'TuvaletimGeldi',
  version: '1.0.0',
  // Gizlilik / destek sayfalarında görünen iletişim adresi.
  // Aynı adresi public/site-config.js içine de yazın.
  contactEmail: '', // İsteğe bağlı: bir e-posta yazarsanız iletişim bağlantısı e-postaya döner
  contactUrl: 'https://github.com/sinekvalesii/tuvaletimgeldi/issues',
  // Web sürümünün yayınlanacağı adres (paylaşım linkleri için)
  webUrl: 'https://sinekvalesii.github.io/tuvaletimgeldi',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.tuvaletimgeldi.app',
};

// ---------------------------------------------------------------------
//  Firebase (giriş, ortak veritabanı, fotoğraflar)
//  Firebase Console > Proje ayarları > Uygulamalarınız > Web uygulaması
//  Boş bırakılırsa uygulama DEMO modunda çalışır: veriler sadece o cihazda
//  saklanır. Yayın için mutlaka doldurun.
// ---------------------------------------------------------------------
export const FIREBASE = {
  apiKey: '', // TODO(yayın)
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// ---------------------------------------------------------------------
//  Özellik anahtarları
//  photos: Fotoğraf yükleme Firebase Storage gerektirir; Storage ise Firebase'in
//  "Blaze" (kullandıkça öde, düşük kullanımda ücretsiz) planını ister.
//  Blaze'e geçmek istemezseniz false yapın, fotoğraf alanı gizlenir.
// ---------------------------------------------------------------------
export const FEATURES = {
  photos: true,
};

// ---------------------------------------------------------------------
//  AdMob (sadece Android/iOS uygulamasında gösterilir, web'de reklam yok)
//  Aşağıdakiler Google'ın resmi TEST kimlikleridir. Gerçek kimliklerinizi
//  AdMob panelinden alıp değiştirin; ayrıca android/app/src/main/AndroidManifest.xml
//  içindeki APPLICATION_ID değerini de güncelleyin.
// ---------------------------------------------------------------------
export const ADMOB = {
  enabled: true,
  testing: true, // TODO(yayın): gerçek kimlikleri girince false yapın
  androidBannerId: 'ca-app-pub-3940256099942544/6300978111', // TODO(yayın)
  iosBannerId: 'ca-app-pub-3940256099942544/2934735716', // TODO(yayın)
};

// ---------------------------------------------------------------------
//  Harita
//  OpenStreetMap'in ücretsiz karo sunucusu küçük/orta trafik içindir.
//  Kullanıcı sayısı artınca MapTiler / Stadia gibi bir sağlayıcının
//  ücretsiz planına geçip buradaki adresi değiştirin.
// ---------------------------------------------------------------------
export const MAP = {
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  defaultCenter: [41.0082, 28.9784], // İstanbul
  defaultZoom: 14,
  // Gerçek tuvalet verisi: OpenStreetMap Overpass API (amenity=toilets)
  overpassUrls: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ],
};
