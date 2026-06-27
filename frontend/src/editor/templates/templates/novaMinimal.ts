import { Template } from '../TemplateTypes';

export const novaMinimalTemplate: Template = {
  id: 'nova-minimal',
  name: 'NOVA Minimal',
  description: 'Minimalist giyim mağazası - Sade, doğal tonlar, zamansız parçalar',
  category: 'store',
  thumbnail: '🤍',
  tags: ['giyim', 'minimal', 'sade', 'doğal'],
  theme: {
    primaryColor: '#78716c',
    secondaryColor: '#1c1917',
    fontFamily: 'system-ui, sans-serif',
    borderRadius: '2px',
  },
  blocks: [
    {
      type: 'Hero',
      props: {
        title: 'NOVA WEAR',
        subtitle: 'Sade, şık ve günlük giyim. Modern kesimler, doğal tonlar, zamansız parçalar.',
        btnText: 'Koleksiyonu İncele',
      },
    },
    {
      type: 'AnnouncementBar',
      props: {
        text: '%30\'a varan indirim · Seçili yeni sezon ürünlerinde sınırlı süreli fırsat',
        bgColor: '#f5f5f4',
        textColor: '#44403c',
        link: '',
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
          { title: '01 · Kadın', content: 'Elbise, gömlek, ceket.' },
          { title: '02 · Erkek', content: 'Tişört, pantolon, oversize.' },
          { title: '03 · Aksesuar', content: 'Çanta, şapka, takı.' },
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
      type: 'AnnouncementBar',
      props: {
        text: 'Yeni sezonda sade başlangıç. 2 ürün ve üzeri alışverişlerde ekstra indirim.',
        bgColor: '#f5f5f4',
        textColor: '#44403c',
        link: '',
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Mağaza Bilgileri',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TextBlock',
      props: {
        content: '<div style="max-width:500px;margin:0 auto;text-align:center;line-height:2;"><p><strong>Adres:</strong> Bağdat Caddesi No: 24, İstanbul</p><p><strong>Telefon:</strong> 0555 000 00 00</p><p><strong>E-posta:</strong> bilgi@novawear.com</p></div>',
        align: 'center',
        size: '14px',
      },
    },
    {
      type: 'TabsBlock',
      props: {
        tabs: [
          { title: 'Hafta içi', content: '10:00 - 21:00' },
          { title: 'Hafta sonu', content: '11:00 - 22:00' },
          { title: 'Online', content: '7/24 açık' },
        ],
      },
    },
    {
      type: 'MapBlock',
      props: {
        address: 'Bağdat Caddesi No:24, İstanbul',
      },
    },
  ],
};