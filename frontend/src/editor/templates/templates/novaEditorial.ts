import { Template } from '../TemplateTypes';

export const novaEditorialTemplate: Template = {
  id: 'nova-editorial',
  name: 'NOVA Editorial',
  description: 'Deneysel giyim mağazası - Sokak modası, asimetrik, editorial tarz',
  category: 'store',
  thumbnail: '🎭',
  tags: ['giyim', 'editorial', 'deneysel', 'sokak-modası'],
  theme: {
    primaryColor: '#ffffff',
    secondaryColor: '#000000',
    fontFamily: "'Courier New', monospace",
    borderRadius: '0px',
  },
  blocks: [
    {
      type: 'AnnouncementBar',
      props: {
        text: 'Yeni Sezon / 2026 · Giyimin kuralları yeniden yazılıyor',
        bgColor: '#000000',
        textColor: '#ffffff',
        link: '',
      },
    },
    {
      type: 'Hero',
      props: {
        title: 'NOVA.WEAR',
        subtitle: 'Minimal kesimler, cesur dokular, sokak modasından ilham. Günlük giyimi sıradanlıktan çıkaran deneysel koleksiyon.',
        btnText: 'Drop 01',
      },
    },
    {
      type: 'AnnouncementBar',
      props: {
        text: 'SINIRLI STOK · %30 DROP 01 · Oversize Ceketler · Premium Kumaş · Ücretsiz Kargo',
        bgColor: '#ffffff',
        textColor: '#000000',
        link: '',
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Koleksiyon Hikayeleri',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TextBlock',
      props: {
        content: '<p style="text-align:center">Her kategori ayrı bir stil diliyle tasarlandı. Asimetrik bloklarla farklılaşan vitrin.</p>',
        align: 'center',
        size: '14px',
      },
    },
    {
      type: 'TabsBlock',
      props: {
        tabs: [
          { title: '01 / City Sharp', content: 'Keskin şehir silüeti.' },
          { title: '02 / Night Core', content: 'Geceye özel koyu seri.' },
          { title: '03 / Soft Utility', content: 'Rahat ama iddialı.' },
        ],
      },
    },
    {
      type: 'HeadingBlock',
      props: {
        text: 'Öne Çıkan Parçalar',
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
        text: 'Lookbook Editörü',
        level: 'h2',
        align: 'center',
      },
    },
    {
      type: 'TextBlock',
      props: {
        content: '<p style="text-align:center; max-width:600px; margin:0 auto;">Mağaza sadece ürün satmıyor, bir stil dünyası sunuyor. Kampanya çekimleri, influencer görselleri ve sezon kombinleri burada sergilenir.</p>',
        align: 'center',
        size: '14px',
      },
    },
    {
      type: 'GalleryBlock',
      props: {
        columns: 3,
        gap: 8,
        images: [
          'https://picsum.photos/seed/ne1/600/800',
          'https://picsum.photos/seed/ne2/600/800',
          'https://picsum.photos/seed/ne3/600/800',
          'https://picsum.photos/seed/ne4/600/800',
          'https://picsum.photos/seed/ne5/600/800',
          'https://picsum.photos/seed/ne6/600/800',
        ],
      },
    },
    {
      type: 'AnnouncementBar',
      props: {
        text: '📬 Yeni drop önce sana gelsin · Bültenimize katıl',
        bgColor: '#000000',
        textColor: '#ffffff',
        link: '',
      },
    },
    {
      type: 'ContactForm',
      props: {
        title: 'Bültene Katıl',
        btnText: 'Kaydol',
      },
    },
    {
      type: 'TextBlock',
      props: {
        content: '<div style="text-align:center;font-size:12px;color:#666;"><p>Adres: Bağdat Caddesi / İstanbul · Instagram: @novawear</p><p>© 2026 NOVA.WEAR · Moda / Stil / Deneysel Vitrin</p></div>',
        align: 'center',
        size: '12px',
      },
    },
  ],
};