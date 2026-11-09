# TuvaletimGeldi — Adım Adım Yayın Rehberi

Toplam süre: ~2-3 saat iş + Google'ın kapalı test süresi (14 gün).
Komutları proje klasöründe (`TuvaletimGeldiApp`) bir terminalde çalıştırın.

**Mevcut durum:** Uygulama çalışıyor. Firebase anahtarları girilmediği için **DEMO modunda**: veriler sadece o
cihazda saklanıyor. Aşağıdaki 1. adımdan sonra gerçek, ortak veritabanına geçer.

---

## 0. Hazırlık (bir kez)

1. Node.js kurulu (sende var).
2. Bağımlılıklar kurulu. Kurulu değilse: `npm install`
3. Firebase komut aracı: `npm install -g firebase-tools`, ardından `firebase login`
4. Kontrol: `npm run check:release` (eksik ayarları ❌ ile gösterir)

## 1. Firebase kurulumu (ortak veritabanı ve giriş)

1. https://console.firebase.google.com → **Proje ekle** → ad: `tuvaletimgeldi` (Analytics isteğe bağlı).
2. **Build › Authentication › Get started** → **Email/Password**'ü etkinleştirin.
3. **Build › Firestore Database › Create database** → konum **eur3 (Europe)** → **production mode**.
4. **(Fotoğraf için) Build › Storage › Get started.** Blaze planına geçmenizi ister. Geçerseniz
   **Google Cloud › Billing › Budgets** altında 5$ bütçe uyarısı kurun. Geçmek istemezseniz
   `src/config.js` içinde `FEATURES.photos = false` yapın ve `firebase.json` içindeki `"storage"` bloğunu silin.
5. **Proje ayarları (⚙) › Genel › Uygulamalarınız › Web (</>)** → takma ad: `web` → çıkan `firebaseConfig`
   değerlerini **`src/config.js` › `FIREBASE`** içine yapıştırın.
6. Güvenlik kurallarını ve indeksleri yükleyin:
   ```
   firebase use --add        (projenizi seçin, takma ad: default)
   firebase deploy --only firestore,storage
   ```
7. **Kendinizi yönetici yapın:** Uygulamada kayıt olun → Firebase **Authentication › Users** listesinden
   kullanıcı UID'nizi kopyalayın → **Firestore › Start collection** → koleksiyon: `admins`, belge kimliği: UID'niz,
   bir alan ekleyin (örn. `role: "admin"`). Artık profilinizde **Bildirilen içerikler** bölümü görünür.

## 2. Bilgilerinizi girin

- `src/config.js` → `contactEmail`, `webUrl` (örn. `https://tuvaletimgeldi.web.app`)
- `public/site-config.js` → `contactEmail`, `owner` (adınız/şirketiniz)
- `npm run check:release` ile kontrol edin.

## 3. Web sitesini yayınlayın (ücretsiz)

```
npm run build
firebase deploy --only hosting
```
Adres: `https://<proje-id>.web.app`. Gizlilik politikası adresi: `https://<proje-id>.web.app/privacy.html`.
Kendi alan adınız varsa: Firebase **Hosting › Add custom domain**.

## 4. AdMob (reklam)

1. https://admob.google.com → hesap oluşturun (ödeme ve vergi bilgileri).
2. **Apps › Add app › Android** → "Uygulama henüz yayınlanmadı" seçin → ad: TuvaletimGeldi.
3. **Uygulama kimliğini** (`ca-app-pub-XXXX~YYYY`) kopyalayın →
   `android/app/src/main/AndroidManifest.xml` içindeki `APPLICATION_ID` değerine yazın.
4. **Ad units › Add › Banner** → kimliği (`ca-app-pub-XXXX/ZZZZ`) `src/config.js › ADMOB.androidBannerId`'ye yazın.
5. `src/config.js` içinde `testing: false` yapın.
6. **Privacy & messaging › GDPR › Create message** (Avrupa kullanıcıları için zorunlu). Uygulama formu kendisi gösterir.
7. **app-ads.txt:** AdMob'un verdiği satırı `public/app-ads.txt` dosyasına yazıp web'i yeniden yayınlayın.
   Play'deki "web sitesi" alanına da web adresinizi girin.

> ⚠️ Kendi reklamlarınıza asla tıklamayın, hesabınız kapatılır. Geliştirirken `testing: true` kalsın.

## 5. Android paketini (AAB) derleyin

```
npm run android:sync
cd android
gradlew.bat bundleRelease
```
Çıktı: `android/app/build/outputs/bundle/release/app-release.aab`

Android Studio ile: `npm run android:open` → **Build › Generate Signed App Bundle**.
Telefonda denemek için: `gradlew.bat assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`.

**İmzalama anahtarı:** `android/upload-keystore.jks` + `android/keystore.properties` (şifre içinde).
**Bu iki dosyayı mutlaka yedekleyin** (USB/bulut, şifreli). Kaybederseniz Play Console'dan "upload key reset" gerekir.

**Her yeni sürümde:** `android/app/build.gradle` içinde `versionCode`'u 1 artırın, `versionName`'i güncelleyin
(`src/config.js › APP.version` ile aynı tutun).

## 6. Google Play Console

1. **Uygulama oluştur** → ad: TuvaletimGeldi, varsayılan dil: Türkçe, Uygulama, Ücretsiz.
2. **Ana mağaza girişi:** metinler `docs/MAGAZA-METINLERI.md` içinde.
   - Uygulama simgesi: `store-assets/play-icon-512.png`
   - Öne çıkan grafik: `store-assets/feature-graphic-1024x500.png`
   - Telefon ekran görüntüleri: `store-assets/screenshots-tr/` (İngilizce giriş için `screenshots-en/`)
3. **Uygulama içeriği** bölümü (cevaplar `docs/MAGAZA-METINLERI.md` içinde):
   - Gizlilik politikası URL'si
   - Reklamlar: **Evet, reklam içeriyor**
   - Uygulama erişimi: "Tüm işlevler özel erişim olmadan kullanılabilir" + isteğe bağlı test hesabı bilgisi
   - İçerik derecelendirmesi anketi
   - Hedef kitle: **18+** (veya 13+), çocuklara yönelik değil
   - Veri güvenliği formu
   - Hesap silme URL'si: `https://<proje-id>.web.app/delete-account.html`
   - Reklam kimliği: Evet (AdMob)
4. **Test › Kapalı test** → yeni kanal → AAB'yi yükleyin → **en az 12 test kullanıcısı** (Gmail adresleri) ekleyin →
   davet linkini paylaşın. Testçiler uygulamayı **14 gün boyunca** yüklü tutmalı.
   (2023 sonrası açılan kişisel hesaplar için zorunlu.)
5. 14 gün sonra **Üretime erişim başvurusu** → onaylanınca **Üretim › Yeni sürüm** → aynı AAB.
6. İnceleme genelde 1-7 gün sürer.

## 7. Güncel tutma

- Tuvalet verisini yenile: `npm run data:update` (her sürümden önce önerilir)
- Mağaza görsellerini yenile: `npm run dev` açıkken başka terminalde `npm run screenshots`
- İkonları yenile: `npm run icons`, ardından `npx capacitor-assets generate --android`
- Bildirimleri kontrol edin: Profil › Bildirilen içerikler (Play kuralı: UGC bildirimlerine hızlı yanıt)

## 8. iOS (ileride)

Gereken: Apple Developer hesabı (yıllık 99$) + Mac **veya** bulut derleme (Codemagic, Ionic Appflow).
```
npx cap add ios
npx capacitor-assets generate --ios
```
`ios/App/App/Info.plist` içine eklenmeli:
- `NSLocationWhenInUseUsageDescription` = "Size en yakın tuvaleti göstermek için konumunuz kullanılır."
- `GADApplicationIdentifier` = AdMob iOS uygulama kimliği
- `NSUserTrackingUsageDescription` = "Size daha alakalı reklamlar gösterebilmek için."
- `SKAdNetworkItems` (AdMob dokümanındaki liste)

Apple incelemesi için not: Uygulama "web sitesi sarmalayıcı" sayılmasın diye yerel konum, titreşim, paylaşım
ve ACİL özelliği öne çıkarılmalı. İnceleme notuna demo hesap bilgisi yazın.

## 9. Sorun giderme

| Sorun | Çözüm |
|---|---|
| Harita boş, "Tuvalet verisi alınamadı" | Yurt dışında Overpass sunucusu yoğun olabilir. "Tekrar dene"ye basın. Türkiye'de gömülü veri kullanılır. |
| Giriş yapılamıyor | Firebase Authentication'da Email/Password açık mı? `src/config.js` doğru mu? |
| "Missing or insufficient permissions" | `firebase deploy --only firestore` ile kuralları yükleyin |
| Yönetici paneli boş/hatalı | Firestore indeksleri oluşuyor olabilir (birkaç dakika). Konsoldaki hata linkine tıklayın. |
| Gradle: "Unable to establish loopback connection" | Kullanıcı klasörü yolunda boşluk olduğu için olur. `C:\gtmp` klasörü açın, terminalde `set JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:/gtmp -Djava.io.tmpdir=C:/gtmp` yazıp tekrar derleyin |
| Reklam görünmüyor | Yeni AdMob birimleri birkaç saat boş dönebilir. Test modunda Google test reklamı görünmeli. |
