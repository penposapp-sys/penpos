# PenPOS Çağrı Ajanı

Bağımsız Electron + React masaüstü uygulaması. Bu aşamadaki seri port ekranı yalnızca Windows COM portlarını listeler, seçilen porta bağlanır ve bağlantıyı kapatır; kumanda verisi okunmaz veya çözümlenmez.

## Sanal kumanda

“Sanal Kumanda” ekranındaki üç tuş, `TEST-001` kimliğiyle test olayları üretir. Her olay ayrı bir kimliğe ve zaman damgasına sahiptir; kaynağı daima `simulator` olarak işaretlenir. Olaylar işletim sisteminin Electron kullanıcı verisi klasöründeki `simulator-events.json` dosyasına kaydedilir ve uygulama yeniden açıldığında geçmiş ekranında gösterilir.

Sanal kumanda olayları yalnızca yerel dosyaya yazılır; PenPOS backend'ine gönderilmez ve COM portundan gelen gerçek sinyal olarak gösterilmez. “İptal” tuşu yalnızca test olayı oluşturur, kayıt silmez.

Testleri çalıştırmak için:

```powershell
npm test
```

## Geliştirme

```powershell
npm install
npm run dev
```

## Production derlemesi ve çalıştırma

```powershell
npm run build
npm start
```

## PenPOS cihaz eşleştirmesi

1. Ajan içindeki **Cihaz Eşleştirme** sayfasına geçip HTTPS PenPOS adresiyle eşleştirmeyi başlatın.
2. Ajan ekranındaki oturum kimliği ve tek kullanımlık kodu PenPOS'ta **Ayarlar > Donanımlar > Masa Çağrı Sistemi** ekranına girin ve erişiminiz olan şubeyi seçerek onaylayın.
3. Eşleştirme tamamlandığında ajan güvenli token oturumuyla bağlanır; işletme, şube ve son heartbeat bilgileri görüntülenir.

Çağrı ajanı cihaz kimliği Windows kullanıcı verisi klasöründe kalıcı olarak saklanır. Access/refresh token'lar Electron `safeStorage` ile şifrelenir; Windows şifrelemesi kullanılamıyorsa token saklanmaz ve eşleştirme başlatılmaz. Uygulama yeniden açıldığında kayıtlı oturum hemen kontrol edilir; ağ kesintilerinde heartbeat yeniden denenir. PenPOS'tan cihaz yetkisi kaldırılırsa yerel oturum silinir ve yeniden eşleştirme gerekir.

Vite üretim derlemesini ve Windows NSIS kurulum paketini oluşturmak için:

```powershell
npm run dist:win
```

Komut `release/` altında Windows kurulum paketi üretir.

## Windows kurulum paketi

```powershell
npm run dist:win
```

Kurulum paketi `release/` klasörüne çıkar.

## Güvenlik ve seri port notları

- Renderer için `nodeIntegration` kapalı, `contextIsolation` ve `sandbox` açık tutulur. Seri port işlemleri yalnızca preload üzerinden sınırlı IPC çağrılarıyla main process’te yapılır.
- `serialport` native Node eklentisi olarak değerlendirildi. Electron için yeniden derlenmesi gerektiği ve bu çalışma dizininin boşluk içeren yolunda `node-gyp` derlemesinin Visual Studio C++ Build Tools istediği için bu aşamada Windows'un yerleşik PowerShell/.NET seri port desteği kullanılır; böylece ek native modül derleme gereksinimi olmaz.
- Üretim renderer’ı harici servislere bağlanmaz. Arayüz yazı tipleri yerel sistem yazı tiplerini kullanır.
- Herhangi bir COM portu yoksa liste boş kalır; bu donanımın bağlı olmadığı geliştirme ortamında beklenen durumdur.
