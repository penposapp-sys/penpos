import { Template } from '../TemplateTypes';

export const servicesTemplate: Template = {
  id: 'services',
  name: 'Profesyonel Hizmet',
  description: 'Danışmanlık, ajans ve hizmet şirketleri için kurumsal template',
  category: 'services',
  thumbnail: '💼',
  tags: ['hizmet', 'ajans', 'danışmanlık'],
  theme: {
    primaryColor: '#1e40af', // Lacivert
    secondaryColor: '#0f172a',
    fontFamily: 'system-ui, sans-serif',
    borderRadius: '8px',
  },
  blocks: [
    {
      type: 'Hero',
      props: {
        title: 'İşinizi Büyütüyoruz',
        subtitle: 'Stratejik danışmanlık ve dijital çözümlerle hedeflerinize ulaşın',
        btnText: 'Ücretsiz Danışmanlık',
      },
    },
    {
      type: 'StatsBlock',
      props: {
        items: [
          { value: '250+', label: 'Tamamlanan Proje' },
          { value: '98%', label: 'Müşteri Memnuniyeti' },
          { value: '15+', label: 'Yıllık Tecrübe' },
          { value: '35+', label: 'Uzman Ekip' },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Hizmetlerimiz',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TabsBlock',
      props: {
        tabs: [
          {
            title: '📊 Stratejik Danışmanlık',
            content: 'İşletmenizin büyümesi için özelleştirilmiş stratejiler. Pazar analizi, rekabet araştırması ve yol haritası oluşturma.',
          },
          {
            title: '🎯 Dijital Pazarlama',
            content: 'SEO, SEM, sosyal medya ve içerik pazarlama ile online varlığınızı güçlendirin.',
          },
          {
            title: '💻 Yazılım Geliştirme',
            content: 'Web, mobil ve kurumsal uygulamalar. Modern teknolojiler, ölçeklenebilir mimari.',
          },
          {
            title: '🎨 Marka Kimliği',
            content: 'Logo, kurumsal kimlik, web tasarımı ve tüm görsel materyaller.',
          },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Fiyatlandırma',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'PricingBlock',
      props: {
        plans: [
          {
            name: 'Başlangıç',
            price: '5.000₺',
            period: 'ay',
            features: [
              'Aylık strateji toplantısı',
              'Temel SEO optimizasyonu',
              'Sosyal medya yönetimi (2 platform)',
              'E-posta desteği',
            ],
            cta: 'Başla',
            featured: false,
          },
          {
            name: 'Profesyonel',
            price: '15.000₺',
            period: 'ay',
            features: [
              'Haftalık strateji toplantısı',
              'Gelişmiş SEO + SEM',
              'Sosyal medya (5 platform)',
              'İçerik üretimi',
              '7/24 öncelikli destek',
              'Aylık raporlama',
            ],
            cta: 'En Popüler',
            featured: true,
          },
          {
            name: 'Kurumsal',
            price: 'Özel',
            period: 'proje',
            features: [
              'Özel danışman ekibi',
              'Tam hizmet paketi',
              'Özel yazılım çözümleri',
              '7/24 özel destek',
              'Yıllık stratejik planlama',
              'Yönetici koçluğu',
            ],
            cta: 'İletişime Geç',
            featured: false,
          },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Müşterilerimiz Ne Diyor?',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TestimonialsBlock',
      props: {
        items: [
          {
            name: 'Can Özkan',
            role: 'CEO, TechStart',
            text: '1 yılda ciromuzu 3 katına çıkardık. Stratejileri mükemmel çalıştı!',
            avatar: 'https://picsum.photos/seed/sv1/100',
          },
          {
            name: 'Selin Arslan',
            role: 'Pazarlama Müdürü',
            text: 'Profesyonel ekip, sonuç odaklı yaklaşım. Kesinlikle tavsiye ederim.',
            avatar: 'https://picsum.photos/seed/sv2/100',
          },
          {
            name: 'Murat Yıldız',
            role: 'Kurucu, E-Ticaret',
            text: 'Dijital dönüşümümüzü başarıyla yönettiler. Harika bir iş ortağı.',
            avatar: 'https://picsum.photos/seed/sv3/100',
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
            q: 'Minimum sözleşme süresi nedir?',
            a: 'Başlangıç paketi için 3 ay, diğer paketler için 6 ay minimum sözleşme süremiz var.',
          },
          {
            q: 'Hangi sektörlerde çalışıyorsunuz?',
            a: 'E-ticaret, SaaS, hizmet sektörü, sağlık ve eğitim başta olmak üzere pek çok sektörde deneyimliyiz.',
          },
          {
            q: 'Sonuçları ne zaman görmeye başlarız?',
            a: 'İlk 30 günde hızlı kazanımlar, 3-6 ay içinde ise kalıcı ve sürdürülebilir büyüme hedefliyoruz.',
          },
          {
            q: 'Raporlama nasıl yapılıyor?',
            a: 'Haftalık özet, aylık detaylı rapor ve 3 aylık strateji değerlendirmeleri sunuyoruz.',
          },
        ],
      },
    },
    {
      type: 'ContactForm',
      props: {
        title: 'Ücretsiz Danışmanlık Alın',
        btnText: 'Randevu Talep Et',
      },
    },
    {
      type: 'SocialBlock',
      props: {
        size: 32,
        links: [
          { platform: 'linkedin', url: 'https://linkedin.com' },
          { platform: 'twitter', url: 'https://twitter.com' },
          { platform: 'facebook', url: 'https://facebook.com' },
        ],
      },
    },
  ],
};