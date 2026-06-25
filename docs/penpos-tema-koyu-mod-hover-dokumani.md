# PenPOS Tema, Koyu Mod ve Hover Dokümantasyonu

Bu doküman, PenPOS içinde tema, koyu mod ve hover davranışlarıyla ilgili aktif yapıların teknik özetidir. Kapsam yalnızca canlı kaynak kod üzerinden çıkarılmıştır; `src_backup_before_hardcode_fix` gibi yedek klasörler özellikle hariç tutulmuştur.

## 1. Genel Mimari

PenPOS'ta görünüm yönetimi tek bir yerde değil, birkaç katmanda çalışır:

1. `frontend/src/theme/themeConfig.js`
   Sistem temalarının listesi, tema scope mantığı ve `localStorage` anahtarları burada tanımlanır.

2. `frontend/src/theme/ThemeContext.jsx`
   Seçilen tema ve koyu mod bilgisi runtime CSS değişkenlerine çevrilir ve `document.documentElement` üstüne yazılır.

3. `frontend/src/context/BusinessSettingsContext.jsx`
   Tenant bazlı ayarlar yüklendiğinde tema, koyu mod, font boyutu ve animasyon sınıfları `html` / `body` üstüne uygulanır.

4. `frontend/src/styles.css`
   Ortak light/dark token'lar, hover efektleri, dark override'lar ve bazı ekranlara özel görsel kurallar burada bulunur.

5. Ekran bazlı ayar sayfaları
   Platform, restoran/kermes, kantin, QR menü ve tenant web sitesi tarafında farklı görünüm ayar ekranları vardır.

## 2. Tema Scope Yapısı

Tema tercihi tek global anahtar olarak değil, scope bazlı saklanır.

Scope çözümleme:

- `platform`: `/platform`, `/platform-login`, `/login/platform`
- `canteen`: `/canteen`, `/login/kantin`
- `kermes`: `/kermes`, `/login/restoran`
- `public`: diğer tüm sayfalar

Kullanılan `localStorage` anahtarları:

- `penpos-theme-key:<scope>`
- `penpos-dark-mode:<scope>`

Kaynaklar:

- `frontend/src/theme/themeConfig.js`
- `frontend/src/theme/ThemeContext.jsx`
- `frontend/src/context/BusinessSettingsContext.jsx`

## 3. Sistemde Tanımlı Tema Paletleri

Aktif tema anahtarları:

- `default` -> Mevcut Tema
- `ocean` -> Ocean Blue
- `slate` -> Premium Dark
- `emerald` -> Restaurant Green
- `amber` -> Warm Gold
- `ruby` -> Ruby Red
- `coffee` -> Coffee Brown
- `indigo` -> Indigo Night
- `mono` -> Clean Mono

Her temada en az şu alanlar tanımlıdır:

- `accent`
- `accentHover`
- `accentSoft`
- `accentText`
- `sidebar`
- `topbar`
- `activeGlow`
- `gradient`
- `chart`
- `card`
- `border`
- `text`

Kaynak:

- `frontend/src/theme/themeConfig.js`

## 4. Runtime'da Üretilen Ana CSS Değişkenleri

`ThemeContext` seçilen tema ve koyu mod durumunu aşağıdaki değişkenlere çevirir:

- `--theme-accent`
- `--theme-accent-hover`
- `--theme-accent-soft`
- `--theme-accent-text`
- `--theme-active-glow`
- `--theme-gradient`
- `--theme-card-bg`
- `--theme-border`
- `--theme-text`
- `--theme-muted`
- `--app-bg`
- `--app-surface`
- `--app-surface-soft`
- `--app-border`
- `--app-text`
- `--app-text-secondary`
- `--app-text-muted`
- `--app-input`
- `--app-button-bg`
- `--panel`
- `--panelElevated`
- `--border`
- `--text`
- `--text-primary`
- `--text-secondary`
- `--muted`
- `--input-bg`
- `--button-bg`
- `--button-border`
- `--card-shadow`

Ek olarak `html[data-theme="light" | "dark"]` da bu katmanda atanır.

Kaynak:

- `frontend/src/theme/ThemeContext.jsx`

## 5. Koyu Modun Nasıl Çalıştığı

PenPOS'ta koyu mod tek işaretçiyle değil, üç farklı selector ailesiyle desteklenir:

- `[data-theme="dark"]`
- `.tenant-dark-mode`
- `.dark`

Bu sayede hem tema context üzerinden gelen dark mode hem de tenant/business sınıf tabanlı dark mod aynı CSS bloğunu kullanabilir.

### 5.1 Dark modda değişen temel token'lar

`styles.css` içinde dark blok şunları değiştirir:

- `--app-bg`
- `--app-shell-bg`
- `--app-surface`
- `--app-surface-soft`
- `--app-surface-2`
- `--app-surface-3`
- `--app-border`
- `--app-text`
- `--app-text-secondary`
- `--app-text-muted`
- `--app-input`
- `--app-button-bg`
- `--card-bg`
- `--card-hover`
- `--border-soft`
- `--border-hover`
- `--sidebar-bg`
- `--topbar-bg`
- `--modal-backdrop`
- `--surface-glass`

Bu blok aynı zamanda placeholder renklerini, muted metinleri, opacity sınıflarını ve sabit inline renklerin bir kısmını da force eder.

Kaynak:

- `frontend/src/styles.css`

### 5.2 Tenant dark mode etkileri

`BusinessSettingsContext` dark mode aktif olduğunda:

- `html` ve `body` üzerine `tenant-dark-mode` sınıfı ekler
- `themeId` ve `darkMode` bilgisini ilgili scope altında `localStorage`'a yazar
- yazı boyutu ve animasyon sınıflarını da birlikte uygular

Ek tenant sınıfları:

- `tenant-font-small`
- `tenant-font-medium`
- `tenant-font-large`
- `tenant-no-animations`
- `tenant-colorful-products`

Kaynaklar:

- `frontend/src/context/BusinessSettingsContext.jsx`
- `frontend/src/styles.css`

### 5.3 Uygulamadaki görünür koyu mod etkileri

Kodda açıkça görülen örnekler:

- sidebar yazı ve ikon renkleri değişir
- aktif menü yazı/ikon kombinasyonu değişir
- logout butonu stili değişir
- logo varyantı light/dark'a göre değişir (`/logo-2.png` ve `/logo-3.png`)
- üst yüzeyler, tablo kartları ve bazı admin satır hover'ları dark palete zorlanır

Kaynaklar:

- `frontend/src/components/Layout.jsx`
- `frontend/src/canteen/layout/CanteenLayout.jsx`
- `frontend/src/styles.css`

## 6. Kullanıcıya Açık Tema / Koyu Mod Ayarları

## 6.1 Platform hesabı tema tercihleri

Ekran:

- `platform/settings/me`

Ayarlar:

- koyu mod aç/kapat
- tema seçimi (`themeKeys` listesindeki tüm temalar)

Davranış:

- backend'e değil, doğrudan `ThemeContext` ve scoped `localStorage` üstüne kaydedilir
- platform scope'u restoran/kantin scope'larından ayrıdır

Kaynaklar:

- `frontend/src/pages/SettingsMePage.jsx`
- `frontend/src/App.jsx`

## 6.2 Restoran / Kermes sistem görünüm ayarları

Ekran:

- `kermes/settings/system`

Görünüm alanı:

- `appearance.fontSize`
- `appearance.darkMode`
- `appearance.colorfulProducts`
- `appearance.animationsEnabled`
- `appearance.themeId`

Davranış:

- tenant business settings içine kaydedilir
- kaydedildiğinde `BusinessSettingsContext` üzerinden canlı arayüze uygulanır

Kaynaklar:

- `frontend/src/pages/BusinessSettingsPage.jsx`
- `backend/src/utils/businessSettings.js`
- `frontend/src/lib/businessSettings.js`

## 6.3 Eski / ana ayarlar sayfasındaki tema kartı

Ekran:

- `kermes/settings`

Bu sayfada da tema kartı görünür. Açıklamada eski sistem temasının korunduğu ve seçimin mevcut sistemin üstüne uygulandığı belirtilir.

Kaynaklar:

- `frontend/src/pages/SettingsPage.jsx`
- `frontend/src/App.jsx`

Not:

- Asıl tenant görünüm kaydı şu anda daha kapsamlı biçimde `SettingsSystemContent` içinde yönetiliyor.

## 6.4 Kantin sistem ayarları

Ekran:

- `canteen/.../sistem` route'u altında `CanteenSettingsSystemPage`

Ayarlar:

- `appearance.themeId`
- `appearance.darkMode`

Davranış:

- tema kartına tıklanınca önizleme anında uygulanır
- `Tema Ayarlarını Kaydet` butonuna basılınca backend'e yazılır
- `Vazgeç` ile kayıt öncesi preview geri alınabilir

Kaynaklar:

- `frontend/src/canteen/pages/CanteenSettingsSystemPage.jsx`
- `backend/src/modules/canteen/services/canteenSettingsService.js`

## 6.5 Restoran public QR menü görünümü

Ekran:

- `kermes/settings/qr`

Ayarlar:

- `qrMenu.themeMode = light | dark`

İlgili ek QR ayarları:

- `enabled`
- `showLogo`
- `showCoverImage`
- `showPrices`
- `showDescriptions`
- `waiterCall`
- `multiLanguage`
- `tableQrEnabled`

Dark mod açıklaması kodda açık:

- kartlar
- çerçeveler
- modal yüzeyleri

Kaynaklar:

- `frontend/src/pages/QrMenuSettingsPage.jsx`
- `frontend/src/pages/PublicMenuPage.jsx`
- `backend/src/utils/businessSettings.js`

## 6.6 Kantin QR müşteri sayfası görünümü

Ekran:

- `frontend/src/canteen/pages/CanteenSettingsQrPage.jsx`

Ayarlar:

- `qrTitle`
- `qrDescription`
- `qrLogoUrl`
- `qrCoverImageUrl`
- `qrPhone`
- `qrWhatsapp`
- `qrEmail`
- `qrAddress`
- `qrWorkingHours`
- `qrTheme`

Önizleme komponentinde tanımlı aktif tema seçenekleri:

- `light`
- `dark`

Kaynaklar:

- `frontend/src/canteen/pages/CanteenSettingsQrPage.jsx`
- `frontend/src/canteen/components/CanteenQrPreview.jsx`
- `frontend/src/canteen/pages/CanteenQrPricePage.jsx`

## 6.7 Tenant web sitesi tema ayarları

Bileşen:

- `frontend/src/components/website/WebsiteBuilder.jsx`

UI üzerinden düzenlenebilen alanlar:

- `seo.title`
- `seo.description`
- `theme.backgroundColor`
- `theme.textColor`
- `theme.buttonColor`
- `theme.cardColor`
- `theme.borderRadius`
- `layout.contentAlign`
- `integrations.showProducts`
- `integrations.showQrMenu`
- `integrations.qrMenuUrl`
- `integrations.showOnlineOrder`
- `integrations.onlineOrderUrl`

Veri modelinde desteklenen ama mevcut builder UI'da açık alanı olmayan tema alanları:

- `theme.primaryColor`
- `theme.secondaryColor`
- `theme.buttonTextColor`
- `theme.fontFamily`

Notlar:

- `primaryColor`, `buttonTextColor` ve `fontFamily` preview'de kullanılıyor
- `secondaryColor` veri modelinde var, ancak aktif frontend kullanımına rastlanmadı

Kaynaklar:

- `frontend/src/components/website/WebsiteBuilder.jsx`
- `frontend/src/constants/tenantWebsite.js`
- `backend/src/services/tenantWebsiteService.js`
- `backend/src/models/TenantWebsiteSettings.js`

## 7. Font Boyutu ve Animasyon Ayarları

### 7.1 Font boyutu

Desteklenen değerler:

- `small`
- `medium`
- `large`

CSS karşılıkları:

- `tenant-font-small` -> `font-size: 14px`
- `tenant-font-medium` -> `font-size: 16px`
- `tenant-font-large` -> `font-size: 18px`

Not:

- Bu ayar body seviyesinde çalışıyor.
- Kod tabanında çok sayıda sabit `fontSize` inline stili bulunduğu için etkisi tüm ekranlarda eşit değildir.

### 7.2 Animasyonlar

`animationsEnabled = false` olduğunda `tenant-no-animations` sınıfı eklenir ve:

- tüm `animation` değerleri kapanır
- tüm `transition` değerleri kapanır
- `scroll-behavior` otomatik moda çekilir

Kaynaklar:

- `frontend/src/context/BusinessSettingsContext.jsx`
- `frontend/src/styles.css`

## 8. Colorful Products Ayarı

Ayar veri modelinde vardır:

- `appearance.colorfulProducts`

Davranış:

- `tenant-colorful-products` sınıfı `html` ve `body` üstüne eklenir

Bulgu:

- Aktif kaynakta bu sınıfa bağlı ek CSS veya görünür davranış bulunamadı
- Yani ayar saklanıyor ve class uygulanıyor, fakat mevcut canlı kodda pratik etkisi görünmüyor

Kaynaklar:

- `frontend/src/context/BusinessSettingsContext.jsx`
- `frontend/src/lib/businessSettings.js`
- `backend/src/utils/businessSettings.js`

## 9. Hover Sistemi

Hover efektleri büyük ölçüde `frontend/src/styles.css` içinde merkezi olarak tanımlanmış durumda.

### 9.1 Ortak hover değişkenleri

Light mod:

- `--card-hover`
- `--border-hover`

Dark mod:

- aynı değişkenler koyu tonlarla override edilir

Kaynak:

- `frontend/src/styles.css`

### 9.2 Ortak hover pattern'leri

En çok kullanılan ortak hover sınıfları:

- `.card:hover`
  Kartı hafif yukarı alır, border rengini değiştirir, `--card-hover` kullanır.

- `.btn:hover`
  Butonu hafif yukarı taşır, glow verir ve `::before` overlay görünür olur.

- `.nav-link:hover`
  Aktif menü kapsülü efekti, yukarı kalkma, glow ve active background.

- `.subnav-pill:hover`
  Alt navigasyon kapsülü için active benzeri hover efekti.

- `.hamburger-btn:hover`
  Arka planı `--card-hover` ile değiştirir.

- `.hover-lift:hover`
  Güçlü kart kaldırma efekti.

- `.hover-lift-strong:hover`
  Daha agresif kaldırma ve gölge efekti.

- `.sidebar-menu-button:hover`
  Hafif scale/translate animasyonu.

- `.sidebar-menu-button:hover .sidebar-menu-hover`
  Gizli hover katmanını görünür yapar.

Kaynak:

- `frontend/src/styles.css`

### 9.3 Varyant buton hover'ları

- `.btn--primary:hover`
- `.btn--danger:hover`
- `.btn--danger-soft:hover`

Kaynak:

- `frontend/src/styles.css`

### 9.4 Liste / tablo / satır hover'ları

- `.admin-table tbody tr:hover`
- `.canteen-sale-row:hover`
- `.delivery-order-card:hover`
- `.kasaCategoryCard:hover`
- `.txCard.clickable:hover`
- `.muted-link:hover`

Kaynak:

- `frontend/src/styles.css`

### 9.5 QR menü hover'ları

Restoran QR menü:

- `.qr-menu .category-pill:hover`
- `.qr-menu .menu-row:hover`

Public dijital menü:

- `.digital-public-menu-tab:hover`
- `.digital-public-menu-card:hover`
- `.digital-public-menu-modal-action:hover`

Demo / alternatif dijital menü:

- `.digital-menu-category-pill:hover`
- `.digital-menu-card:hover`
- `.digital-menu-card:hover .digital-menu-card-image`

Kaynak:

- `frontend/src/styles.css`

### 9.6 Ayarlar ve kart ekranları hover'ları

- `SettingsPage` içindeki `.settings-module-card:hover`
- `SettingsPage` içindeki `.settings-module-card:hover .settings-module-link`
- `BusinessSettingsPage` içindeki `.settings-module-card:hover`
- `CanteenSettingsLayout` içindeki `.canteen-settings-home-card:hover`

Kaynaklar:

- `frontend/src/pages/SettingsPage.jsx`
- `frontend/src/pages/BusinessSettingsPage.jsx`
- `frontend/src/canteen/pages/CanteenSettingsLayout.jsx`

### 9.7 Giriş / pazarlama ekranı hover'ları

Aktif hover tanımları bulunan diğer alanlar:

- marketing nav ve button hover'ları
- public auth kart hover'ları
- register kart / form hover'ları
- system login geri link ve submit hover'ları
- landing page içinde inline style bloğu ile verilen hover'lar

Kaynaklar:

- `frontend/src/styles.css`
- `frontend/src/pages/LandingPage.jsx`
- `frontend/src/components/PublicSystemLogin.jsx`

### 9.8 Modal açıkken hover bastırma

Önemli güvenlik/UX detayı:

`body.modal-open` aktifken arkadaki çoğu hover transform ve glow efekti zorla kapatılır.

Bastırılan örnekler:

- `.card:hover`
- `.btn:hover`
- `.nav-link:hover`
- `.subnav-pill:hover`
- `.hover-lift:hover`
- `.hover-lift-strong:hover`
- `.sidebar-menu-button:hover`
- `.canteen-sale-row:hover`
- `.txCard.clickable:hover`
- `.qr-menu .category-pill:hover`
- `.qr-menu .menu-row:hover`

Bu, modal açıkken arka planın yanlışlıkla "hareket ediyor" görünmesini engeller.

Kaynak:

- `frontend/src/styles.css`

## 10. Public Menü Dark Modu

Restoran public menüde dark mod `data-qr-theme="dark"` ile çalışır.

Dark modda override edilen ana parçalar:

- shell arka planı
- header arka planı
- başlık ve alt metin renkleri
- arama kutusu
- ürün kartları
- modal yüzeyleri
- tab aktif rengi
- fiyat badge'leri
- mode pill
- modal action butonu

Tema token'ları:

- `--qr-page-bg`
- `--qr-shell-bg`
- `--qr-shell-border`
- `--qr-card-bg`
- `--qr-card-border`
- `--qr-panel`
- `--qr-accent`
- `--qr-accent-text`
- `--qr-soft`
- `--qr-soft-text`
- `--qr-kicker`
- `--qr-text`
- `--qr-muted`
- `--qr-logo-bg`
- `--qr-overlay`

Kaynaklar:

- `frontend/src/pages/PublicMenuPage.jsx`
- `frontend/src/styles.css`

## 11. Login Tema Varyantları

`PublicSystemLogin` bileşeni sabit tema varyantları destekler:

- `restaurant`
- `canteen`
- `platform`

Bu varyantlar aşağıdaki login değişkenlerini tanımlar:

- `--login-accent`
- `--login-accent-strong`
- `--login-soft`
- `--login-surface`
- `--login-panel`
- `--login-panel-2`
- `--login-text`
- `--login-muted`

Not:

- Bunlar kullanıcı ayarı değildir
- sayfa/bileşen düzeyinde seçilen sabit tema varyantlarıdır

Kaynaklar:

- `frontend/src/components/PublicSystemLogin.jsx`
- `frontend/src/styles.css`
- `frontend/src/pages/SignIn.jsx`
- `frontend/src/pages/PlatformLogin.jsx`

## 12. Backend ve Veri Modeli Özeti

### 12.1 Business settings görünüm alanı

Restaurant / kermes tenant görünüm verisi:

- `appearance.fontSize`
- `appearance.darkMode`
- `appearance.colorfulProducts`
- `appearance.animationsEnabled`
- `appearance.themeId`

QR menü görünüm verisi:

- `qrMenu.themeMode`

Kaynak:

- `backend/src/utils/businessSettings.js`

### 12.2 Canteen settings görünüm alanı

- `appearance.themeId`
- `appearance.darkMode`
- `qrTheme`

Kaynak:

- `backend/src/modules/canteen/services/canteenSettingsService.js`

### 12.3 Tenant website theme veri modeli

- `theme.backgroundColor`
- `theme.textColor`
- `theme.primaryColor`
- `theme.secondaryColor`
- `theme.buttonColor`
- `theme.buttonTextColor`
- `theme.cardColor`
- `theme.borderRadius`
- `theme.fontFamily`

Kaynaklar:

- `backend/src/models/TenantWebsiteSettings.js`
- `backend/src/services/tenantWebsiteService.js`

### 12.4 Geriye dönük alias desteği

Kod içinde legacy alias'lar normalize ediliyor:

- `appearance.themeName` -> `appearance.themeId`
- `appearance.animations` -> `appearance.animationsEnabled`
- `general.closeCustomerAccounts` -> `general.disableCreditAccounts`
- `notifications.loopDeliverySound` -> `notifications.repeatPackageServiceAlert`

Bu yapı eski veri formatlarını yeni arayüze taşımaya yarıyor.

Kaynaklar:

- `frontend/src/lib/businessSettings.js`
- `backend/src/utils/businessSettings.js`

## 13. Tespit Edilen Boşluklar ve Tutarsızlıklar

### 13.1 `tenant-colorful-products` şu an etkisiz görünüyor

- Ayar mevcut
- class ekleniyor
- fakat aktif kaynakta buna bağlı stil/iş kuralı bulunamadı

### 13.2 Tenant website theme alanlarının tamamı UI'da açılmamış

Backend ve veri modeli destekliyor:

- `primaryColor`
- `secondaryColor`
- `buttonTextColor`
- `fontFamily`

Ama builder UI şu anda bunların tamamını düzenlettirmiyor.

### 13.3 `secondaryColor` saklanıyor ama aktif kullanım görünmüyor

- veri modelinde var
- normalize ediliyor
- fakat aktif frontend tüketimi görünmedi

### 13.4 Canteen QR tema seçeneklerinde backend/frontend uyumsuzluğu var

Backend izin verdiği değerler:

- `dark`
- `blue`
- `green`
- `orange`

Frontend preview / seçim tarafında görülen değerler:

- `light`
- `dark`

Ek durum:

- backend default `qrTheme` değeri `green`
- frontend fallback davranışı `light` / ilk tema

Bu nedenle `green`, `blue`, `orange` gibi değerler veri tabanında olsa bile frontend tarafında tam karşılık bulmuyor olabilir.

Kaynaklar:

- `backend/src/modules/canteen/services/canteenSettingsService.js`
- `frontend/src/canteen/components/CanteenQrPreview.jsx`
- `frontend/src/canteen/pages/CanteenQrPricePage.jsx`
- `frontend/src/canteen/pages/CanteenSettingsQrPage.jsx`

## 14. Dosya Bazlı Ana Referanslar

- `frontend/src/theme/themeConfig.js`
- `frontend/src/theme/ThemeContext.jsx`
- `frontend/src/context/BusinessSettingsContext.jsx`
- `frontend/src/styles.css`
- `frontend/src/pages/SettingsMePage.jsx`
- `frontend/src/pages/BusinessSettingsPage.jsx`
- `frontend/src/pages/SettingsPage.jsx`
- `frontend/src/pages/QrMenuSettingsPage.jsx`
- `frontend/src/pages/PublicMenuPage.jsx`
- `frontend/src/components/website/WebsiteBuilder.jsx`
- `frontend/src/canteen/pages/CanteenSettingsSystemPage.jsx`
- `frontend/src/canteen/pages/CanteenSettingsQrPage.jsx`
- `frontend/src/canteen/components/CanteenQrPreview.jsx`
- `frontend/src/canteen/pages/CanteenQrPricePage.jsx`
- `backend/src/utils/businessSettings.js`
- `backend/src/modules/canteen/services/canteenSettingsService.js`
- `backend/src/services/tenantWebsiteService.js`
- `backend/src/models/TenantWebsiteSettings.js`
- `frontend/src/components/PublicSystemLogin.jsx`

