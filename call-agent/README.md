# PenPOS Çağrı Ajanı

Bağımsız Electron + React masaüstü uygulaması. Windows COM port bağlantısı 9600 baud'da JSON satırlarını okur. ESP32 + CC1101 firmware'i 433.92 MHz OOK ham darbe örneklerini Çağrı Ajanı'na iletir; gerçek kumanda sinyaliyle protokol ve tuş kodları doğrulanana kadar bu örnekler çağrı oluşturmaz.

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

## ESP32 + CC1101 433 MHz alıcı (ham sinyal tanılama)

Arduino IDE'de `firmware/esp32_cc1101_rx/esp32_cc1101_rx.ino` dosyasını açın. ESP32 Arduino kart paketinde **ESP32 Dev Module** veya **DOIT ESP32 DEVKIT V1** seçin; harici Arduino kütüphanesi gerekmez. ESP32 ve CC1101'i 3.3 V ile besleyin; CC1101 pinlerine 5 V uygulamayın.

| CC1101 | ESP32 DevKit V1 |
|---|---|
| CSN / CS | GPIO5 |
| GDO0 | GPIO4 |
| SCK | GPIO18 |
| MISO / SO | GPIO19 |
| MOSI / SI | GPIO23 |
| VCC | 3V3 |
| GND | GND |

Sketch, CC1101'i 433.92 MHz ASK/OOK asenkron alım profilinde (MDMCFG4 `0x87`, yaklaşık 203 kHz alım bant genişliği ve yaklaşık 4.8 kbit/s modem veri hızı) çalıştırır. Önceki 58 kHz/1.2 kbit/s profiline göre daha geniş filtre ve daha hızlı slicer, bilinmeyen/ucuz kumanda vericilerindeki taşıyıcı sapması ve kısa OOK darbelerine toleransı artırmayı amaçlar; karşılığında daha fazla gürültü kabul edebilir ve gerçek donanımda menzil/sinyal kalitesi kontrol edilmelidir. Modülasyon `MDMCFG2=0x30` ile ASK/OOK, GDO0 `IOCFG0=0x0D` ile asenkron seri veri, `PKTCTRL0=0x32` ile async serial modundadır; AGC ve front-end değerleri `registers` readback listesinde raporlanır. Açılışta tüm yazılan register'lar SPI ile geri okunup beklenen değerlerle karşılaştırılır; `rf.receiver.asyncOokConfigured` ancak bu doğrulama, GDO0 interrupt kurulumu ve MARCSTATE=RX birlikte başarılıysa `true` olur. GDO0, GPIO4'te `CHANGE` interrupt'ıyla izlenir. Çerçeve sınırı 5 ms sessizlikle belirlenir ve tek çerçevede en fazla 256 darbe saklanır. `LEARN A|B|C` süresince RSSI 20 ms aralıklarla örneklenir; saniyelik `rf.diagnostics` JSON'u anlık RSSI yanında signed ham RSSI penceresinin min/max/ortalama/farkını, MARCSTATE, GDO0 seviyesi/kenar sayısı ve işlenen frame sayaçlarını verir. En az üç benzer çerçeve kararlı kümeye ulaştığında firmware tek bir `rf.capture` JSON satırı gönderir; gürültü ve geçersiz frame'ler yazdırılmaz. `signalQualityPct`, eşleşen tekrar çerçevelerinin zamanlama benzerliğidir; RSSI veya protokol güven skoru değildir. Firmware hiçbir RF sinyali göndermez.

Şema örneği (darbe süreleri sentetiktir, gerçek kumanda ölçümü değildir):

```json
{"version":1,"type":"rf.capture","eventType":"raw_capture","deviceId":"","buttonCode":"","protocol":"unknown","captureId":1,"clusterId":1,"phase":"completed","target":"A","accepted":true,"reason":"none","learnMode":true,"learnedLabel":"A","stored":{"A":true,"B":false,"C":false},"frequencyMHz":433.92,"receiverBandwidthKHz":203.1,"repeatCount":3,"signalQualityPct":94,"firstLevel":"high","stable":true,"pulseCount":12,"totalDurationUs":8400,"minPulseUs":345,"maxPulseUs":1055,"pulseUs":[350,1050,360,1040,355,1055,345,1045,350,1050,360,1040]}
```

`deviceId` ve `buttonCode` kasıtlı olarak boştur. EV1527, PT2262 ya da başka bir protokol varsayılmaz. `LEARN A/B/C`, seçilen etikete ait ham darbe şablonunu ESP32 NVS belleğine kaydeder; gerçek protokol çözülmüş değildir. Kararlı şablon eşleşmesi `rf.match` olarak gönderilir. Ajanın eşleşmiş olması ve **Masa Eşleştirme** ekranında masa seçilmesi gerekir: A garson çağrısı, B servis talebi oluşturur; C yalnızca bu kumandadan açılan bekleyen çağrı/servis taleplerini kapatır. Backend alıcı erişim anahtarını ve seçilen masanın eşleşmiş şubeye ait olduğunu doğrular.

### Donanım doğrulama adımları

1. Gücü kapatıp bağlantıları yukarıdaki tabloya göre yapın; CC1101'in 3.3 V lojik seviyesini doğrulayın.
2. Sketch'i yükleyin. Arduino Serial Monitor'u 9600 baud'da açın; açılışta alıcı yapılandırma/reset JSON satırlarını göreceksiniz. RF yakalama çıktısı için `LEARN A`, `LEARN B` veya `LEARN C` komutuyla bir oturum başlatın.
3. CR, LF ve CRLF satır sonları desteklenir; satır sonu göndermeyen istemcilerde komut 100 ms sonra tamamlanır. Komut onayından sonra `rf.diagnostics` saniyede bir gelir; boşta/öğrenme dışında sürekli ham frame çıktısı üretilmez. `rf.receiver` içindeki `registers` dizisi istenen/okunan register değerlerini karşılaştırmalı gösterir; `receiverState` `RX` olmalı ve `asyncOokConfigured` `true` olmalıdır. Kumanda basılmadan birkaç saniye `rssiWindowAvgSignedRaw` ve min/max değerlerini kaydedin, ardından kısa basışlar sırasında `rssiWindowMaxSignedRaw`, `rssiWindowDeltaSignedRaw` ve `gdo0EdgeDelta` alanlarını karşılaştırın. RSSI penceresindeki artış RF enerjisinin görüldüğünü; kenar artışı ise GPIO4'te demodüle edilmiş seri çıkışın görüldüğünü gösterir. RSSI penceresi değişmiyorsa anten/433.92 MHz uyumu, CC1101 anten bağlantısı, güç ve kumanda vericisini kontrol edin. RSSI değişiyor ama GDO0 kenarı yoksa demodülasyon, GDO0 kablosu/pin eşlemesi ve modem ayarlarını inceleyin. RSSI tek başına protokol/tuş doğrulaması değildir. Gürültü/geçersiz frame'ler NVS'ye yazılmaz ve oturumu durdurmaz. Mevcut kararlılık doğrulamasını geçen ilk sinyal NVS'ye kaydedildiğinde oturum otomatik kapanır; pulse dizisi, tekrar sayısı, toplam süre, min/max pulse ve `stored` alanları tek bir `rf.capture` JSON satırında döner. Sinyal gelmezse oturum açık kalır; `STOP` veya `LEARN OFF` komutu oturumu iptal eder ve önceden kaydedilmiş şablonları korur. `LEARN STATUS` saklı örnekleri gösterir; `LEARN CLEAR A|B|C` ilgili saklı şablonu siler.
4. B ve C tuşları için de sırasıyla `LEARN B` ve `LEARN C` oturumları başlatıp işlemi tekrarlayın. Her çıktı operatörün seçtiği hedefi `learnedLabel` olarak gösterir; `deviceId` ve `buttonCode` boş, `protocol` `unknown` kalmalıdır. Bu davranış gerçek protokol çözümü değildir.
5. Ham örnek öğrenmek için Serial Monitor kullanın; aynı anda Çağrı Ajanı'nı COM portuna bağlamayın. Öğrenme tamamlandıktan sonra Serial Monitor'ü kapatıp COM portunu Çağrı Ajanı'na bağlayın. Çağrı Ajanı `rf.match` satırlarını doğrular ve masa seçiliyse eşleşen işlemi PenPOS'a gönderir.
6. Bu yöntem ham dalga biçimi şablonlarını karşılaştırır, gerçek protokol/kimlik decoder'ı değildir. Eşleşmeyi ve A/B/C görevlerini donanım üzerinde doğrulayın. Arduino IDE ve fiziksel alıcı/kumanda olmadan firmware derlemesi ve RF doğrulaması yapılmış sayılmaz.
7. `rf.reset.resetReason` değeri `power_on` ise firmware içinde `LEARN` komutunun çağırdığı bir yeniden başlatma yoktur; ESP32 bunu güç açılışı/güç kesilip gelmesi olarak raporlar. `retainedBootCount` yazılımsal yeniden başlatmalarda artıyorsa USB-Serial DTR/RTS veya firmware reset akışı araştırılabilir; her açılışta 1'e dönmesi ve `power_on` görülmesi halinde USB kablosu/portu, 5 V besleme ve bağlantı gevşekliği test edilmelidir. Bu durum firmware ile engellenemez.

Çağrı Ajanı testlerini çalıştırmak için:

```powershell
npm test
```
