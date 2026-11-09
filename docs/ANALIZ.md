# TuvaletimGeldi — Site mi, Uygulama mı? (Analiz ve Kararlar)

## Kısa cevap

**İkisi birden, tek kod tabanından.** Aynı kod hem web sitesi (PWA) hem Android uygulaması olarak yayınlanır.
Sıralama: **1) Web + Google Play birlikte → 2) Kullanıcı gelirse iOS.**

## Neden ikisi birden?

| Kriter | Web sitesi (PWA) | Mobil uygulama (Play/App Store) |
|---|---|---|
| Kullanım anı | Sıkışan kişi Google'da "yakınımdaki tuvalet" arar → **siteye düşer**, kurulum yok | Telefonunda yüklüyse tek dokunuşla açar |
| Keşfedilme | Google araması (SEO), paylaşılan linkler | Mağaza araması, "Öne çıkanlar" |
| Gelir | Reklam geliri düşük, AdSense onayı zor | **AdMob banner geliri web'den birkaç kat yüksek** |
| Maliyet | Firebase Hosting ücretsiz | Play: tek seferlik 25$ (sende var), Apple: yıllık 99$ + Mac |
| Konum/ACİL deneyimi | İyi (tarayıcı konum izni) | Daha iyi (yerel izin, titreşim, paylaşım, geri tuşu) |
| Güncelleme | Anında | Mağaza onayı gerekir (1-3 gün) |

Bu uygulamanın doğası **acil ihtiyaç**: kişi o an sokakta, uygulama indirmeye vakti yok. Bu yüzden web sürümü
yeni kullanıcı kazanmanın ana kapısı olur. Uygulamayı beğenen düzenli kullanıcı (turist, kurye, taksici, hamile,
çocuklu aile, engelli birey, IBS/Crohn hastası) ise Play'den indirir. Reklam geliri de bu sadık kitleden gelir.

## Verdiğim kararlar

1. **Platform:** Web (PWA) + Android (Capacitor ile aynı kod). iOS kodu hazır, ama Mac ve Apple hesabın olmadığı için
   sonraya bırakıldı. Mac'siz yol: Codemagic gibi bulut derleme servisi (bkz. YAYIN-REHBERI.md, bölüm 8).
2. **Gerçek veri:** Eski sürümdeki 10 uydurma İstanbul tuvaleti kaldırıldı. Yerine **OpenStreetMap'teki gerçek tuvaletler**
   geldi. Türkiye'deki 3.692 tuvalet uygulamanın içine gömüldü, internet yavaşken bile harita anında dolar.
   Yurt dışında veri canlı olarak OSM'den çekilir.
3. **Ortak veritabanı:** Eski sürümde herkesin verisi sadece kendi tarayıcısındaydı, kimse başkasının eklediğini göremiyordu.
   Artık **Firebase** var: eklenen tuvaletler ve yorumlar herkese görünür. Ücretsiz planı başlangıç için yeterli.
4. **Giriş zorunlu değil:** Harita, arama ve ACİL girişsiz çalışır. Sadece tuvalet ekleme ve yorum için giriş istenir.
5. **ACİL butonu:** Tek dokunuşla en yakın tuvaleti bulur, büyük "Yol tarifi" butonuyla Google Maps'te yürüyüş rotası açar.
6. **Reklam:** Sadece mobil uygulamada, alt kısımda tek banner. Tam ekran reklam yok; acil durumdaki kullanıcıyı
   tam ekran reklamla durdurmak hem kötü bir deneyim hem kötü yorum demek. KVKK/GDPR izin formu (Google UMP) var.
7. **Diller:** Türkçe + İngilizce, telefon diline göre otomatik seçilir.
8. **Mağaza kuralları:** Hesap silme (uygulama içi + web sayfası), içerik bildirme, yönetici moderasyonu,
   gizlilik politikası, kullanım koşulları, koyu tema, erişilebilirlik etiketleri eklendi.

## Eski sürümdeki sorunlar ve çözümleri

| Sorun | Çözüm |
|---|---|
| Veriler sadece kullanıcının tarayıcısında | Firebase Firestore (ortak veritabanı) |
| Şifreler düz metin saklanıyordu | Firebase Authentication (şifreler hash'li, biz göremeyiz) |
| `admin@admin.com / admin123` kodun içinde | Yönetici Firebase konsolundan atanır, kodda şifre yok |
| Kullanıcı metinleri filtresiz basılıyordu (XSS) | Tüm metinler kaçışlanıyor (test edildi) |
| 10 uydurma tuvalet | 3.692 gerçek tuvalet (OSM) + topluluk |
| Fotoğraflar base64 olarak tarayıcıya yazılıyordu, depolama doluyordu | Sıkıştırılıp Firebase Storage'a yükleniyor |
| OSRM demo sunucusu (ticari kullanım yasak) | Google Maps / Apple Maps'e yönlendirme |
| Tailwind CDN (üretim için uygun değil) | Derlenmiş, küçültülmüş CSS |
| İkon, açılış ekranı, gizlilik politikası yok | Hepsi eklendi |

## Maliyet tahmini

| Kalem | Tutar |
|---|---|
| Google Play geliştirici hesabı | Var (tek seferlik 25$) |
| Firebase (Spark, ücretsiz) | 0 ₺. Günlük 50 bin okuma, 20 bin yazma |
| Firebase Storage (fotoğraf) | Blaze planı gerekir. Düşük kullanımda 0 ₺, mutlaka 1-5$ bütçe uyarısı kurun. İstemezseniz `FEATURES.photos = false` |
| Alan adı (isteğe bağlı) | Yıllık ~300-600 ₺ (`tuvaletimgeldi.web.app` ücretsiz) |
| Apple (ileride) | Yıllık 99$ + Mac veya bulut derleme |

## Riskler

- **Google Play'de yeni kişisel hesaplar** üretime çıkmadan önce **en az 12 test kullanıcısıyla 14 gün kapalı test**
  yapmak zorunda. Bu süreyi planlayın (rehberde anlatıldı).
- **Harita karoları:** OpenStreetMap'in ücretsiz karo sunucusu yüksek trafik için uygun değil. Günlük binlerce kullanıcıya
  ulaşınca MapTiler/Stadia'nın ücretsiz planına geçin (`src/config.js` içinde tek satır).
- **Veri güncelliği:** Gömülü Türkiye verisini her sürümden önce `npm run data:update` ile yenileyin.
