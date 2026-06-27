import { Template } from '../TemplateTypes';

// Aynı HTML'in farklı varyasyonu - daha basit ve temiz
export const modaLineBasicTemplate: Template = {
  id: 'moda-line-basic',
  name: 'ModaLine Basic',
  description: 'Temel giyim mağazası - Hızlı kurulum için hazır vitrin',
  category: 'store',
  thumbnail: '🛍️',
  tags: ['giyim', 'basit', 'hızlı-kurulum'],
  theme: {
    primaryColor: '#1e40af',
    secondaryColor: '#111827',
    fontFamily: 'system-ui, sans-serif',
    borderRadius: '8px',
  },
  blocks: [
    {
      type: 'AnnouncementBar',
      props: {
        text: '🚚 500₺ üzeri ücretsiz kargo · %30\'a varan indirimler',
        bgColor: '#dbeafe',
        textColor: '#1e40af',
        link: '',
      },
    },
    {
      type: 'Hero',
      props: {
        title: 'ModaLine',
        subtitle: 'Modern, rahat ve şık parçalar. Günlük kombinlerden özel günlere.',
        btnText: 'Koleksiyona Git',
      },
    },
    {
      type: 'StatsBlock',
      props: {
        items: [
          { value: '10K+', label: 'Mutlu Müşteri' },
          { value: '500+', label: 'Ürün Çeşidi' },
          { value: '24s', label: 'Hızlı Kargo' },
          { value: '4.9', label: 'Müşteri Puanı' },
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
        text: 'Kategoriler',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TabsBlock',
      props: {
        tabs: [
          { title: '👗 Kadın', content: 'Elbise, bluz, ceket, pantolon.' },
          { title: '👔 Erkek', content: 'Gömlek, pantolon, takım, ceket.' },
          { title: '🧒 Çocuk', content: 'Rahat ve renkli çocuk ürünleri.' },
          { title: '👜 Aksesuar', content: 'Çanta, kemer, takı, şapka.' },
        ],
      },
    },
    {
      type: 'AnnouncementBar',
      props: {
        text: '🎉 2. üründe %40 indirim · Kampanya kodu: MODA40',
        bgColor: '#fef3c7',
        textColor: '#92400e',
        link: '',
      },
    },
    {
      type: 'TestimonialsBlock',
      props: {
        items: [
          {
            name: 'Zeynep K.',
            role: 'İstanbul',
            text: 'Ürünler harika, kargo hızlı. Tekrar alışveriş yapacağım!',
            avatar: 'https://picsum.photos/seed/ml1/100',
          },
          {
            name: 'Ahmet Y.',
            role: 'Ankara',
            text: 'Kalite-fiyat dengesi mükemmel. Müşteri hizmetleri ilgili.',
            avatar: 'https://picsum.photos/seed/ml2/100',
          },
          {
            name: 'Selin D.',
            role: 'İzmir',
            text: 'Kolay iade, güvenilir satış. Herkese tavsiye ederim.',
            avatar: 'https://picsum.photos/seed/ml3/100',
          },
        ],
      },
    },
    {
      type: 'ContactForm',
      props: {
        title: 'Bize Ulaşın',
        btnText: 'Mesaj Gönder',
      },
    },
    {
      type: 'SocialBlock',
      props: {
        size: 32,
        links: [
          { platform: 'instagram', url: 'https://instagram.com' },
          { platform: 'facebook', url: 'https://facebook.com' },
          { platform: 'whatsapp', url: 'https://wa.me/' },
        ],
      },
    },
  ],
};