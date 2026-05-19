export const defaultWebsiteSettings = {
  siteTitle: 'PenPOS',
  siteDescription: 'Restoran, cafe, mağaza ve marketler için ayrı akışlı modern bulut otomasyon sistemi.',
  heroTitle: 'Restoran ve mağaza sistemlerini ayrı ayrı yönetin.',
  heroDescription: 'PenPOS; restoran-cafe ve mağaza-market için ayrı girişleri, ayrı ekran akışları olan modern otomasyon yapısıdır. Restoran tarafında QR menü standart olarak dahildir; her işletme istediği kadar şube açabilir.',
  trialDays: 7,
  primaryCtaText: '1 Haftalık Ücretsiz Deneme Başlat',
  secondaryCtaText: 'Üye Olmadan Önce İncele',
  restaurantLoginUrl: '/login?type=restaurant',
  marketLoginUrl: '/login?type=market',
  registerUrl: '/register',
  whatsappUrl: '',
  phone: '',
  email: '',
  address: '',
  features: [
    { id: 'feature-1', icon: 'utensils', title: 'Restoran ve cafe adisyon sistemi', text: 'Masa, paket servis, gel-al, mutfak çıktısı ve QR menü dahil olacak şekilde restoran akışlarını yönetin.', sortOrder: 1, active: true },
    { id: 'feature-2', icon: 'store', title: 'Mağaza ve market otomasyonu', text: 'Barkod okutun, hızlı satış yapın, cari hesapları izleyin ve stok giriş-çıkışlarını tek panelden takip edin.', sortOrder: 2, active: true },
    { id: 'feature-3', icon: 'smartphone', title: 'Telefondan satış yapın', text: 'Mağaza ve market sistemi telefon, tablet veya bilgisayardan online market mantığıyla satış yapmaya uygundur.', sortOrder: 3, active: true },
    { id: 'feature-4', icon: 'qr', title: 'QR menü standart dahil', text: 'Restoran tarafında QR menü ekstra modül değil, sistemin doğal parçasıdır.', sortOrder: 4, active: true },
    { id: 'feature-5', icon: 'layers', title: 'Sınırsız şube yapısı', text: 'İşletmenize ait istediğiniz kadar şube açabilir ve hepsini aynı altyapıdan yönetebilirsiniz.', sortOrder: 5, active: true },
    { id: 'feature-6', icon: 'chart', title: 'Raporlama ve yazıcı desteği', text: 'Ciro, stok, cari ve satış raporlarıyla birlikte fiş ve mutfak yazıcı akışları hazır gelir.', sortOrder: 6, active: true }
  ],
  systemCards: [
    { id: 'system-restaurant', type: 'restaurant', title: 'Restoran / Cafe Sistemi', description: 'Masa, adisyon, paket servis, mutfak çıktısı ve QR menü odaklı ayrı restoran paneli.', bullets: ['Masa ve adisyon', 'Mutfak çıktısı', 'Paket servis', 'QR menü dahil', 'Sınırsız şube açma'], active: true },
    { id: 'system-market', type: 'market', title: 'Mağaza / Market Sistemi', description: 'Online market programı gibi pratik çalışır; telefon, tablet veya bilgisayardan satış yapılabilir.', bullets: ['Telefondan satış', 'Barkod okuma', 'Cari hesap', 'Stok giriş-çıkış', 'Sınırsız şube açma'], active: true }
  ],
  pricingPlans: [
    { id: 'plan-restaurant', name: 'Restoran / Cafe', price: '₺899', period: '/ ay', description: 'Masa, adisyon, paket servis, mutfak ve QR menü kullanımı için.', items: ['Masa ve adisyon', 'Paket servis', 'QR menü dahil', 'Sınırsız şube açma', 'Raporlar ve yazıcı'], popular: true, buttonText: 'Başvuru Yap / Üye Ol', buttonUrl: '/register?type=restaurant', active: true, sortOrder: 1 },
    { id: 'plan-market', name: 'Mağaza / Market', price: '₺399', period: '/ ay', description: 'Barkodlu satış, stok, cari ve hızlı kasa kullanımı için.', items: ['Telefondan satış', 'Barkod okuma', 'Cari hesap', 'Stok giriş-çıkış', 'Sınırsız şube açma'], popular: false, buttonText: 'Başvuru Yap / Üye Ol', buttonUrl: '/register?type=market', active: true, sortOrder: 2 },
    { id: 'plan-support', name: 'Kurulum ve Destek', price: 'Özel', period: '', description: 'Veri aktarma, yazıcı kurulumu veya özel destek isteyen işletmeler için.', items: ['Ürün aktarımı', 'Şube kurulumu', 'Yazıcı kurulumu', 'Eğitim desteği', 'Özel yönlendirme'], popular: false, buttonText: 'İletişime Geç', buttonUrl: '', active: true, sortOrder: 3 },
    { id: 'plan-integration', name: 'Özel Entegrasyon', price: 'Özel', period: '', description: 'İleri seviye bağlantı, özel rapor veya işletmeye özel geliştirme ihtiyacı olanlar için.', items: ['Özel entegrasyon', 'Ek rapor geliştirme', 'Markaya özel düzenleme', 'Teknik analiz', 'Proje bazlı çalışma'], popular: false, buttonText: 'Teklif Al', buttonUrl: '', active: true, sortOrder: 4 }
  ],
  trainingVideos: [
    { id: 'video-1', title: 'Üyelik ve İlk Kurulum', description: 'İlk hesap açılışı ve panel tanıtımı.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'general', active: true, sortOrder: 1 },
    { id: 'video-2', title: 'Restoran Satış Akışı', description: 'Masa ve adisyon akışının temel kullanımı.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'restaurant', active: true, sortOrder: 2 },
    { id: 'video-3', title: 'Mağaza Barkodlu Satış', description: 'Hızlı kasa ve barkodlu satış örneği.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'market', active: true, sortOrder: 3 },
    { id: 'video-4', title: 'Stok Girişi / Çıkışı', description: 'Stok hareketlerinin yönetimi.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'market', active: true, sortOrder: 4 },
    { id: 'video-5', title: 'Cari Hesap Kullanımı', description: 'Cari hesap takibi ve işlemler.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'general', active: true, sortOrder: 5 },
    { id: 'video-6', title: 'Raporlar ve Gün Sonu', description: 'Gün sonu ve raporlama ekranları.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'general', active: true, sortOrder: 6 },
    { id: 'video-7', title: 'Yazıcı Ayarları', description: 'Fiş ve mutfak yazıcısı ayarları.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'general', active: true, sortOrder: 7 },
    { id: 'video-8', title: 'QR Menü Kullanımı', description: 'QR menü paylaşımı ve kullanımı.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'restaurant', active: true, sortOrder: 8 }
  ],
  integrations: [
    { id: 'integration-1', name: 'Bulut Erişim', description: 'Telefon, tablet ve bilgisayardan aynı veri yapısına erişim.', active: true, sortOrder: 1 },
    { id: 'integration-2', name: 'Yazıcı Altyapısı', description: 'Fiş, mutfak ve hızlı kasa yazıcı akışlarını destekler.', active: true, sortOrder: 2 },
    { id: 'integration-3', name: 'Rapor Altyapısı', description: 'Şube, satış ve operasyon raporlarını birlikte sunar.', active: true, sortOrder: 3 }
  ],
  seoTitle: 'PenPOS | Restoran ve Mağaza Otomasyonu',
  seoDescription: 'PenPOS ile restoran/cafe ve mağaza/market akışları ayrı girişlerle yönetilir. QR menü dahil, sınırsız şube ve raporlama hazır.',
  seoKeywords: 'penpos,pos,restoran otomasyonu,mağaza otomasyonu,market otomasyonu,qr menü',
  isPublished: true,
  updatedAt: null
}

export const heroBadges = ['1 Hafta Ücretsiz', 'Kredi Kartsız Başla', 'Ayrı Restoran ve Mağaza Girişi', 'QR Menü Dahil', 'Sınırsız Şube', 'Raporlama']
export const reportItems = ['Günlük ciro', 'Saatlik satış yoğunluğu', 'En çok satan ürünler', 'Kategori kârlılığı', 'Garson performansı', 'Paket servis durumu', 'Ödeme tipi analizi', 'Şube karşılaştırması']
