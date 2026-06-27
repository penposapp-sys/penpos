import { Template } from '../TemplateTypes';

export const storeTemplate: Template = {
  id: 'store',
  name: 'Modern E-Ticaret',
  description: 'Online mağaza için optimize edilmiş, ürün odaklı template',
  category: 'store',
  thumbnail: '🛍️',
  tags: ['mağaza', 'e-ticaret', 'butik'],
  theme: {
    primaryColor: '#059669', // Yeşil
    secondaryColor: '#111827',
    fontFamily: 'system-ui, sans-serif',
    borderRadius: '8px',
  },
  blocks: [
    {
      type: 'AnnouncementBar',
      props: {
        text: '🚚 500₺ üzeri siparişlerde ÜCRETSİZ KARGO!',
        bgColor: '#dcfce7',
        textColor: '#166534',
        link: '',
      },
    },
    {
      type: 'Hero',
      props: {
        title: 'Yeni Sezon Koleksiyonu',
        subtitle: 'En trend ürünler, uygun fiyatlar, hızlı teslimat',
        btnText: 'Alışverişe Başla',
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
      type: 'StatsBlock',
      props: {
        items: [
          { value: '10K+', label: 'Mutlu Müşteri' },
          { value: '500+', label: 'Ürün Çeşidi' },
          { value: '24s', label: 'Hızlı Kargo' },
          { value: '7/24', label: 'Destek' },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Neden Bizi Tercih Etmelisiniz?',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TabsBlock',
      props: {
        tabs: [
          {
            title: '🚚 Hızlı Teslimat',
            content: 'Siparişleriniz aynı gün kargoya verilir. İstanbul içi 24 saatte kapınızda!',
          },
          {
            title: '💰 Uygun Fiyat',
            content: 'Doğrudan üreticiden alıyoruz, aracı yok. Size en iyi fiyatı sunuyoruz.',
          },
          {
            title: '🔒 Güvenli Ödeme',
            content: '256-bit SSL şifreleme ile tüm ödemeleriniz güvende. 3D Secure destekli.',
          },
          {
            title: '↩️ Kolay İade',
            content: '14 gün içinde koşulsuz iade garantisi. Müşteri memnuniyeti önceliğimiz.',
          },
        ],
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
            name: 'Zeynep A.',
            role: 'İstanbul',
            text: 'Ürünler harika, kargo çok hızlı. Kesinlikle tekrar alışveriş yapacağım!',
            avatar: 'https://picsum.photos/seed/s1/100',
          },
          {
            name: 'Ali K.',
            role: 'Ankara',
            text: 'Fiyat-performans olarak en iyi site. Müşteri hizmetleri çok ilgili.',
            avatar: 'https://picsum.photos/seed/s2/100',
          },
          {
            name: 'Fatma Y.',
            role: 'İzmir',
            text: 'Kaliteli ürünler, güvenilir satış. Herkese tavsiye ederim.',
            avatar: 'https://picsum.photos/seed/s3/100',
          },
        ],
      },
    },
    {
      type: 'ContactForm',
      props: {
        title: 'Sorularınız mı Var?',
        btnText: 'Bize Yazın',
      },
    },
    {
      type: 'SocialBlock',
      props: {
        size: 32,
        links: [
          { platform: 'instagram', url: 'https://instagram.com' },
          { platform: 'facebook', url: 'https://facebook.com' },
          { platform: 'twitter', url: 'https://twitter.com' },
          { platform: 'youtube', url: 'https://youtube.com' },
          { platform: 'tiktok', url: 'https://tiktok.com' },
        ],
      },
    },
  ],
};