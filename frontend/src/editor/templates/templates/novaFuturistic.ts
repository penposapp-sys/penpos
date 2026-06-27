import { Template } from '../TemplateTypes';

export const novaFuturisticTemplate: Template = {
  id: 'nova-futuristic',
  name: 'NOVA Futuristic',
  description: 'Yeni nesil giyim mağazası - Koyu tema, neon vurgular, futuristik vitrin',
  category: 'store',
  thumbnail: '🌌',
  tags: ['giyim', 'futuristik', 'premium', 'neon'],
  theme: {
    primaryColor: '#00f5ff',
    secondaryColor: '#0a0a0a',
    fontFamily: "'Courier New', monospace",
    borderRadius: '0px',
  },
  blocks: [
    {
      type: 'AnnouncementBar',
      props: {
        text: '✨ Yeni Drop 2026 Yaz Koleksiyonu yayında — Sınırlı stok',
        bgColor: '#00f5ff',
        textColor: '#000000',
        link: '',
      },
    },
    {
      type: 'Hero',
      props: {
        title: 'NOVA WEAR',
        subtitle: 'Geleceğin stilini bugün gi. Şehir hayatı, spor-lüks ve gece şıklığı tek vitrinde.',
        btnText: 'Alışverişe Başla',
      },
    },
    {
      type: 'StatsBlock',
      props: {
        items: [
          { value: '48s', label: 'Hızlı Kargo' },
          { value: '120+', label: 'Yeni Sezon' },
          { value: '%25', label: 'İlk Alışveriş' },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Haftanın Parçası: Chrome Bomber Ceket',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TextBlock',
      props: {
        content: '<p style="text-align:center">₺2.490 · Limited · Stil Notu: Neon aksesuar + oversize kalıp = güçlü vitrin görünümü</p>',
        align: 'center',
        size: '16px',
      },
    },
    {
      type: 'AnnouncementBar',
      props: {
        text: 'NOVA DROP · CITY LUXE · LIMITED STOCK · FUTURE BASICS · NOVA DROP · CITY LUXE',
        bgColor: '#0a0a0a',
        textColor: '#00f5ff',
        link: '',
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Koleksiyonlar',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TextBlock',
      props: {
        content: '<p style="text-align:center">Her bölüm kendi tarz hikayesine sahip. Günlük, gece ve spor-lüks tek vitrinde.</p>',
        align: 'center',
        size: '14px',
      },
    },
    {
      type: 'TabsBlock',
      props: {
        tabs: [
          {
            title: '01 · City Luxe',
            content: 'Şehirde güçlü görünüm için blazer, pantolon ve dokulu üstler.',
          },
          {
            title: '02 · Future Basic',
            content: 'Temel parçaların daha keskin, daha kaliteli ve daha modern hali.',
          },
          {
            title: '03 · Night Edit',
            content: 'Akşam davetleri ve özel günler için iddialı kombin parçaları.',
          },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Öne Çıkan Ürünler',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'ProductGrid',
      props: {
        columns: 4,
        showPrices: true,
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Marka Hikayesi',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TextBlock',
      props: {
        content: '<p style="text-align:center; max-width: 700px; margin: 0 auto;">NOVA WEAR, klasik mağaza vitrini yerine dijital koleksiyon deneyimi sunar. Her ürün yalnızca bir kıyafet değil; renk, kesim ve kullanım senaryosuyla hazırlanmış bir stil önerisidir.</p>',
        align: 'center',
        size: '15px',
      },
    },
    {
      type: 'AnnouncementBar',
      props: {
        text: '🎁 İlk alışverişe özel: Sepette %25 indirim + ücretsiz kargo · Kod: NOVA25',
        bgColor: '#fef3c7',
        textColor: '#92400e',
        link: '',
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Müşteri Yorumları',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TestimonialsBlock',
      props: {
        items: [
          {
            name: 'Elif K.',
            role: '★★★★★',
            text: 'Ürün kalitesi ve paketleme gerçekten premium hissettiriyor. Bomber ceket beklediğimden çok daha iyi durdu.',
            avatar: 'https://picsum.photos/seed/nf1/100',
          },
          {
            name: 'Can A.',
            role: '★★★★★',
            text: 'Site çok farklı görünüyor, ürünleri keşfetmek keyifli. Beden rehberi ve kombin önerileri işimi kolaylaştırdı.',
            avatar: 'https://picsum.photos/seed/nf2/100',
          },
          {
            name: 'Derya M.',
            role: '★★★★★',
            text: 'Hızlı kargo ve değişim süreci çok rahattı. Yeni koleksiyonu takip edeceğim.',
            avatar: 'https://picsum.photos/seed/nf3/100',
          },
        ],
      },
    },
    {
      type: 'TabsBlock',
      props: {
        tabs: [
          { title: '🚚 Hızlı Kargo', content: '16:00\'a kadar aynı gün çıkış.' },
          { title: '↩️ Kolay İade', content: '14 gün içinde hızlı değişim.' },
          { title: '✨ Premium Paket', content: 'Hediye edilebilir özel kutu.' },
          { title: '📏 Beden Rehberi', content: 'Her ürün için net ölçü.' },
        ],
      },
    },
    {
      type: 'ContactForm',
      props: {
        title: 'Stil Bültenine Katıl',
        btnText: 'Kaydol',
      },
    },
    {
      type: 'SocialBlock',
      props: {
        size: 32,
        links: [
          { platform: 'instagram', url: 'https://instagram.com' },
          { platform: 'whatsapp', url: 'https://wa.me/' },
        ],
      },
    },
  ],
};