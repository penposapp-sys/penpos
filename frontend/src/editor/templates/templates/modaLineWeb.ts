import { Template } from '../TemplateTypes';

export const modaLineWebTemplate: Template = {
  id: 'moda-line-web',
  name: 'ModaLine Web',
  description: 'Klasik giyim mağazası - Sade, şık, kategori odaklı vitrin',
  category: 'store',
  thumbnail: '👗',
  tags: ['giyim', 'klasik', 'kategori', 'kadın-erkek'],
  theme: {
    primaryColor: '#b91c1c',
    secondaryColor: '#1f2937',
    fontFamily: 'Georgia, serif',
    borderRadius: '6px',
  },
  blocks: [
    {
      type: 'AnnouncementBar',
      props: {
        text: 'Yeni sezon ürünlerinde %30\'a varan indirim — Ücretsiz kargo',
        bgColor: '#fef3c7',
        textColor: '#92400e',
        link: '',
      },
    },
    {
      type: 'Hero',
      props: {
        title: 'ModaLine',
        subtitle: 'Tarzını sade ama güçlü göster. Günlük kombinlerden özel davetlere kadar.',
        btnText: 'Alışverişe Başla',
      },
    },
    {
      type: 'TextBlock',
      props: {
        content: '<p style="text-align:center; background:#f3f4f6; padding:12px; border-radius:4px;"><strong>Haftanın kombinin:</strong> Basic ceket + rahat pantolon + minimal aksesuar</p>',
        align: 'center',
        size: '14px',
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
          { title: '👗 Kadın', content: 'Elbise, bluz, ceket koleksiyonu.' },
          { title: '👔 Erkek', content: 'Gömlek, pantolon, takım seçenekleri.' },
          { title: '🧒 Çocuk', content: 'Rahat ve renkli ürünler.' },
          { title: '👜 Aksesuar', content: 'Çanta, kemer, takı.' },
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
        columns: 3,
        showPrices: true,
      },
    },
    {
      type: 'AnnouncementBar',
      props: {
        text: '🎉 Sezon fırsatı: 2. üründe %40 indirim',
        bgColor: '#dcfce7',
        textColor: '#166534',
        link: '',
      },
    },
    {
      type: 'TabsBlock',
      props: {
        tabs: [
          { title: '🚚 Hızlı Teslimat', content: 'Şehir içi aynı gün teslimat.' },
          { title: '↩️ Kolay Değişim', content: 'Hızlı iade ve değişim.' },
          { title: '💬 WhatsApp', content: 'Tek tıkla mesaj gönderin.' },
        ],
      },
    },
    {
      type: 'MapBlock',
      props: {
        address: 'Bağdat Caddesi, İstanbul',
      },
    },
    {
      type: 'ContactForm',
      props: {
        title: 'İletişim',
        btnText: 'Mesaj Gönder',
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