import React from 'react'
import { Link } from 'react-router-dom'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'
import { usePageSeo } from '../hooks/usePageSeo.js'

const pages = {
  'restoran-programi': {
    title: 'Restoran Programı | Adisyon ve Sipariş Yönetimi | PenPOS',
    description: 'PenPOS restoran programı ile masa, adisyon, mutfak ve paket servis siparişlerini yönetin. Restoran otomasyonu, POS ve rapor özelliklerini keşfedin.',
    heading: 'Restoran Programı ile masa ve sipariş akışınızı yönetin',
    introduction: 'PenPOS restoran programı; masa ve siparişleri, mutfak hazırlığını, paket servisi, tahsilatı ve raporları aynı operasyon akışında birleştirir. Restoran otomasyon programı arayan ekipler masa ve adisyon durumunu takip eder; adisyon programı işlevleri açık hesabı güncel tutarken restoran POS ekranı masalı ve masasız satışların kaydını destekler.',
    image: { src: '/images/restaurant-preview.png', alt: 'PenPOS restoran ekranında salon masalarının ve masa durumlarının görünümü', caption: 'Masaların ve açık servis durumlarının genel görünümü' },
    highlights: ['Masa, sipariş ve adisyon takibi', 'Mutfak, paket servis ve masasız satış', 'Rapor, cari ve ödeme yönetimi'],
    sections: [
      {
        heading: 'Salondaki masalardan mutfağa sipariş akışı',
        introduction: 'Masa ekranı ve adisyon, servis ekibinin aynı masa ve sipariş bilgisi üzerinde çalışmasını sağlar.',
        features: [
          { heading: 'Masa ve adisyon', text: 'Masaların durumunu görüntüleyin, siparişleri ilgili masanın adisyonuna ekleyin ve servis sürerken hesabı güncel tutun.', benefit: 'Açık masaları ve hesap içeriğini tek yerden takip etmek kolaylaşır.' },
          { heading: 'Sipariş ve mutfak', text: 'Masa siparişini mutfak ekranına aktarın; mutfak ekibi hazırlanacak siparişleri kendi iş akışında görsün.', benefit: 'Salon ve hazırlık ekibi aynı sipariş ayrıntıları üzerinden ilerler.' },
          { heading: 'Garson çağrısı', text: 'Garson çağrısı ekranında bekleyen masa çağrılarını takip edin ve ekip içinde yanıtlanmasını sağlayın.', benefit: 'Masadan gelen servis talebi görünür bir iş listesine dönüşür.' }
        ]
      },
      {
        heading: 'Paket servis ve masasız satış için ayrı akışlar',
        introduction: 'Restoran servisi yalnızca masada başlamaz. PenPOS, paket siparişleri ve masasız satış için de ayrı ekranlar sunar.',
        features: [
          { heading: 'Paket siparişi ve kurye', text: 'Paket servis ekranında siparişleri, teslimat durumunu ve kurye akışını izleyin; mutfak hazırlığıyla eşgüdümlü çalışın.', benefit: 'Teslim edilecek siparişlerin salon adisyonları arasında kaybolma riski azalır.' },
          { heading: 'Masasız satış', text: 'Walk-in satış ekranından bir masaya bağlamadan satış oluşturun. Bu, tezgahtan doğrudan satış gibi masasız işlemler için kullanılabilir.', benefit: 'Her satış için masa açmadan sipariş ve ödeme adımlarını tamamlayabilirsiniz.' },
          { heading: 'QR Menü ve online satış', text: 'Misafirler menüye QR kodla ulaşabilir. İşletme ayarlarına göre online satış bağlantısını da site veya ilgili satış akışında sunabilirsiniz.', benefit: 'Dijital menü ve online sipariş bağlantıları restoran operasyonuyla birlikte yönetilir.' }
        ]
      },
      {
        heading: 'Ürün, tahsilat ve işletme kontrolü',
        introduction: 'Günlük operasyonu tamamlayan ürün ve finans ekranları, ekip ve yöneticilerin aynı kayıt düzeninde çalışmasına yardımcı olur.',
        features: [
          { heading: 'Ürün ve kategoriler', text: 'Menü ürünlerini ve kategorilerini yönetin; ürün adı, fiyat, açıklama ve görsellerini katalogda güncel tutun.', benefit: 'Kasa, menü ve dijital sunumda kullanılacak ürün bilgileri daha düzenli yönetilir.' },
          { heading: 'Ödeme ve cari', text: 'Satış tahsilatlarını tamamlayın; cari hesap ekranlarından müşteri hesaplarını ve tahsilat hareketlerini takip edin.', benefit: 'Satış anındaki ödeme ile vadeli/cari hareketlerini ayrı ayrı izleyebilirsiniz.' },
          { heading: 'Stok bilgisi', text: 'Ürünlerde miktar ve stok takibi alanları ile malzeme/reçete stok düşme ayarları bulunur. Bu, ayrı bir stok hareketi ve sayım modülü olduğu anlamına gelmez.', benefit: 'Ürün kayıtlarında stokla ilgili mevcut alanları işletme düzeninize göre kullanabilirsiniz.' },
          { heading: 'Rapor, yazıcı, şube ve yetki', text: 'Satış raporlarını inceleyin, yazdırma ayarları ve istasyonları kullanın; şube seçimi ile personel izinlerini yönetin.', benefit: 'Yönetici satışları değerlendirebilir, görevli ekip de izin verilen ekranlara erişir.' }
        ]
      }
    ],
    workflow: {
      heading: 'Bir servis döneminde PenPOS nasıl kullanılır?',
      steps: [
        { title: 'Siparişi alın', text: 'Masalı siparişi ilgili adisyona ekleyin veya işlemi masasız satış ekranında başlatın.' },
        { title: 'Hazırlığı takip edin', text: 'Masa siparişini mutfak akışına, teslim edilecek siparişi paket servis/kurye ekranına yönlendirin.' },
        { title: 'Hesabı kapatın', text: 'Ödemeyi alın; gerekiyorsa cari hareketini ilgili müşteri hesabında takip edin.' },
        { title: 'Sonuçları değerlendirin', text: 'Raporları inceleyin ve gün sonu operasyonunu işletmenizin kayıtları üzerinden gözden geçirin.' }
      ]
    },
    website: {
      heading: 'Restoranınıza ait, müşterilerin görebildiği bir web sitesi',
      text: 'PenPOS panelinden restoranınız için herkese açık bir site oluşturup düzenleyebilir ve yayına alabilirsiniz. Hazır site görünümünü form alanlarından yönetirsiniz; serbest yerleşimli bir editör, tema seçimi veya özel alan adı özelliği değildir.',
      details: ['Logo, kapak ve galeri görselleri', 'Ana sayfa ve hakkımızda metinleri', 'Menüden seçilen ürün vitrini', 'Telefon, e-posta, adres ve harita bağlantısı', 'PenPOS site adresi için düzenlenebilir slug', 'Yayınlama/yayından kaldırma ve telefon uyumlu görünüm'],
      integration: 'Restoran sitesinde QR Menü ve online satış bağlantılarını gösterebilirsiniz.',
      image: { src: '/images/qr-preview.png', alt: 'Telefonda açılan restoran QR menüsü ve masadaki QR kod görseli', caption: 'Web sitesi, restoranın dijital menü akışına bağlantı verebilir' }
    },
    faqs: [
      { question: 'Restoran programı PenPOS ile hangi işleri yönetebilir?', answer: 'PenPOS restoran ekranlarında masa ve adisyon, sipariş ve mutfak akışı, paket servis/kurye, masasız satış, tahsilat, cari, ürün ve kategori, rapor, yazdırma, şube ve personel izinleri bulunur.' },
      { question: 'PenPOS ile hem masalı hem masasız satış yapabilir miyim?', answer: 'Evet. Masa ve adisyon akışına ek olarak walk-in satış ekranı vardır. Bu ekran masasız işlemler içindir; zamanlı ön sipariş veya özel bir gel-al rezervasyon akışı olarak tanımlanmamalıdır.' },
      { question: 'Restoran ürünlerinde stok takibi var mı?', answer: 'Ürün ayarlarında stok miktarı/takibi ve malzeme veya reçete için stoktan düşme ayarları bulunur. Ayrı, hareket ve sayım odaklı bir restoran stok modülü doğrulanmış değildir.' },
      { question: 'Restoranım için PenPOS üzerinden web sitesi yayınlayabilir miyim?', answer: 'Evet. Logo, görseller, ana sayfa metinleri, ürün vitrini ve iletişim bilgilerini düzenleyip PenPOS site adresinizde yayınlayabilirsiniz. Özel alan adı bağlama özelliği doğrulanmamıştır.' }
    ],
    related: ['restoran-otomasyon-programi', 'adisyon-programi', 'restoran-pos', 'paket-servis-programi', 'qr-menu-programi']
  },
  'restoran-otomasyon-programi': {
    title: 'Restoran Otomasyon Programı ve Sipariş Akışı | PenPOS',
    description: 'Restoran otomasyonunda masa, mutfak, paket sipariş, cari, rapor ve personel süreçlerini PenPOS ile birlikte takip edin.',
    heading: 'Restoran ekiplerinin ortak iş akışı için otomasyon programı',
    introduction: 'Restoran otomasyonu, farklı işleri tek ekranda toplamak kadar sipariş bilgisinin doğru ekibe ulaşmasını da gerektirir. PenPOS’ta masa/adisyon, mutfak, paket servis, ödeme ve yönetim ekranları restoranın günlük akışına göre birlikte kullanılır.',
    image: { src: '/images/reports-preview.png', alt: 'PenPOS restoran rapor ekranında satış, tahsilat, açık masa ve paket sipariş özetleri', caption: 'Satış, tahsilat ve operasyon özetlerinin rapor ekranındaki görünümü' },
    highlights: ['Siparişten hazırlığa takip', 'Salon ve paket satış ekranları', 'Yönetim, rapor ve personel izinleri'],
    sections: [
      {
        heading: 'Sipariş nereden gelirse gelsin ilgili ekrana ulaşsın',
        introduction: 'Her sipariş türünün işleyişi farklıdır. PenPOS, restoran içi ve dijital kanalları destekleyen ekranlar sunar.',
        features: [
          { heading: 'Masa siparişi', text: 'Masayı seçip siparişleri adisyona ekleyin; ekibiniz açık masa ve hesap içeriğini izlesin.', benefit: 'Servis devam ederken siparişin hangi masaya ait olduğu net kalır.' },
          { heading: 'Mutfak hazırlığı', text: 'Siparişleri mutfak ekranında takip edin. Mutfak ekibi bekleyen işleri salon masasından bağımsız şekilde görebilir.', benefit: 'Sipariş ile hazırlık arasında ortak bir dijital kayıt oluşur.' },
          { heading: 'Paket ve kurye', text: 'Paket servis siparişlerini teslimat ve kurye ekranlarında izleyin.', benefit: 'Teslimat işi için ayrı bir operasyon görünümü kullanılır.' },
          { heading: 'Walk-in ve QR', text: 'Masa açmadan satış alın; QR Menü ile müşterilerin menüye telefondan erişmesini sağlayın.', benefit: 'Tezgâh satışı ve dijital menü, masa servisinden ayrı kullanım seçenekleri sunar.' }
        ]
      },
      {
        heading: 'Tahsilat ve müşteri hesaplarını kayıtlı tutun',
        introduction: 'Servis veya teslimat tamamlandığında ödeme ve cari işlemleri de operasyonun parçasıdır.',
        features: [
          { heading: 'Ödeme adımı', text: 'POS akışında satışı tamamlayıp tahsilatı kaydedin; işletme ödeme yöntemlerini ayarlardan yönetebilir.', benefit: 'Günlük satışlar raporlarda izlenebilir hale gelir.' },
          { heading: 'Cari hesaplar', text: 'Müşteri cari kayıtlarını ve detay ekranlarındaki tahsilat/hareketleri takip edin.', benefit: 'Cari hesap hareketleri günlük kasa satışlarıyla karıştırılmadan izlenebilir.' },
          { heading: 'Ürün ve menü yönetimi', text: 'Ürün ve kategorileri katalog ayarlarından güncelleyin. Ürün kayıtlarında stok miktarı/takibi ve malzeme stok düşme seçenekleri bulunur.', benefit: 'Menü içeriği ile operasyon ekranlarında kullanılacak ürün bilgileri merkezi yönetilir.' }
        ]
      },
      {
        heading: 'Şube ve ekip yönetimini işletme yapısına uydurun',
        introduction: 'Yönetici ekranları günlük işlem kayıtlarından daha geniş bir kontrol sağlar.',
        features: [
          { heading: 'Rapor ve yazdırma', text: 'Satış raporlarını inceleyin; yazdırma ayarları, fiş ve print station ekranlarını kullanın.', benefit: 'Yönetim çıktıları ve satış değerlendirmesi operasyon içinde erişilebilir olur.' },
          { heading: 'Şube seçimi', text: 'Şube yönetimi ve aktif şube seçimi üzerinden uygun işletme konumunda çalışın.', benefit: 'Birden fazla konumu olan işletmeler doğru şubeyi seçerek işlem yapabilir.' },
          { heading: 'Personel ve izinler', text: 'Personel ekranından ekip erişimlerini yönetin; uygulama ekranları izinlere göre sınırlandırılır.', benefit: 'Çalışanlar görevleri için gereken ekranlara erişir.' },
          { heading: 'Garson çağrısı ve online satış', text: 'Garson çağrılarını takip edin; restoranın online satış ayarları ve müşteri satış ekranlarıyla dijital sipariş kanalını yönetin.', benefit: 'Salon desteği ve web üzerinden satış, aynı işletme yönetimiyle ilişkilendirilir.' }
        ]
      }
    ],
    workflow: {
      heading: 'Siparişin ekipler arasındaki yolculuğu',
      steps: [
        { title: 'Kanalı seçin', text: 'Masalı servis, walk-in satış veya paket sipariş için uygun ekranı kullanın.' },
        { title: 'Hazırlık ekibine iletin', text: 'Mutfak ekranındaki sipariş bilgisi üzerinden hazırlığı takip edin.' },
        { title: 'Teslim edip tahsil edin', text: 'Sipariş türüne göre servisi veya teslimatı tamamlayıp ödemeyi kaydedin.' },
        { title: 'Yönetimi gözden geçirin', text: 'Rapor, cari hareketleri ve personel/şube ayarlarını kullanarak operasyonu takip edin.' }
      ]
    },
    website: {
      heading: 'Otomasyon panelinden restoran web sitenizi de yönetin',
      text: 'PenPOS, restoran yönetimi yanında işletmenizin müşterilere açık sitesini düzenleme ve yayınlama imkânı verir. Bu hazır site akışında logo ve görselleri, ana sayfa/hakkımızda metinlerini, ürün vitrini ve iletişim alanlarını yönetebilirsiniz.',
      details: ['Kapak ve galeri görselleriyle işletmenizi tanıtın', 'Katalog ürünlerinden vitrinde gösterilecekleri belirleyin', 'Adres, telefon, e-posta ve harita bağlantısı ekleyin', 'Slug tabanlı PenPOS adresinde yayınlayın veya yayından kaldırın', 'Mobil uyumlu sayfada QR Menü ve online satış bağlantısı sunun'],
      integration: 'Site ayarları tema seçimi, serbest sayfa yerleşimi veya özel domain desteği içermez.',
      image: { src: '/images/restaurant-preview.png', alt: 'PenPOS restoran yönetim panelinin masa operasyonu ekranı', caption: 'Restoran operasyonu ile işletmenin dijital kanalları aynı yönetim çatısı altında' }
    },
    faqs: [
      { question: 'Restoran otomasyonu hangi işleri kapsıyor?', answer: 'Kodda masa/adisyon, sipariş, mutfak, paket servis/kurye, walk-in satış, QR Menü, ödeme, cari, ürün/kategori, rapor, yazdırma, şube, personel izinleri ve garson çağrısı ekranları bulunuyor.' },
      { question: 'Otomasyon stokları otomatik olarak düşürüyor mu?', answer: 'Ürün ayarlarında miktar/stok takibi ve malzeme/reçete stoktan düşme seçenekleri görülüyor. Bunlar tek başına tüm restoran satışlarında otomatik düşümü veya ayrı bir stok yönetim modülünü kanıtlamaz.' },
      { question: 'Restoran web sitesi bu sisteme bağlı mı?', answer: 'Evet. Site ürün vitrini katalog verisini kullanabilir; QR Menü ve online satışa yönlendiren bağlantılar yapılandırılabilir.' }
    ],
    related: ['restoran-programi', 'adisyon-programi', 'paket-servis-programi', 'market-programi']
  },
  'adisyon-programi': {
    title: 'Adisyon Programı: Masa ve Hesap Takibi | PenPOS',
    description: 'PenPOS adisyon programıyla masa siparişlerini, açık hesapları, mutfak aktarımını ve tahsilat adımlarını restoran akışında yönetin.',
    heading: 'Masaya bağlı sipariş ve hesap takibi için adisyon programı',
    introduction: 'Yoğun serviste adisyon, masadaki siparişlerin ve hesabın güncel kaydıdır. PenPOS’ta masa durumu, sipariş ekleme, mutfak akışı ve ödeme adımları restoran POS sürecine bağlanır; ekip masanın içeriğini ayrı ayrı kâğıtlardan takip etmek zorunda kalmaz.',
    image: { src: '/images/restaurant-preview.png', alt: 'PenPOS ekranında açık ve boş masa durumlarını gösteren restoran masa planı', caption: 'Masa durumlarına göre servis ve adisyon takibi' },
    highlights: ['Masaya bağlı sipariş kaydı', 'Mutfak ekranına sipariş aktarımı', 'Ödeme ve cari hareketlerinin takibi'],
    sections: [
      {
        heading: 'Masa ve açık adisyonu güncel tutun',
        introduction: 'Servis boyunca masanın durumu ve sipariş içeriği değişebilir; masa/adisyon ekranları bu bilgiyi birlikte yönetmeye yarar.',
        features: [
          { heading: 'Masa durumunu görün', text: 'Masa ekranında masaları ve durumlarını takip edin. Bir masa seçerek ilgili servis işlemlerine geçin.', benefit: 'Ekip hangi masanın işlem beklediğini tek görünümde fark edebilir.' },
          { heading: 'Siparişleri adisyona ekleyin', text: 'Yeni siparişleri doğru masaya kaydedin ve servis sürerken mevcut adisyonu güncelleyin.', benefit: 'Sipariş satırları ve masa ilişkisi kayıtlı kalır.' },
          { heading: 'Garson çağrısına yanıt verin', text: 'Garson çağrısı ekranında gelen çağrıları görün ve ekip içinde takip edin.', benefit: 'Müşteri talebi servis ekibinin gözden kaçırmaması için ayrı listelenir.' }
        ]
      },
      {
        heading: 'Adisyondan mutfağa ve ödeme adımına geçin',
        introduction: 'Sipariş kaydının ardından hazırlık, servis ve tahsilat süreçleri de işletme ekranlarında izlenebilir.',
        features: [
          { heading: 'Mutfak siparişleri', text: 'Adisyonla ilişkili siparişleri mutfak ekranına taşıyın; mutfak ekibi hazırlanacak işleri oradan takip etsin.', benefit: 'Sipariş bilgisinin hazırlık ekibine aktarılması kolaylaşır.' },
          { heading: 'Hesabı tahsil edin', text: 'POS üzerinden ödeme adımlarını tamamlayıp satışı kaydedin; cari hesap gerekiyorsa müşteri hareketini ayrı takip edin.', benefit: 'Masa hesabı, satış tahsilatı ve cari kayıtları görünür iş akışlarına ayrılır.' },
          { heading: 'Fiş ve satış görünümü', text: 'Yazıcı ayarları ve print station üzerinden yazdırma akışını kullanın; raporlardan satış sonuçlarını inceleyin.', benefit: 'Servis işleminin çıktısı ve dönemsel değerlendirmesi erişilebilir olur.' }
        ]
      },
      {
        heading: 'Adisyon dışındaki satışları da aynı işletmede yönetin',
        introduction: 'Adisyon masa servisinin merkezindedir; PenPOS’un diğer restoran ekranları farklı sipariş türlerini destekler.',
        features: [
          { heading: 'Masasız ve paket satış', text: 'Walk-in ekranı masaya bağlanmayan satış içindir. Paket servis ve kurye ekranları teslimat siparişlerini ayrı izler.', benefit: 'Masa dışı siparişler salon adisyonlarıyla karışmadan yönetilir.' },
          { heading: 'Ürün ve kategori', text: 'Menü ürünlerini ve kategorilerini katalog ayarlarından yönetin; ürün değişikliklerini işletme menüsüyle eşleştirin.', benefit: 'Servis ekibinin kullandığı ürün listesi daha tutarlı kalır.' },
          { heading: 'Şube ve personel', text: 'Şube seçimi ve personel izinleriyle ekip erişimini işletme düzeninize göre yönetin.', benefit: 'Kullanıcılar yetkileri kapsamındaki operasyonlara erişir.' }
        ]
      }
    ],
    workflow: {
      heading: 'Bir masa adisyonunun örnek akışı',
      steps: [
        { title: 'Masayı açın', text: 'Masa durumundan işlem yapılacak masayı seçin.' },
        { title: 'Siparişi kaydedin', text: 'Ürünleri masanın adisyonuna ekleyin ve sipariş bilgisini mutfağa iletin.' },
        { title: 'Servisi tamamlayın', text: 'Garson çağrılarını ve açık siparişi takip ederek masa hizmetini sürdürün.' },
        { title: 'Tahsilat yapın', text: 'Hesabı POS ekranında tamamlayın; gerektiğinde fiş yazdırıp rapordan satış kaydını inceleyin.' }
      ]
    },
    website: {
      heading: 'Adisyon sisteminizin yanında restoran web sitenizi yayınlayın',
      text: 'İşletme yöneticisi PenPOS panelinde restoranına ait herkese açık siteyi hazırlayıp yayına alabilir. İşletme tanıtımı ve ürün vitrini müşteriler tarafından görüntülenebilir; bu site, adisyon ekranının yerine geçen bir servis aracı değildir.',
      details: ['Logo, kapak ve galeri görselleri yükleyin', 'Ana sayfa ve hakkımızda alanlarını düzenleyin', 'Menüden öne çıkacak ürünleri belirleyin', 'Telefon, e-posta, adres ve harita bağlantısı ekleyin', 'Slug adresinde yayınlayın ve mobil görünümde sunun'],
      integration: 'Restoran web sitesi QR Menüye ve yapılandırılmış online satış bağlantısına yönlendirme sağlayabilir.',
      image: { src: '/images/qr-preview.png', alt: 'Restoran QR menüsünün telefon ekranındaki ürün listesi', caption: 'Müşteriler işletme menüsüne QR üzerinden erişebilir' }
    },
    faqs: [
      { question: 'Adisyon siparişleri mutfağa iletilebilir mi?', answer: 'Evet. Restoran uygulamasında mutfak ekranı ve masa sipariş akışı bulunur.' },
      { question: 'Masa açmadan satış alabilir miyim?', answer: 'Walk-in satış ekranı masaya bağlı olmayan satış için mevcut. Kodda ayrı bir zamanlı gel-al rezervasyon akışı doğrulanmadı.' },
      { question: 'Adisyon ve cari hesap aynı şey mi?', answer: 'Masa adisyonu servis siparişini/hesabını takip eder; cari ekranları müşteri hesapları ve tahsilat hareketleri için ayrı akış sunar.' }
    ],
    related: ['restoran-programi', 'restoran-pos', 'restoran-otomasyon-programi', 'paket-servis-programi']
  },
  'restoran-pos': {
    title: 'Restoran POS Sistemi: Sipariş ve Tahsilat | PenPOS',
    description: 'PenPOS restoran POS ile masa ve masasız satışları, adisyonu, mutfak siparişlerini, paket servisi ve tahsilatı takip edin.',
    heading: 'Restoran satış noktasında siparişten tahsilata net akış',
    introduction: 'Restoran POS yalnızca ödeme alma ekranı değildir; siparişin masa, mutfak ve teslimat süreçleriyle ilişkisini de korumalıdır. PenPOS restoran POS’ta masalı sipariş ve adisyon, walk-in satış, paket servis, ödeme ve satış raporları restoran operasyonuna uygun ayrı ekranlarda bulunur.',
    image: { src: '/images/reports-preview.png', alt: 'PenPOS restoran POS rapor panelinde tahsilat, masa ve paket sipariş özetleri', caption: 'POS işlemlerinin satış ve tahsilat raporlarına yansıması' },
    highlights: ['Masa ve adisyonla satış', 'Paket ve masasız satış ekranları', 'Ödeme, fiş ve rapor takibi'],
    sections: [
      {
        heading: 'İşletmenizin servis biçimine uygun satış başlatın',
        introduction: 'Her işlem masa hesabı değildir. PenPOS satış ekranları restoranın farklı sipariş türlerine göre kullanılır.',
        features: [
          { heading: 'Masalı POS satışı', text: 'Masayı seçip siparişleri adisyona ekleyin; masa hesabını servis süresince güncel tutun.', benefit: 'Tahsilatın hangi masa siparişine ait olduğu izlenebilir.' },
          { heading: 'Walk-in satış', text: 'Müşteri için masa açmadan satış oluşturun. Bu ekran, masaya bağlanmayan doğrudan satış akışıdır.', benefit: 'Tezgahtan veya hızlı servis noktasından alınan satış için masa adisyonu gerekmez.' },
          { heading: 'Paket sipariş', text: 'Teslimat siparişlerini paket servis ve kurye ekranlarında takip edin.', benefit: 'Salon satışları ile teslimat işlerinin operasyonu birbirinden ayrılır.' }
        ]
      },
      {
        heading: 'Sipariş, mutfak ve tahsilat bilgilerini eşleştirin',
        introduction: 'Satış adımlarının aynı ürün ve sipariş bilgisi üzerinde ilerlemesi günlük kontrolü kolaylaştırır.',
        features: [
          { heading: 'Mutfak akışı', text: 'Sipariş ayrıntılarını mutfak ekranında hazırlık ekibiyle paylaşın.', benefit: 'Hazırlık ekibi sipariş bilgisine kendi ekranından erişir.' },
          { heading: 'Ödeme ve cari', text: 'POS satışını tahsil edin; müşteri cari hesabı ve hareketlerini cari ekranında yönetin.', benefit: 'Anlık ödeme ile müşteri hesabı hareketini uygun akışlarda takip edebilirsiniz.' },
          { heading: 'Yazdırma ve rapor', text: 'Fiş/yazdırma ekranlarından çıktı alın ve satış raporlarıyla gerçekleşen işlemleri değerlendirin.', benefit: 'İşlem kaydı ve dönem özeti yöneticinin incelemesine hazır olur.' }
        ]
      },
      {
        heading: 'POS çevresindeki işletme ayarları',
        introduction: 'Satış ekranları ürün kataloğu, ekip ve şube yapılandırmalarıyla birlikte çalışır.',
        features: [
          { heading: 'Ürün ve kategoriler', text: 'Menü katalog ekranından satışta kullanılacak ürün ve kategorileri yönetin.', benefit: 'Kasa ürünlerinin adını ve fiyat bilgisini güncel tutmak kolaylaşır.' },
          { heading: 'Stok alanları', text: 'Ürün düzenleme ekranında stok miktarı/takibi ile malzeme stoktan düşme ayarları bulunur; ayrıca restoran stok hareket/sayım modülü olduğu varsayılmamalıdır.', benefit: 'Ürün kartındaki mevcut stok bilgileri ve ayarları işletme tarafından görülebilir.' },
          { heading: 'Şube ve kullanıcı yetkisi', text: 'Aktif şubeyi seçin, personel kayıtlarını ve uygulama izinlerini yönetin.', benefit: 'POS erişimi çalışan rol ve yetkileriyle kontrol edilir.' }
        ]
      }
    ],
    workflow: {
      heading: 'POS üzerinde örnek bir satış',
      steps: [
        { title: 'Satış türünü belirleyin', text: 'Masa, walk-in veya paket sipariş için uygun ekranı açın.' },
        { title: 'Ürünleri ekleyin', text: 'Katalogdan siparişi oluşturun ve gerekiyorsa mutfak hazırlık akışına aktarın.' },
        { title: 'Tahsilatı tamamlayın', text: 'POS ödeme adımını bitirin; gerekiyorsa cari hareketini ilgili müşteri hesabına kaydedin.' },
        { title: 'İşlemi kontrol edin', text: 'Fiş/yazdırma akışını kullanın ve satış raporundan kaydı inceleyin.' }
      ]
    },
    website: {
      heading: 'Restoran POS’unuzla birlikte işletme web sitenizi yönetin',
      text: 'PenPOS müşterisi, kendi işletmesi için herkese açık bir web sitesi oluşturup panelden temel içeriklerini düzenleyebilir ve yayınlayabilir. Site; ürün/menü vitrini ve müşteriye ulaşma bilgileriyle POS’un yanında çalışan bir tanıtım kanalıdır.',
      details: ['İşletme logosu, kapak ve galeri görselleri', 'Ana sayfa ve hakkımızda içerikleri', 'Katalogdan seçilen ürün vitrini', 'Adres, telefon, e-posta ve harita bağlantısı', 'PenPOS slug adresi ve yayın durumu', 'Telefon ve tablet ekranına uyumlu görünüm'],
      integration: 'Restoran sitesine QR Menü ve online satış butonları eklenebilir. Özel alan adı ve tema/renk/font editörü yoktur.',
      image: { src: '/images/qr-preview.png', alt: 'Telefonla görüntülenen restoran menüsü ve QR kod üzerinden menüye erişim', caption: 'Web sitesinden QR Menü ve online satış kanallarına geçiş' }
    },
    faqs: [
      { question: 'Restoran POS ile paket sipariş alınabilir mi?', answer: 'Evet. Restoran uygulamasında paket servis ve kurye için ayrı sipariş ekranları bulunur.' },
      { question: 'Barkod okuyucu restoran POS’ta destekleniyor mu?', answer: 'Ürün kartlarında barkodla ilgili alan bulunabilir; ancak restoran POS için çalışan barkod okuyucu satış akışı doğrulanmadı.' },
      { question: 'Restoran POS satışları raporlanıyor mu?', answer: 'Evet. Restoran rapor ekranlarında satış ve ilgili işletme özetleri bulunur.' }
    ],
    related: ['adisyon-programi', 'restoran-programi', 'paket-servis-programi', 'qr-menu-programi']
  },
  'qr-menu-programi': {
    title: 'QR Menü Programı: Dijital Restoran Menüsü | PenPOS',
    description: 'PenPOS QR Menü ile restoran ürün ve kategorilerini telefonda sunun; menüyü işletme sitenizden ve restoran operasyonundan yönetin.',
    heading: 'Restoran menüsünü müşterinin telefonuna taşıyan QR Menü',
    introduction: 'Müşteriler masadaki QR kodu okutarak restoran menüsünü telefonlarında açabilir. PenPOS’ta menü ürün ve kategorileri işletme kataloğundan yönetilir; QR Menü, masa/adisyon, ürün düzenleme ve restoranın web sitesiyle birlikte kullanılabilir.',
    image: { src: '/images/qr-preview.png', alt: 'PenPOS QR Menü ekranında kategori ve yemek listesi ile masadaki QR menü kodu', caption: 'Müşteri telefonu ve QR menü görseli' },
    highlights: ['Telefonla QR kod üzerinden erişim', 'Katalogdan ürün ve kategori sunumu', 'Restoran web sitesiyle bağlantı'],
    sections: [
      {
        heading: 'Misafirler menüye kendi telefonlarından ulaşsın',
        introduction: 'QR menü bağlantısı, müşterinin fiziksel menü almadan ürün listesini açmasını sağlar.',
        features: [
          { heading: 'QR kod ile açılan menü', text: 'Müşteri işletmeye ait QR bağlantısını tarayarak herkese açık menü ekranına gider.', benefit: 'Menüye erişim için müşterinin kendi telefonu yeterlidir.' },
          { heading: 'Kategoriler ve ürün bilgileri', text: 'Menüde kategoriler ve ürün sunumları yer alır; ürün adları, fiyatları, açıklamaları ve görselleri katalog verileriyle ilişkilidir.', benefit: 'Müşteriler sipariş vermeden önce ürün seçeneklerini inceleyebilir.' },
          { heading: 'Menü içeriğini yönetme', text: 'İşletme panelinin ürün/kategori ve QR ayarları üzerinden menü içeriği ve bağlantısını düzenleyin.', benefit: 'Katalogda yapılan işletme güncellemeleri dijital sunumda yönetilebilir.' }
        ]
      },
      {
        heading: 'QR Menü ile sipariş akışının sınırını bilin',
        introduction: 'Dijital menü ve sipariş alma birbirine bağlı olabilir; ancak her QR menü görüntülemesi tek başına bir sipariş oluşturmaz.',
        features: [
          { heading: 'Menüyü görüntüleme', text: 'Müşteri QR kodu okutup menüyü inceler. Menüye erişim, müşterinin ürünleri görmesini sağlar.', benefit: 'Basılı menü içeriğini telefondan erişilebilir hale getirirsiniz.' },
          { heading: 'Online satış bağlantısı', text: 'Restoran ayarlarında online satış seçeneği ve bağlantısı ayrıca yapılandırılabilir.', benefit: 'Sipariş/ödeme gerektiren akışa menü ekranından ayrı bir bağlantı verilebilir.' },
          { heading: 'Masa servisi', text: 'Restoran ekibi masa siparişlerini POS/adisyon ekranında yönetir ve mutfak akışına aktarır.', benefit: 'Müşteri menü deneyimi ile işletme içi sipariş takibi uygun ekranlarda yürür.' }
        ]
      },
      {
        heading: 'Dijital menüyü restoranın diğer ekranlarıyla kullanın',
        introduction: 'QR Menü tek başına katalog oluşturmaz; PenPOS restoran ürün ve yönetim yapısıyla birlikte çalışır.',
        features: [
          { heading: 'Masa ve adisyon', text: 'Personel masaları ve siparişleri restoran POS/adisyon ekranında takip eder.', benefit: 'Dijital sunum işletmenin gerçek servis akışından ayrı kalmaz.' },
          { heading: 'Ürün ve kategori düzenleme', text: 'Menü öğeleri ve kategoriler işletme panelinde düzenlenir.', benefit: 'İçerik bakımı için herkese açık sayfayı tek tek değiştirmek gerekmez.' },
          { heading: 'İşletme web sitesi', text: 'Restoranın herkese açık sitesinde ürün vitrini, QR Menü ve yapılandırılan online satış bağlantıları sunulabilir.', benefit: 'Müşteri işletme bilgilerine ve dijital menüye farklı kanallardan ulaşabilir.' }
        ]
      }
    ],
    workflow: {
      heading: 'Müşterinin menüyü açmasından siparişe',
      steps: [
        { title: 'QR kodu okutun', text: 'Müşteri masadaki veya işletmenin paylaştığı QR kodu telefonuyla tarar.' },
        { title: 'Menüyü inceleyin', text: 'Kategorileri ve ürün bilgilerini herkese açık menü ekranında görüntüler.' },
        { title: 'Sipariş kanalını kullanın', text: 'İşletmenin akışına göre online satış bağlantısına geçer veya personelden sipariş verir.' },
        { title: 'Restoran siparişi yönetsin', text: 'Personel siparişi POS/adisyon ve mutfak ekranlarında takip eder.' }
      ]
    },
    website: {
      heading: 'QR Menü, restoran web sitenizin parçası olabilir',
      text: 'PenPOS müşterileri kendi işletmeleri için yayınlanabilir bir web sitesi oluşturabilir. Site üzerinde işletme tanıtımı, ürün vitrini ve iletişim bilgileriyle birlikte QR Menü bağlantısı gösterilebilir.',
      details: ['Logo, kapak görseli ve galeri ekleyin', 'Ana sayfa ve hakkımızda metnini düzenleyin', 'Menüden öne çıkan ürünleri seçin', 'Adres, telefon, e-posta ve harita bağlantısını paylaşın', 'Slug adresini belirleyip siteyi yayınlayın', 'Telefon ve tabletlerde kullanılabilir görünüm sunun'],
      integration: 'Bu, form tabanlı içerik ayarı olan hazır bir site görünümüdür; tema seçimi, serbest tasarım, renk/font özelleştirme veya özel domain değildir.',
      image: { src: '/images/restaurant-preview.png', alt: 'PenPOS restoran yönetim ekranında masalar ve restoran işletme bölümleri', caption: 'Dijital menü, restoranın katalog ve servis yönetimiyle ilişkilidir' }
    },
    faqs: [
      { question: 'Müşteri QR menüyü uygulama indirmeden açabilir mi?', answer: 'QR kod üzerinden telefon tarayıcısında açılan herkese açık menü ekranı bulunuyor; ayrı bir müşteri uygulaması kurulumu gerektiren akış görünmüyor.' },
      { question: 'QR menü görüntülemek siparişi otomatik olarak mutfağa iletir mi?', answer: 'Menü görüntüleme ve online satış ayrı ayarlanabilir. Restoran siparişi POS/adisyon ve mutfak ekranlarında yönetilir; her menü görüntülemesi sipariş oluşturmaz.' },
      { question: 'QR Menü bağlantısı web sitesinde yer alabilir mi?', answer: 'Evet. Restoran web sitesi ayarlarında QR Menü butonu ve bağlantısı yapılandırılabilir.' }
    ],
    related: ['restoran-programi', 'restoran-pos', 'adisyon-programi', 'restoran-otomasyon-programi']
  },
  'paket-servis-programi': {
    title: 'Paket Servis Programı: Sipariş ve Kurye Takibi | PenPOS',
    description: 'PenPOS paket servis programında teslimat siparişlerini, mutfak hazırlığını ve kurye akışını restoran satışlarıyla birlikte yönetin.',
    heading: 'Restoran teslimat siparişleri için düzenli paket servis akışı',
    introduction: 'Paket siparişler, salon servisinden farklı olarak hazırlık ve teslimat koordinasyonu gerektirir. PenPOS’ta paket servis ve kurye ekranları sipariş takibini restoran POS, mutfak, ödeme ve rapor akışlarının yanında yürütür.',
    image: { src: '/images/restaurant-preview.png', alt: 'PenPOS restoran panelinde Paket Servis ve Paket Kurye ekran bağlantıları', caption: 'Paket servis ve kurye ekranları restoran yönetim panelinde yer alır' },
    highlights: ['Paket siparişleri için ayrı ekran', 'Mutfak ve kurye takibi', 'Walk-in masasız satıştan ayrı akış'],
    sections: [
      {
        heading: 'Teslim edilecek siparişi salon adisyonundan ayırın',
        introduction: 'Paket siparişi, masadaki servisten farklı bilgiler ve teslimat adımları içerir.',
        features: [
          { heading: 'Paket servis listesi', text: 'Paket siparişleri teslimat ekranında görüntüleyip durumlarını takip edin.', benefit: 'Teslimat bekleyen işler masalı servis ekranına karışmaz.' },
          { heading: 'Kurye akışı', text: 'Kurye ekranında teslimatla ilgili siparişleri ve ilerleme durumunu takip edin.', benefit: 'Ekip teslimata çıkacak veya teslimat sürecindeki işleri görünür biçimde izleyebilir.' },
          { heading: 'Sipariş bilgisi', text: 'Paket sipariş kaydını restoran sipariş ve satış düzeni içinde yönetin.', benefit: 'Hazırlık ve teslimat ekibinin ilgili sipariş kaydına ulaşması kolaylaşır.' }
        ]
      },
      {
        heading: 'Hazırlık, müşteri ve ödeme adımlarını koordine edin',
        introduction: 'Sipariş mutfağa ulaşmalı, ödeme tamamlanmalı ve teslimat adımı takip edilebilmelidir.',
        features: [
          { heading: 'Mutfak hazırlığı', text: 'Sipariş bilgilerini mutfak ekranında takip ederek teslimat hazırlığını restoranın hazırlık akışıyla ilişkilendirin.', benefit: 'Teslimat siparişleri için mutfak hazırlığı ekipçe izlenir.' },
          { heading: 'Ödeme ve cari', text: 'POS’ta satış ödemesini tamamlayın; müşteri cari kaydı veya tahsilatı gerekiyorsa cari hesap ekranını kullanın.', benefit: 'Anlık tahsilat ve cari hareketi ayrı kayıt akışlarında bulunur.' },
          { heading: 'Ürün, fiş ve rapor', text: 'Siparişteki ürünleri katalogdan yönetin, yazdırma ekranlarını kullanın ve satış raporlarında sonuçları inceleyin.', benefit: 'Teslimat işinin ürün ve satış kayıtları yönetilebilir.' }
        ]
      },
      {
        heading: 'Gel-al beklentisi ile mevcut akışı doğru ayırın',
        introduction: 'PenPOS’ta walk-in satış ekranı ve paket teslimat ekranı doğrulanmıştır; bunlar özel rezervasyonlu pickup modülüyle aynı şey değildir.',
        features: [
          { heading: 'Masasız satış', text: 'Walk-in ekranı, satışın restoran masasına bağlanmadan oluşturulmasını sağlar.', benefit: 'Tezgahtan alınan doğrudan satış için masa açmaya gerek kalmaz.' },
          { heading: 'Paket teslimat', text: 'Teslim edilecek siparişler paket servis ve kurye akışında takip edilir.', benefit: 'Kurye/teslimat operasyonu için ayrı görünüm sağlanır.' },
          { heading: 'Online sipariş kanalı', text: 'Online satış ayarları ve müşteri ekranları, restoranın internet üzerinden sipariş kanalını destekler.', benefit: 'Restoran, etkinleştirdiği dijital sipariş yolunu kendi operasyonunda kullanabilir.' }
        ]
      }
    ],
    workflow: {
      heading: 'Paket siparişin örnek iş akışı',
      steps: [
        { title: 'Siparişi kaydedin', text: 'Paket siparişini ilgili restoran satış akışında oluşturun veya gelen sipariş ekranında açın.' },
        { title: 'Hazırlığı yönetin', text: 'Mutfak ekranında sipariş ayrıntılarını takip edin.' },
        { title: 'Teslimatı izleyin', text: 'Paket servis ve kurye ekranlarında siparişin teslimat adımını takip edin.' },
        { title: 'Satışı kontrol edin', text: 'Ödemeyi/cari hareketini tamamlayıp rapor ve yazdırma akışından kaydı inceleyin.' }
      ]
    },
    website: {
      heading: 'Paket servis müşterileri için işletmenizin web sitesi',
      text: 'PenPOS ile restoranınız için herkese açık bir işletme web sitesi oluşturup yayınlayabilirsiniz. Müşteri kapak görseli, galeri, hakkımızda içeriği, ürün vitrini ve iletişim bilgileri üzerinden işletmenizi tanır.',
      details: ['Logo ve işletme görsellerini yükleyin', 'Ana sayfa ve hakkımızda alanlarını düzenleyin', 'Menüden seçilen ürünleri sergileyin', 'Telefon, e-posta, adres ve harita bağlantısı paylaşın', 'Slug tabanlı PenPOS adresini ayarlayıp yayınlayın', 'Telefon/tablet uyumlu sayfada erişim sağlayın'],
      integration: 'Restoran sitesinden QR Menüye veya yapılandırılmış online sipariş bağlantısına yönlendirme yapılabilir.',
      image: { src: '/images/qr-preview.png', alt: 'Restoran menüsüne telefondaki QR Menü ekranından erişim', caption: 'Web sayfasından QR Menü ve online satış bağlantılarına geçiş' }
    },
    faqs: [
      { question: 'Paket sipariş ve kurye takibi var mı?', answer: 'Evet. Restoran route’larında paket servis siparişleri ve kurye için ayrı ekranlar bulunuyor.' },
      { question: 'PenPOS özel zamanlı gel-al rezervasyonu sunuyor mu?', answer: 'Kodda walk-in masasız satış ve paket teslimat akışları var; özel zaman seçmeli pickup/gel-al rezervasyon iş akışı doğrulanmadı.' },
      { question: 'Paket siparişler mutfakla birlikte takip edilebilir mi?', answer: 'Restoran uygulamasında hem mutfak hem paket sipariş/kurye ekranları bulunuyor; sipariş hazırlığı ve teslimat bu ekranlarda izlenebilir.' }
    ],
    related: ['restoran-programi', 'restoran-pos', 'adisyon-programi', 'qr-menu-programi']
  },
  'market-programi': {
    title: 'Market Programı: Barkodlu Kasa ve Stok Yönetimi | PenPOS',
    description: 'PenPOS market programında barkod okuyuculu satış, stok hareketleri ve sayım, ürün partileri, cari, Z raporu ve şube yönetimini kullanın.',
    heading: 'Barkodlu kasa ve stok operasyonu için market programı',
    loginPath: '/magaza/login',
    introduction: 'Market kasasında ürün bulma ve ödeme hızlı ilerlemeli; satış sonrası stok ve rapor kayıtları da işletmenin kontrolünde olmalıdır. PenPOS market ekranlarında barkod okuyucu ile satış, ürün ve kategori yönetimi, stok hareketleri/sayım, cari işlemler ve satış raporları bulunur. Kasa ekranı telefon ve tablet yerleşimlerine de uyarlanır.',
    highlights: ['Klavye tipi okuyucuyla barkodlu satış', 'Stok hareketi, sayım ve ürün partileri', 'Cari, ödeme ve Z raporu'],
    image: { src: '/images/canteen-preview-v2.png', alt: 'PenPOS market satış ve stok yönetimi ekranı', caption: 'Market satış ve stok yönetimi için gerçek PenPOS ekranı' },
    sections: [
      {
        heading: 'Barkoddan satış sepetine, kasada kesintisiz akış',
        introduction: 'Market kasiyer ekranı barkod girişini, ürün aramasını, sepeti ve satış ödemesini aynı satış işleminde toplar.',
        features: [
          { heading: 'Barkod okuyuculu hızlı satış', text: 'Kasiyer ekranındaki barkod alanına klavye gibi giriş yapan barkod okuyucuyu kullanın; ürün bulunup satış sepetine eklenir.', benefit: 'Her ürünü listeden elle aramak yerine okutma yoluyla satışa alabilirsiniz.' },
          { heading: 'Kasa ve sepet', text: 'Satış ürünlerini sepette kontrol edin, miktarları düzenleyin ve işlemi tamamlayın.', benefit: 'Kasiyer ürünleri ve toplamı tahsilat öncesinde aynı ekranda gözden geçirir.' },
          { heading: 'Ürün ve kategori', text: 'Market ürünlerini, kategorilerini ve barkod bilgilerini ayar ekranlarından yönetin.', benefit: 'Kasada aranacak ve okutulacak ürün kayıtları merkezi biçimde düzenlenir.' }
        ]
      },
      {
        heading: 'Stok değişimini ve ürün partilerini izleyin',
        introduction: 'Market sistemi ayrı stok ekranı ve backend stok iş akışlarını içerir; ürün kartındaki miktardan ibaret değildir.',
        features: [
          { heading: 'Stok hareketleri', text: 'Stok ekranında ürün stok operasyonlarını ve hareket kayıtlarını yönetin.', benefit: 'Ürün miktarındaki değişimi işletme stok sürecinde inceleyebilirsiniz.' },
          { heading: 'Stok sayımı', text: 'Stok sayım işlevlerini kullanarak kayıtlı stokla fiziksel sayım sürecini karşılaştırmaya yönelik işlemleri yönetin.', benefit: 'Stok kontrolü günlük kasa satışından ayrı bir yönetim ekranında yapılır.' },
          { heading: 'Ürün partileri', text: 'Market modülündeki ürün parti hizmetiyle ürün batch/parti kayıtları desteklenir.', benefit: 'Parti bilgisi gerektiren ürün kayıtlarını stok modülü kapsamında ele alabilirsiniz.' }
        ]
      },
      {
        heading: 'Tahsilat, cari ve gün sonu raporları',
        introduction: 'Satış kaydı farklı ödeme seçenekleriyle tamamlanır; yönetici tahsilat ve satış özetlerini raporlardan takip edebilir.',
        features: [
          { heading: 'Nakit, kart ve IBAN', text: 'Ödeme ayarlarından bu yöntemleri yapılandırın; kasa satışında desteklenen ödeme seçeneğini kullanın.', benefit: 'Tahsilatları işletmenin açık ödeme yöntemleriyle kaydedebilirsiniz.' },
          { heading: 'Cari ve tahsilat', text: 'Cari ekranlarından müşterileri, hesap ayrıntılarını ve tahsilat/hareket geçmişini yönetin.', benefit: 'Müşteri hesabıyla ilişkili satış ve tahsilat takibi sağlar.' },
          { heading: 'Satış/ödeme raporları ve Z raporu', text: 'Market raporlarında satış ve ödeme özetlerini, Z raporunu ve dışa aktarım seçeneklerini inceleyin.', benefit: 'Yönetici kasa dönemini ve satış performansını kayıtlar üzerinden değerlendirebilir.' },
          { heading: 'Excel aktarımı', text: 'Market rapor ekranındaki Excel dışa aktarma imkânını kullanın.', benefit: 'Rapor verisini işletme dışındaki tablo incelemesi için alabilirsiniz.' }
        ]
      },
      {
        heading: 'Şubeler, ekip, yazıcılar ve mobil ekran',
        introduction: 'Market yönetimi kasa dışındaki günlük idari ihtiyaçlara da ekran sunar.',
        features: [
          { heading: 'Yazıcı', text: 'Yazıcı ayarları ve print station üzerinden market yazdırma akışını yönetin.', benefit: 'Kasa ve işletme yazdırma ayarları için ayrılmış ekranlar bulunur.' },
          { heading: 'Şube ve personel izinleri', text: 'Şube ayarlarını yönetin, aktif şubeyi seçin ve personel erişimlerini izinlere göre düzenleyin.', benefit: 'Ekip ve şube yönetimi market operasyonunun parçasıdır.' },
          { heading: 'Telefon/tablet kullanımı', text: 'Arayüz küçük ekranlara uyum sağlar; kasa için özel mobil yerleşim ve responsive menüler vardır.', benefit: 'Uygulama telefon veya tablette tarayıcı/arayüz üzerinden kullanılabilir; bu özel bir yerel mobil uygulama iddiası değildir.' },
          { heading: 'QR siparişleri', text: 'QR siparişleri market panelindeki ayrı sipariş ekranından takip edin.', benefit: 'QR ile gelen siparişler kasiyer satışından ayrı bir yönetim listesinde görünür.' }
        ]
      }
    ],
    workflow: {
      heading: 'Bir market satışının örnek iş akışı',
      steps: [
        { title: 'Ürünü okutun', text: 'Barkod okuyucuyu kullanın veya ürünü kasa aramasında bulun.' },
        { title: 'Sepeti kontrol edin', text: 'Ürün ve miktarları doğrulayarak satış sepetini tamamlayın.' },
        { title: 'Ödeme alın', text: 'İşletmede etkinleştirilen nakit, kart veya IBAN seçeneğiyle satışı kaydedin.' },
        { title: 'Stok ve raporu izleyin', text: 'Stok ekranında hareket/sayım ve raporlarda satış/ödeme sonuçlarını inceleyin.' }
      ]
    },
    website: {
      heading: 'Marketiniz için ürün vitrini olan herkese açık web sitesi',
      text: 'PenPOS müşterisi kendi işletmesi için dışarıdan ziyaret edilebilen bir web sitesi oluşturabilir, içeriklerini panelden düzenleyebilir ve yayına alabilir. Market sitesi, katalogdan seçilen ürünleri ve işletme iletişim bilgilerini müşteriye gösteren bir tanıtım alanıdır.',
      details: ['İşletme logosu, kapak ve galeri görselleri ekleyin', 'Ana sayfa ve hakkımızda metinlerini düzenleyin', 'Market ürünlerinden vitrine çıkacakları seçin', 'Telefon, e-posta, adres ve harita bağlantısını paylaşın', 'PenPOS slug/site adresinde yayınlayın veya yayından kaldırın', 'Telefon ve tablet ekranlarında uyumlu görünüm kullanın'],
      integration: 'Market sitesinde ürün kataloğu ve yapılandırılabilir online sipariş bağlantısı bulunabilir. Bu, özel domain veya tema/renk/font seçimi sağlamaz.',
      market: true
    },
    faqs: [
      { question: 'Market kasasında barkod okuyucu kullanılabilir mi?', answer: 'Evet. Kasa barkod alanı ve klavye girişlerini yakalayan okuyucu akışı mevcut. Doğrulanan akış donanım okuyucu girişidir; kamera ile barkod tarama olduğu anlamına gelmez.' },
      { question: 'Market stok ekranında hangi işlemler var?', answer: 'Kodda market stok ekranı, backend stok servisi, stok hareketi/sayım modelleri ve ürün parti hizmeti bulunuyor.' },
      { question: 'Market işletmesi kendi web sitesini yayınlayabilir mi?', answer: 'Evet. Market yöneticisi ürün vitrini, görseller, ana sayfa ve iletişim bilgilerini düzenleyip slug tabanlı PenPOS adresinde yayınlayabilir. Site ürün kataloğu ve online sipariş bağlantısıyla ilişkilendirilebilir.' },
      { question: 'Market arayüzü telefon ve tablette çalışıyor mu?', answer: 'Market layout ve kasa ekranı küçük ekranlara uyarlanmış responsive kullanıma sahiptir. Bu, ayrı bir yerel mobil uygulamanın bulunduğu anlamına gelmez.' }
    ],
    related: ['restoran-programi', 'restoran-pos', 'qr-menu-programi']
  }
}

const relatedPages = [
  { path: 'restoran-programi', label: 'Restoran Programı' },
  { path: 'restoran-otomasyon-programi', label: 'Restoran Otomasyonu' },
  { path: 'adisyon-programi', label: 'Adisyon Programı' },
  { path: 'restoran-pos', label: 'Restoran POS' },
  { path: 'qr-menu-programi', label: 'QR Menü' },
  { path: 'paket-servis-programi', label: 'Paket Servis' },
  { path: 'market-programi', label: 'Market Programı' }
]

function FeatureCards({ features }) {
  return (
    <div className="seo-landing-feature-grid">
      {features.map((feature) => (
        <article className="seo-landing-detail-card" key={feature.heading}>
          <h3>{feature.heading}</h3>
          <p>{feature.text}</p>
          <div className="seo-landing-benefit"><strong>İşletmeye katkısı</strong><span>{feature.benefit}</span></div>
        </article>
      ))}
    </div>
  )
}

function Workflow({ workflow }) {
  return (
    <section className="seo-landing-content-section seo-landing-workflow">
      <p className="seo-landing-eyebrow">Günlük kullanım</p>
      <h2>{workflow.heading}</h2>
      <ol className="seo-landing-steps">
        {workflow.steps.map((step, index) => (
          <li key={step.title}>
            <span className="seo-landing-step-number">{String(index + 1).padStart(2, '0')}</span>
            <div><h3>{step.title}</h3><p>{step.text}</p></div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function WebsiteSection({ website }) {
  return (
    <section className="seo-landing-website">
      <div className="seo-landing-website-copy">
        <p className="seo-landing-eyebrow">İşletmenizin dijital vitrini</p>
        <h2>{website.heading}</h2>
        <p className="seo-landing-section-intro">{website.text}</p>
        <ul className="seo-landing-check-list">
          {website.details.map((detail) => <li key={detail}><span aria-hidden="true">✓</span>{detail}</li>)}
        </ul>
        <p className="seo-landing-integration">{website.integration}</p>
        <Link to="/register" className="seo-landing-primary-cta">İşletme web sitesini keşfedin</Link>
      </div>
      {website.image ? (
        <figure className="seo-landing-image-card seo-landing-website-image">
          <img src={website.image.src} alt={website.image.alt} loading="lazy" />
          <figcaption>{website.image.caption}</figcaption>
        </figure>
      ) : website.market ? (
        <div className="seo-landing-market-site-card" role="img" aria-label="Market web sitesindeki ürün vitrini ve iletişim alanlarının şematik gösterimi">
          <div className="seo-landing-site-browser"><span /><span /><span /><small>penpos.cloud / isletme</small></div>
          <div className="seo-landing-site-preview">
            <span className="seo-landing-site-brand">İŞLETMENİZ</span>
            <strong>Ürünleriniz müşterilerinizle buluşsun</strong>
            <span>Ürün vitrini · İletişim · Online sipariş</span>
            <div className="seo-landing-site-products"><i /><i /><i /></div>
          </div>
          <p>Slug adresinde yayınlanan, telefon uyumlu işletme sitesi</p>
        </div>
      ) : null}
    </section>
  )
}

export default function SeoLandingPage({ page }) {
  const content = pages[page]
  useBodyLayoutMode('public-site-layout')
  usePageSeo({
    title: content.title,
    description: content.description,
    path: `/${page}`,
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: content.title,
          description: content.description,
          url: `https://penpos.cloud/${page}`,
          isPartOf: { '@type': 'WebSite', name: 'PenPOS', url: 'https://penpos.cloud/' },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: 'https://penpos.cloud/' },
              { '@type': 'ListItem', position: 2, name: content.heading, item: `https://penpos.cloud/${page}` }
            ]
          }
        },
        {
          '@type': 'FAQPage',
          mainEntity: content.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer }
          }))
        }
      ]
    }
  })

  return (
    <main className="seo-landing">
      <header className="seo-landing-header">
        <Link to="/landing" className="seo-landing-brand" aria-label="PenPOS ana sayfa">
          <img src="/logo-2.png" alt="PenPOS" />
        </Link>
        <nav aria-label="Ana gezinme">
          <Link to="/landing">Ana Sayfa</Link>
          <Link to="/register" className="seo-landing-header-cta">Ücretsiz Deneyin</Link>
        </nav>
      </header>

      <div className="seo-landing-content">
        <section className="seo-landing-hero">
          <div className="seo-landing-hero-copy">
            <p className="seo-landing-eyebrow">PenPOS işletme yönetim sistemi</p>
            <h1>{content.heading}</h1>
            <p className="seo-landing-intro">{content.introduction}</p>
            <div className="seo-landing-actions">
              <Link to="/register" className="seo-landing-primary-cta">Ücretsiz deneyin</Link>
              <Link to={content.loginPath || '/login/restoran'} className="seo-landing-secondary-cta">Giriş yapın</Link>
            </div>
          </div>
          {content.image ? (
            <figure className="seo-landing-image-card seo-landing-hero-image">
              <img src={content.image.src} alt={content.image.alt} fetchPriority="high" />
              <figcaption>{content.image.caption}</figcaption>
            </figure>
          ) : null}
        </section>

        <ul className="seo-landing-highlights">
          {content.highlights.map((highlight) => <li key={highlight}><span aria-hidden="true">✓</span>{highlight}</li>)}
        </ul>

        {content.sections.map((section, index) => (
          <section className="seo-landing-content-section" key={section.heading}>
            <div className="seo-landing-section-heading">
              <span className="seo-landing-section-index">{String(index + 1).padStart(2, '0')}</span>
              <div><h2>{section.heading}</h2><p className="seo-landing-section-intro">{section.introduction}</p></div>
            </div>
            <FeatureCards features={section.features} />
          </section>
        ))}

        <Workflow workflow={content.workflow} />
        <WebsiteSection website={content.website} />

        <section className="seo-landing-content-section seo-landing-faq">
          <p className="seo-landing-eyebrow">Sık sorulan sorular</p>
          <h2>{content.heading} hakkında merak edilenler</h2>
          <div className="seo-landing-faq-list">
            {content.faqs.map((faq) => (
              <article key={faq.question}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="seo-landing-related">
          <h2>İşletmenize uygun PenPOS akışlarını keşfedin</h2>
          <div className="seo-landing-related-links">
            {content.related.map((slug) => {
              const related = relatedPages.find((item) => item.path === slug)
              return related ? <Link to={`/${related.path}`} key={related.path}>{related.label}</Link> : null
            })}
          </div>
        </section>

        <section className="seo-landing-final-cta">
          <div><p className="seo-landing-eyebrow">İşletmenize uygun akışla başlayın</p><h2>PenPOS özelliklerini kendi operasyonunuzda keşfedin</h2><p>Ürün, sipariş ve yönetim ekranlarını işletmenizin ihtiyaçlarına göre değerlendirin.</p></div>
          <Link to="/register" className="seo-landing-primary-cta">PenPOS'u deneyin</Link>
        </section>
      </div>

      <footer className="seo-landing-footer">
        <Link to="/landing">PenPOS</Link>
        <span>Restoran ve market işletmeleri için satış ve yönetim sistemi.</span>
      </footer>
    </main>
  )
}
