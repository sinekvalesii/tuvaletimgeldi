# TuvaletimGeldi 🚻

En yakın tuvaleti saniyeler içinde bulan uygulama. Tek kod tabanıyla **web sitesi (PWA)** ve **Android uygulaması**
(Capacitor) olarak yayınlanır. iOS'a hazırdır.

## Hızlı başlangıç

```
npm install
npm run dev            # http://localhost:5173
```

## Belgeler

| Dosya | İçerik |
|---|---|
| [docs/ANALIZ.md](docs/ANALIZ.md) | Site mi uygulama mı, verilen kararlar, maliyet ve riskler |
| [docs/YAYIN-REHBERI.md](docs/YAYIN-REHBERI.md) | Firebase, AdMob, Google Play'e adım adım yayın |
| [docs/MAGAZA-METINLERI.md](docs/MAGAZA-METINLERI.md) | Mağaza açıklamaları (TR/EN), veri güvenliği ve içerik formu cevapları |

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Web sürümünü `dist/` içine derler |
| `npm run check:release` | Yayın öncesi eksikleri listeler |
| `npm run android:sync` | Web'i derleyip Android projesine kopyalar |
| `npm run android:open` | Android Studio'da açar |
| `npm run data:update` | Türkiye tuvalet verisini OpenStreetMap'ten yeniler |
| `npm run icons` | Logo ve mağaza görsellerini yeniden üretir |
| `npm run screenshots` | Mağaza ekran görüntülerini üretir (`npm run dev` açıkken) |

## Klasörler

```
src/                 Uygulama kodu
  config.js          ★ Tüm ayarlar (Firebase, AdMob, iletişim)
  main.js            Harita, liste, ACİL, arama
  ui/views.js        Detay, yorum, ekleme, giriş, profil ekranları
  services/          Firebase/demo veri katmanı, OSM, konum, reklam
public/              Gizlilik, koşullar, hesap silme sayfaları, ikonlar, gömülü veri
android/             Android projesi (imzalama anahtarı burada — YEDEKLEYİN)
store-assets/        Play Store simgesi, öne çıkan grafik, ekran görüntüleri
firestore.rules      Veritabanı güvenlik kuralları
eski-surumler/       Önceki index.html dosyaları (referans için)
```

Harita verisi © OpenStreetMap katkıcıları (ODbL).
