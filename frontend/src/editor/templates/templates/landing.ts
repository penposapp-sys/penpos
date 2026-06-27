import { Template } from '../TemplateTypes';

export const landingTemplate: Template = {
  id: 'landing',
  name: 'SaaS Landing Page',
  description: 'Startup ve SaaS ürünleri için dönüşüm odaklı landing page',
  category: 'landing',
  thumbnail: '🚀',
  tags: ['startup', 'saas', 'landing'],
  theme: {
    primaryColor: '#ec4899', // Pembe
    secondaryColor: '#18181b',
    fontFamily: 'system-ui, sans-serif',
    borderRadius: '12px',
  },
  blocks: [
    {
      type: 'AnnouncementBar',
      props: {
        text: '🎁 İlk 100 kullanıcıya %50 indirim! Son 3 gün',
        bgColor: '#fce7f3',
        textColor: '#9f1239',
        link: '',
      },
    },
    {
      type: 'Hero',
      props: {
        title: 'İşinizi Otomatikleştirin',
        subtitle: 'Tek platformda CRM, otomasyon ve analitik. Zaman kazanın, büyüyün.',
        btnText: 'Ücretsiz Dene',
      },
    },
    {
      type: 'StatsBlock',
      props: {
        items: [
          { value: '10K+', label: 'Aktif Kullanıcı' },
          { value: '98%', label: 'Memnuniyet' },
          { value: '50+', label: 'Entegrasyon' },
          { value: '24/7', label: 'Destek' },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Neden Biz?',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TabsBlock',
      props: {
        tabs: [
          {
            title: '⚡ Hızlı Kurulum',
            content: '5 dakikada başlayın. Kredi kartı gerekmez, kurulum yardımı dahil.',
          },
          {
            title: '🔒 Güvenli Altyapı',
            content: 'SOC 2 sertifikalı, GDPR uyumlu, 256-bit şifreleme.',
          },
          {
            title: '📱 Her Yerde Erişim',
            content: 'Web, iOS, Android. Tüm cihazlarınızda senkronize çalışın.',
          },
          {
            title: '🎯 AI Destekli',
            content: 'Yapay zeka ile otomatik öneriler, akıllı raporlar ve tahminleme.',
          },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Şeffaf Fiyatlandırma',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'PricingBlock',
      props: {
        plans: [
          {
            name: 'Bireysel',
            price: '0₺',
            period: 'ay',
            features: ['1 kullanıcı', '100 otomasyon/ay', 'Temel raporlar', 'E-posta destek'],
            cta: 'Ücretsiz Başla',
            featured: false,
          },
          {
            name: 'Pro',
            price: '299₺',
            period: 'ay',
            features: [
              '5 kullanıcı',
              'Sınırsız otomasyon',
              'Gelişmiş raporlar',
              'API erişimi',
              'Öncelikli destek',
              'Özel entegrasyonlar',
            ],
            cta: 'Pro\'ya Geç',
            featured: true,
          },
          {
            name: 'Kurumsal',
            price: 'Özel',
            period: 'teklif',
            features: [
              'Sınırsız kullanıcı',
              'Sınırsız her şey',
              'Özel geliştirme',
              'SLA garantisi',
              '7/24 özel destek',
              'Dedicated hesap yöneticisi',
            ],
            cta: 'Satışla Görüş',
            featured: false,
          },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Kullanıcılarımız Ne Diyor?',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TestimonialsBlock',
      props: {
        items: [
          {
            name: 'Mert K.',
            role: 'Kurucu, StartupX',
            text: 'İş akışımızı tamamen değiştirdi. Ekip verimliliğimiz %300 arttı!',
            avatar: 'https://picsum.photos/seed/l1/100',
          },
          {
            name: 'Ayşe D.',
            role: 'Pazarlama Direktörü',
            text: 'Otomasyon özellikleri muhteşem. Saatler kazandırıyor.',
            avatar: 'https://picsum.photos/seed/l2/100',
          },
          {
            name: 'Emre T.',
            role: 'CTO, TechCorp',
            text: 'API dokümantasyonu harika, entegrasyon çok kolay oldu.',
            avatar: 'https://picsum.photos/seed/l3/100',
          },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Sıkça Sorulan Sorular',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'AccordionBlock',
      props: {
        items: [
          {
            q: 'Ücretsiz deneme süresi ne kadar?',
            a: '14 gün ücretsiz deneme, kredi kartı gerekmez. Deneme sonunda otomatik ücretlendirme YOK.',
          },
          {
            q: 'İstediğim zaman iptal edebilir miyim?',
            a: 'Evet, tek tıkla iptal. Sözleşme yok, taahhüt yok.',
          },
          {
            q: 'Verilerim güvende mi?',
            a: 'SOC 2 Type II sertifikalıyız. Verileriniz 256-bit şifreleme ile korunur, günlük yedekleme yapılır.',
          },
          {
            q: 'Hangi entegrasyonları destekliyorsunuz?',
            a: 'Slack, Zapier, Google Workspace, Microsoft 365, Salesforce, HubSpot ve 50+ araç ile entegrasyon.',
          },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Hemen Başlayın',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'ContactForm',
      props: {
        title: 'Demo Talep Edin',
        btnText: 'Ücretsiz Demo Al',
      },
    },
    {
      type: 'SocialBlock',
      props: {
        size: 32,
        links: [
          { platform: 'twitter', url: 'https://twitter.com' },
          { platform: 'linkedin', url: 'https://linkedin.com' },
          { platform: 'youtube', url: 'https://youtube.com' },
          { platform: 'instagram', url: 'https://instagram.com' },
        ],
      },
    },
  ],
};